import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";

vi.mock("@/lib/authStorage", () => ({ authStorage: { getToken: () => "t" } }));
vi.mock("@/lib/quota", () => ({ parseQuotaError: () => null }));
vi.mock("@/extensions/registry", () => ({ notifyRunFinished: vi.fn() }));

import { useStreaming } from "../useStreaming";

// Builds a fetch that streams the given SSE events, then closes.
function fakeFetch(events) {
  return vi.fn(async () => {
    const encoder = new TextEncoder();
    let i = 0;
    const body = new ReadableStream({
      pull(controller) {
        if (i < events.length) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(events[i++])}\n\n`));
        } else {
          controller.close();
        }
      },
    });
    return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
  });
}

const adkText = (text) => ({ content: { role: "model", parts: [{ text }] } });

describe("useStreaming — accumulated-text deduplication", () => {
  it("does not double a turn that opens with a short word", async () => {
    // ADK restates the whole turn on every event.
    global.fetch = fakeFetch([adkText("Je"), adkText("Je vais"), adkText("Je vais bien."), adkText("Je vais bien.")]);
    const { result } = renderHook(() => useStreaming());
    let out = "";
    await result.current.startStreaming({
      agentId: "a",
      userId: "u",
      sessionId: "s",
      message: { role: "user", parts: [{ text: "hi" }] },
      onChunk: (c) => (out += c),
      onComplete: () => {},
      onError: (e) => {
        throw e;
      },
    });
    expect(out).toBe("Je vais bien.");
  });

  it("still handles a new turn after a tool call", async () => {
    global.fetch = fakeFetch([
      adkText("Oui"),
      adkText("Oui, je cherche."),
      { content: { parts: [{ functionCall: { name: "search", args: {} } }] } },
      { content: { parts: [{ functionResponse: { name: "search", response: { ok: true } } }] } },
      adkText("Voici"),
      adkText("Voici le résultat."),
    ]);
    const { result } = renderHook(() => useStreaming());
    let out = "";
    await result.current.startStreaming({
      agentId: "a",
      userId: "u",
      sessionId: "s",
      message: { role: "user", parts: [{ text: "hi" }] },
      onChunk: (c) => (out += c),
      onToolCall: () => {},
      onToolResult: () => {},
      onComplete: () => {},
      onError: (e) => {
        throw e;
      },
    });
    expect(out).toBe("Oui, je cherche.Voici le résultat.");
  });

  it("reports a user Stop as an interruption, not an error", async () => {
    global.fetch = vi.fn((url, { signal }) =>
      new Promise((_, reject) => {
        signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
      }),
    );
    const { result } = renderHook(() => useStreaming());
    const onComplete = vi.fn();
    const onError = vi.fn();
    const p = result.current.startStreaming({
      agentId: "a",
      userId: "u",
      sessionId: "s",
      message: { role: "user", parts: [{ text: "hi" }] },
      onChunk: () => {},
      onComplete,
      onError,
    });
    result.current.abortStreaming();
    await p;
    expect(onComplete).toHaveBeenCalledWith({ interrupted: true });
    expect(onError).not.toHaveBeenCalled();
  });
});
