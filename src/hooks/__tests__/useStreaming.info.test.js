import { describe, it, expect, vi } from "vitest";
import { processSSEBlock } from "../useStreaming";

describe("processSSEBlock — information and stream errors", () => {
  it("routes a rate-limit pause to onInfo without touching the transcript", () => {
    const onChunk = vi.fn();
    const onInfo = vi.fn();
    processSSEBlock('data: {"info":"rate_limit_retry","delay_seconds":5,"attempt":1,"max_attempts":2}', { onChunk, onInfo });
    expect(onInfo).toHaveBeenCalledWith({ kind: "rate_limit_retry", delaySeconds: 5, attempt: 1, maxAttempts: 2 });
    expect(onChunk).not.toHaveBeenCalled();
  });

  it("ignores an info event when nobody listens", () => {
    const onChunk = vi.fn();
    expect(() => processSSEBlock('data: {"info":"rate_limit_retry"}', { onChunk })).not.toThrow();
    expect(onChunk).not.toHaveBeenCalled();
  });

  it("hands a generic backend error to onStreamError instead of writing a warning", () => {
    const onChunk = vi.fn();
    const onStreamError = vi.fn();
    const onError = vi.fn();
    processSSEBlock('data: {"error":"boom","status":502}', { onChunk, onStreamError, onError });
    expect(onStreamError).toHaveBeenCalledWith({ code: "stream_error", message: "boom", status: 502 });
    expect(onChunk).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("still surfaces a lost session through onError, whatever else is wired", () => {
    const onChunk = vi.fn();
    const onStreamError = vi.fn();
    const onError = vi.fn();
    processSSEBlock('data: {"error":"Session not found."}', { onChunk, onStreamError, onError });
    expect(onError).toHaveBeenCalledWith({ code: "session_expired", message: "Session not found." });
    expect(onStreamError).not.toHaveBeenCalled();
  });

  it("parses the ADK tool cycle: call, then response", () => {
    const onToolCall = vi.fn();
    const onToolResult = vi.fn();
    processSSEBlock('data: {"content":{"parts":[{"functionCall":{"name":"search","args":{"q":"x"}}}]}}', { onToolCall, onToolResult, onChunk: vi.fn() });
    processSSEBlock('data: {"content":{"parts":[{"functionResponse":{"name":"search","response":{"hits":2}}}]}}', { onToolCall, onToolResult, onChunk: vi.fn() });
    expect(onToolCall).toHaveBeenCalledWith({ name: "search", args: { q: "x" } });
    expect(onToolResult).toHaveBeenCalledWith({ name: "search", result: { hits: 2 } });
  });
});
