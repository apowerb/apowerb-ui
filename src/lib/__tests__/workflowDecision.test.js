/**
 * Human decision node (phase 1): SSE terminal event, run-state reducer, and
 * the local validation / routes of an `approval` node. Contract: the engine's
 * `awaiting_input` event, `approval_*` codes and `replayed` flag.
 */
import { describe, it, expect } from "vitest";
import { applyRunEvent, createRunState, runStatusByNodeId } from "@/lib/workflowRunState";
import { isTerminalEvent, TERMINAL_EVENTS } from "@/lib/workflowSse";
import {
  validateGraphLocal,
  approvalRoutes,
  createNode,
  isRunnableType,
  templateSuggestionsFor,
} from "@/lib/workflowGraph";

const reduce = (events, from = createRunState()) => events.reduce(applyRunEvent, from);

const AWAITING = {
  event: "awaiting_input",
  run_id: "r1",
  node_id: "decision1",
  question: "Valider ? Plan A",
  mode: "both",
  choices: [{ route: "oui", label: "Oui" }, { route: "non", label: "Non" }],
  assignee: "bob@example.com",
};

describe("awaiting_input — SSE", () => {
  it("ends the stream like done/error/cancelled", () => {
    expect(TERMINAL_EVENTS.has("awaiting_input")).toBe(true);
    expect(isTerminalEvent({ event: "awaiting_input" })).toBe(true);
  });
});

describe("awaiting_input — run state", () => {
  const first = [
    { event: "run_started", run_id: "r1" },
    { event: "node_start", node_id: "trigger1", type: "trigger" },
    { event: "node_complete", node_id: "trigger1", output: { a: 1 } },
    { event: "node_start", node_id: "decision1", type: "approval" },
    AWAITING,
  ];

  it("starts without a pending decision", () => {
    expect(createRunState().pendingDecision).toBeNull();
  });

  it("goes to `awaiting` with the decision to answer, and the node stops running", () => {
    const s = reduce(first);
    expect(s.status).toBe("awaiting");
    expect(s.pendingDecision).toEqual({
      runId: "r1",
      nodeId: "decision1",
      question: "Valider ? Plan A",
      mode: "both",
      choices: [{ route: "oui", label: "Oui" }, { route: "non", label: "Non" }],
      assignee: "bob@example.com",
    });
    expect(runStatusByNodeId(s)).toEqual({ trigger1: "done", decision1: "awaiting" });
    expect(s.finalError).toBeNull();
  });

  it("does not mutate the previous state", () => {
    const before = reduce(first.slice(0, 4));
    reduce([AWAITING], before);
    expect(before.status).toBe("running");
    expect(before.timeline.find((e) => e.id === "decision1").status).toBe("running");
  });

  it("settles a stray running node as awaiting only for the decision node", () => {
    const s = reduce([
      { event: "run_started" },
      { event: "node_start", node_id: "other", type: "agent" },
      { event: "node_start", node_id: "decision1", type: "approval" },
      AWAITING,
    ]);
    expect(runStatusByNodeId(s)).toEqual({ other: "running", decision1: "awaiting" });
  });

  it("resumes: replayed nodes are flagged, the decision completes with the answer, the run ends", () => {
    const awaiting = reduce(first);
    // The caller resets the state, then feeds the resume stream.
    const resumed = reduce(
      [
        { event: "run_started", run_id: "r1" },
        { event: "node_start", node_id: "trigger1", type: "trigger", replayed: true },
        { event: "node_complete", node_id: "trigger1", output: { a: 1 }, replayed: true },
        { event: "node_start", node_id: "decision1", type: "approval", replayed: true },
        { event: "node_complete", node_id: "decision1", output: { choice: "oui", text: null, answered_by: "bob", answered_at: "t" } },
        { event: "route", node_id: "decision1", route: "oui" },
        { event: "done", output: "ok" },
      ],
      createRunState(),
    );
    expect(awaiting.status).toBe("awaiting");
    expect(resumed.status).toBe("done");
    expect(resumed.pendingDecision).toBeNull();
    const byId = Object.fromEntries(resumed.timeline.map((e) => [e.id, e]));
    expect(byId.trigger1.replayed).toBe(true);
    expect(byId.decision1.status).toBe("done");
    expect(byId.decision1.output.choice).toBe("oui");
    expect(byId.decision1.route).toBe("oui");
  });

  it("clears the pending decision when a new run starts, or the run is cancelled", () => {
    const awaiting = reduce(first);
    expect(reduce([{ event: "run_started" }], awaiting).pendingDecision).toBeNull();
    const cancelled = reduce([{ event: "cancelled" }], awaiting);
    expect(cancelled.pendingDecision).toBeNull();
    expect(cancelled.status).toBe("cancelled");
  });

  it("a later decision in the resume stream awaits again", () => {
    const s = reduce([
      { event: "run_started" },
      { event: "node_complete", node_id: "decision1", output: { choice: "oui" } },
      { event: "node_start", node_id: "decision2", type: "approval" },
      { ...AWAITING, node_id: "decision2", mode: "text", choices: [] },
    ]);
    expect(s.status).toBe("awaiting");
    expect(s.pendingDecision.nodeId).toBe("decision2");
    expect(runStatusByNodeId(s).decision1).toBe("done");
  });
});

