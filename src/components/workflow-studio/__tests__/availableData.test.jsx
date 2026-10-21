/**
 * Studio proactif, étape 1 : le panneau « Données disponibles » de
 * l'inspecteur montre ce que chaque nœud amont a produit au dernier run de
 * test, insère `{{noeud.chemin}}` au clic, signale une référence absente de
 * la dernière sortie et prévisualise l'Entrée rendue par le moteur.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import StudioInspector from "@/components/workflow-studio/StudioInspector";
import { graphToFlow } from "@/lib/workflowGraph";
import { renderWorkflowPreview } from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal()),
  renderWorkflowPreview: vi.fn(),
}));

const GRAPH = {
  nodes: [
    { id: "start", type: "trigger", config: { kind: "manual", sample_payload: { client: "x" } } },
    { id: "lignes", type: "tool", config: { tool: "erp.lines" } },
    { id: "redac", type: "agent", config: { agent_id: "a1" } },
    { id: "suivant", type: "agent", config: { agent_id: "a2", input: "" } },
    { id: "outil", type: "tool", config: { tool: "crm.push", args: { q: "", n: "" } } },
  ],
  edges: [
    { source: "start", target: "lignes" },
    { source: "lignes", target: "redac" },
    { source: "redac", target: "suivant" },
    { source: "suivant", target: "outil" },
  ],
};

const OUTPUTS = {
  start: {
    client: "Acme",
    attachments: [{ name: "facture.pdf", size: 2048, content_type: "application/pdf", ref: "r1" }],
  },
  lignes: [
    { sku: "A1", qty: 2 },
    { sku: "B2", qty: 5 },
  ],
  redac: "Bonjour Acme, voici le récapitulatif.",
};

function Inspector({ nodeId, runOutputs, onConfig = () => {}, initial = GRAPH }) {
  const [flow, setFlow] = useState(() => graphToFlow(initial));
  const node = flow.nodes.find((n) => n.id === nodeId);
  return (
    <StudioInspector
      selection={{ kind: "node", node }}
      nodes={flow.nodes}
      edges={flow.edges}
      runOutputs={runOutputs}
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

const panel = () => screen.getByRole("region", { name: "Available data" });

beforeEach(() => {
  renderWorkflowPreview.mockReset();
  renderWorkflowPreview.mockResolvedValue({ rendered: "" });
});

describe("Available data panel", () => {
  it("without a run, asks for a test and lists the fields already known", () => {
    render(<Inspector nodeId="suivant" runOutputs={{}} />);
    const p = panel();
    expect(within(p).getAllByText("Run a test to see the data.").length).toBeGreaterThan(0);
    // Trigger's declared sample payload: known before any run.
    expect(within(p).getByRole("button", { name: "{{start.client}}" })).toBeInTheDocument();
    expect(renderWorkflowPreview).not.toHaveBeenCalled();
  });

  it("renders a JSON output as a tree and inserts a field into the agent input", async () => {
    const user = userEvent.setup();
    const patches = [];
    render(<Inspector nodeId="suivant" runOutputs={OUTPUTS} onConfig={(p) => patches.push(p)} />);
    await user.click(within(panel()).getByRole("button", { name: /^client\b/ }));
    expect(patches.at(-1)).toEqual({ input: "{{start.client}}" });
  });

  it("renders a list of objects as a table, cells as node.index.field", async () => {
    const user = userEvent.setup();
    const patches = [];
    render(<Inspector nodeId="suivant" runOutputs={OUTPUTS} onConfig={(p) => patches.push(p)} />);
    const table = within(panel()).getByRole("table", { name: "lignes" });
    expect(within(table).getByRole("columnheader", { name: "sku" })).toBeInTheDocument();
    await user.click(within(table).getByRole("button", { name: "B2" }));
    expect(patches.at(-1)).toEqual({ input: "{{lignes.1.sku}}" });
  });

  it("shows an agent's text as a block and files with name, type and size", () => {
    render(<Inspector nodeId="suivant" runOutputs={OUTPUTS} />);
    const p = panel();
    expect(within(p).getByText("Bonjour Acme, voici le récapitulatif.")).toBeInTheDocument();
    const file = within(p).getByRole("button", { name: /facture\.pdf/ });
    expect(file).toHaveTextContent("application/pdf");
    expect(file).toHaveTextContent("2 KB");
  });

  it("inserts at the cursor of the field last focused (tool argument)", async () => {
    const user = userEvent.setup();
    const patches = [];
    render(<Inspector nodeId="outil" runOutputs={OUTPUTS} onConfig={(p) => patches.push(p)} />);
    const values = screen.getAllByPlaceholderText("Value (template)");
    await user.click(values[1]);
    await user.click(within(panel()).getByRole("button", { name: /^client\b/ }));
    expect(patches.at(-1)).toEqual({ args: { q: "", n: "{{start.client}}" } });
  });

  it("asks to pick a field first when nothing is focused on a tool node", async () => {
    const user = userEvent.setup();
    const patches = [];
    render(<Inspector nodeId="outil" runOutputs={OUTPUTS} onConfig={(p) => patches.push(p)} />);
    await user.click(within(panel()).getByRole("button", { name: /^client\b/ }));
    expect(patches).toEqual([]);
    expect(within(panel()).getByText("Click inside a field first, then pick a value.")).toBeInTheDocument();
  });

  it("puts the reference in the drag data, for a drop into any field", () => {
    render(<Inspector nodeId="suivant" runOutputs={OUTPUTS} />);
    const setData = vi.fn();
    fireEvent.dragStart(within(panel()).getByRole("button", { name: /^client\b/ }), { dataTransfer: { setData, effectAllowed: "" } });
    expect(setData).toHaveBeenCalledWith("text/plain", "{{start.client}}");
  });
});

describe("References the last run would not resolve", () => {
  it("warns in orange under the field", () => {
    const initial = { ...GRAPH, nodes: GRAPH.nodes.map((n) => (n.id === "suivant" ? { ...n, config: { ...n.config, input: "{{start.client}} {{start.city}} {{redac.texte}}" } } : n)) };
    render(<Inspector nodeId="suivant" runOutputs={OUTPUTS} initial={initial} />);
    const missing = screen.getByText("{{start.city}}: not in the last output of start.");
    expect(missing).toHaveClass("text-amber-400");
    expect(screen.getByText("{{redac.texte}}: the last output of redac is plain text, without fields.")).toBeInTheDocument();
    expect(screen.queryByText(/start\.client}}: not in/)).not.toBeInTheDocument();
  });

  it("says nothing without a run", () => {
    const initial = { ...GRAPH, nodes: GRAPH.nodes.map((n) => (n.id === "suivant" ? { ...n, config: { ...n.config, input: "{{start.city}}" } } : n)) };
    render(<Inspector nodeId="suivant" runOutputs={{}} initial={initial} />);
    expect(screen.queryByText(/not in the last output/)).not.toBeInTheDocument();
  });
});

describe("Input preview rendered by the engine", () => {
  const withInput = (input) => ({ ...GRAPH, nodes: GRAPH.nodes.map((n) => (n.id === "suivant" ? { ...n, config: { ...n.config, input } } : n)) });

  it("sends the template and the upstream outputs, and shows the result", async () => {
    renderWorkflowPreview.mockResolvedValue({ rendered: "Client Acme" });
    render(<Inspector nodeId="suivant" runOutputs={{ ...OUTPUTS, ailleurs: "x" }} initial={withInput("Client {{start.client}}")} />);
    expect(await screen.findByText("Client Acme")).toBeInTheDocument();
    const [body] = renderWorkflowPreview.mock.calls.at(-1);
    expect(body.template).toBe("Client {{start.client}}");
    expect(body.node_id).toBe("suivant");
    // Only what this node can reach: not a node off its path.
    expect(Object.keys(body.outputs).sort()).toEqual(["lignes", "redac", "start"]);
    // Once per change, not once per render.
    await new Promise((r) => setTimeout(r, 600));
    expect(renderWorkflowPreview).toHaveBeenCalledTimes(1);
  });

  it("shows the engine's template_ref_invalid", async () => {
    const err = Object.assign(new Error("422"), { status: 422, detail: { code: "template_ref_invalid", params: { node: "suivant", ref: "redac.texte" } } });
    renderWorkflowPreview.mockRejectedValue(err);
    render(<Inspector nodeId="suivant" runOutputs={OUTPUTS} initial={withInput("{{redac.texte}}")} />);
    expect(await screen.findByText("{{redac.texte}} cannot be resolved: the output it goes through is plain text.")).toBeInTheDocument();
  });

  it("does not call the engine without a run or with an empty input", async () => {
    render(<Inspector nodeId="suivant" runOutputs={OUTPUTS} initial={withInput("")} />);
    render(<Inspector nodeId="suivant" runOutputs={{}} initial={withInput("{{start.client}}")} />);
    await new Promise((r) => setTimeout(r, 600));
    expect(renderWorkflowPreview).not.toHaveBeenCalled();
  });
});
