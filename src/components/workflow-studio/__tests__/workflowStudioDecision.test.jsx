/**
 * End to end in the studio (canvas stubbed, API faked at the HTTP-response
 * level): a run parks on a human decision, the dialog opens, the answer
 * resumes the run in the Test panel; a refusal changes nothing; a decision is
 * reopened from the list / the URL after the tab was closed.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WorkflowStudio from "@/components/workflow-studio/WorkflowStudio";

vi.mock("@/lib/navigation", () => ({
  Link: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
  usePathname: () => "/workflows/wf1",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/components/workflow-studio/StudioCanvas", () => ({
  default: (props) => (
    <div data-testid="canvas-mock">
      <div data-testid="node-count">{props.nodes.length}</div>
      {props.nodes.map((n) => (
        <span key={n.id} data-testid={`status-${n.id}`}>{n.data.runStatus || ""}</span>
      ))}
    </div>
  ),
}));

const api = vi.hoisted(() => ({
  getWorkflowDef: vi.fn(),
  updateWorkflowDef: vi.fn(),
  listAgents: vi.fn(),
  listTools: vi.fn(),
  listToolConfigs: vi.fn(),
  listWorkflowDefs: vi.fn(),
  runWorkflowDef: vi.fn(),
  cancelWorkflowRun: vi.fn(),
  listWorkflowRevisions: vi.fn(),
  restoreWorkflowRevision: vi.fn(),
  getWorkflowTriggerState: vi.fn(),
  rotateWorkflowTrigger: vi.fn(),
  getPublicConfig: vi.fn(),
  sendWorkflowSuggestEvent: vi.fn(),
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

const GRAPH = {
  version: 1,
  nodes: [
    { id: "trigger1", type: "trigger", label: "Start", config: { kind: "manual" }, position: { x: 0, y: 0 } },
    { id: "decision1", type: "approval", label: "Validation", config: { question: "Valider ?", mode: "choices", choices: [{ route: "oui", label: "Oui" }, { route: "non", label: "Non" }] }, position: { x: 200, y: 0 } },
    { id: "out1", type: "output", label: "", config: { value: "ok" }, position: { x: 400, y: 0 } },
  ],
  edges: [
    { source: "trigger1", target: "decision1" },
    { source: "decision1", target: "out1", route: "oui" },
  ],
};

const FIRST_RUN = [
  { event: "run_started", run_id: "r1" },
  { event: "node_start", node_id: "trigger1", type: "trigger" },
  { event: "node_complete", node_id: "trigger1", output: {} },
  { event: "node_start", node_id: "decision1", type: "approval" },
  { event: "awaiting_input", run_id: "r1", node_id: "decision1", question: "Valider ?", mode: "choices", choices: [{ route: "oui", label: "Oui" }, { route: "non", label: "Non" }], assignee: null },
];
const RESUMED = [
  { event: "run_started", run_id: "r1" },
  { event: "node_start", node_id: "trigger1", type: "trigger", replayed: true },
  { event: "node_complete", node_id: "trigger1", output: {}, replayed: true },
  { event: "node_start", node_id: "decision1", type: "approval", replayed: true },
  { event: "node_complete", node_id: "decision1", output: { choice: "oui", text: null, answered_by: "me", answered_at: "now" } },
  { event: "route", node_id: "decision1", route: "oui" },
  { event: "node_start", node_id: "out1", type: "output" },
  { event: "node_complete", node_id: "out1", output: "ok" },
  { event: "done", output: "ok" },
];
const ROW = { run_id: "r1", workflow_id: "wf1", workflow_name: "Test workflow", node_id: "decision1", question: "Valider ?", mode: "choices", choices: [{ route: "oui", label: "Oui" }, { route: "non", label: "Non" }], assignee: null, owner_id: "u", paused_at: "2026-10-21T10:00:00Z" };

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, "", "/workflows/wf1");
  api.getWorkflowDef.mockResolvedValue({ workflow_id: "wf1", name: "Test workflow", description: "", status: "draft", version: 1, graph: GRAPH, validation: { valid: true, errors: [] } });
  api.updateWorkflowDef.mockResolvedValue({});
  api.listAgents.mockResolvedValue([]);
  api.listTools.mockResolvedValue({});
  api.listToolConfigs.mockResolvedValue([]);
  api.listWorkflowDefs.mockResolvedValue([]);
  api.listWorkflowRevisions.mockResolvedValue([]);
  api.getWorkflowTriggerState.mockResolvedValue({ kind: "manual", active: false, reason: "unpublished", webhook_url: null, form_url: null, hmac_enabled: false, next_run_at: null, last_fired_at: null, last_status: null });
  api.getPublicConfig.mockResolvedValue({ workflow_suggest_enabled: false });
  api.sendWorkflowSuggestEvent.mockResolvedValue(undefined);
  api.listAwaitingDecisions.mockResolvedValue([]);
  api.cancelWorkflowRun.mockResolvedValue({});
});
afterEach(() => window.history.replaceState({}, "", "/"));

// A stream the test feeds and ends itself: a run still going on the engine.
function openStream(events) {
  let ctl;
  const body = new ReadableStream({
    start(c) {
      ctl = c;
      for (const e of events) c.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
    },
  });
  return {
    response: { ok: true, status: 200, body },
    push: (...events) => events.forEach((e) => ctl.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`))),
    end: () => ctl.close(),
  };
}

async function runUntilParked(user) {
  api.runWorkflowDef.mockResolvedValueOnce(sse(FIRST_RUN));
  api.listAwaitingDecisions.mockResolvedValue([ROW]);
  render(<WorkflowStudio workflowId="wf1" />);
  await waitFor(() => expect(screen.getByTestId("node-count")).toHaveTextContent("3"));
  await user.click(screen.getByRole("button", { name: /^Test run/ }));
  await user.click(screen.getByRole("button", { name: /^Run$/ }));
  return screen.findByRole("dialog");
}

describe("a run that waits for a human decision", () => {
  it("opens the dialog on awaiting_input, the node shows it waits, and Later keeps it reachable", async () => {
    const user = userEvent.setup();
    const dialog = await runUntilParked(user);
    expect(within(dialog).getByText("Valider ?")).toBeInTheDocument();
    expect(screen.getByTestId("status-decision1")).toHaveTextContent("awaiting");

    await user.click(within(dialog).getByRole("button", { name: "Later" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    // Reopened from the panel...
    await user.click(screen.getByRole("button", { name: "Answer" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(api.resumeWorkflowRun).not.toHaveBeenCalled();
  });

  it("an answer resumes the run and the Test panel plays the rest, replayed nodes included", async () => {
    const user = userEvent.setup();
    const dialog = await runUntilParked(user);
    api.resumeWorkflowRun.mockResolvedValueOnce(sse(RESUMED));
    await user.click(within(dialog).getByRole("button", { name: "Oui" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(api.resumeWorkflowRun).toHaveBeenCalledWith("r1", { choice: "oui" }, expect.anything());
    await waitFor(() => expect(screen.getByTestId("status-out1")).toHaveTextContent("done"));
    expect(screen.getByTestId("status-decision1")).toHaveTextContent("done");
    expect(screen.getAllByText("Completed").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Before the answer").length).toBeGreaterThan(0); // trigger1 + decision1 replayed
    expect(screen.getByText("Route: oui")).toBeInTheDocument();
  });

  it("a 409 is explained in the dialog and the parked run stays on screen", async () => {
    const user = userEvent.setup();
    const dialog = await runUntilParked(user);
    api.resumeWorkflowRun.mockRejectedValueOnce(Object.assign(new Error("x"), { status: 409, detail: { code: "decision_already_answered" } }));
    await user.click(within(dialog).getByRole("button", { name: "Oui" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/already been answered/i);
    expect(screen.getByTestId("status-decision1")).toHaveTextContent("awaiting");
    expect(screen.getByTestId("status-trigger1")).toHaveTextContent("done");
  });

  it("Abandon from the list cancels the parked run on screen", async () => {
    const user = userEvent.setup();
    const dialog = await runUntilParked(user);
    await user.click(within(dialog).getByRole("button", { name: "Later" }));
    api.abandonWorkflowRun.mockResolvedValueOnce({});
    const list = await screen.findByRole("region", { name: "Waiting for a decision" });
    await user.click(await within(list).findByRole("button", { name: "Abandon" }));
    await user.click(within(list).getByRole("button", { name: "Yes, abandon" }));
    expect(api.abandonWorkflowRun).toHaveBeenCalledWith("r1");
    await waitFor(() => expect(screen.queryByRole("button", { name: "Answer" })).toBeNull());
    expect(screen.getAllByText("Cancelled").length).toBeGreaterThan(0);
  });
});

describe("a decision reopened after the tab was closed", () => {
  it("?decision=<run> opens the dialog; answering plays the resumption in the Test panel", async () => {
    window.history.replaceState({}, "", "/workflows/wf1?decision=r1");
    api.listAwaitingDecisions.mockResolvedValue([ROW]);
    api.resumeWorkflowRun.mockResolvedValueOnce(sse(RESUMED));
    const user = userEvent.setup();
    render(<WorkflowStudio workflowId="wf1" />);
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Non" }));
    await waitFor(() => expect(screen.getByTestId("status-out1")).toHaveTextContent("done"));
    expect(api.resumeWorkflowRun).toHaveBeenCalledWith("r1", { choice: "non" }, expect.anything());
    // The panel opened by itself to show it.
    expect(screen.getAllByText("Completed").length).toBeGreaterThan(0);
  });

  it("the list in the Test panel reopens it too, only for this workflow", async () => {
    api.listAwaitingDecisions.mockResolvedValue([ROW, { ...ROW, run_id: "r2", workflow_id: "other", question: "Ailleurs ?" }]);
    const user = userEvent.setup();
    render(<WorkflowStudio workflowId="wf1" />);
    await waitFor(() => expect(screen.getByTestId("node-count")).toHaveTextContent("3"));
    await user.click(screen.getByRole("button", { name: /^Test run/ }));
    const list = await screen.findByRole("region", { name: "Waiting for a decision" });
    expect(await within(list).findByText("Valider ?")).toBeInTheDocument();
    expect(within(list).queryByText("Ailleurs ?")).toBeNull();
    await user.click(within(list).getByRole("button", { name: "Reply" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("Stop", () => {
  async function resumeAndKeepRunning(user) {
    const dialog = await runUntilParked(user);
    const live = openStream(RESUMED.slice(0, 7));
    api.resumeWorkflowRun.mockResolvedValueOnce(live.response);
    await user.click(within(dialog).getByRole("button", { name: "Oui" }));
    await waitFor(() => expect(screen.getByTestId("status-out1")).toHaveTextContent("running"));
    return live;
  }

  it("during a resumption cancels the resumed run by its id, not the workflow's", async () => {
    const user = userEvent.setup();
    const live = await resumeAndKeepRunning(user);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(api.cancelWorkflowRun).toHaveBeenCalledTimes(1);
    expect(api.cancelWorkflowRun).toHaveBeenCalledWith("r1");
    await waitFor(() => expect(screen.getAllByText("Cancelled").length).toBeGreaterThan(0));
    live.push({ event: "cancelled" });
    live.end();
  });

  it("during a resumption, a refused cancel (404: already over) does not show the run cancelled", async () => {
    const user = userEvent.setup();
    const live = await resumeAndKeepRunning(user);
    api.cancelWorkflowRun.mockRejectedValueOnce(Object.assign(new Error("Unknown workflow id"), { status: 404 }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(api.cancelWorkflowRun).toHaveBeenCalledWith("r1"));
    expect(screen.queryByText("Cancelled")).toBeNull();
    // The resumption was not cut from here: its end still shows.
    live.push(...RESUMED.slice(7));
    live.end();
    await waitFor(() => expect(screen.getByTestId("status-out1")).toHaveTextContent("done"));
    expect(screen.queryByText("Cancelled")).toBeNull();
  });

  it("on a first run cancels by the run id the engine announced", async () => {
    const user = userEvent.setup();
    const live = openStream([
      { event: "run_started", wid: "r9" },
      { event: "node_start", node_id: "trigger1", type: "trigger" },
    ]);
    api.runWorkflowDef.mockResolvedValueOnce(live.response);
    render(<WorkflowStudio workflowId="wf1" />);
    await waitFor(() => expect(screen.getByTestId("node-count")).toHaveTextContent("3"));
    await user.click(screen.getByRole("button", { name: /^Test run/ }));
    await user.click(screen.getByRole("button", { name: /^Run$/ }));
    await waitFor(() => expect(screen.getByTestId("status-trigger1")).toHaveTextContent("running"));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(api.cancelWorkflowRun).toHaveBeenCalledWith("r9");
    expect(screen.getAllByText("Cancelled").length).toBeGreaterThan(0);
  });
});
