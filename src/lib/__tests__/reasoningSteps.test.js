import { describe, it, expect } from "vitest";
import {
  appendThinkingStep,
  closeThinkingStep,
  closeOpenSteps,
  addToolStep,
  setToolStepResult,
  addHandoffStep,
  isToolResultError,
  deriveSteps,
  deriveMessageStatus,
  summarizeSteps,
  formatDuration,
} from "../reasoningSteps";

describe("step accumulation", () => {
  it("merges consecutive thinking into one step and opens a new one after a tool", () => {
    let steps = appendThinkingStep([], "Let me ", 1000);
    steps = appendThinkingStep(steps, "think.", 1010);
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({ kind: "thinking", text: "Let me think.", startedAt: 1000 });
    expect(steps[0].endedAt).toBeUndefined();

    steps = addToolStep(steps, { name: "search", args: { q: "x" } }, 1500);
    expect(steps).toHaveLength(2);
    expect(steps[0].endedAt).toBe(1500); // the thought closed when the tool began
    expect(steps[1]).toMatchObject({ kind: "tool", name: "search", status: "running", startedAt: 1500 });

    steps = appendThinkingStep(steps, "Now the answer.", 1600);
    expect(steps).toHaveLength(3);
    expect(steps[2].kind).toBe("thinking");
  });

  it("attaches the result to the last running step of that tool, with a status", () => {
    let steps = addToolStep([], { name: "db" }, 100);
    steps = addToolStep(steps, { name: "db" }, 200);
    steps = setToolStepResult(steps, "db", { rows: 3 }, 300);
    expect(steps[1]).toMatchObject({ status: "done", endedAt: 300, result: { rows: 3 } });
    expect(steps[0].status).toBe("running");
    steps = setToolStepResult(steps, "db", { error: "boom" }, 400);
    expect(steps[0]).toMatchObject({ status: "error", endedAt: 400 });
  });

  it("ignores a result for a tool that never ran", () => {
    const steps = addToolStep([], { name: "a" }, 1);
    expect(setToolStepResult(steps, "zzz", {}, 2)).toBe(steps);
  });

  it("closes everything still open when the turn ends", () => {
    let steps = appendThinkingStep([], "…", 1);
    steps = addToolStep(steps, { name: "slow" }, 2);
    const closed = closeOpenSteps(steps, 9, { toolStatus: "interrupted" });
    expect(closed[0].endedAt).toBe(2);
    expect(closed[1]).toMatchObject({ status: "interrupted", endedAt: 9 });
    // Nothing open → same array back (no needless re-render).
    expect(closeOpenSteps(closed, 10)).toBe(closed);
    expect(closeThinkingStep(closed, 10)).toBe(closed);
  });

  it("records hand-offs as closed steps", () => {
    const steps = addHandoffStep([], { from: "planner", to: "coder", reason: "code" }, 5);
    expect(steps[0]).toMatchObject({ kind: "handoff", from: "planner", to: "coder", startedAt: 5, endedAt: 5 });
  });
});

describe("isToolResultError", () => {
  it("recognises the usual failure shapes and nothing else", () => {
    expect(isToolResultError({ error: "x" })).toBe(true);
    expect(isToolResultError({ success: false })).toBe(true);
    expect(isToolResultError({ status: "failed" })).toBe(true);
    expect(isToolResultError("Error: nope")).toBe(true);
    expect(isToolResultError({ status: "ok", rows: [] })).toBe(false);
    expect(isToolResultError("all good")).toBe(false);
    expect(isToolResultError(null)).toBe(false);
  });
});

describe("deriveSteps (legacy messages)", () => {
  it("returns the stored steps when present", () => {
    const steps = [{ id: "s", kind: "thinking", text: "t" }];
    expect(deriveSteps({ steps })).toBe(steps);
  });

  it("rebuilds thought → tools → hand-offs from the legacy fields", () => {
    const msg = {
      id: "m1",
      thinking: "hmm",
      toolCalls: [{ name: "a", args: {}, result: { ok: true } }, { name: "b", args: {}, result: { error: "e" } }],
      handoffs: [{ from: "x", to: "y" }],
      timestamp: 10,
    };
    const steps = deriveSteps(msg);
    expect(steps.map((s) => s.kind)).toEqual(["thinking", "tool", "tool", "handoff"]);
    expect(steps[1].status).toBe("done");
    expect(steps[2].status).toBe("error");
  });

  it("keeps a tool without result running while the message streams", () => {
    const steps = deriveSteps({ id: "m", toolCalls: [{ name: "a" }], isStreaming: true });
    expect(steps[0].status).toBe("running");
    expect(deriveSteps({ id: "m", toolCalls: [{ name: "a" }] })[0].status).toBe("done");
  });
});

describe("deriveMessageStatus", () => {
  it("trusts an explicit status, otherwise derives it", () => {
    expect(deriveMessageStatus({ status: "interrupted", content: "x" })).toBe("interrupted");
    expect(deriveMessageStatus({ role: "assistant", isStreaming: true })).toBe("streaming");
    expect(deriveMessageStatus({ role: "assistant", error: "boom" })).toBe("error");
    expect(deriveMessageStatus({ role: "assistant", content: "  " })).toBe("empty");
    expect(deriveMessageStatus({ role: "assistant", content: "", toolCalls: [{ name: "a" }] })).toBe("done");
    expect(deriveMessageStatus({ role: "assistant", content: "", actionCards: [{ id: "c" }] })).toBe("done");
    expect(deriveMessageStatus({ role: "user", content: "" })).toBe("done");
    expect(deriveMessageStatus(null)).toBe("done");
  });
});

describe("summarizeSteps / formatDuration", () => {
  it("counts kinds and measures the span, extending to `now` while open", () => {
    const steps = [
      { kind: "thinking", startedAt: 1000, endedAt: 2000 },
      { kind: "tool", status: "error", startedAt: 2000, endedAt: 4500 },
      { kind: "tool", status: "running", startedAt: 4500 },
    ];
    const s = summarizeSteps(steps, 6000);
    expect(s).toMatchObject({ total: 3, thinking: 1, tools: 2, toolErrors: 1, handoffs: 0, open: true, durationMs: 5000 });
    expect(summarizeSteps([]).durationMs).toBe(0);
  });

  it("formats durations for humans", () => {
    expect(formatDuration(0)).toBe("");
    expect(formatDuration(850)).toBe("850ms");
    expect(formatDuration(4200)).toBe("4.2s");
    expect(formatDuration(42_000)).toBe("42s");
    expect(formatDuration(65_000)).toBe("1m 05s");
  });
});
