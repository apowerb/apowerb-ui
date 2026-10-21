import { describe, it, expect } from "vitest";
import {
  lookupPath,
  shapeOf,
  pathsOf,
  outputsByNodeId,
  missingRefs,
} from "@/lib/availableData";

describe("lookupPath mirrors the engine's _lookup", () => {
  const out = { client: { name: "Acme" }, lines: [{ sku: "A1" }, { sku: "B2" }], n: 0 };

  it("walks objects and list indexes", () => {
    expect(lookupPath(out, "client.name")).toEqual({ found: true, value: "Acme" });
    expect(lookupPath(out, "lines.1.sku")).toEqual({ found: true, value: "B2" });
    expect(lookupPath(out, "")).toEqual({ found: true, value: out });
    expect(lookupPath(out, "n")).toEqual({ found: true, value: 0 });
  });

  it("reports a missing key or index as not found", () => {
    expect(lookupPath(out, "client.city")).toEqual({ found: false });
    expect(lookupPath(out, "lines.5.sku")).toEqual({ found: false });
    // A list only takes digits, like the engine.
    expect(lookupPath(out, "lines.first")).toEqual({ found: false });
  });

  it("reports a path through a scalar apart (the engine refuses it)", () => {
    expect(lookupPath("Bonjour", "text")).toEqual({ found: false, scalar: true });
    expect(lookupPath(out, "client.name.first")).toEqual({ found: false, scalar: true });
  });
});

describe("shapeOf", () => {
  it("tells the four shapes apart", () => {
    expect(shapeOf({ a: 1 })).toBe("json");
    expect(shapeOf([{ a: 1 }, { a: 2 }])).toBe("table");
    expect(shapeOf([1, 2])).toBe("json");
    expect(shapeOf("du texte")).toBe("text");
    expect(shapeOf(3)).toBe("text");
    expect(shapeOf(null)).toBe("empty");
    expect(shapeOf([])).toBe("empty");
  });

  it("recognises a file list ({name, size, content_type})", () => {
    expect(shapeOf([{ name: "f.pdf", size: 12, content_type: "application/pdf", ref: "r1" }])).toBe("files");
  });
});

describe("pathsOf", () => {
  it("lists every leaf path with list indexes as segments", () => {
    const paths = pathsOf({ a: { b: 1 }, l: [{ c: "x" }] }).map((p) => p.path);
    expect(paths).toEqual(["a", "a.b", "l", "l.0", "l.0.c"]);
  });

  it("caps depth and list items", () => {
    const deep = { a: { b: { c: { d: 1 } } } };
    expect(pathsOf(deep, { maxDepth: 2 }).map((p) => p.path)).toEqual(["a", "a.b"]);
    const many = Array.from({ length: 50 }, (_, i) => i);
    expect(pathsOf({ l: many }, { maxItems: 3 }).map((p) => p.path)).toEqual(["l", "l.0", "l.1", "l.2"]);
  });
});

describe("outputsByNodeId", () => {
  it("keeps the output of every finished top-level node", () => {
    const runState = {
      timeline: [
        { id: "start", status: "done", output: { a: 1 }, iterations: {} },
        { id: "redac", status: "done", output: "", iterations: {} },
        { id: "slow", status: "running", output: null, iterations: {} },
        { id: "ko", status: "error", output: null, iterations: {} },
      ],
    };
    expect(outputsByNodeId(runState)).toEqual({ start: { a: 1 }, redac: "" });
  });

  it("is empty without a run", () => {
    expect(outputsByNodeId({ timeline: [] })).toEqual({});
    expect(outputsByNodeId(null)).toEqual({});
  });
});

describe("missingRefs", () => {
  const outputs = { start: { client: "Acme" }, redac: "Bonjour" };

  it("flags a field missing from the last output of a node that ran", () => {
    expect(missingRefs("{{start.client}} {{start.city}}", outputs)).toEqual([
      { raw: "{{start.city}}", nodeId: "start", path: "city", scalar: false },
    ]);
  });

  it("flags a path through a text output", () => {
    expect(missingRefs("{{redac.text}}", outputs)).toEqual([
      { raw: "{{redac.text}}", nodeId: "redac", path: "text", scalar: true },
    ]);
  });

  it("ignores nodes that did not run and whole-node refs", () => {
    expect(missingRefs("{{ghost.x}} {{redac}} {{start}}", outputs)).toEqual([]);
  });

  it("looks inside objects (tool args)", () => {
    expect(missingRefs({ q: "{{start.nope}}" }, outputs).map((r) => r.raw)).toEqual(["{{start.nope}}"]);
  });

  it("reports each missing ref once", () => {
    expect(missingRefs("{{start.city}} {{start.city}}", outputs)).toHaveLength(1);
  });
});
