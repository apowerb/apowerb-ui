import { describe, it, expect, vi } from "vitest";
import { processSSEBlock } from "../useStreaming";

// google-adk 2.12 (not 2.9) LiteLlm streams a tool call as partial events
// (`partial: true`, `willContinue`, `partialArgs`, no `args`) before the final
// event that carries the complete call. Shapes below are the events ADK 2.12.0
// sent for one embed_chart call streamed by an Azure OpenAI model (args split
// across deltas). Counting each partial event as a call showed one chart card
// per delta: 5 charts for 1 embed_chart, ~10x tool calls in the trace.
const sse = (event) => `data: ${JSON.stringify(event)}`;
const partialCall = (partialArgs) =>
  sse({
    partial: true,
    content: {
      role: "model",
      parts: [
        {
          functionCall: {
            id: "call_2_0",
            name: "embed_chart",
            willContinue: true,
            ...(partialArgs && { partialArgs }),
          },
        },
      ],
    },
  });

const EMBED_CHART_STREAM = [
  partialCall(),
  partialCall(),
  partialCall([{ jsonPath: "$.chart_id", stringValue: "", willContinue: true }]),
  partialCall([{ jsonPath: "$.chart_id", stringValue: "c-1", willContinue: false }]),
  sse({
    content: {
      role: "model",
      parts: [{ functionCall: { id: "call_2_0", name: "embed_chart", args: { chart_id: "c-1" } } }],
    },
    partial: false,
  }),
  sse({
    content: {
      role: "user",
      parts: [
        {
          functionResponse: {
            id: "call_2_0",
            name: "embed_chart",
            response: { status: "displayed" },
          },
        },
      ],
    },
  }),
];

describe("processSSEBlock — streamed (partial) function calls", () => {
  it("reports one tool call, with its args, for a call streamed as partial events", () => {
    const onToolCall = vi.fn();
    const onToolResult = vi.fn();
    for (const block of EMBED_CHART_STREAM) {
      processSSEBlock(block, { onChunk: vi.fn(), onToolCall, onToolResult });
    }
    expect(onToolCall).toHaveBeenCalledTimes(1);
    expect(onToolCall).toHaveBeenCalledWith({ name: "embed_chart", args: { chart_id: "c-1" } });
    expect(onToolResult).toHaveBeenCalledTimes(1);
  });

  it("still streams partial text", () => {
    const onChunk = vi.fn();
    processSSEBlock(
      sse({ partial: true, content: { role: "model", parts: [{ text: "Il y a " }] } }),
      { onChunk },
    );
    expect(onChunk).toHaveBeenCalledWith("Il y a ", { partial: true });
  });

  it("keeps a function call that arrives in a non-partial event (ADK 2.9, Gemini)", () => {
    const onToolCall = vi.fn();
    processSSEBlock(
      sse({
        content: {
          role: "model",
          parts: [{ functionCall: { name: "embed_chart", args: { chart_id: "c-1" } } }],
        },
      }),
      { onChunk: vi.fn(), onToolCall },
    );
    expect(onToolCall).toHaveBeenCalledTimes(1);
  });
});
