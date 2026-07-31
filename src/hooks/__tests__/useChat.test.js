import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mockDispatch = vi.fn();
const mockPersist = vi.fn();
const mockStartStreaming = vi.fn();
const mockAbortStreaming = vi.fn();
const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

let mockState;

vi.mock("@/contexts/ChatContext", () => {
  return {
    ACTIONS: {
      ADD_MESSAGE: "ADD_MESSAGE",
      SET_LOADING: "SET_LOADING",
      CLEAR_ERROR: "CLEAR_ERROR",
      UPDATE_ACTION_CARD: "UPDATE_ACTION_CARD",
      FINISH_STREAMING: "FINISH_STREAMING",
      SET_ERROR: "SET_ERROR",
      ADD_ACTION_CARD: "ADD_ACTION_CARD",
      APPEND_TO_STREAMING: "APPEND_TO_STREAMING",
      APPEND_THINKING: "APPEND_THINKING",
      MOVE_CONTENT_TO_THINKING: "MOVE_CONTENT_TO_THINKING",
      PROMOTE_THINKING_TO_CONTENT: "PROMOTE_THINKING_TO_CONTENT",
      ADD_TOOL_CALL: "ADD_TOOL_CALL",
      SET_TOOL_RESULT: "SET_TOOL_RESULT",
      SET_MESSAGE_META: "SET_MESSAGE_META",
      ADD_INTEGRATION_REQUEST: "ADD_INTEGRATION_REQUEST",
      UPDATE_UPLOAD_PROGRESS: "UPDATE_UPLOAD_PROGRESS",
    },
    useChatContext: () => ({
      state: mockState,
      dispatch: mockDispatch,
      persistToStorage: mockPersist,
    }),
  };
});

vi.mock("../useStreaming", () => ({
  useStreaming: () => ({
    startStreaming: mockStartStreaming,
    abortStreaming: mockAbortStreaming,
  }),
}));

vi.mock("@/lib/api", () => ({
  uploadFileChunked: vi.fn(),
  generateTitle: vi.fn(() => Promise.resolve({ title: "" })),
}));

vi.mock("@/components/Toast", () => ({
  useToast: () => mockToast,
}));

import { useChat } from "../useChat";

function buildState({ cardStatus = "pending" } = {}) {
  const sessionId = "sess_1";
  const messageId = "msg_1";
  const cardId = "card_1";
  const session = {
    id: sessionId,
    agentId: "agent_1",
    agentName: "Scout",
    userId: "user@example.com",
    messages: [
      {
        id: messageId,
        role: "assistant",
        content: "",
        actionCards: [
          {
            id: cardId,
            kind: "user_input",
            status: cardStatus,
            data: { input_type: "text", question: "Q?" },
          },
        ],
      },
    ],
  };
  return {
    sessionId,
    messageId,
    cardId,
    state: {
      activeSessionId: sessionId,
      sessions: new Map([[sessionId, session]]),
      isLoading: false,
      streamingMessageId: null,
      error: null,
    },
  };
}

describe("useChat.respondToActionCard", () => {
  beforeEach(() => {
    mockDispatch.mockClear();
    mockPersist.mockClear();
    mockStartStreaming.mockClear();
    mockAbortStreaming.mockClear();
    mockToast.success.mockClear();
  });

  it("dispatches UPDATE_ACTION_CARD when the card is pending", () => {
    const { state, messageId, cardId } = buildState({ cardStatus: "pending" });
    mockState = state;

    const { result } = renderHook(() => useChat());
    act(() => {
      result.current.respondToActionCard(messageId, cardId, "hello", {
        sendFollowup: false,
      });
    });

    const updateCall = mockDispatch.mock.calls.find(
      (c) => c[0]?.type === "UPDATE_ACTION_CARD",
    );
    expect(updateCall).toBeDefined();
    expect(updateCall[0].payload).toMatchObject({
      messageId,
      cardId,
      updates: { status: "cancelled", response: "hello" },
    });
  });

  it("does NOT dispatch when the card is already done and warns instead", () => {
    const { state, messageId, cardId } = buildState({ cardStatus: "done" });
    mockState = state;

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { result } = renderHook(() => useChat());
    act(() => {
      result.current.respondToActionCard(messageId, cardId, "hello");
    });

    const updateCall = mockDispatch.mock.calls.find(
      (c) => c[0]?.type === "UPDATE_ACTION_CARD",
    );
    expect(updateCall).toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("does NOT dispatch when the card is unknown and warns", () => {
    const { state, messageId } = buildState();
    mockState = state;

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { result } = renderHook(() => useChat());
    act(() => {
      result.current.respondToActionCard(messageId, "unknown_card", "hello");
    });

    const updateCall = mockDispatch.mock.calls.find(
      (c) => c[0]?.type === "UPDATE_ACTION_CARD",
    );
    expect(updateCall).toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("skips MOVE_CONTENT_TO_THINKING when the tool is an action card", async () => {
    const { state, messageId } = buildState({ cardStatus: "pending" });
    mockState = state;

    let capturedOnToolCall;
    mockStartStreaming.mockImplementation(async (opts) => {
      capturedOnToolCall = opts.onToolCall;
    });

    const { result } = renderHook(() => useChat());
    await act(async () => {
      await result.current.sendMessage("hi");
    });
    act(() => {
      capturedOnToolCall({ name: "request_user_input", args: { question: "Quelle est la suite ?" } });
    });

    const moveCalls = mockDispatch.mock.calls.filter(
      (c) => c[0]?.type === "MOVE_CONTENT_TO_THINKING",
    );
    expect(moveCalls).toHaveLength(0);
  });

  it("still dispatches MOVE_CONTENT_TO_THINKING for non-action-card tools", async () => {
    const { state } = buildState({ cardStatus: "pending" });
    mockState = state;

    let capturedOnToolCall;
    mockStartStreaming.mockImplementation(async (opts) => {
      capturedOnToolCall = opts.onToolCall;
    });

    const { result } = renderHook(() => useChat());
    await act(async () => {
      await result.current.sendMessage("hi");
    });
    act(() => {
      capturedOnToolCall({ name: "tool_get_next_contact", args: {} });
    });

    const moveCalls = mockDispatch.mock.calls.filter(
      (c) => c[0]?.type === "MOVE_CONTENT_TO_THINKING",
    );
    expect(moveCalls).toHaveLength(1);
  });

  it("flags the followup user message as synthetic when sendFollowup=true", async () => {
    const { state, messageId, cardId } = buildState({ cardStatus: "pending" });
    mockState = state;
    mockStartStreaming.mockResolvedValue(undefined);

    const { result } = renderHook(() => useChat());
    await act(async () => {
      result.current.respondToActionCard(messageId, cardId, "hello", {
        sendFollowup: true,
      });
    });

    const addMessageCalls = mockDispatch.mock.calls.filter(
      (c) => c[0]?.type === "ADD_MESSAGE",
    );
    const userAddCall = addMessageCalls.find(
      (c) => c[0].payload.message.role === "user",
    );
    expect(userAddCall).toBeDefined();
    expect(userAddCall[0].payload.message.isSynthetic).toBe(true);
  });
});
