/**
 * Output and Convert nodes (MVP, 21/09): local validation, defaults, and the
 * inspector fields that configure them.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import StudioInspector from "@/components/workflow-studio/StudioInspector";
import ExecutionPanel from "@/components/workflow-studio/ExecutionPanel";
import { createNode, graphToFlow, validateGraphLocal, CONVERT_TARGETS, NODE_TYPES } from "@/lib/workflowGraph";
import { applyRunEvent, createRunState } from "@/lib/workflowRunState";

const trigger = { id: "t", type: "trigger", config: {} };

describe("output and convert in the graph model", () => {
  it("are known node types with safe defaults", () => {
    expect(NODE_TYPES).toEqual(expect.arrayContaining(["output", "convert"]));
    expect(createNode("convert").config).toEqual({ to: "text" });
    // No `value` key: an empty template would replace the output with "".
    expect(createNode("output").config).toEqual({});
    expect(CONVERT_TARGETS).toEqual(["text", "json", "number", "boolean", "list", "csv", "date"]);
  });

  it("refuses an edge leaving an output node", () => {
    const { errors } = validateGraphLocal({
      nodes: [trigger, { id: "out", type: "output", config: {} }, { id: "a", type: "agent", config: { agent_id: "agent1" } }],
      edges: [{ source: "t", target: "out" }, { source: "out", target: "a" }],
    });
    expect(errors.map((e) => e.message)).toContain("outputHasSuccessor");
  });

  it("refuses an unknown conversion", () => {
    const { errors } = validateGraphLocal({
      nodes: [trigger, { id: "c", type: "convert", config: { to: "xml" } }],
      edges: [{ source: "t", target: "c" }],
    });
    expect(errors.map((e) => e.message)).toContain("convertUnknownTarget:xml");
  });
});

function Inspector({ graph, nodeId, onConfig }) {
  const [flow, setFlow] = useState(() => graphToFlow(graph));
  const node = flow.nodes.find((n) => n.id === nodeId);
  return (
    <StudioInspector
      selection={{ kind: "node", node }}
      nodes={flow.nodes}
      edges={flow.edges}
      onChangeLabel={() => {}}
      onRenameNode={() => {}}
      onPatchConfig={(id, partial) => {
        setFlow((f) => ({
          ...f,
          nodes: f.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, config: { ...n.data.config, ...partial } } } : n)),
        }));
        onConfig(partial);
      }}
      onChangeEdgeRoute={() => {}}
      onDeleteNode={() => {}}
      onDeleteEdge={() => {}}
      onOpenLoopBody={() => {}}
    />
  );
}

describe("inspector", () => {
  it("configures a convert node", async () => {
    const user = userEvent.setup();
    const patches = [];
    render(
      <Inspector
        graph={{ nodes: [trigger, { id: "c", type: "convert", config: { to: "text" } }], edges: [{ source: "t", target: "c" }] }}
        nodeId="c"
        onConfig={(p) => patches.push(p)}
      />,
    );
    await user.selectOptions(screen.getByLabelText(/Convert to/i), "number");
    expect(patches.at(-1)).toEqual({ to: "number" });
    expect(screen.getByText(/Leave empty to convert the upstream output/i)).toBeInTheDocument();
  });

  it("stores no value for an output left empty", async () => {
    const user = userEvent.setup();
    const patches = [];
    render(
      <Inspector
        graph={{ nodes: [trigger, { id: "out", type: "output", config: { value: "x" } }], edges: [{ source: "t", target: "out" }] }}
        nodeId="out"
        onConfig={(p) => patches.push(p)}
      />,
    );
    await user.clear(screen.getByLabelText(/Output value/i));
    expect(patches.at(-1)).toEqual({ value: undefined });
  });
});

it("words a failed conversion", () => {
  let s = createRunState();
  s = applyRunEvent(s, { event: "node_start", node_id: "c", type: "convert" });
  s = applyRunEvent(s, { event: "node_error", node_id: "c", code: "convert_failed", detail: "c : conversion", params: { node: "c", to: "number" } });
  render(
    <ExecutionPanel open onToggle={() => {}} payloadText="{}" onPayloadTextChange={() => {}} payloadError={null} isRunning={false} runState={s} onRun={() => {}} onCancel={() => {}} />,
  );
  expect(screen.getByText(/Convert c could not read its input as number/i)).toBeInTheDocument();
});