describe("approval — routes", () => {
  it("are the choices, plus the reserved text route in mode both", () => {
    const choices = [{ route: "oui", label: "Oui" }, { route: "non", label: "Non" }];
    expect(approvalRoutes({ mode: "choices", choices })).toEqual(["oui", "non"]);
    expect(approvalRoutes({ mode: "both", choices })).toEqual(["oui", "non", "text"]);
  });
  it("do not exist in text mode (edges carry no route)", () => {
    expect(approvalRoutes({ mode: "text", choices: [{ route: "x" }] })).toBeNull();
  });
  it("ignore blank routes", () => {
    expect(approvalRoutes({ mode: "choices", choices: [{ route: "" }, { route: "a" }] })).toEqual(["a"]);
  });
});

describe("approval — node model", () => {
  it("is runnable and ships a valid-shaped default", () => {
    expect(isRunnableType("approval")).toBe(true);
    const node = createNode("approval");
    expect(node.config.mode).toBe("choices");
    expect(node.config.question).toBe("");
    expect(Array.isArray(node.config.choices)).toBe(true);
  });
  it("exposes the decision's choice and text to templates", () => {
    expect(templateSuggestionsFor({ id: "decision1", type: "approval", config: {} })).toEqual(
      expect.arrayContaining(["{{decision1}}", "{{decision1.choice}}", "{{decision1.text}}"]),
    );
  });
});

