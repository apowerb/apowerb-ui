import { describe, it, expect, vi } from "vitest";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/lib/chatStorage", () => ({ chatStorage: { setUserId() {}, load: () => null, save() {} } }));

import { chatReducer, initialState, ACTIONS } from "../ChatContext";

const S = "s1";
const M = "a1";

function seed() {
  const sessions = new Map();
  sessions.set(S, {
    id: S,
    agentId: "agent1",
    messages: [
      { id: "u1", role: "user", content: "hello", timestamp: 1 },
      { id: M, role: "assistant", content: "", thinking: "", toolCalls: [], steps: [], isStreaming: true, meta: { startTime: 1 } },
    ],
  });
  return { ...initialState, sessions, activeSessionId: S, streamingMessageId: M, isLoading: true };
}

const msg = (state) => state.sessions.get(S).messages.find((m) => m.id === M);

function play(state, actions) {
  return actions.reduce((st, a) => chatReducer(st, a), state);
}

describe("chatReducer — reasoning trail", () => {
  it("records thinking, tool calls and results as ordered steps", () => {
    const st = play(seed(), [
      { type: ACTIONS.APPEND_THINKING, payload: { sessionId: S, messageId: M, thinking: "Plan: " } },
      { type: ACTIONS.APPEND_THINKING, payload: { sessionId: S, messageId: M, thinking: "search first." } },
      { type: ACTIONS.ADD_TOOL_CALL, payload: { sessionId: S, messageId: M, toolCall: { name: "search", args: { q: "x" } } } },
      { type: ACTIONS.SET_TOOL_RESULT, payload: { sessionId: S, messageId: M, toolName: "search", result: { hits: 2 } } },
      { type: ACTIONS.APPEND_TO_STREAMING, payload: { sessionId: S, messageId: M, content: "Found 2 hits." } },
    ]);
    const m = msg(st);
    expect(m.steps.map((s) => s.kind)).toEqual(["thinking", "tool"]);
    expect(m.steps[0].text).toBe("Plan: search first.");
    expect(m.steps[0].endedAt).toBeDefined();
    expect(m.steps[1]).toMatchObject({ name: "search", status: "done", result: { hits: 2 } });
    expect(m.toolCalls[0]).toMatchObject({ name: "search", status: "done", result: { hits: 2 } });
    expect(typeof m.toolCalls[0].durationMs).toBe("number");
    // Legacy fields keep working for older consumers.
    expect(m.thinking).toBe("Plan: search first.");
    expect(m.content).toBe("Found 2 hits.");
  });

  it("moves intermediate text into the trail as thinking, and drops it when promoted", () => {
    const st = play(seed(), [
      { type: ACTIONS.APPEND_TO_STREAMING, payload: { sessionId: S, messageId: M, content: "Let me check…" } },
      { type: ACTIONS.MOVE_CONTENT_TO_THINKING, payload: { sessionId: S, messageId: M } },
      { type: ACTIONS.ADD_TOOL_CALL, payload: { sessionId: S, messageId: M, toolCall: { name: "db" } } },
    ]);
    expect(msg(st).content).toBe("");
    expect(msg(st).steps.map((s) => s.kind)).toEqual(["thinking", "tool"]);
    expect(msg(st).steps[0].text).toBe("Let me check…");

    // A turn whose only text was "thought" promotes it to the answer and
    // removes it from the trail, so nothing is shown twice.
    const st2 = play(seed(), [
      { type: ACTIONS.APPEND_THINKING, payload: { sessionId: S, messageId: M, thinking: "The answer is 42." } },
      { type: ACTIONS.PROMOTE_THINKING_TO_CONTENT, payload: { sessionId: S, messageId: M } },
    ]);
    expect(msg(st2).content).toBe("The answer is 42.");
    expect(msg(st2).steps).toEqual([]);
  });
});

