/**
 * The link of a decision notice (mail, Teams): `/workflows?decision=<run_id>`.
 * The page asks to sign in like any other; once there, the dialog of that
 * decision opens by itself — for the owner as for an assignee, who cannot
 * open the studio. A link that no longer leads to a waiting decision says so
 * instead of showing nothing.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WorkflowsPage from "@/components/workflow-studio/WorkflowsPage";

vi.mock("@/lib/navigation", () => ({
  Link: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
  usePathname: () => "/workflows",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { email: "bob@example.com" } }) }));

const api = vi.hoisted(() => ({
  listWorkflowDefs: vi.fn(),
  createWorkflowDef: vi.fn(),
  duplicateWorkflowDef: vi.fn(),
  deleteWorkflowDef: vi.fn(),
  getWorkflowDef: vi.fn(),
  listAwaitingDecisions: vi.fn(),
  resumeWorkflowRun: vi.fn(),
  abandonWorkflowRun: vi.fn(),
}));
vi.mock("@/lib/api", () => api);

const ASSIGNED = { run_id: "r2", owner_id: "alice@example.com", workflow_id: "w2", workflow_name: "Congés", node_id: "d2", question: "Accorder ?", mode: "text", choices: [], assignee: "bob@example.com", mine: false, paused_at: "2026-10-21T11:00:00+00:00", expires_at: "2026-10-28T11:00:00+00:00" };
const OWNED = { run_id: "r1", owner_id: "bob@example.com", workflow_id: "w1", workflow_name: "Achats", node_id: "d1", question: "Valider ?", mode: "choices", choices: [{ route: "oui", label: "Oui" }], assignee: null, mine: true, paused_at: "2026-10-21T10:00:00+00:00" };

const visit = (search) => window.history.replaceState({}, "", `/workflows${search}`);

beforeEach(() => {
  vi.clearAllMocks();
  api.listWorkflowDefs.mockResolvedValue([]);
  api.listAwaitingDecisions.mockResolvedValue([OWNED, ASSIGNED]);
});

afterEach(() => visit(""));

describe("WorkflowsPage - opened from a decision notice", () => {
  it("opens the dialog of the linked decision, not another one", async () => {
    visit("?decision=r2");
    render(<WorkflowsPage />);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Accorder ?")).toBeInTheDocument();
    expect(within(dialog).queryByText("Valider ?")).toBeNull();
  });

  it("answers the linked decision from the dialog", async () => {
    api.resumeWorkflowRun.mockReturnValue(new Promise(() => {}));
    visit("?decision=r2");
    const user = userEvent.setup();
    render(<WorkflowsPage />);
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByRole("textbox"), "oui");
    await user.click(within(dialog).getByRole("button", { name: "Send" }));
    expect(api.resumeWorkflowRun).toHaveBeenCalledWith("r2", { text: "oui" }, expect.anything());
  });

  it("says when the linked decision no longer waits, and opens nothing", async () => {
    visit("?decision=gone");
    render(<WorkflowsPage />);
    expect(await screen.findByText("This decision is no longer waiting for you: it was answered, abandoned or it expired.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("says it too when no decision waits at all", async () => {
    api.listAwaitingDecisions.mockResolvedValue([]);
    visit("?decision=r2");
    render(<WorkflowsPage />);
    expect(await screen.findByText("This decision is no longer waiting for you: it was answered, abandoned or it expired.")).toBeInTheDocument();
  });

  it("opens nothing without a link", async () => {
    render(<WorkflowsPage />);
    await screen.findByText("Accorder ?");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText(/no longer waiting for you/)).toBeNull();
  });

  it("does not reopen the dialog once closed", async () => {
    visit("?decision=r2");
    const user = userEvent.setup();
    render(<WorkflowsPage />);
    const dialog = await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await screen.findByText("Accorder ?");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(dialog).not.toBeInTheDocument();
  });
});
