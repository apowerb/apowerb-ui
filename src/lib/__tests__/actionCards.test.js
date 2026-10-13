import { describe, it, expect, vi } from "vitest";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/lib/chatStorage", () => ({ chatStorage: { setUserId() {}, load: () => null, save() {} } }));

import { chatReducer, initialState, ACTIONS } from "@/contexts/ChatContext";
import { dropRefusedCard } from "@/lib/actionCards";

const S = "s1";
const M = "a1";

function seed() {
  const sessions = new Map();
  sessions.set(S, {
    id: S,
    agentId: "agent1",
    messages: [{ id: M, role: "assistant", content: "", toolCalls: [], steps: [], actionCards: [] }],
  });
  return { ...initialState, sessions, activeSessionId: S };
}

const cards = (state) => state.sessions.get(S).messages[0].actionCards;

function embed(result) {
  const call = { name: "embed_chart", args: { chart_id: "c1" } };
  return [
    { type: ACTIONS.ADD_ACTION_CARD, payload: { sessionId: S, messageId: M, card: { id: "k1", kind: "chart_embed", status: "pending", data: call.args } } },
    { type: ACTIONS.ADD_TOOL_CALL, payload: { sessionId: S, messageId: M, toolCall: call } },
    { type: ACTIONS.SET_TOOL_RESULT, payload: { sessionId: S, messageId: M, toolName: "embed_chart", result } },
  ].reduce((st, a) => chatReducer(st, a), seed());
}

describe("action card refused by its tool (PROD 13/10: 404 chart card)", () => {
  it("removes the chart card when embed_chart refuses the chart id", () => {
    expect(cards(embed({ success: false, error: "No chart with id 'c1' exists." }))).toEqual([]);
  });

  it("keeps the chart card when embed_chart displays it", () => {
    expect(cards(embed({ status: "displayed", kind: "chart_embed" }))).toHaveLength(1);
  });

  it("reads an ADK-wrapped result and an error status", () => {
    const card = { id: "k1", kind: "chart_embed", status: "pending" };
    expect(dropRefusedCard([card], "embed_chart", { result: { success: false } })).toEqual([]);
    expect(dropRefusedCard([card], "embed_chart", { status: "error" })).toEqual([]);
  });

  it("only drops the last pending card of that tool's kind", () => {
    const done = { id: "k0", kind: "chart_embed", status: "done" };
    const other = { id: "k2", kind: "user_input", status: "pending" };
    const last = { id: "k1", kind: "chart_embed", status: "pending" };
    expect(dropRefusedCard([done, other, last], "embed_chart", { success: false })).toEqual([done, other]);
    expect(dropRefusedCard([other], "request_user_input", null)).toEqual([other]);
  });
});
