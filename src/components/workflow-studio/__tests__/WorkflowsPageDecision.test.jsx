/**
 * The workflows page, seen by someone who is ASKED to decide (an assignee, not
 * the owner of the workflow): they answer from the list, in a dialog on the
 * page. The studio is not involved: it loads the workflow by `getWorkflowDef`,
 * which only the owner may call (404 otherwise).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WorkflowsPage from "@/components/workflow-studio/WorkflowsPage";

vi.mock("@/lib/navigation", () => ({
  Link: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
  usePathname: () => "/workflows",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { email: "Bob@example.com" } }) }));

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

const enc = new TextEncoder();
const sse = (events) => ({
  ok: true,
  status: 200,
  body: new ReadableStream({
    start(c) {
      for (const e of events) c.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
      c.close();
    },
  }),
});

const ASSIGNED = { run_id: "r2", owner_id: "alice@example.com", workflow_id: "w2", workflow_name: "Congés", node_id: "d2", question: "Accorder ?", mode: "text", choices: [], assignee: "bob@example.com", paused_at: "2026-10-21T11:00:00Z" };
const OWNED = { run_id: "r1", owner_id: "bob@example.com", workflow_id: "w1", workflow_name: "Achats", node_id: "d1", question: "Valider ?", mode: "choices", choices: [{ route: "oui", label: "Oui" }], assignee: null, paused_at: "2026-10-21T10:00:00Z" };

const rowOf = async (question) => (await screen.findByText(question)).closest("li");

beforeEach(() => {
  vi.clearAllMocks();
  api.listWorkflowDefs.mockResolvedValue([]);
  api.listAwaitingDecisions.mockResolvedValue([ASSIGNED, OWNED]);
  api.getWorkflowDef.mockRejectedValue(Object.assign(new Error("not found"), { status: 404 }));
});

describe("WorkflowsPage - answering a decision", () => {
  it("an assignee answers from the list, without ever loading the workflow", async () => {
    api.resumeWorkflowRun.mockResolvedValue(sse([{ event: "run_started", run_id: "r2" }, { event: "done", output: "ok" }]));
    const user = userEvent.setup();
    render(<WorkflowsPage />);
    await user.click(within(await rowOf("Accorder ?")).getByRole("button", { name: "Reply" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByRole("textbox"), "oui, accordé");
    api.listAwaitingDecisions.mockResolvedValue([OWNED]);
    await user.click(within(dialog).getByRole("button", { name: "Send" }));

    expect(api.resumeWorkflowRun).toHaveBeenCalledWith("r2", { text: "oui, accordé" }, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(await screen.findByText("Answer sent: the workflow finished.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(screen.queryByText("Accorder ?")).toBeNull());
    expect(api.getWorkflowDef).not.toHaveBeenCalled();
  });

  it("says when the run is now waiting for another decision", async () => {
    api.resumeWorkflowRun.mockResolvedValue(sse([{ event: "run_started" }, { event: "awaiting_input", run_id: "r2", node_id: "d3", question: "Et ensuite ?", mode: "text", choices: [] }]));
    const user = userEvent.setup();
    render(<WorkflowsPage />);
    await user.click(within(await rowOf("Accorder ?")).getByRole("button", { name: "Reply" }));
    await user.type(within(screen.getByRole("dialog")).getByRole("textbox"), "x");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Answer sent: the workflow is now waiting for another decision.")).toBeInTheDocument();
  });

  it("words a failure of the rest of the run, and a cancellation", async () => {
    api.resumeWorkflowRun.mockResolvedValueOnce(sse([{ event: "error", code: "decision_not_saved" }]));
    const user = userEvent.setup();
    render(<WorkflowsPage />);
    await user.click(within(await rowOf("Accorder ?")).getByRole("button", { name: "Reply" }));
    await user.type(within(screen.getByRole("dialog")).getByRole("textbox"), "x");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText(/failed after your answer.*could not be saved/i)).toBeInTheDocument();

    api.resumeWorkflowRun.mockResolvedValueOnce(sse([{ event: "cancelled" }]));
    await user.click(within(await rowOf("Accorder ?")).getByRole("button", { name: "Reply" }));
    await user.type(within(screen.getByRole("dialog")).getByRole("textbox"), "y");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("The workflow was cancelled.")).toBeInTheDocument();
  });

  it("a refused answer stays in the dialog", async () => {
    api.resumeWorkflowRun.mockRejectedValue(Object.assign(new Error("x"), { status: 409, detail: { code: "decision_already_answered" } }));
    const user = userEvent.setup();
    render(<WorkflowsPage />);
    await user.click(within(await rowOf("Accorder ?")).getByRole("button", { name: "Reply" }));
    await user.type(within(screen.getByRole("dialog")).getByRole("textbox"), "x");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await within(screen.getByRole("dialog")).findByRole("alert")).toHaveTextContent("already been answered");
  });

  it("only the owner gets Open in the Studio and Abandon", async () => {
    render(<WorkflowsPage />);
    const assigned = await rowOf("Accorder ?");
    const owned = await rowOf("Valider ?");
    expect(within(assigned).queryByRole("link", { name: "Open in the Studio" })).toBeNull();
    expect(within(assigned).queryByRole("button", { name: "Abandon" })).toBeNull();
    expect(within(owned).getByRole("link", { name: "Open in the Studio" })).toHaveAttribute("href", "/workflows/w1?decision=r1");
    expect(within(owned).getByRole("button", { name: "Abandon" })).toBeInTheDocument();
  });

  it("answering a second decision never cuts the first resumption; the status is the latest one's", async () => {
    let firstSignal;
    let pushFirst;
    api.resumeWorkflowRun.mockImplementationOnce(async (_id, _b, { signal }) => {
      firstSignal = signal;
      return { ok: true, status: 200, body: new ReadableStream({ start(c) { pushFirst = c; } }) };
    });
    api.resumeWorkflowRun.mockImplementationOnce(async () => sse([{ event: "run_started" }, { event: "done", output: "ok" }]));
    const user = userEvent.setup();
    render(<WorkflowsPage />);
    await user.click(within(await rowOf("Accorder ?")).getByRole("button", { name: "Reply" }));
    await user.type(within(screen.getByRole("dialog")).getByRole("textbox"), "x");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await user.click(within(await rowOf("Valider ?")).getByRole("button", { name: "Reply" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Oui" }));
    expect(await screen.findByText("Answer sent: the workflow finished.")).toBeInTheDocument();
    expect(firstSignal.aborted).toBe(false);
    pushFirst.enqueue(enc.encode(`data: ${JSON.stringify({ event: "cancelled" })}\n\n`));
    pushFirst.close();
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByText("Answer sent: the workflow finished.")).toBeInTheDocument();
  });

  it("leaving the page does not cut a resumption", async () => {
    let signal;
    api.resumeWorkflowRun.mockImplementationOnce(async (_id, _b, opts) => {
      signal = opts.signal;
      return { ok: true, status: 200, body: new ReadableStream({ start() {} }) };
    });
    const user = userEvent.setup();
    const { unmount } = render(<WorkflowsPage />);
    await user.click(within(await rowOf("Accorder ?")).getByRole("button", { name: "Reply" }));
    await user.type(within(screen.getByRole("dialog")).getByRole("textbox"), "x");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(signal).toBeDefined());
    unmount();
    expect(signal.aborted).toBe(false);
  });
});
