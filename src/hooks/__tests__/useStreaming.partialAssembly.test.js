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

const delta = (text) => ({ partial: true, content: { role: "model", parts: [{ text }] } });
const final = (text) => ({ partial: false, content: { role: "model", parts: [{ text }] } });
const toolCall = { partial: false, content: { parts: [{ functionCall: { name: "search", args: {} } }] } };
const toolResult = {
  content: { parts: [{ functionResponse: { name: "search", response: { ok: true } } }] },
};

async function run(events) {
  global.fetch = fakeFetch(events);
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
  return out;
}

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function split(text, next, min = 1, max = 80) {
  const pieces = [];
  let i = 0;
  while (i < text.length) {
    const size = min + Math.floor(next() * (max - min + 1));
    pieces.push(text.slice(i, i + size));
    i += size;
  }
  return pieces;
}

describe("useStreaming — ADK partial deltas then aggregated event", () => {
  it("keeps identical consecutive deltas and blank lines", async () => {
    const deltas = ["Here ", "is ", "the result.", "\n", "\n", "Next."];
    const full = "Here is the result.\n\nNext.";
    expect(await run([...deltas.map(delta), final(full)])).toBe(full);
  });

  it("keeps deltas of neighbouring sentences sharing more than 40 characters", async () => {
    const shared = "the quarterly report shows a steady increase in volume across regions";
    const full = `First, ${shared} during spring. Then, ${shared} during autumn. Finally, wrap up.`;
    const deltas = ["First, ", `${shared} during spring. `, "Then, ", `${shared} during autumn. `, "Finally, wrap up."];
    expect(await run([...deltas.map(delta), final(full)])).toBe(full);
  });

  it("keeps a delta of 20+ characters already present earlier (repeated bullets)", async () => {
    const bullet = "- Review the configuration\n";
    const full = `List:\n${bullet}${bullet}${bullet}Done.`;
    const deltas = ["List:\n", bullet, bullet, bullet, "Done."];
    expect(await run([...deltas.map(delta), final(full)])).toBe(full);
  });

  it("assembles two model turns separated by a tool call without duplicates", async () => {
    const t1 = ["I will ", "look this up ", "now."];
    const t2 = ["The value ", "is 42, ", "as expected."];
    const out = await run([
      ...t1.map(delta),
      final(t1.join("")),
      toolCall,
      toolResult,
      ...t2.map(delta),
      final(t2.join("")),
    ]);
    expect(out).toBe(t1.join("") + t2.join(""));
  });

  it("shows an aggregated event without any delta exactly once", async () => {
    expect(await run([final("Complete answer, no deltas.")])).toBe("Complete answer, no deltas.");
  });

  it("appends once a final-only turn that follows a streamed turn", async () => {
    const out = await run([
      delta("I am "),
      delta("checking."),
      final("I am checking."),
      toolCall,
      toolResult,
      final("I am checking. Final result."),
    ]);
    expect(out).toBe("I am checking.I am checking. Final result.");
  });

  it("restarts from zero on a consecutive turn without a tool call", async () => {
    const out = await run([
      delta("First "),
      delta("turn."),
      final("First turn."),
      delta("Second "),
      delta("turn"),
      final("Second turn, completed."),
    ]);
    expect(out).toBe("First turn.Second turn, completed.");
  });

  it("never corrupts the text across 200 seeded random splits", async () => {
    const para =
      "## Summary\n\nThe system processes each request in order. Each request is validated first.\n\n" +
      "- Validate the input payload carefully\n- Validate the input payload carefully\n- Store the result\n\n" +
      "The system processes each request in order. Each request is validated first.\n\n" +
      "Notes: values are rounded; values are rounded; see the appendix for details about rounding.\n";
    const full = (para + para).slice(0, 700);
    const next = rng(12345);
    const failures = [];
    for (let n = 0; n < 200; n++) {
      const deltas = split(full, next);
      const out = await run([...deltas.map(delta), final(full)]);
      if (out !== full) failures.push(n);
    }
    expect(failures).toEqual([]);
  }, 60000);
});
