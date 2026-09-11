import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";

vi.mock("@/lib/authStorage", () => ({ authStorage: { getToken: () => "t" } }));
vi.mock("@/lib/quota", () => ({ parseQuotaError: () => null }));
vi.mock("@/extensions/registry", () => ({ notifyRunFinished: vi.fn() }));

import { useStreaming } from "../useStreaming";

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

// One streaming delta, as LiteLlm yields them: partial=true, one part.
const delta = (text) => ({ partial: true, content: { role: "model", parts: [{ text }] } });
// The aggregated end-of-turn response: partial=false, every fragment kept as
// its own part — this is what ADK persists as the single stored event.
const aggregated = (fragments) => ({
  partial: false,
  content: { role: "model", parts: fragments.map((text) => ({ text })) },
});

async function run(events, extra = {}) {
  global.fetch = fakeFetch(events);
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
    ...extra,
  });
  return out;
}

describe("useStreaming — aggregated end-of-turn event", () => {
  // Live defect (k8s.apowerb.com, 2026-09-11): the stored model event carried
  // 46 parts / 193 characters in ONE copy, and the screen showed ~386.
  it("renders the answer once when the final event restates every delta", async () => {
    const fragments = ["…Provide ", "a ", "chips ", "set.", "We ", "need ", "to ", "respond ", "concisely…"];
    const out = await run([...fragments.map(delta), aggregated(fragments)]);
    expect(out).toBe(fragments.join(""));
  });

  it("keeps the text of a non-streamed turn (aggregated event only)", async () => {
    const out = await run([aggregated(["Bonjour ", "Elom."])]);
    expect(out).toBe("Bonjour Elom.");
  });

  it("does not double the text preceding a tool call", async () => {
    const fragments = ["Je ", "cherche ", "cela."];
    const out = await run(
      [
        ...fragments.map(delta),
        {
          partial: false,
          content: {
            parts: [
              ...fragments.map((text) => ({ text })),
              { functionCall: { name: "search", args: {} } },
            ],
          },
        },
        { content: { parts: [{ functionResponse: { name: "search", response: { ok: true } } }] } },
        delta("Voici "),
        delta("le résultat."),
        aggregated(["Voici ", "le résultat."]),
      ],
      { onToolCall: () => {}, onToolResult: () => {} },
    );
    expect(out).toBe("Je cherche cela.Voici le résultat.");
  });
});
