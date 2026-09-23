import { describe, it, expect, vi, afterEach } from "vitest";
import {
  parseWorkflowFile,
  buildWorkflowFile,
  workflowFileName,
  downloadWorkflowFile,
  WorkflowFileError,
} from "@/lib/workflowFile";

const GRAPH = {
  version: 1,
  nodes: [{ id: "trigger1", type: "trigger", config: { kind: "manual" } }],
  edges: [],
};

describe("parseWorkflowFile", () => {
  it("reads a bare graph, as the API stores it", () => {
    const read = parseWorkflowFile(JSON.stringify(GRAPH));
    expect(read.graph).toEqual(GRAPH);
    expect(read.name).toBe("");
  });

  it("reads an exported file and keeps its name and description", () => {
    const read = parseWorkflowFile(
      JSON.stringify({ name: " Lead triage ", description: " Routes a lead ", graph: GRAPH }),
    );
    expect(read).toEqual({ name: "Lead triage", description: "Routes a lead", graph: GRAPH });
  });

  it("defaults the graph version when the file omits it", () => {
    const { nodes, edges } = GRAPH;
    expect(parseWorkflowFile(JSON.stringify({ nodes, edges })).graph.version).toBe(1);
  });

  it("rejects text that is not JSON, with a code the UI can translate", () => {
    expect(() => parseWorkflowFile("{nope")).toThrow(WorkflowFileError);
    try {
      parseWorkflowFile("{nope");
    } catch (err) {
      expect(err.code).toBe("importInvalidJson");
    }
  });

  it.each([
    ["an unrelated object", JSON.stringify({ hello: "world" })],
    ["nodes without edges", JSON.stringify({ nodes: [] })],
    ["a list", JSON.stringify([GRAPH])],
    ["null", "null"],
  ])("refuses %s", (_label, text) => {
    expect(() => parseWorkflowFile(text)).toThrow(
      expect.objectContaining({ code: "importNotAWorkflow" }),
    );
  });
});

describe("buildWorkflowFile", () => {
  it("round-trips through parseWorkflowFile", () => {
    const file = buildWorkflowFile({ name: "Lead triage", description: "Routes a lead", graph: GRAPH });
    expect(parseWorkflowFile(JSON.stringify(file))).toEqual({
      name: "Lead triage",
      description: "Routes a lead",
      graph: GRAPH,
    });
  });

  it("leaves out an empty description instead of writing null", () => {
    expect(buildWorkflowFile({ name: "n", graph: GRAPH })).not.toHaveProperty("description");
  });
});

describe("workflowFileName", () => {
  it.each([
    ["Lead triage", "lead-triage.json"],
    ["Révision des commandes", "revision-des-commandes.json"],
    ["", "workflow.json"],
    ["***", "workflow.json"],
  ])("turns %o into %o", (name, expected) => {
    expect(workflowFileName(name)).toBe(expected);
  });
});

describe("downloadWorkflowFile", () => {
  afterEach(() => vi.restoreAllMocks());

  it("hands the browser a JSON blob named after the workflow", () => {
    const createObjectURL = vi.fn(() => "blob:x");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    downloadWorkflowFile({ name: "Lead triage", graph: GRAPH });

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(createObjectURL.mock.calls[0][0].type).toBe("application/json");
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:x");
    expect(document.querySelector("a[download]")).toBeNull();
    vi.unstubAllGlobals();
  });
});
