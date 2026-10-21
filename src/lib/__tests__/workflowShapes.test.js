import { describe, it, expect } from "vitest";
import {
  shapeOf,
  shapeFieldPaths,
  knownShapes,
  effectfulNodesUpTo,
  insertFieldPatch,
} from "@/lib/workflowShapes";

const node = (id, type, config = {}, label) => ({ id, type, data: { label, config } });

describe("shapeOf — keys and types, never values", () => {
  it("describes an object without keeping a value", () => {
    const shape = shapeOf({ name: "Ada", n: 3, ok: true, tags: ["x"], addr: { city: "Metz" } });
    expect(shape).toEqual({
      type: "object",
      fields: {
        name: { type: "string" },
        n: { type: "number" },
        ok: { type: "boolean" },
        tags: { type: "array", items: { type: "string" } },
        addr: { type: "object", fields: { city: { type: "string" } } },
      },
    });
    expect(JSON.stringify(shape)).not.toMatch(/Ada|Metz/);
  });
});

describe("shapeFieldPaths", () => {
  it("lists the reachable paths, nested objects included", () => {
    const shape = shapeOf({ customer: { id: "c1", email: "a@b" }, total: 3 });
    expect(shapeFieldPaths(shape)).toEqual([
      { path: "customer", type: "object" },
      { path: "customer.id", type: "string" },
      { path: "customer.email", type: "string" },
      { path: "total", type: "number" },
    ]);
  });

  it("gives nothing for a scalar or an unknown object", () => {
    expect(shapeFieldPaths({ type: "string" })).toEqual([]);
    expect(shapeFieldPaths({ type: "object" })).toEqual([]);
  });
});

describe("knownShapes", () => {
  it("prefers what a node really returned in this session's run", () => {
    const server = { t: { source: "static", shape: { type: "object", fields: { a: { type: "string" } } } } };
    const runState = { timeline: [{ id: "t", status: "done", output: { b: 1 } }, { id: "x", status: "running", output: null }] };
    const shapes = knownShapes(server, runState);
    expect(shapes.t).toEqual({ source: "run", shape: { type: "object", fields: { b: { type: "number" } } } });
    expect(shapes.x).toBeUndefined();
  });

  it("never proposes the fields of an error a tool reported in continue mode", () => {
    const server = { t: { source: "learned", shape: { type: "object", fields: { rows: { type: "array" } } } } };
    const runState = { timeline: [{ id: "t", status: "done", output: { success: false, error: "boom" }, reportedError: "boom" }] };
    expect(knownShapes(server, runState).t).toEqual(server.t);
  });
});

describe("effectfulNodesUpTo", () => {
  it("lists only the nodes with an effect among the node and its ancestors", () => {
    const nodes = [
      node("trigger1", "trigger"),
      node("lookup", "tool", {}, "CRM lookup"),
      node("s", "set"),
      node("mail", "notification"),
      node("after", "http"),
    ];
    const edges = [
      { source: "trigger1", target: "lookup" },
      { source: "lookup", target: "s" },
      { source: "trigger1", target: "mail" },
      { source: "s", target: "after" },
    ];
    expect(effectfulNodesUpTo("s", nodes, edges)).toEqual([{ id: "lookup", type: "tool", label: "CRM lookup" }]);
    expect(effectfulNodesUpTo("trigger1", nodes, edges)).toEqual([]);
  });
});

describe("insertFieldPatch — composing the downstream input on click", () => {
  it("appends to an agent's input", () => {
    expect(insertFieldPatch(node("a", "agent"), "lookup", "customer.email")).toEqual({ input: "{{lookup.customer.email}}" });
    expect(insertFieldPatch(node("a", "agent", { input: "Write to" }), "lookup", "email")).toEqual({ input: "Write to {{lookup.email}}" });
  });

  it("adds a set field named after the path", () => {
    expect(insertFieldPatch(node("s", "set", { fields: [{ key: "x", value: 1 }] }), "lookup", "customer.email")).toEqual({
      fields: [{ key: "x", value: 1 }, { key: "email", value: "{{lookup.customer.email}}" }],
    });
  });

  it("adds a tool argument and keeps the others", () => {
    expect(insertFieldPatch(node("t", "tool", { args: { a: "1" } }), "lookup", "id")).toEqual({ args: { a: "1", id: "{{lookup.id}}" } });
  });

  it("refers to the whole output without a path, and gives up on a node with no input field", () => {
    expect(insertFieldPatch(node("o", "output"), "lookup", "")).toEqual({ value: "{{lookup}}" });
    expect(insertFieldPatch(node("r", "router"), "lookup", "id")).toBeNull();
  });
});
