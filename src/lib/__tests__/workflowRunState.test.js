import { describe, it, expect } from "vitest";
import { createRunState, applyRunEvent, runStatusByNodeId } from "@/lib/workflowRunState";

function reduce(events) {
  return events.reduce(applyRunEvent, createRunState());
}

describe("applyRunEvent — plain (non-loop) nodes", () => {
  it("tracks run_started, node lifecycle, and the done terminal", () => {
    const state = reduce([
      { event: "run_started", workflow_id: "w1" },
      { event: "node_start", node_id: "trigger1", type: "trigger" },
      { event: "node_complete", node_id: "trigger1", output: { ok: true }, duration_ms: 3 },
      { event: "node_start", node_id: "router1", type: "router" },
      { event: "route", node_id: "router1", route: "yes" },
      { event: "node_complete", node_id: "router1", output: {}, duration_ms: 1 },
      { event: "done", output: { final: 1 } },
    ]);

    expect(state.status).toBe("done");
    expect(state.finalOutput).toEqual({ final: 1 });
    expect(state.timeline.map((e) => e.id)).toEqual(["trigger1", "router1"]);

    const trigger = state.timeline[0];
    expect(trigger.status).toBe("done");
    expect(trigger.output).toEqual({ ok: true });
    expect(trigger.duration).toBe(3);

    const router = state.timeline[1];
    expect(router.route).toBe("yes");
    expect(router.status).toBe("done");
  });

  it("marks a node as errored and stops there, and never mutates the previous state object", () => {
    const s0 = createRunState();
    const s1 = applyRunEvent(s0, { event: "node_start", node_id: "tool1", type: "tool" });
    const s2 = applyRunEvent(s1, { event: "node_error", node_id: "tool1", detail: "boom" });
    const s3 = applyRunEvent(s2, { event: "error", detail: "boom" });

    expect(s0.timeline).toEqual([]); // untouched
    expect(s1.timeline[0].status).toBe("running");
    expect(s2.timeline[0]).toMatchObject({ status: "error", error: { detail: "boom" } });
    expect(s3.status).toBe("error");
    expect(s3.finalError).toEqual({ code: null, detail: "boom", ref: null });
  });

  it("exposes a flat nodeId -> status map for canvas coloring", () => {
    const state = reduce([
      { event: "node_start", node_id: "agentA" },
      { event: "node_complete", node_id: "agentA", output: 1, duration_ms: 5 },
      { event: "node_start", node_id: "agentB" },
    ]);
    expect(runStatusByNodeId(state)).toEqual({ agentA: "done", agentB: "running" });
  });
});

describe("applyRunEvent — loop nodes", () => {
  it("groups nested loopId.innerId events by iteration under the loop's own entry", () => {
    const state = reduce([
      { event: "node_start", node_id: "loop1", type: "loop" },
      { event: "node_start", node_id: "loop1.trigger1", iteration: 0 },
      { event: "node_complete", node_id: "loop1.trigger1", iteration: 0, output: { item: "a" }, duration_ms: 1 },
      { event: "node_start", node_id: "loop1.agentA", iteration: 0 },
      { event: "node_complete", node_id: "loop1.agentA", iteration: 0, output: "done-a", duration_ms: 12 },
      { event: "node_start", node_id: "loop1.trigger1", iteration: 1 },
      { event: "node_complete", node_id: "loop1.trigger1", iteration: 1, output: { item: "b" }, duration_ms: 1 },
      { event: "node_complete", node_id: "loop1", output: ["done-a", "done-b"], duration_ms: 20 },
    ]);

    const loop = state.timeline.find((e) => e.id === "loop1");
    expect(loop.status).toBe("done"); // the loop's own node_complete is authoritative, not "running" from the last inner event
    expect(loop.output).toEqual(["done-a", "done-b"]);
    expect(Object.keys(loop.iterations)).toEqual(["0", "1"]);
    expect(loop.iterations[0].map((i) => i.innerId)).toEqual(["trigger1", "agentA"]);
    expect(loop.iterations[0][1]).toMatchObject({ status: "done", output: "done-a", duration: 12 });
    expect(loop.iterations[1][0]).toMatchObject({ innerId: "trigger1", output: { item: "b" } });

    // Only the loop node itself appears at the top level — inner ids never leak into the flat map.
    expect(Object.keys(runStatusByNodeId(state))).toEqual(["loop1"]);
  });

  it("marks the loop errored when any inner node errors, even mid-iteration", () => {
    const state = reduce([
      { event: "node_start", node_id: "loop1" },
      { event: "node_start", node_id: "loop1.agentA", iteration: 2 },
      { event: "node_error", node_id: "loop1.agentA", iteration: 2, detail: "rate limited" },
    ]);
    const loop = state.timeline.find((e) => e.id === "loop1");
    expect(loop.status).toBe("error");
    expect(loop.iterations[2][0]).toMatchObject({ status: "error", error: { detail: "rate limited" } });
  });

  it("records loop_capped on the loop's entry without needing a prior node_start", () => {
    const state = reduce([
      { event: "loop_capped", node_id: "loop1", max_iterations: 10, remaining: null },
    ]);
    const loop = state.timeline.find((e) => e.id === "loop1");
    expect(loop.capped).toEqual({ max: 10, remaining: null });
  });

  it("defaults a missing iteration field to 0 rather than dropping the event", () => {
    const state = reduce([
      { event: "node_start", node_id: "loop1.trigger1" },
      { event: "node_complete", node_id: "loop1.trigger1", output: 1, duration_ms: 1 },
    ]);
    const loop = state.timeline.find((e) => e.id === "loop1");
    expect(loop.iterations[0]).toHaveLength(1);
  });
});
