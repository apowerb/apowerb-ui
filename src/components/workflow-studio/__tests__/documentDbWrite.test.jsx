/**
 * Backend nodes `document` and `db_write`, and the Jev classifier's implicit
 * `uncertain` route (core workflow_graph.py): graph validation, node cards,
 * palette entries and inspector fields. Modeled after extractRag.test.jsx.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReactFlowProvider } from "@xyflow/react";
import { useState } from "react";
import en from "../../../../messages/en.json";
import fr from "../../../../messages/fr.json";
import StudioInspector from "@/components/workflow-studio/StudioInspector";
import StudioPalette from "@/components/workflow-studio/StudioPalette";
import { DocumentNode, DbWriteNode, ClassifierNode } from "@/components/workflow-studio/nodes/index.jsx";
import { declaredRoutesOf, firstUnwiredRoute } from "@/lib/nextNodeSuggestions";
import { createNode, graphToFlow, validateGraphLocal, NODE_TYPES, NODE_FAMILIES } from "@/lib/workflowGraph";

const GRAPH = {
  version: 1,
  nodes: [
    { id: "mail", type: "trigger", config: { kind: "manual" } },
    { id: "pieces", type: "document", config: { files: "{{mail.attachments}}" } },
    {
      id: "tri",
      type: "classifier",
      config: {
        engine: "jev",
        text: "Objet : {{mail.subject}}\n\n{{pieces.text}}",
        min_confidence: 0.7,
        routes: [
          { route: "ar", description: "Accusé de réception ..." },
          { route: "autre", description: "Tout autre document ..." },
        ],
      },
    },
    {
      id: "enregistrer",
      type: "db_write",
      config: {
        connection: "tool_config0",
        table: "documents_recus",
        values: {
          expediteur: "{{mail.from}}",
          sujet: "{{mail.subject}}",
          fichier: "{{pieces.documents.0.name}}",
          classe: "AR",
          extrait: "{{pieces.text}}",
        },
      },
    },
    { id: "fin_ar", type: "output", config: { value: "AR enregistré : {{mail.subject}}" } },
    { id: "fin_autre", type: "output", config: { value: "Pas un AR : {{mail.subject}}" } },
    { id: "fin_doute", type: "output", config: { value: "À vérifier à la main : {{mail.subject}}" } },
  ],
  edges: [
    { source: "mail", target: "pieces" },
    { source: "pieces", target: "tri" },
    { source: "tri", target: "enregistrer", route: "ar" },
    { source: "tri", target: "fin_autre", route: "autre" },
    { source: "tri", target: "fin_doute", route: "uncertain" },
    { source: "enregistrer", target: "fin_ar" },
  ],
};

const messagesOf = (graph) => validateGraphLocal(graph).errors.map((e) => e.message);
const withNode = (id, patch) => ({
  ...GRAPH,
  nodes: GRAPH.nodes.map((n) => (n.id === id ? { ...n, config: { ...n.config, ...patch } } : n)),
});

describe("graph model: document, db_write, jev classifier", () => {
  it("accepts the full mail-AR workflow with zero issue", () => {
    expect(validateGraphLocal(GRAPH).errors).toEqual([]);
  });

  it("knows both types, with safe defaults and families", () => {
    expect(NODE_TYPES).toEqual(expect.arrayContaining(["document", "db_write"]));
    expect(createNode("document").config).toEqual({ files: "" });
    expect(createNode("db_write").config).toEqual({ connection: "", table: "", values: {} });
    expect(NODE_FAMILIES.document.family).toBe("intelligence");
    expect(NODE_FAMILIES.db_write.family).toBe("tools");
  });

  it("refuses a document node with no files", () => {
    expect(messagesOf(withNode("pieces", { files: "  " }))).toContain("documentFilesRequired");
  });

  it("refuses a db_write with a URL as connection, a bad table, or no column", () => {
    expect(messagesOf(withNode("enregistrer", { connection: "postgres://x" }))).toContain("dbWriteConnectionInvalid");
    expect(messagesOf(withNode("enregistrer", { table: "a.b.c" }))).toContain("dbWriteTableInvalid:a.b.c");
    expect(messagesOf(withNode("enregistrer", { values: {} }))).toContain("dbWriteValuesRequired");
    expect(messagesOf(withNode("enregistrer", { values: { "bad col": "x" } }))).toContain("dbWriteColumnInvalid:bad col");
  });

  it("accepts schema.table", () => {
    expect(messagesOf(withNode("enregistrer", { table: "public.documents_recus" }))).toEqual([]);
  });

  it("only allows the uncertain route when the classifier engine is jev", () => {
    expect(messagesOf(withNode("tri", { engine: "agent", agent_id: "a1" }))).toContain("unknownRoute:uncertain");
  });

  it("refuses a user route named uncertain, a route without description, and a bad min_confidence on jev", () => {
    const reserved = withNode("tri", { routes: [{ route: "uncertain", description: "x" }, { route: "autre", description: "y" }] });
    expect(messagesOf(reserved)).toContain("classifierUncertainReserved");
    const noDesc = withNode("tri", { routes: [{ route: "ar", description: "" }, { route: "autre", description: "y" }] });
    expect(messagesOf(noDesc)).toContain("classifierRouteDescriptionRequired:ar");
    expect(messagesOf(withNode("tri", { min_confidence: 0 }))).toContain("classifierMinConfidence");
    expect(messagesOf(withNode("tri", { min_confidence: 1.5 }))).toContain("classifierMinConfidence");
  });

  it("resolves the declared outputs of document and db_write, and rejects others", () => {
    const bad = withNode("enregistrer", { values: { a: "{{pieces.bogus}}", b: "{{pieces.count}}" } });
    const msgs = messagesOf(bad);
    expect(msgs).toContain("templateRefUnknownField:{{pieces.bogus}}");
    expect(msgs.some((m) => m.includes("pieces.count"))).toBe(false);
    const out = {
      ...GRAPH,
      nodes: GRAPH.nodes.map((n) => (n.id === "fin_ar" ? { ...n, config: { value: "{{enregistrer.inserted}} {{enregistrer.table}} {{enregistrer.nope}}" } } : n)),
    };
    expect(messagesOf(out)).toEqual(["templateRefUnknownField:{{enregistrer.nope}}"]);
  });

  it("declares uncertain as a branch of a jev classifier (suggestions)", () => {
    const tri = GRAPH.nodes.find((n) => n.id === "tri");
    expect(declaredRoutesOf(tri)).toEqual(["ar", "autre", "uncertain"]);
    expect(firstUnwiredRoute(tri, [{ source: "tri", data: { route: "ar" } }, { source: "tri", data: { route: "autre" } }])).toBe("uncertain");
    expect(declaredRoutesOf({ ...tri, config: { ...tri.config, engine: "agent" } })).toEqual(["ar", "autre"]);
  });
});

describe("messages", () => {
  it.each([["en", en], ["fr", fr]])("%s: palette, help and validation texts exist", (_l, m) => {
    for (const k of ["nodeDocument", "nodeDb_write"]) expect(m.WorkflowPalette[k], k).toBeTruthy();
    for (const k of ["document_what", "document_output", "db_write_what", "db_write_output"]) expect(m.WorkflowNodeHelp[k], k).toBeTruthy();
    for (const k of ["documentFilesRequired", "dbWriteConnectionInvalid", "dbWriteTableInvalid", "dbWriteValuesRequired", "dbWriteColumnInvalid", "classifierUncertainReserved", "classifierRouteDescriptionRequired", "classifierMinConfidence"]) {
      expect(m.WorkflowValidation[k], k).toBeTruthy();
    }
  });
  it("uses beginner-friendly names", () => {
    expect(en.WorkflowPalette.nodeDocument).toBe("Read document");
    expect(en.WorkflowPalette.nodeDb_write).toBe("Write to database");
    expect(fr.WorkflowPalette.nodeDocument).toBe("Lire un document");
    expect(fr.WorkflowPalette.nodeDb_write).toBe("Écrire en base");
  });
});

describe("node cards", () => {
  const renderNode = (ui) => render(<ReactFlowProvider>{ui}</ReactFlowProvider>);

  it("document: title and OCR subtitle", () => {
    renderNode(<DocumentNode data={{ config: { files: "{{mail.attachments}}" } }} />);
    expect(screen.getByText("Read document")).toBeInTheDocument();
    expect(screen.getByText("OCR · Document Intelligence")).toBeInTheDocument();
  });

  it("db_write: title and the table as subtitle", () => {
    renderNode(<DbWriteNode data={{ config: { connection: "tool_config0", table: "documents_recus", values: { a: "1" } } }} />);
    expect(screen.getByText("Write to database")).toBeInTheDocument();
    expect(screen.getByText("documents_recus")).toBeInTheDocument();
  });

  it("jev classifier: shows Jev, its routes and the uncertain branch", () => {
    renderNode(<ClassifierNode data={{ config: GRAPH.nodes[2].config }} />);
    expect(screen.getByText("ar")).toBeInTheDocument();
    expect(screen.getByText("autre")).toBeInTheDocument();
    expect(screen.getByText("Uncertain")).toBeInTheDocument();
    expect(screen.getByText("Jev")).toBeInTheDocument();
  });

  it("agent classifier: no uncertain branch", () => {
    renderNode(<ClassifierNode data={{ config: { agent_id: "a", routes: [{ route: "x" }, { route: "y" }] } }} />);
    expect(screen.queryByText("Uncertain")).toBeNull();
  });
});

describe("palette", () => {
  it("lists both nodes and adds them by click", async () => {
    const user = userEvent.setup();
    const added = [];
    render(<StudioPalette onAdd={(t) => added.push(t)} />);
    await user.click(screen.getByText("Read document"));
    await user.click(screen.getByText("Write to database"));
    expect(added).toEqual(["document", "db_write"]);
  });
});

function Inspector({ graph, nodeId, onConfig = () => {}, toolOptions }) {
  const [flow, setFlow] = useState(() => graphToFlow(graph));
  const node = flow.nodes.find((n) => n.id === nodeId);
  return (
    <StudioInspector
      selection={{ kind: "node", node }}
      nodes={flow.nodes}
      edges={flow.edges}
      toolOptions={toolOptions}
      agentOptions={[{ value: "agent1", label: "Agent One" }]}
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

describe("inspector: document", () => {
  it("edits the files template", async () => {
    const user = userEvent.setup();
    const patches = [];
    render(<Inspector graph={GRAPH} nodeId="pieces" onConfig={(p) => patches.push(p)} />);
    const files = screen.getByLabelText(/Files/i);
    expect(files).toHaveValue("{{mail.attachments}}");
    await user.type(files, "x");
    expect(patches.at(-1)).toEqual({ files: "{{mail.attachments}}x" });
  });
});

describe("inspector: db_write", () => {
  it("shows connection, table and values, and edits them", async () => {
    const user = userEvent.setup();
    const patches = [];
    render(<Inspector graph={GRAPH} nodeId="enregistrer" onConfig={(p) => patches.push(p)} />);
    expect(screen.getByLabelText(/Connection/i)).toHaveValue("tool_config0");
    const table = screen.getByLabelText(/^Table/i);
    expect(table).toHaveValue("documents_recus");
    expect(screen.getByDisplayValue("expediteur")).toBeInTheDocument();
    expect(screen.getByDisplayValue("{{mail.from}}")).toBeInTheDocument();
    expect(screen.getByDisplayValue("AR")).toBeInTheDocument();

    await user.type(table, "2");
    expect(patches.at(-1)).toEqual({ table: "documents_recus2" });

    await user.click(screen.getByRole("button", { name: /Add a column/i }));
    expect(Object.keys(patches.at(-1).values)).toHaveLength(6);

    await user.click(screen.getAllByRole("button", { name: /Remove column/i })[0]);
    expect(patches.at(-1).values).not.toHaveProperty("expediteur");
  });

  it("offers the registered database connections", () => {
    render(
      <Inspector
        graph={GRAPH}
        nodeId="enregistrer"
        toolOptions={[{ value: "tool_config0", label: "Base clients" }, { value: "web_search", label: "Search" }]}
      />,
    );
    expect(document.querySelector("datalist option[value=tool_config0]")).not.toBeNull();
    expect(document.querySelector("datalist option[value=web_search]")).toBeNull();
  });
});

describe("inspector: jev classifier", () => {
  it("shows the engine and min_confidence, and hides the agent picker", async () => {
    const user = userEvent.setup();
    const patches = [];
    render(<Inspector graph={GRAPH} nodeId="tri" onConfig={(p) => patches.push(p)} />);
    expect(screen.getByLabelText(/Engine/i)).toHaveValue("jev");
    const mc = screen.getByLabelText(/Minimum confidence/i);
    expect(mc).toHaveValue("0.7");
    expect(screen.queryByLabelText(/^Agent/i)).toBeNull();
    await user.clear(mc);
    await user.type(mc, "0.9");
    expect(patches.at(-1)).toEqual({ min_confidence: 0.9 });
  });

  it("switching to Jev sets the engine; the agent engine keeps the agent picker", async () => {
    const user = userEvent.setup();
    const patches = [];
    render(
      <Inspector
        graph={{ nodes: [{ id: "t", type: "trigger", config: {} }, { id: "c", type: "classifier", config: { agent_id: "", routes: [] } }], edges: [{ source: "t", target: "c" }] }}
        nodeId="c"
        onConfig={(p) => patches.push(p)}
      />,
    );
    expect(screen.getByLabelText(/^Agent/i)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/Engine/i), "jev");
    expect(patches.at(-1)).toEqual({ engine: "jev" });
  });
});
