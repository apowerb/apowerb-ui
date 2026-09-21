import { describe, it, expect, vi } from "vitest";
import {
  parseSseBlock,
  parseSseChunk,
  isTerminalEvent,
  consumeWorkflowRun,
} from "@/lib/workflowSse";

describe("parseSseBlock", () => {
  it("parses a single-line data block", () => {
    expect(parseSseBlock('data: {"event":"run_started","workflow_id":"w1"}')).toEqual({
      event: "run_started",
      workflow_id: "w1",
    });
  });

  it("parses a multi-line block with event:/id: fields around data:", () => {
    const block = 'event: message\ndata: {"event":"node_start","node_id":"agent1"}\nid: 42';
    expect(parseSseBlock(block)).toEqual({ event: "node_start", node_id: "agent1" });
  });

  it("returns null for [DONE], blank input, and invalid JSON", () => {
    expect(parseSseBlock("data: [DONE]")).toBeNull();
    expect(parseSseBlock("   ")).toBeNull();
    expect(parseSseBlock("data: {not json")).toBeNull();
  });
});

describe("parseSseChunk", () => {
  it("splits complete frames and keeps a trailing partial frame as remainder", () => {
    const buffer =
      'data: {"event":"run_started"}\n\ndata: {"event":"node_start","node_id":"a"}\n\ndata: {"event":"node_comp';
    const { events, remainder } = parseSseChunk(buffer);
    expect(events).toEqual([{ event: "run_started" }, { event: "node_start", node_id: "a" }]);
    expect(remainder).toBe('data: {"event":"node_comp');
  });

  it("drops unparseable frames but keeps the rest in order", () => {
    const buffer = 'data: garbage\n\ndata: {"event":"done","output":1}\n\n';
    const { events, remainder } = parseSseChunk(buffer);
    expect(events).toEqual([{ event: "done", output: 1 }]);
    expect(remainder).toBe("");
  });
});

describe("isTerminalEvent", () => {
  it("recognises the three terminal kinds and nothing else", () => {
    expect(isTerminalEvent({ event: "done" })).toBe(true);
    expect(isTerminalEvent({ event: "error" })).toBe(true);
    expect(isTerminalEvent({ event: "cancelled" })).toBe(true);
    expect(isTerminalEvent({ event: "node_start" })).toBe(false);
    expect(isTerminalEvent(null)).toBe(false);
  });
});

/** Fake fetch Response whose body streams the given text in the given chunk sizes. */
function fakeSseResponse(fullText, chunkSize = 64) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(fullText);
  let offset = 0;
  return {
    body: {
      getReader() {
        return {
          async read() {
            if (offset >= bytes.length) return { done: true, value: undefined };
            const chunk = bytes.slice(offset, offset + chunkSize);
            offset += chunkSize;
            return { done: false, value: chunk };
          },
          releaseLock() {},
        };
      },
    },
  };
}

describe("consumeWorkflowRun", () => {
  it("delivers every event in order and resolves with the terminal one", async () => {
    const text = [
      'data: {"event":"run_started","workflow_id":"w1"}',
      'data: {"event":"node_start","node_id":"trigger1","type":"trigger"}',
      'data: {"event":"node_complete","node_id":"trigger1","output":{},"duration_ms":2}',
      'data: {"event":"done","output":{"ok":true}}',
    ].join("\n\n") + "\n\n";

    const received = [];
    const terminal = await consumeWorkflowRun(fakeSseResponse(text, 40), {
      onEvent: (evt) => received.push(evt.event),
    });

    expect(received).toEqual(["run_started", "node_start", "node_complete", "done"]);
    expect(terminal).toEqual({ event: "done", output: { ok: true } });
  });

  it("stops at the first terminal event even if more data follows", async () => {
    const text =
      'data: {"event":"error","detail":"boom"}\n\ndata: {"event":"node_start","node_id":"late"}\n\n';
    const received = [];
    const terminal = await consumeWorkflowRun(fakeSseResponse(text), {
      onEvent: (evt) => received.push(evt.event),
    });
    expect(received).toEqual(["error"]);
    expect(terminal).toEqual({ event: "error", detail: "boom" });
  });

  it("returns null when the stream ends without a terminal event", async () => {
    const text = 'data: {"event":"node_start","node_id":"a"}\n\n';
    const terminal = await consumeWorkflowRun(fakeSseResponse(text), { onEvent: () => {} });
    expect(terminal).toBeNull();
  });

  it("treats a read error after an abort as a cancellation, not a crash", async () => {
    const controller = new AbortController();
    controller.abort();
    const response = {
      body: {
        getReader() {
          return {
            async read() {
              throw new DOMException("aborted", "AbortError");
            },
            releaseLock() {},
          };
        },
      },
    };
    const terminal = await consumeWorkflowRun(response, {
      onEvent: () => {},
      signal: controller.signal,
    });
    expect(terminal).toEqual({ event: "cancelled" });
  });

  it("re-throws a read error that isn't from an abort", async () => {
    const response = {
      body: {
        getReader() {
          return {
            async read() {
              throw new Error("network down");
            },
            releaseLock() {},
          };
        },
      },
    };
    await expect(consumeWorkflowRun(response, { onEvent: () => {} })).rejects.toThrow("network down");
  });
});
