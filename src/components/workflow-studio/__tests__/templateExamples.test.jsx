/**
 * Every template field offers an "Examples" menu: ready-made values built
 * from the nearest upstream node, so nothing has to be guessed. Picking one
 * fills an empty field, or is appended after the existing text.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import en from "../../../../messages/en.json";
import fr from "../../../../messages/fr.json";
import StudioInspector from "@/components/workflow-studio/StudioInspector";
import { graphToFlow } from "@/lib/workflowGraph";
import { TEMPLATE_EXAMPLES, templateExamplesFor, exampleRefs } from "@/lib/templateExamples";

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

const trigger = { id: "trigger1", type: "trigger", config: { kind: "manual", sample_payload: { subject: "Hi", priority: "high" } } };

describe("templateExamplesFor", () => {
  it("refers to the nearest upstream node, its first declared field for @field", () => {
    expect(exampleRefs([{ id: "trigger1", type: "trigger", data: { config: trigger.config } }])).toEqual({
      ref: "{{trigger1}}",
      field: "{{trigger1.subject}}",
    });
    const url = templateExamplesFor("httpUrl", [trigger], () => "");
    expect(url.map((e) => e.snippet)).toEqual([
      "https://api.example.com/items/{{trigger1.subject}}",
      "https://api.example.com/search?q={{trigger1.subject}}",
    ]);
  });

  it("falls back to the whole output when the node declares no field", () => {
    expect(exampleRefs([{ id: "agent1", type: "agent", config: {} }])).toEqual({ ref: "{{agent1}}", field: "{{agent1}}" });
  });

  it("offers nothing without an upstream node or for an unknown kind", () => {
    expect(templateExamplesFor("agentInput", [], () => "x")).toEqual([]);
    expect(templateExamplesFor("nope", [trigger], () => "x")).toEqual([]);
  });

  it("has an EN and FR label for every example, and prose text where needed", () => {
    for (const [kind, examples] of Object.entries(TEMPLATE_EXAMPLES)) {
      for (const { id, text } of examples) {
        for (const messages of [en, fr]) {
          const ns = messages.WorkflowInspector;
          expect(ns[`tplEx_${kind}_${id}`], `${kind}.${id} label`).toBeTruthy();
          if (text === undefined) expect(ns[`tplExText_${kind}_${id}`], `${kind}.${id} text`).toMatch(/@ref|@field/);
        }
      }
    }
  });
});

describe("Examples menu in the inspector", () => {
  const graph = {
    nodes: [trigger, { id: "agent1", type: "agent", config: { agent_id: "a1" } }],
    edges: [{ source: "trigger1", target: "agent1" }],
  };

  it("fills an empty field with the picked example", async () => {
    const user = userEvent.setup();
    const patches = [];
    render(<Inspector graph={graph} nodeId="agent1" onConfig={(p) => patches.push(p)} />);

    await user.click(screen.getByRole("button", { name: "Examples" }));
    await user.click(screen.getByRole("button", { name: /Summarize/ }));

    expect(patches.at(-1)).toEqual({ input: "Summarize in 3 bullet points:\n{{trigger1}}" });
    expect(screen.queryByRole("button", { name: /Summarize/ })).toBeNull();
  });

  it("appends to existing text instead of replacing it", async () => {
    const user = userEvent.setup();
    const patches = [];
    const withText = { ...graph, nodes: [trigger, { id: "agent1", type: "agent", config: { agent_id: "a1", input: "Context: " } }] };
    render(<Inspector graph={withText} nodeId="agent1" onConfig={(p) => patches.push(p)} />);

    await user.click(screen.getByRole("button", { name: "Examples" }));
    await user.click(screen.getByRole("button", { name: /Translate/ }));

    expect(patches.at(-1)).toEqual({ input: "Context: Translate into English:\n{{trigger1}}" });
  });

  it("shows no Examples menu when nothing is upstream", () => {
    render(<Inspector graph={{ nodes: [{ id: "agent1", type: "agent", config: {} }], edges: [] }} nodeId="agent1" onConfig={() => {}} />);
    expect(screen.queryByRole("button", { name: "Examples" })).toBeNull();
  });
});
