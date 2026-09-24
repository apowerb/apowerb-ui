import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WorkflowsPage from "@/components/workflow-studio/WorkflowsPage";

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

const ONE_WORKFLOW = [
  {
    workflow_id: "wf1",
    name: "Lead triage",
    description: "Routes a lead to the right agent",
    status: "published",
    version: 3,
    node_count: 5,
    updated_at: new Date().toISOString(),
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  listWorkflowDefs.mockResolvedValue(ONE_WORKFLOW);
});

describe("WorkflowsPage", () => {
  it("shows the Preview badge with its tooltip next to the page title (roadmap#100)", async () => {
    render(<WorkflowsPage />);
    await waitFor(() => expect(screen.getByText("Lead triage")).toBeInTheDocument());
    const badge = screen.getByTestId("preview-badge");
    expect(badge).toHaveTextContent("Preview");
    expect(badge).toHaveAttribute("title", "Preview feature — feedback welcome");
  });

  it("lists workflows with their status, version and node count", async () => {
    render(<WorkflowsPage />);
    await waitFor(() => expect(screen.getByText("Lead triage")).toBeInTheDocument());
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.getByText("v3")).toBeInTheDocument();
    expect(screen.getByText("5 nodes")).toBeInTheDocument();
  });

  it("shows an empty state when there are no workflows", async () => {
    listWorkflowDefs.mockResolvedValue([]);
    render(<WorkflowsPage />);
    await waitFor(() => expect(screen.getByText(/No workflow yet/i)).toBeInTheDocument());
  });

  it("filters by name via the search box", async () => {
    const user = userEvent.setup();
    listWorkflowDefs.mockResolvedValue([
      ...ONE_WORKFLOW,
      { workflow_id: "wf2", name: "Weekly digest", status: "draft", version: 1, node_count: 2, updated_at: new Date().toISOString() },
    ]);
    render(<WorkflowsPage />);
    await waitFor(() => expect(screen.getByText("Lead triage")).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText(/Search workflows/i), "digest");

    expect(screen.queryByText("Lead triage")).not.toBeInTheDocument();
    expect(screen.getByText("Weekly digest")).toBeInTheDocument();
  });

  it("creates a blank workflow with just a trigger node", async () => {
    const user = userEvent.setup();
    // Forme réelle de POST /workflows/defs : le workflow complet, graphe
    // compris, sans ``node_count`` (réservé à la liste).
    createWorkflowDef.mockResolvedValue({
      workflow_id: "wf9", name: "New flow", status: "draft", version: 1, updated_at: new Date().toISOString(),
      graph: { version: 1, nodes: [{ id: "trigger1", type: "trigger", config: { kind: "manual" } }], edges: [] },
    });
    render(<WorkflowsPage />);
    await waitFor(() => expect(screen.getByText("Lead triage")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /New workflow/i }));
    await user.click(screen.getByRole("button", { name: /Start from scratch/i }));
    await user.type(screen.getByPlaceholderText(/Workflow name/i), "New flow");
    await user.click(screen.getByRole("button", { name: /^Create$/i }));

    await waitFor(() => expect(createWorkflowDef).toHaveBeenCalledTimes(1));
    const payload = createWorkflowDef.mock.calls[0][0];
    expect(payload.name).toBe("New flow");
    expect(payload.graph.nodes).toHaveLength(1);
    expect(payload.graph.nodes[0].type).toBe("trigger");

    expect(await screen.findByText("New flow")).toBeInTheDocument();
    expect(screen.getByText("1 node")).toBeInTheDocument();
  });

  it("submits the create dialog with Enter from the name field", async () => {
    const user = userEvent.setup();
    createWorkflowDef.mockResolvedValue({
      workflow_id: "wf8", name: "Via Enter", status: "draft", version: 1, updated_at: new Date().toISOString(),
      graph: { version: 1, nodes: [{ id: "trigger1", type: "trigger", config: {} }], edges: [] },
    });
    render(<WorkflowsPage />);
    await waitFor(() => expect(screen.getByText("Lead triage")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /New workflow/i }));
    await user.type(screen.getByPlaceholderText(/Workflow name/i), "Via Enter{Enter}");
    await waitFor(() => expect(createWorkflowDef).toHaveBeenCalledTimes(1));
    expect(createWorkflowDef.mock.calls[0][0].name).toBe("Via Enter");
  });

  it("renders the create dialog on an opaque surface", async () => {
    const user = userEvent.setup();
    render(<WorkflowsPage />);
    await waitFor(() => expect(screen.getByText("Lead triage")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /New workflow/i }));
    // th-bg-elevated vaut rgba(255,255,255,0.07) en thème sombre : la page se
    // lisait à travers la modale. th-bg-modal est le jeton opaque du dépôt.
    const form = screen.getByPlaceholderText(/Workflow name/i).closest("form");
    expect(form.className).toContain("th-bg-modal");
    expect(form.className).not.toContain("th-bg-elevated");
  });

  it("tells the user when duplicating fails", async () => {
    const user = userEvent.setup();
    duplicateWorkflowDef.mockRejectedValue(new Error("quota atteint"));
    render(<WorkflowsPage />);
    await waitFor(() => expect(screen.getByText("Lead triage")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /Duplicate/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("quota atteint");
  });

  it("asks for confirmation before deleting a workflow", async () => {
    const user = userEvent.setup();
    deleteWorkflowDef.mockResolvedValue(undefined);
    render(<WorkflowsPage />);
    await waitFor(() => expect(screen.getByText("Lead triage")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /Delete/i }));
    expect(screen.getByText(/permanently deleted/i)).toBeInTheDocument();
    expect(deleteWorkflowDef).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /^Delete$/i }));
    await waitFor(() => expect(deleteWorkflowDef).toHaveBeenCalledWith("wf1"));
    await waitFor(() => expect(screen.queryByText("Lead triage")).not.toBeInTheDocument());
  });
});
