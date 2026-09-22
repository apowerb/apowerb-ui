/**
 * fix/workflow-template-refs (2026-09-22): the engine stores each node's
 * raw output, so `{{id.output}}` / `{{id.route}}` / `{{id.payload}}` never
 * resolve — only `{{id}}` (whole output) and real declared fields do. These
 * tests cover the UI surface that used to insert the now-invalid forms.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import StudioInspector from "@/components/workflow-studio/StudioInspector";
import { graphToFlow } from "@/lib/workflowGraph";

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

describe("ArgsEditor upstream pastilles", () => {
  it("inserts the whole-node form, not {{id.output}}, on click", async () => {
    const user = userEvent.setup();
    const patches = [];
    const graph = {
      nodes: [
        { id: "trigger1", type: "trigger", config: { kind: "manual" } },
        { id: "agent1", type: "agent", config: { agent_id: "a1" } },
        { id: "tool1", type: "tool", config: { tool: "search", args: { q: "" } } },
      ],
      edges: [
        { source: "trigger1", target: "agent1" },
        { source: "agent1", target: "tool1" },
      ],
    };
    render(<Inspector graph={graph} nodeId="tool1" onConfig={(p) => patches.push(p)} />);

    await user.click(screen.getByRole("button", { name: "agent1" }));

    expect(patches.at(-1)).toEqual({ args: { q: "{{agent1}}" } });
  });
});
