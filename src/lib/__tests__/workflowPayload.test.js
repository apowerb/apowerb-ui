import { describe, it, expect } from "vitest";
import {
  coerceFieldValue,
  payloadRows,
  rowsToPayloadText,
  textToPayloadText,
  payloadMessage,
  formatPayloadText,
} from "@/lib/workflowPayload";

describe("workflowPayload", () => {
  it("coerces form values that are JSON literals and keeps other text", () => {
    expect(coerceFieldValue("12")).toBe(12);
    expect(coerceFieldValue("true")).toBe(true);
    expect(coerceFieldValue('"12"')).toBe("12");
    expect(coerceFieldValue("[1,2]")).toEqual([1, 2]);
    expect(coerceFieldValue("B7")).toBe("B7");
    expect(coerceFieldValue("  ")).toBe("");
  });

  it("round-trips an object payload through form rows", () => {
    const rows = payloadRows('{"order_id":"B7","amount":12,"tags":["a"]}');
    expect(rows).toEqual([
      { key: "order_id", value: "B7" },
      { key: "amount", value: "12" },
      { key: "tags", value: '["a"]' },
    ]);
    expect(JSON.parse(rowsToPayloadText(rows))).toEqual({ order_id: "B7", amount: 12, tags: ["a"] });
  });

  it("refuses to show a non-object payload as a form", () => {
    expect(payloadRows("[1,2]")).toBeNull();
    expect(payloadRows("{oops")).toBeNull();
    expect(payloadRows("")).toEqual([]);
  });

  it("skips rows without a key", () => {
    expect(JSON.parse(rowsToPayloadText([{ key: "", value: "x" }, { key: " a ", value: "1" }]))).toEqual({ a: 1 });
  });

  it("wraps plain text as a message and reads it back", () => {
    const text = textToPayloadText("Bonjour");
    expect(JSON.parse(text)).toEqual({ message: "Bonjour" });
    expect(payloadMessage(text)).toBe("Bonjour");
    expect(payloadMessage('{"x":1}')).toBe("");
  });

  it("formats valid JSON and reports invalid JSON as null", () => {
    expect(formatPayloadText('{"a":1}')).toBe('{\n  "a": 1\n}');
    expect(formatPayloadText("{a")).toBeNull();
  });
});
