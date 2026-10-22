/**
 * "Waiting for a decision": the runs parked on an answer, reopened from here
 * after the tab that started them was closed.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { listAwaitingDecisions, abandonWorkflowRun } = vi.hoisted(() => ({
  listAwaitingDecisions: vi.fn(),
  abandonWorkflowRun: vi.fn(),
}));
vi.mock("@/lib/api", () => ({ listAwaitingDecisions, abandonWorkflowRun }));
vi.mock("@/lib/navigation", () => ({
  Link: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
}));

import AwaitingDecisionsList from "@/components/workflow-studio/AwaitingDecisionsList";

const ROWS = [
  { run_id: "r1", workflow_id: "w1", workflow_name: "Achats", node_id: "decision1", question: "Valider Plan A ?", mode: "choices", choices: [{ route: "oui", label: "Oui" }, { route: "non", label: "Non" }], assignee: null, owner_id: "u1", paused_at: "2026-10-21T10:00:00Z" },
  { run_id: "r2", workflow_id: "w2", workflow_name: "Congés", node_id: "decision2", question: "Accorder ?", mode: "text", choices: [], assignee: "bob@example.com", owner_id: "u2", paused_at: "2026-10-21T11:00:00Z" },
];

beforeEach(() => {
  vi.clearAllMocks();
  listAwaitingDecisions.mockResolvedValue(ROWS);
  abandonWorkflowRun.mockResolvedValue({});
});

describe("AwaitingDecisionsList", () => {
  it("loads and lists workflow, question and date", async () => {
    render(<AwaitingDecisionsList onAnswer={vi.fn()} />);
    expect(await screen.findByText("Valider Plan A ?")).toBeInTheDocument();
    expect(screen.getByText("Achats")).toBeInTheDocument();
    expect(screen.getByText("Accorder ?")).toBeInTheDocument();
    expect(screen.getByText("Congés")).toBeInTheDocument();
    expect(screen.getAllByText(/Since/)).toHaveLength(2);
  });

  it("filters on the current workflow in the studio", async () => {
    render(<AwaitingDecisionsList workflowId="w1" onAnswer={vi.fn()} />);
    expect(await screen.findByText("Valider Plan A ?")).toBeInTheDocument();
    expect(screen.queryByText("Accorder ?")).toBeNull();
  });

  it("says when nothing waits", async () => {
    listAwaitingDecisions.mockResolvedValue([]);
    render(<AwaitingDecisionsList onAnswer={vi.fn()} />);
    expect(await screen.findByText("No decision is waiting for you.")).toBeInTheDocument();
  });

  it("shows a load failure with a retry", async () => {
    listAwaitingDecisions.mockRejectedValueOnce(new Error("HTTP 500"));
    const user = userEvent.setup();
    render(<AwaitingDecisionsList onAnswer={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("HTTP 500");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Valider Plan A ?")).toBeInTheDocument();
  });

  it("Reply opens the decision modal; a choice resumes THAT run", async () => {
    const onAnswer = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<AwaitingDecisionsList onAnswer={onAnswer} />);
    const row = (await screen.findByText("Valider Plan A ?")).closest("li");
    await user.click(within(row).getByRole("button", { name: "Reply" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Valider Plan A ?")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Oui" }));
    expect(onAnswer).toHaveBeenCalledWith(
      expect.objectContaining({ runId: "r1", nodeId: "decision1", question: "Valider Plan A ?" }),
      { choice: "oui" },
    );
  });

  it("closes the modal once answered, and reloads the list", async () => {
    const onAnswer = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<AwaitingDecisionsList onAnswer={onAnswer} />);
    const row = (await screen.findByText("Valider Plan A ?")).closest("li");
    await user.click(within(row).getByRole("button", { name: "Reply" }));
    listAwaitingDecisions.mockResolvedValue([ROWS[1]]);
    await user.click(screen.getByRole("button", { name: "Oui" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(screen.queryByText("Valider Plan A ?")).toBeNull());
  });

  it("Later leaves the run waiting", async () => {
    const user = userEvent.setup();
    render(<AwaitingDecisionsList onAnswer={vi.fn()} />);
    const row = (await screen.findByText("Valider Plan A ?")).closest("li");
    await user.click(within(row).getByRole("button", { name: "Reply" }));
    await user.click(screen.getByRole("button", { name: "Later" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Valider Plan A ?")).toBeInTheDocument();
  });

  it("Abandon asks to confirm, then calls the API for that run and drops the row", async () => {
    const onAbandoned = vi.fn();
    const user = userEvent.setup();
    render(<AwaitingDecisionsList onAnswer={vi.fn()} onAbandoned={onAbandoned} />);
    const row = (await screen.findByText("Valider Plan A ?")).closest("li");
    await user.click(within(row).getByRole("button", { name: "Abandon" }));
    expect(abandonWorkflowRun).not.toHaveBeenCalled();
    await user.click(within(row).getByRole("button", { name: "Yes, abandon" }));
    expect(abandonWorkflowRun).toHaveBeenCalledWith("r1");
    await waitFor(() => expect(screen.queryByText("Valider Plan A ?")).toBeNull());
    expect(screen.getByText("Accorder ?")).toBeInTheDocument();
    expect(onAbandoned).toHaveBeenCalledWith(expect.objectContaining({ runId: "r1" }));
  });

  it("keeping the run does not call the API", async () => {
    const user = userEvent.setup();
    render(<AwaitingDecisionsList onAnswer={vi.fn()} />);
    const row = (await screen.findByText("Valider Plan A ?")).closest("li");
    await user.click(within(row).getByRole("button", { name: "Abandon" }));
    await user.click(within(row).getByRole("button", { name: "Keep" }));
    expect(abandonWorkflowRun).not.toHaveBeenCalled();
    expect(within(row).getByRole("button", { name: "Abandon" })).toBeInTheDocument();
  });

  it("a failed abandon keeps the row and says why", async () => {
    abandonWorkflowRun.mockRejectedValueOnce(new Error("HTTP 500"));
    const user = userEvent.setup();
    render(<AwaitingDecisionsList onAnswer={vi.fn()} />);
    const row = (await screen.findByText("Valider Plan A ?")).closest("li");
    await user.click(within(row).getByRole("button", { name: "Abandon" }));
    await user.click(within(row).getByRole("button", { name: "Yes, abandon" }));
    expect(await within(row).findByRole("alert")).toHaveTextContent("HTTP 500");
    expect(screen.getByText("Valider Plan A ?")).toBeInTheDocument();
  });

  it("without an onAnswer (workflows page), Reply links to the studio on that run", async () => {
    render(<AwaitingDecisionsList />);
    const row = (await screen.findByText("Accorder ?")).closest("li");
    expect(within(row).getByRole("link", { name: "Reply" })).toHaveAttribute("href", "/workflows/w2?decision=r2");
  });

  it("reloads when refreshKey changes", async () => {
    const { rerender } = render(<AwaitingDecisionsList onAnswer={vi.fn()} refreshKey="a" />);
    await screen.findByText("Valider Plan A ?");
    rerender(<AwaitingDecisionsList onAnswer={vi.fn()} refreshKey="b" />);
    await waitFor(() => expect(listAwaitingDecisions).toHaveBeenCalledTimes(2));
  });

  it("hides Abandon (owner only, the server answers 403) for a decision assigned to me", async () => {
    listAwaitingDecisions.mockResolvedValue([
      { ...ROWS[0], owner_id: "alice@example.com" },
      { ...ROWS[1], owner_id: "bob@example.com", assignee: "alice@example.com" },
    ]);
    render(<AwaitingDecisionsList onAnswer={vi.fn()} userEmail="Bob@Example.com" />);
    const mine = (await screen.findByText("Accorder ?")).closest("li");
    const assigned = screen.getByText("Valider Plan A ?").closest("li");
    expect(within(mine).getByRole("button", { name: "Abandon" })).toBeInTheDocument();
    expect(within(assigned).queryByRole("button", { name: "Abandon" })).toBeNull();
    expect(within(assigned).getByRole("button", { name: "Reply" })).toBeInTheDocument();
  });

  it("without a known user (the studio, owner only) Abandon stays", async () => {
    render(<AwaitingDecisionsList onAnswer={vi.fn()} />);
    const row = (await screen.findByText("Valider Plan A ?")).closest("li");
    expect(within(row).getByRole("button", { name: "Abandon" })).toBeInTheDocument();
  });

  it("says until when a decision waits, and nothing for an older server", async () => {
    listAwaitingDecisions.mockResolvedValue([{ ...ROWS[0], expires_at: "2026-10-28 10:00:00.000000" }, ROWS[1]]);
    render(<AwaitingDecisionsList onAnswer={vi.fn()} />);
    const row = (await screen.findByText("Valider Plan A ?")).closest("li");
    expect(within(row).getByText(/^Expires/)).toBeInTheDocument();
    const other = screen.getByText("Accorder ?").closest("li");
    expect(within(other).queryByText(/^Expires/)).toBeNull();
  });

  it("an abandon refused because the decision expired says so in words", async () => {
    abandonWorkflowRun.mockRejectedValueOnce(Object.assign(new Error("HTTP 409"), { status: 409, detail: { code: "decision_expired" } }));
    const user = userEvent.setup();
    render(<AwaitingDecisionsList onAnswer={vi.fn()} />);
    const row = (await screen.findByText("Valider Plan A ?")).closest("li");
    await user.click(within(row).getByRole("button", { name: "Abandon" }));
    await user.click(within(row).getByRole("button", { name: "Yes, abandon" }));
    expect(await within(row).findByRole("alert")).toHaveTextContent(/expired/i);
  });

  it("trusts the server's mine flag: Abandon only on the user's own runs, none while the user is unknown", async () => {
    listAwaitingDecisions.mockResolvedValue([
      { ...ROWS[0], owner_id: undefined, mine: true },
      { ...ROWS[1], owner_id: undefined, mine: false },
    ]);
    const { unmount } = render(<AwaitingDecisionsList onAnswer={vi.fn()} userEmail="me@example.com" />);
    const own = (await screen.findByText("Valider Plan A ?")).closest("li");
    expect(within(own).getByRole("button", { name: "Abandon" })).toBeInTheDocument();
    expect(within(screen.getByText("Accorder ?").closest("li")).queryByRole("button", { name: "Abandon" })).toBeNull();
    unmount();
    listAwaitingDecisions.mockResolvedValue([{ ...ROWS[0], owner_id: undefined }]);
    render(<AwaitingDecisionsList onAnswer={vi.fn()} userEmail={null} />);
    const row = (await screen.findByText("Valider Plan A ?")).closest("li");
    expect(within(row).queryByRole("button", { name: "Abandon" })).toBeNull();
  });
});
