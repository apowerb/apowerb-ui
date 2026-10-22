/**
 * Output nodes `file` (create a CSV, Excel, JSON, Markdown, text, Word or PDF
 * file) and `file_save` (drop it on OneDrive), and email attachments on the
 * `notification` node (core workflow_graph.py): graph validation, node cards,
 * palette, inspector, "Test up to here" effects, run errors and the download
 * in the Test panel. Modeled after documentDbWrite.test.jsx.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReactFlowProvider } from "@xyflow/react";
import { useState } from "react";
import { IntlProvider } from "use-intl";
import en from "../../../../messages/en.json";
import fr from "../../../../messages/fr.json";
import StudioInspector from "@/components/workflow-studio/StudioInspector";
import StudioPalette from "@/components/workflow-studio/StudioPalette";
import ExecutionPanel, { errorText } from "@/components/workflow-studio/ExecutionPanel";
import { FileNode, FileSaveNode } from "@/components/workflow-studio/nodes/index.jsx";
import { suggestNextNodes, prefillFor } from "@/lib/nextNodeSuggestions";
import { effectfulNodesUpTo, effectfulNodesFrom } from "@/lib/workflowShapes";
import { applyRunEvent, createRunState } from "@/lib/workflowRunState";
import { createNode, graphToFlow, validateGraphLocal, NODE_TYPES, NODE_FAMILIES, FILE_FORMATS } from "@/lib/workflowGraph";

const downloadWorkflowFile = vi.fn().mockResolvedValue(new Blob(["a,b\n"], { type: "text/csv" }));
vi.mock("@/lib/api", () => ({
  downloadWorkflowFile: (...args) => downloadWorkflowFile(...args),
  getToolSchema: vi.fn().mockResolvedValue({ params: [], accepts_kwargs: true }),
  getTeamsWebhookStatus: vi.fn().mockResolvedValue({ configured: true }),
}));
vi.mock("@/components/bi/ChartRenderer", () => ({ default: () => null }));

const GRAPH = {
  version: 1,
  nodes: [
    { id: "t", type: "trigger", config: { kind: "manual" } },
    { id: "prevision", type: "agent", config: { agent_id: "a1" } },
    { id: "tableau", type: "file", config: { format: "xlsx", filename: "previsions-{{t.mois}}", content: "{{prevision}}", sheet_name: "Ventes" } },
    { id: "rapport", type: "file", config: { format: "pdf", content: "# Prévisions\n{{prevision}}" } },
    { id: "depot", type: "file_save", config: { provider: "onedrive", file: "{{tableau}}", folder: "Rapports/Ventes", conflict: "rename" } },
    {
      id: "mail",
      type: "notification",
      config: { channel: "email", to: ["farid@example.com"], subject: "Prévisions", body: "Lien : {{depot.web_url}}", attachments: "{{rapport}}" },
    },
    { id: "fin", type: "output", config: { value: "{{tableau.name}} {{tableau.rows}} {{mail.sent}}" } },
  ],
  edges: [
    { source: "t", target: "prevision" },
    { source: "prevision", target: "tableau" },
    { source: "tableau", target: "rapport" },
    { source: "rapport", target: "depot" },
    { source: "depot", target: "mail" },
    { source: "mail", target: "fin" },
  ],
};

const messagesOf = (graph) => validateGraphLocal(graph).errors.map((e) => e.message);
const withNode = (id, patch) => ({
  ...GRAPH,
  nodes: GRAPH.nodes.map((n) => (n.id === id ? { ...n, config: { ...n.config, ...patch } } : n)),
});

describe("graph model: file, file_save, email attachments", () => {
  it("accepts the full forecast-report workflow with zero issue", () => {
    expect(validateGraphLocal(GRAPH).errors).toEqual([]);
  });

  it("knows both types, with safe defaults, in the output family", () => {
    expect(NODE_TYPES).toEqual(expect.arrayContaining(["file", "file_save"]));
    expect(createNode("file").config).toEqual({ format: "csv", filename: "", content: "" });
    expect(createNode("file_save").config).toEqual({ provider: "onedrive", file: "", folder: "", conflict: "rename" });
    expect(NODE_FAMILIES.file.family).toBe("output");
    expect(NODE_FAMILIES.file_save.family).toBe("output");
  });

  it("mirrors the engine's formats", () => {
    expect(FILE_FORMATS).toEqual(["csv", "xlsx", "json", "markdown", "text", "docx", "pdf"]);
  });

  it("refuses an unknown format, an empty content, a bad sheet name or a too long file name", () => {
    expect(messagesOf(withNode("tableau", { format: "exe" }))).toContain("fileFormatUnknown:exe");
    expect(messagesOf(withNode("tableau", { content: " " }))).toContain("fileContentRequired");
    expect(messagesOf(withNode("tableau", { sheet_name: "a/b" }))).toContain("fileSheetInvalid");
    expect(messagesOf(withNode("tableau", { sheet_name: "x".repeat(32) }))).toContain("fileSheetInvalid");
    expect(messagesOf(withNode("tableau", { filename: "x".repeat(121) }))).toContain("fileFilenameTooLong");
  });

  it("refuses a file_save with an unknown storage, no file, a climbing folder or an unknown conflict mode", () => {
    expect(messagesOf(withNode("depot", { provider: "dropbox" }))).toContain("fileSaveProviderUnknown:dropbox");
    expect(messagesOf(withNode("depot", { file: "" }))).toContain("fileSaveFileRequired");
    expect(messagesOf(withNode("depot", { folder: "a/../b" }))).toContain("fileSaveFolderInvalid");
    expect(messagesOf(withNode("depot", { folder: "a\\b" }))).toContain("fileSaveFolderInvalid");
    expect(messagesOf(withNode("depot", { conflict: "merge" }))).toContain("fileSaveConflictUnknown:merge");
  });

  it("judges a folder like the engine: a long reference counts once rendered, an empty conflict means rename", () => {
    expect(messagesOf(withNode("depot", { folder: `Rapports/{{${"t".repeat(250)}}}` }))).not.toContain("fileSaveFolderInvalid");
    expect(messagesOf(withNode("depot", { folder: "x".repeat(201) }))).toContain("fileSaveFolderInvalid");
    expect(messagesOf(withNode("depot", { conflict: null }))).toEqual([]);
    expect(messagesOf(withNode("depot", { conflict: "" }))).toEqual([]);
  });

  it("refuses control characters in a folder, like the engine", () => {
    expect(messagesOf(withNode("depot", { folder: "Rapports\u0007" }))).toContain("fileSaveFolderInvalid");
    expect(messagesOf(withNode("depot", { folder: "Rapports\nmois" }))).toContain("fileSaveFolderInvalid");
    expect(messagesOf(withNode("depot", { folder: "Rapports/2026" }))).not.toContain("fileSaveFolderInvalid");
  });

  it("only lets an email carry attachments", () => {
    expect(messagesOf(withNode("mail", { channel: "teams", to: [] }))).toContain("notificationAttachmentsEmailOnly");
    expect(messagesOf(withNode("mail", { attachments: "" }))).toEqual([]);
    expect(messagesOf(withNode("mail", { attachments: { ref: "x" } }))).toContain("notificationAttachmentBadRef");
    expect(messagesOf(withNode("mail", { attachments: ["{{rapport}}", "{{tableau}}"] }))).toEqual([]);
  });

  it("resolves the declared outputs of file and file_save, and rejects others", () => {
    const out = withNode("fin", { value: "{{tableau.ref}} {{tableau.size}} {{depot.path}} {{tableau.nope}} {{depot.nope}}" });
    expect(messagesOf(out)).toEqual(["templateRefUnknownField:{{tableau.nope}}", "templateRefUnknownField:{{depot.nope}}"]);
  });

  it("suggests what usually follows a file, already pointing at it", () => {
    const file = { id: "f1", type: "file", config: {} };
    const suggestions = suggestNextNodes(file, [file, { id: "o", type: "output" }], []);
    expect(suggestions.map((s) => s.type)).toEqual(["notification", "file_save", "output"]);
    expect(suggestions[0].config).toEqual({ channel: "email", attachments: "{{f1}}" });
    expect(suggestions[1].config).toEqual({ file: "{{f1}}" });
    expect(prefillFor("file", { id: "a1", type: "agent" })).toEqual({ content: "{{a1}}" });
  });
});

describe("Test up to here", () => {
  it("lists a produced file and a OneDrive drop as effects", () => {
    const flow = graphToFlow(GRAPH);
    const types = effectfulNodesUpTo("mail", flow.nodes, flow.edges).map((e) => e.type);
    expect(types).toEqual(expect.arrayContaining(["file", "file_save", "notification"]));
  });

  it("asks before a Resume here that would produce or drop files again", () => {
    const flow = graphToFlow(GRAPH);
    const from = (id) => effectfulNodesFrom(id, flow.nodes, flow.edges).map((e) => e.id);
    // Failed on the spreadsheet: it and everything below runs again.
    expect(from("tableau")).toEqual(["tableau", "rapport", "depot", "mail"]);
    // Failed on the drop: the files above are replayed, not produced again.
    expect(from("depot")).toEqual(["depot", "mail"]);
  });
});

const ENGINE_CODES = [
  "file_bad_rows",
  "file_empty",
  "file_text_too_long",
  "file_too_many_rows",
  "file_too_many_columns",
  "file_too_many_cells",
  "file_too_deep",
  "file_too_many_lines",
  "file_too_large",
  "file_build_failed",
  "file_run_limit",
  "file_save_bad_file",
  "file_save_folder_invalid",
  "file_save_not_found",
  "file_save_failed",
  "notification_attachment_bad_ref",
  "notification_too_many_attachments",
  "notification_attachment_missing",
  "notification_attachment_not_found",
  "notification_attachments_too_large",
  "notification_attachments_email_only",
];

describe("messages", () => {
  it.each([["en", en], ["fr", fr]])("%s: palette, help, validation, effects and run errors exist", (_l, m) => {
    for (const k of ["nodeFile", "nodeFile_save"]) expect(m.WorkflowPalette[k], k).toBeTruthy();
    for (const k of ["file_what", "file_output", "file_save_what", "file_save_output"]) expect(m.WorkflowNodeHelp[k], k).toBeTruthy();
    for (const k of [
      "fileFormatUnknown",
      "fileContentRequired",
      "fileSheetInvalid",
      "fileFilenameTooLong",
      "fileSaveProviderUnknown",
      "fileSaveFileRequired",
      "fileSaveFolderInvalid",
      "fileSaveConflictUnknown",
      "notificationAttachmentsEmailOnly",
      "notificationAttachmentBadRef",
    ]) {
      expect(m.WorkflowValidation[k], k).toBeTruthy();
    }
    for (const k of ["testUntilEffect_file", "testUntilEffect_file_save"]) expect(m.WorkflowInspector[k], k).toBeTruthy();
    for (const code of ENGINE_CODES) expect(m.WorkflowExecutionPanel[`runError_${code}`], code).toBeTruthy();
  });

  it("words every engine code in the run panel instead of showing it raw", () => {
    const t = (key, params) => `${key}|${JSON.stringify(params || {})}`;
    for (const code of ENGINE_CODES) {
      expect(errorText(t, { code, message: "raw", params: { node: "n", max: "5" } })).toMatch(new RegExp(`^runError_${code}\\|`));
    }
  });

  it("never promises tables in a PDF, and never shows a raw OneDrive message", () => {
    for (const m of [en, fr]) {
      expect(m.WorkflowExecutionPanel.runError_file_save_failed).not.toContain("{message}");
      expect(m.WorkflowInspector.fileContentHelp_text).toMatch(/Word/);
    }
    expect(en.WorkflowInspector.fileContentHelp_text).toContain("tables (Word only)");
  });

  it("uses beginner-friendly names", () => {
    expect(en.WorkflowPalette.nodeFile).toBe("Create file");
    expect(en.WorkflowPalette.nodeFile_save).toBe("Save to OneDrive");
    expect(fr.WorkflowPalette.nodeFile).toBe("Créer un fichier");
    expect(fr.WorkflowPalette.nodeFile_save).toBe("Déposer sur OneDrive");
  });
});

describe("node cards", () => {
  const renderNode = (ui) => render(<ReactFlowProvider>{ui}</ReactFlowProvider>);

  it("file: title and format as subtitle", () => {
    renderNode(<FileNode data={{ config: { format: "xlsx", content: "{{a}}" } }} />);
    expect(screen.getByText("Create file")).toBeInTheDocument();
    expect(screen.getByText("Excel (.xlsx)")).toBeInTheDocument();
  });

  it("file_save: title and folder as subtitle", () => {
    renderNode(<FileSaveNode data={{ config: { provider: "onedrive", file: "{{f}}", folder: "Rapports" } }} />);
    expect(screen.getByText("Save to OneDrive")).toBeInTheDocument();
    expect(screen.getByText("Rapports")).toBeInTheDocument();
  });
});

describe("palette", () => {
  it("lists both nodes and adds them by click", async () => {
    const user = userEvent.setup();
    const added = [];
    render(<StudioPalette onAdd={(t) => added.push(t)} />);
    await user.click(screen.getByText("Create file"));
    await user.click(screen.getByText("Save to OneDrive"));
    expect(added).toEqual(["file", "file_save"]);
  });
});

function Inspector({ graph, nodeId, onConfig = () => {} }) {
  const [flow, setFlow] = useState(() => graphToFlow(graph));
  const node = flow.nodes.find((n) => n.id === nodeId);
  return (
    <StudioInspector
      selection={{ kind: "node", node }}
      nodes={flow.nodes}
      edges={flow.edges}
      agentOptions={[{ value: "a1", label: "Prévision" }]}
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

describe("inspector: file", () => {
  it("shows format, file name, content and the sheet for Excel, and edits them", async () => {
    const user = userEvent.setup();
    const patches = [];
    render(<Inspector graph={GRAPH} nodeId="tableau" onConfig={(p) => patches.push(p)} />);
    expect(screen.getByLabelText(/^Format/i)).toHaveValue("xlsx");
    expect(screen.getByLabelText(/^File name/i)).toHaveValue("previsions-{{t.mois}}");
    expect(screen.getByLabelText(/^Content/i)).toHaveValue("{{prevision}}");
    const sheet = screen.getByLabelText(/^Sheet/i);
    expect(sheet).toHaveValue("Ventes");
    await user.type(sheet, "2");
    expect(patches.at(-1)).toEqual({ sheet_name: "Ventes2" });
    await user.selectOptions(screen.getByLabelText(/^Format/i), "pdf");
    expect(patches.at(-1)).toEqual({ format: "pdf", sheet_name: undefined });
    expect(screen.queryByLabelText(/^Sheet/i)).toBeNull();
    expect(screen.getByText(/\{\{tableau\.ref\}\}/)).toBeInTheDocument();
  });
});

describe("inspector: file_save", () => {
  it("shows file, folder and conflict mode, and edits them", async () => {
    const user = userEvent.setup();
    const patches = [];
    render(<Inspector graph={GRAPH} nodeId="depot" onConfig={(p) => patches.push(p)} />);
    expect(screen.getByLabelText(/^File to save/i)).toHaveValue("{{tableau}}");
    const folder = screen.getByLabelText(/^Folder/i);
    expect(folder).toHaveValue("Rapports/Ventes");
    await user.type(folder, "/2026");
    expect(patches.at(-1)).toEqual({ folder: "Rapports/Ventes/2026" });
    await user.selectOptions(screen.getByLabelText(/^If the file exists/i), "replace");
    expect(patches.at(-1)).toEqual({ conflict: "replace" });
  });
});

describe("inspector: email attachments", () => {
  it("edits the attachments of an email, and hides them for Teams", async () => {
    const user = userEvent.setup();
    const patches = [];
    render(<Inspector graph={GRAPH} nodeId="mail" onConfig={(p) => patches.push(p)} />);
    const att = screen.getByLabelText(/^Attachments/i);
    expect(att).toHaveValue("{{rapport}}");
    await user.clear(att);
    expect(patches.at(-1)).toEqual({ attachments: undefined });
    await user.selectOptions(screen.getByLabelText(/^Channel/i), "teams");
    expect(screen.queryByLabelText(/^Attachments/i)).toBeNull();
  });
});

describe("test panel", () => {
  it("offers the produced file for download", async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn(() => "blob:x");
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const runState = [
      { event: "run_started" },
      { event: "node_start", node_id: "tableau", type: "file" },
      {
        event: "node_complete",
        node_id: "tableau",
        output: { name: "previsions.xlsx", ref: "att_" + "a".repeat(32), size: 4200, content_type: "x", format: "xlsx", rows: 12 },
        duration_ms: 3,
        artifacts: [{ file_ref: "att_" + "a".repeat(32), file_name: "previsions.xlsx", size: 4200 }],
      },
    ].reduce(applyRunEvent, createRunState());
    render(
      <IntlProvider locale="en" messages={en}>
        <ExecutionPanel open onToggle={() => {}} payloadText="{}" onPayloadTextChange={() => {}} payloadError={null} isRunning={false} runState={runState} onRun={() => {}} onCancel={() => {}} />
      </IntlProvider>,
    );
    await user.click(screen.getByRole("button", { name: /previsions\.xlsx/ }));
    await waitFor(() => expect(downloadWorkflowFile).toHaveBeenCalledWith("att_" + "a".repeat(32)));
    expect(createObjectURL).toHaveBeenCalled();
  });
});
