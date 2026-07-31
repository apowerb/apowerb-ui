import { describe, it, expect, vi } from "vitest";
import { processSSEBlock } from "../useStreaming";

// Regression for "ReferenceError: onError is not defined" — processSSEBlock
// referenced onError without destructuring it from `callbacks`, so the
// "session not found" branch crashed the whole stream.
describe("processSSEBlock — error events", () => {
  it("does NOT throw when a session-not-found error arrives without an onError callback", () => {
    const onChunk = vi.fn();
    expect(() =>
      processSSEBlock('data: {"error":"session not found"}', { onChunk }),
    ).not.toThrow();
    // The user still gets the friendly warning in the transcript.
    expect(onChunk).toHaveBeenCalledTimes(1);
    expect(onChunk.mock.calls[0][0]).toMatch(/session expired/i);
  });

  it("surfaces a session-not-found error to onError when provided", () => {
    const onChunk = vi.fn();
    const onError = vi.fn();
    processSSEBlock('data: {"error":"session not found"}', { onChunk, onError });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith({
      code: "session_expired",
      message: "session not found",
    });
  });

  it("routes a generic backend error to onChunk only (no onError)", () => {
    const onChunk = vi.fn();
    const onError = vi.fn();
    processSSEBlock('data: {"error":"boom"}', { onChunk, onError });
    expect(onChunk).toHaveBeenCalledTimes(1);
    expect(onChunk.mock.calls[0][0]).toMatch(/boom/);
    expect(onError).not.toHaveBeenCalled();
  });

  it("still dispatches a normal thinking event", () => {
    const onThinking = vi.fn();
    processSSEBlock('data: {"type":"thinking","text":"hmm"}', { onThinking });
    expect(onThinking).toHaveBeenCalledWith("hmm");
  });
});
