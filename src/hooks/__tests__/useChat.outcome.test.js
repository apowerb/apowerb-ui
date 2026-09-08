import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mockDispatch = vi.fn();
const mockStartStreaming = vi.fn();
let mockState;

vi.mock("@/contexts/ChatContext", () => ({
  ACTIONS: new Proxy({}, { get: (_, k) => String(k) }),
  useChatContext: () => ({ state: mockState, dispatch: mockDispatch, persistToStorage: vi.fn() }),
}));
vi.mock("../useStreaming", () => ({
  useStreaming: () => ({ startStreaming: mockStartStreaming, abortStreaming: vi.fn() }),
}));
vi.mock("@/lib/api", () => ({
  uploadFileChunked: vi.fn(),
  generateTitle: vi.fn(() => Promise.resolve({ title: "" })),
}));
vi.mock("@/components/Toast", () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));

import { useChat, CONTINUE_PROMPT } from "../useChat";

function state(messages = []) {
  const sessions = new Map();
  sessions.set("s1", { id: "s1", agentId: "agent1", agentName: "A", userId: "u", messages });
  return { sessions, activeSessionId: "s1", isLoading: false, streamingMessageId: null, error: null, streamInfo: null };
}

const finish = () => mockDispatch.mock.calls.map((c) => c[0]).filter((a) => a.type === "FINISH_STREAMING").pop();

describe("useChat — turn outcome", () => {
  beforeEach(() => {
    mockDispatch.mockClear();
    mockStartStreaming.mockReset();
    mockState = state();
  });

  it("finishes with outcome error when the backend fails mid-stream", async () => {
    mockStartStreaming.mockImplementation(async (cb) => {
      cb.onChunk("Half");
      cb.onStreamError({ code: "stream_error", message: "Upstream 503" });
      cb.onComplete();
    });
    const { result } = renderHook(() => useChat());
    await act(async () => {
      await result.current.sendMessage("hello");
    });
    expect(finish()).toMatchObject({ payload: { outcome: "error", error: "Upstream 503" } });
  });

  it("finishes with outcome interrupted after a Stop", async () => {
    mockStartStreaming.mockImplementation(async (cb) => {
      cb.onChunk("Half");
      cb.onComplete({ interrupted: true });
    });
    const { result } = renderHook(() => useChat());
    await act(async () => {
      await result.current.sendMessage("hello");
    });
    expect(finish()).toMatchObject({ payload: { outcome: "interrupted" } });
  });

  it("finishes with outcome done on a clean stream, and error on a thrown failure", async () => {
    mockStartStreaming.mockImplementation(async (cb) => {
      cb.onChunk("All good");
      cb.onComplete();
    });
    const { result } = renderHook(() => useChat());
    await act(async () => {
      await result.current.sendMessage("hello");
    });
    expect(finish()).toMatchObject({ payload: { outcome: "done" } });

    mockStartStreaming.mockImplementation(async (cb) => {
      cb.onError(new Error("HTTP error 502"));
    });
    await act(async () => {
      await result.current.sendMessage("again");
    });
    expect(finish()).toMatchObject({ payload: { outcome: "error", error: "HTTP error 502" } });
    // A plain failure does not raise the global banner (only quota / lost session do).
    expect(mockDispatch.mock.calls.some((c) => c[0].type === "SET_ERROR")).toBe(false);
  });

  it("regenerate replays the previous user turn into the same assistant message", async () => {
    mockState = state([
      { id: "u1", role: "user", content: "first question", sentContent: "[Uploaded files: a.pdf]\n\nfirst question" },
      { id: "a1", role: "assistant", content: "old answer", status: "done" },
    ]);
    mockStartStreaming.mockImplementation(async (cb) => {
      cb.onChunk("new answer");
      cb.onComplete();
    });
    const { result } = renderHook(() => useChat());
    await act(async () => {
      await result.current.regenerate();
    });
    const regen = mockDispatch.mock.calls.map((c) => c[0]).find((a) => a.type === "REGENERATE_MESSAGE");
    expect(regen.payload).toEqual({ sessionId: "s1", messageId: "a1" });
    expect(mockStartStreaming).toHaveBeenCalledTimes(1);
    const args = mockStartStreaming.mock.calls[0][0];
    expect(args.message.parts[0].text).toBe("[Uploaded files: a.pdf]\n\nfirst question");
    expect(finish().payload.messageId).toBe("a1");
  });

  it("continue sends a synthetic user turn", async () => {
    mockState = state([{ id: "a1", role: "assistant", content: "half", status: "interrupted" }]);
    mockStartStreaming.mockImplementation(async (cb) => cb.onComplete());
    const { result } = renderHook(() => useChat());
    await act(async () => {
      await result.current.continueResponse();
    });
    const added = mockDispatch.mock.calls.map((c) => c[0]).filter((a) => a.type === "ADD_MESSAGE");
    expect(added[0].payload.message).toMatchObject({ role: "user", content: CONTINUE_PROMPT, isSynthetic: true });
  });

  it("does nothing while a stream is running", async () => {
    mockState = { ...state([{ id: "a1", role: "assistant", content: "x" }]), streamingMessageId: "a1" };
    const { result } = renderHook(() => useChat());
    await act(async () => {
      await result.current.regenerate();
      await result.current.continueResponse();
    });
    expect(mockStartStreaming).not.toHaveBeenCalled();
  });
});