describe("approval — local validation", () => {
  const trigger = { id: "t", type: "trigger", config: {} };
  const agent = (id) => ({ id, type: "agent", config: { agent_id: "a" } });
  const yesNo = [{ route: "oui", label: "Oui" }, { route: "non", label: "Non" }];
  const decision = (config) => ({ id: "d", type: "approval", config: { question: "Valider ?", mode: "choices", choices: yesNo, ...config } });
  const codes = (r, id = "d") => r.errors.filter((e) => e.nodeId === id && e.level !== "warning").map((e) => e.message);
  const run = (config, edges) =>
    validateGraphLocal({
      nodes: [trigger, decision(config), agent("a1"), agent("a2")],
      edges: edges ?? [
        { source: "t", target: "d" },
        { source: "d", target: "a1", route: "oui" },
        { source: "d", target: "a2", route: "non" },
      ],
    });

  it("accepts a well-formed choices decision, with no notRunnable error", () => {
    const r = run({});
    expect(r.valid).toBe(true);
    expect(r.errors.some((e) => e.message.startsWith("notRunnable"))).toBe(false);
  });

  it("accepts a text decision with unrouted edges", () => {
    const r = run({ mode: "text", choices: [] }, [
      { source: "t", target: "d" },
      { source: "d", target: "a1" },
    ]);
    expect(codes(r)).toEqual([]);
    expect(r.valid).toBe(true);
  });

  it("accepts mode both when the text route is wired", () => {
    const r = run({ mode: "both" }, [
      { source: "t", target: "d" },
      { source: "d", target: "a1", route: "oui" },
      { source: "d", target: "a2", route: "text" },
    ]);
    expect(codes(r)).toEqual([]);
  });

  it("refuses an empty question", () => {
    expect(codes(run({ question: "  " }))).toContain("approvalQuestionRequired");
  });

  it("refuses an unknown or missing mode", () => {
    expect(codes(run({ mode: "vote" }))).toContain("approvalModeUnknown:vote");
    expect(codes(run({ mode: undefined }))).toContain("approvalModeUnknown:undefined");
  });

  it("refuses a choices/both decision without choices, but not a text one", () => {
    expect(codes(run({ choices: [] }, [{ source: "t", target: "d" }]))).toContain("approvalChoicesMissing");
    expect(codes(run({ mode: "both", choices: [] }, [{ source: "t", target: "d" }]))).toContain("approvalChoicesMissing");
    expect(codes(run({ mode: "text", choices: [] }, [{ source: "t", target: "d" }]))).not.toContain("approvalChoicesMissing");
  });

  it("refuses a waiting delay that is not 1 to 720 whole hours, accepts none", () => {
    for (const bad of [0, 721, 2.5, "48"]) {
      expect(codes(run({ mode: "text", expires_after_hours: bad }))).toContain("approvalExpiryInvalid");
    }
    expect(codes(run({ mode: "text", expires_after_hours: 48 }))).not.toContain("approvalExpiryInvalid");
    expect(codes(run({ mode: "text" }))).not.toContain("approvalExpiryInvalid");
  });

  it("refuses a blank choice route", () => {
    expect(codes(run({ choices: [{ route: "", label: "x" }] }, [{ source: "t", target: "d" }]))).toContain("approvalChoiceRouteRequired");
  });

  it("reserves the route name `text`", () => {
    const r = run({ choices: [{ route: "text", label: "T" }, ...yesNo] });
    expect(codes(r)).toContain("approvalChoiceReserved:text");
  });

  it("refuses two choices on the same route", () => {
    const r = run({ choices: [...yesNo, { route: "oui", label: "Encore" }] });
    expect(codes(r)).toContain("approvalChoiceDuplicate:oui");
  });

  it("requires the text route to be wired in mode both", () => {
    const r = run({ mode: "both" });
    expect(codes(r)).toContain("approvalTextRouteMissing");
    expect(r.valid).toBe(false);
  });

  it("routes work like a router: unrouted or unknown edges are refused", () => {
    const r = run({}, [
      { source: "t", target: "d" },
      { source: "d", target: "a1" },
      { source: "d", target: "a2", route: "peut-etre" },
    ]);
    expect(codes(r).some((m) => m.startsWith("missingRoute"))).toBe(true);
    expect(codes(r)).toContain("unknownRoute:peut-etre");
  });

  it("the reserved route is only valid in mode both", () => {
    const r = run({}, [
      { source: "t", target: "d" },
      { source: "d", target: "a1", route: "text" },
    ]);
    expect(codes(r)).toContain("unknownRoute:text");
  });

  it("refuses a decision inside a loop or try body", () => {
    const body = {
      version: 1,
      nodes: [{ id: "trigger1", type: "trigger", config: {} }, decision({})],
      edges: [{ source: "trigger1", target: "d" }],
    };
    for (const kind of ["loop", "try"]) {
      const config = kind === "loop" ? { mode: "foreach", items: "{{t}}", max_iterations: 3, body } : { body, retries: 0, retry_delay_ms: 0 };
      const r = validateGraphLocal({ nodes: [trigger, { id: "c", type: kind, config }], edges: [{ source: "t", target: "c" }] });
      expect(r.errors.map((e) => `${e.nodeId}:${e.message}`)).toContain("c.d:approvalNested");
    }
  });

  it("a decision nothing leads to only warns", () => {
    const r = validateGraphLocal({ nodes: [trigger, decision({ mode: "text", choices: [] })], edges: [] });
    const w = r.errors.find((e) => e.nodeId === "d" && e.message === "nodeNotConnected");
    expect(w.level).toBe("warning");
  });
});
