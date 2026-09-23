/**
 * Importer un workflow depuis un fichier JSON, et exporter celui qu'on édite.
 *
 * L'import est exercé depuis WorkflowsPage, pas depuis le seul modal : c'est
 * la page qui appelle POST /workflows/defs, donc elle seule prouve que le
 * graphe lu dans le fichier arrive bien à l'API.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WorkflowsPage from "@/components/workflow-studio/WorkflowsPage";
import StudioTopBar from "@/components/workflow-studio/StudioTopBar";

vi.mock("@/lib/navigation", () => ({
  Link: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
  usePathname: () => "/workflows",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const { listWorkflowDefs, createWorkflowDef, duplicateWorkflowDef, deleteWorkflowDef } = vi.hoisted(() => ({
  listWorkflowDefs: vi.fn(),
  createWorkflowDef: vi.fn(),
  duplicateWorkflowDef: vi.fn(),
  deleteWorkflowDef: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  listWorkflowDefs,
  createWorkflowDef,
  duplicateWorkflowDef,
  deleteWorkflowDef,
}));

const GRAPH = {
  version: 1,
  nodes: [
    { id: "trigger1", type: "trigger", config: { kind: "manual" } },
    { id: "agent1", type: "agent", config: { agent_id: "7" } },
  ],
  edges: [{ source: "trigger1", target: "agent1" }],
};

const jsonFile = (content, name = "flow.json") =>
  new File([typeof content === "string" ? content : JSON.stringify(content)], name, {
    type: "application/json",
  });

const openImport = async (user) => {
  await user.click(screen.getByRole("button", { name: /New workflow/i }));
  await user.click(screen.getByRole("button", { name: /Import a JSON file/i }));
  return screen.getByLabelText(/Choose a file/i);
};

beforeEach(() => {
  vi.clearAllMocks();
  listWorkflowDefs.mockResolvedValue([]);
});

describe("importing a workflow file", () => {
  it("creates the workflow with the graph read from the file", async () => {
    const user = userEvent.setup();
    createWorkflowDef.mockResolvedValue({
      workflow_id: "wf9", name: "Lead triage", status: "draft", version: 1,
      updated_at: new Date().toISOString(), graph: GRAPH,
    });
    render(<WorkflowsPage />);
    await waitFor(() => expect(listWorkflowDefs).toHaveBeenCalled());

    const input = await openImport(user);
    await user.upload(input, jsonFile({ name: "Lead triage", graph: GRAPH }));

    // Le nom du fichier remplit le champ : l'import doit tenir en un geste.
    await waitFor(() => expect(screen.getByPlaceholderText(/Workflow name/i)).toHaveValue("Lead triage"));
    await user.click(screen.getByRole("button", { name: /^Create$/i }));

    await waitFor(() => expect(createWorkflowDef).toHaveBeenCalledTimes(1));
    expect(createWorkflowDef.mock.calls[0][0]).toMatchObject({ name: "Lead triage", graph: GRAPH });
  });

  it("accepts a bare graph and lets the user name it", async () => {
    const user = userEvent.setup();
    createWorkflowDef.mockResolvedValue({
      workflow_id: "wf9", name: "Renamed", status: "draft", version: 1,
      updated_at: new Date().toISOString(), graph: GRAPH,
    });
    render(<WorkflowsPage />);
    await waitFor(() => expect(listWorkflowDefs).toHaveBeenCalled());

    const input = await openImport(user);
    await user.upload(input, jsonFile(GRAPH));
    await user.type(screen.getByPlaceholderText(/Workflow name/i), "Renamed");
    await user.click(screen.getByRole("button", { name: /^Create$/i }));

    await waitFor(() => expect(createWorkflowDef).toHaveBeenCalledTimes(1));
    expect(createWorkflowDef.mock.calls[0][0].graph).toEqual(GRAPH);
  });

  it("explains a file that is not a workflow and creates nothing", async () => {
    const user = userEvent.setup();
    render(<WorkflowsPage />);
    await waitFor(() => expect(listWorkflowDefs).toHaveBeenCalled());

    const input = await openImport(user);
    await user.upload(input, jsonFile({ hello: "world" }));

    expect(await screen.findByText(/does not look like a workflow/i)).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText(/Workflow name/i), "Anything");
    expect(screen.getByRole("button", { name: /^Create$/i })).toBeDisabled();
    expect(createWorkflowDef).not.toHaveBeenCalled();
  });

  it("explains a file that is not JSON at all", async () => {
    const user = userEvent.setup();
    render(<WorkflowsPage />);
    await waitFor(() => expect(listWorkflowDefs).toHaveBeenCalled());

    const input = await openImport(user);
    await user.upload(input, jsonFile("{ not json", "broken.json"));

    expect(await screen.findByText(/is not valid JSON/i)).toBeInTheDocument();
    expect(createWorkflowDef).not.toHaveBeenCalled();
  });
});

describe("exporting the workflow being edited", () => {
  const topBarProps = {
    name: "Lead triage",
    onNameChange: vi.fn(),
    status: "draft",
    version: 2,
    saveState: "idle",
    validation: { errors: [] },
    onOpenVersions: vi.fn(),
    testOpen: false,
    onToggleTest: vi.fn(),
    onPublish: vi.fn(),
    onUnpublish: vi.fn(),
    publishing: false,
    conflict: null,
    onReloadConflict: vi.fn(),
  };

  it("offers an Export button that hands the current graph over", async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    render(<StudioTopBar {...topBarProps} onExport={onExport} />);

    await user.click(screen.getByRole("button", { name: /Export/i }));

    expect(onExport).toHaveBeenCalledTimes(1);
  });
});