describe("chatReducer — turn outcome", () => {
  it("marks a turn with no visible output as empty", () => {
    const st = chatReducer(seed(), { type: ACTIONS.FINISH_STREAMING, payload: { sessionId: S, messageId: M } });
    expect(msg(st)).toMatchObject({ isStreaming: false, status: "empty", error: null });
    expect(st.streamingMessageId).toBeNull();
    expect(st.isLoading).toBe(false);
  });

  it("marks a turn as done when it produced text, a tool call or a card", () => {
    const withText = play(seed(), [
      { type: ACTIONS.APPEND_TO_STREAMING, payload: { sessionId: S, messageId: M, content: "hi" } },
      { type: ACTIONS.FINISH_STREAMING, payload: { sessionId: S, messageId: M } },
    ]);
    expect(msg(withText).status).toBe("done");
    const withCard = play(seed(), [
      { type: ACTIONS.ADD_ACTION_CARD, payload: { sessionId: S, messageId: M, card: { id: "c1", kind: "user_input", status: "pending" } } },
      { type: ACTIONS.FINISH_STREAMING, payload: { sessionId: S, messageId: M } },
    ]);
    expect(msg(withCard).status).toBe("done");
  });

  it("keeps partial content and flags an interrupted turn, closing running tools", () => {
    const st = play(seed(), [
      { type: ACTIONS.APPEND_TO_STREAMING, payload: { sessionId: S, messageId: M, content: "Half of the" } },
      { type: ACTIONS.ADD_TOOL_CALL, payload: { sessionId: S, messageId: M, toolCall: { name: "slow" } } },
      { type: ACTIONS.FINISH_STREAMING, payload: { sessionId: S, messageId: M, outcome: "interrupted" } },
    ]);
    const m = msg(st);
    expect(m.status).toBe("interrupted");
    expect(m.content).toBe("Half of the");
    expect(typeof m.interruptedAt).toBe("number");
    expect(m.steps.find((s) => s.kind === "tool").status).toBe("interrupted");
  });

  it("stores the error message on an errored turn and clears transient info", () => {
    const st = play(seed(), [
      { type: ACTIONS.SET_STREAM_INFO, payload: { kind: "rate_limit_retry", delaySeconds: 5 } },
      { type: ACTIONS.FINISH_STREAMING, payload: { sessionId: S, messageId: M, outcome: "error", error: "HTTP 502" } },
    ]);
    expect(msg(st)).toMatchObject({ status: "error", error: "HTTP 502" });
    expect(st.streamInfo).toBeNull();
  });

  it("clears stream info as soon as content flows again", () => {
    const st = play(seed(), [
      { type: ACTIONS.SET_STREAM_INFO, payload: { kind: "rate_limit_retry", delaySeconds: 5 } },
      { type: ACTIONS.APPEND_TO_STREAMING, payload: { sessionId: S, messageId: M, content: "…" } },
    ]);
    expect(st.streamInfo).toBeNull();
  });
});

describe("chatReducer — regenerate & branches", () => {
  it("keeps the previous answer as a branch and streams into a fresh one", () => {
    const done = play(seed(), [
      { type: ACTIONS.APPEND_TO_STREAMING, payload: { sessionId: S, messageId: M, content: "First answer" } },
      { type: ACTIONS.FINISH_STREAMING, payload: { sessionId: S, messageId: M } },
    ]);
    const regen = chatReducer(done, { type: ACTIONS.REGENERATE_MESSAGE, payload: { sessionId: S, messageId: M } });
    const m = msg(regen);
    expect(m).toMatchObject({ content: "", isStreaming: true, status: "streaming", _activeBranch: 1 });
    expect(m._branches).toHaveLength(2);
    expect(m._branches[0].content).toBe("First answer");
    expect(regen.streamingMessageId).toBe(M);
    expect(regen.isLoading).toBe(true);

    const second = play(regen, [
      { type: ACTIONS.APPEND_TO_STREAMING, payload: { sessionId: S, messageId: M, content: "Second answer" } },
      { type: ACTIONS.FINISH_STREAMING, payload: { sessionId: S, messageId: M } },
    ]);
    expect(msg(second)._branches[1].content).toBe("Second answer");
    expect(msg(second).content).toBe("Second answer");

    // Navigate back to the first answer, then forward again.
    const back = chatReducer(second, { type: ACTIONS.SET_BRANCH_INDEX, payload: { sessionId: S, messageId: M, index: 0 } });
    expect(msg(back)).toMatchObject({ content: "First answer", _activeBranch: 0, isStreaming: false });
    const fwd = chatReducer(back, { type: ACTIONS.SET_BRANCH_INDEX, payload: { sessionId: S, messageId: M, index: 1 } });
    expect(msg(fwd).content).toBe("Second answer");
  });

  it("ignores an out-of-range branch and never swaps under a live stream", () => {
    const done = play(seed(), [
      { type: ACTIONS.FINISH_STREAMING, payload: { sessionId: S, messageId: M } },
      { type: ACTIONS.REGENERATE_MESSAGE, payload: { sessionId: S, messageId: M } },
    ]);
    const live = chatReducer(done, { type: ACTIONS.SET_BRANCH_INDEX, payload: { sessionId: S, messageId: M, index: 0 } });
    expect(msg(live)._activeBranch).toBe(1);
    const finished = chatReducer(done, { type: ACTIONS.FINISH_STREAMING, payload: { sessionId: S, messageId: M } });
    const oob = chatReducer(finished, { type: ACTIONS.SET_BRANCH_INDEX, payload: { sessionId: S, messageId: M, index: 7 } });
    expect(msg(oob)._activeBranch).toBe(1);
  });

  it("SET_MESSAGE_STATUS updates status and error in place", () => {
    const st = chatReducer(seed(), { type: ACTIONS.SET_MESSAGE_STATUS, payload: { sessionId: S, messageId: M, status: "error", error: "boom" } });
    expect(msg(st)).toMatchObject({ status: "error", error: "boom" });
  });
});
