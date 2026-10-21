/**
 * The human-decision inspector: question, answer mode, choices, assignee —
 * and the StudioInspector wiring (the old "soon" help is gone).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import StudioInspector from "@/components/workflow-studio/StudioInspector";
import { graphToFlow } from "@/lib/workflowGraph";

vi.mock("@/lib/api", () => ({ getToolSchema: vi.fn().mockResolvedValue({ params: [], accepts_kwargs: true }) }));

function Harness({ initial = {}, onConfig = () => {}, edges = [] }) {
  const [config, setConfig] = useState({
    question: "",
    mode: "choices",
    choices: [{ route: "oui", label: "Oui" }, { route: "non", label: "Non" }],
    ...initial,
  });
  const graph = {
    version: 1,
    nodes: [
      { id: "trigger1", type: "trigger", config: {}, position: { x: 0, y: 0 } },
      { id: "decision1", type: "approval", config, position: { x: 0, y: 0 } },
    ],
    edges: [{ source: "trigger1", target: "decision1" }, ...edges],
  };
  const flow = graphToFlow(graph);
  const node = flow.nodes.find((n) => n.id === "decision1");
  return (
    <StudioInspector
      selection={{ kind: "node", node }}
      nodes={flow.nodes}
      edges={flow.edges}
      onChangeLabel={() => {}}
      onRenameNode={() => {}}
      onPatchConfig={(_id, partial) => {
        onConfig(partial);
        setConfig((c) => ({ ...c, ...partial }));
      }}
      onChangeEdgeRoute={() => {}}
      onDeleteNode={() => {}}
      onDeleteEdge={() => {}}
    />
  );
}

describe("ApprovalInspector", () => {
  it("replaces the old 'soon' help with the form", () => {
    render(<Harness />);
    expect(screen.queryByText(/backend can't run it yet/)).toBeNull();
    expect(screen.getByLabelText("Question")).toBeInTheDocument();
    expect(screen.getByLabelText("Answer")).toHaveValue("choices");
  });

  it("writes the question into the node", async () => {
    const onConfig = vi.fn();
    const user = userEvent.setup();
    render(<Harness onConfig={onConfig} />);
    await user.type(screen.getByLabelText("Question"), "Ok");
    expect(onConfig).toHaveBeenLastCalledWith({ question: "Ok" });
  });

  it("lists the choices with route and label", () => {
    render(<Harness />);
    expect(screen.getAllByLabelText("Route")).toHaveLength(2);
    expect(screen.getAllByLabelText("Button label").map((i) => i.value)).toEqual(["Oui", "Non"]);
  });

  it("adds and removes a choice", async () => {
    const onConfig = vi.fn();
    const user = userEvent.setup();
    render(<Harness onConfig={onConfig} />);
    await user.click(screen.getByRole("button", { name: "Add a choice" }));
    expect(onConfig).toHaveBeenLastCalledWith({
      choices: [{ route: "oui", label: "Oui" }, { route: "non", label: "Non" }, { route: "", label: "" }],
    });
    await user.click(screen.getByRole("button", { name: "Remove choice 1" }));
    expect(onConfig).toHaveBeenLastCalledWith({ choices: [{ route: "non", label: "Non" }, { route: "", label: "" }] });
  });

  it("edits a choice's route and label", async () => {
    const onConfig = vi.fn();
    const user = userEvent.setup();
    render(<Harness onConfig={onConfig} />);
    await user.type(screen.getAllByLabelText("Route")[0], "x");
    expect(onConfig).toHaveBeenLastCalledWith({ choices: [{ route: "ouix", label: "Oui" }, { route: "non", label: "Non" }] });
  });

  it("text mode hides the choices; both shows them with the text-route hint", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.queryByText(/“text” route/)).toBeNull();
    await user.selectOptions(screen.getByLabelText("Answer"), "both");
    expect(screen.getAllByLabelText("Route")).toHaveLength(2);
    expect(screen.getByText(/follows the “text” route/)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Answer"), "text");
    expect(screen.queryByLabelText("Route")).toBeNull();
    expect(screen.queryByRole("button", { name: "Add a choice" })).toBeNull();
  });

  it("keeps the choices when switching to text mode and back (patches the mode only)", async () => {
    const onConfig = vi.fn();
    const user = userEvent.setup();
    render(<Harness onConfig={onConfig} />);
    await user.selectOptions(screen.getByLabelText("Answer"), "text");
    expect(onConfig).toHaveBeenLastCalledWith({ mode: "text" });
  });

  it("assignee is optional: empty clears the key", async () => {
    const onConfig = vi.fn();
    const user = userEvent.setup();
    render(<Harness onConfig={onConfig} initial={{ assignee: "bob@example.com" }} />);
    const field = screen.getByLabelText("Assigned to (optional)");
    expect(field).toHaveValue("bob@example.com");
    await user.clear(field);
    expect(onConfig).toHaveBeenLastCalledWith({ assignee: undefined });
  });

  it("offers the choices (and text in mode both) as the routes of an outgoing edge", () => {
    const flow = graphToFlow({
      version: 1,
      nodes: [
        { id: "decision1", type: "approval", config: { question: "q", mode: "both", choices: [{ route: "oui", label: "Oui" }] }, position: { x: 0, y: 0 } },
        { id: "agent1", type: "agent", config: { agent_id: "a" }, position: { x: 0, y: 0 } },
      ],
      edges: [{ source: "decision1", target: "agent1" }],
    });
    render(
      <StudioInspector
        selection={{ kind: "edge", edge: flow.edges[0] }}
        nodes={flow.nodes}
        edges={flow.edges}
        onChangeEdgeRoute={() => {}}
        onDeleteEdge={() => {}}
      />,
    );
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(expect.arrayContaining(["oui", "Written answer"]));
  });
});
