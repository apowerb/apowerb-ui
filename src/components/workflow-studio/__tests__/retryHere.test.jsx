/**
 * "Resume here": a run that failed on a step can be run again from that step.
 * The button sits on the failed step of the Test panel, the confirmation lists
 * what will really run (the failed step and below), a refusal leaves the run
 * on screen, and the new run shows the steps above as replayed.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WorkflowStudio from "@/components/workflow-studio/WorkflowStudio";
import ExecutionPanel from "@/components/workflow-studio/ExecutionPanel";
import { applyRunEvent, createRunState } from "@/lib/workflowRunState";

vi.mock("@/lib/navigation", () => ({
  Link: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
  usePathname: () => "/workflows/wf1",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/components/workflow-studio/StudioCanvas", () => ({
  default: (props) => (
    <div data-testid="canvas-mock">
      {props.nodes.map((n) => (
        <button key={n.id} data-testid={`node-${n.id}`} onClick={() => props.onNodeClick(n)}>
          {n.id}
        </button>
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
  getWorkflowTriggerState: vi.fn(),
  getPublicConfig: vi.fn(),
  suggestNextWorkflowNode: vi.fn(),
  sendWorkflowSuggestEvent: vi.fn(),
  getWorkflowNodeShapes: vi.fn(),
  getToolSchema: vi.fn(),
  listAwaitingDecisions: () => Promise.resolve([]),
  resumeWorkflowRun: vi.fn(),
  retryWorkflowRunFromFailure: vi.fn(),
}));

vi.mock("@/lib/api", () => api);

const GRAPH = {
  version: 1,
  nodes: [
    { id: "trigger1", type: "trigger", label: "Start", config: { kind: "manual" }, position: { x: 0, y: 0 } },
    { id: "lookup", type: "tool", label: "CRM lookup", config: { tool: "crm.lookup" }, position: { x: 200, y: 0 } },
    { id: "writer", type: "agent", label: "Writer", config: { agent_id: "1" }, position: { x: 400, y: 0 } },
    { id: "notify", type: "notification", label: "Mail client", config: { channel: "email", to: "a@b.fr", subject: "s", body: "{{writer}}" }, position: { x: 600, y: 0 } },
  ],
  edges: [
    { source: "trigger1", target: "lookup" },
    { source: "lookup", target: "writer" },
    { source: "writer", target: "notify" },
  ],
};

function sse(events) {
  const text = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");
  let sent = false;
  return {
    body: {
      getReader: () => ({
        read: async () => (sent ? { done: true } : ((sent = true), { done: false, value: new TextEncoder().encode(text) })),
        releaseLock: () => {},
        cancel: async () => {},
      }),
    },
  };
}

const failedRun = (retryable = true) => [
  { event: "run_started", wid: "r1" },
  { event: "node_start", node_id: "trigger1" },
  { event: "node_complete", node_id: "trigger1", output: {} },
  { event: "node_start", node_id: "lookup" },
  { event: "node_complete", node_id: "lookup", output: { customer: 1 } },
  { event: "node_start", node_id: "writer" },
  { event: "node_error", node_id: "writer", code: "workflow_error", detail: "quota" },
  { event: "error", code: "workflow_error", detail: "quota", failed_node: "writer", retryable },
];

const RESUMED = [
  { event: "run_started", wid: "r2" },
  { event: "retry_started", replay_of: "r1", node_id: "writer" },
  { event: "node_start", node_id: "trigger1", replayed: true },
  { event: "node_complete", node_id: "trigger1", output: {}, replayed: true },
  { event: "node_start", node_id: "lookup", replayed: true },
  { event: "node_complete", node_id: "lookup", output: { customer: 1 }, replayed: true },
  { event: "node_start", node_id: "writer" },
  { event: "node_complete", node_id: "writer", output: "texte" },
  { event: "node_start", node_id: "notify" },
  { event: "node_complete", node_id: "notify", output: { sent: 1 } },
  { event: "done", output: { sent: 1 } },
];

beforeEach(() => {
  vi.clearAllMocks();
  api.getWorkflowDef.mockResolvedValue({ workflow_id: "wf1", name: "W", description: "", status: "draft", version: 1, graph: GRAPH });
  api.updateWorkflowDef.mockResolvedValue({ workflow_id: "wf1", name: "W", status: "draft", version: 2 });
  api.listAgents.mockResolvedValue([{ agent_id: 1, agent_name: "Writer agent" }]);
  api.listTools.mockResolvedValue({});
  api.listToolConfigs.mockResolvedValue([]);
  api.listWorkflowDefs.mockResolvedValue([]);
  api.getWorkflowTriggerState.mockResolvedValue({ kind: "manual", active: false, reason: "unpublished" });
  api.getPublicConfig.mockResolvedValue({ workflow_suggest_enabled: false });
  api.sendWorkflowSuggestEvent.mockResolvedValue(undefined);
  api.getToolSchema.mockRejectedValue(Object.assign(new Error("nope"), { status: 404 }));
  api.getWorkflowNodeShapes.mockResolvedValue({ shapes: {} });
});

async function runAndFail(user, retryable = true) {
  api.runWorkflowDef.mockResolvedValueOnce(sse(failedRun(retryable)));
  render(<WorkflowStudio workflowId="wf1" />);
  await screen.findByTestId("node-writer");
  await user.click(screen.getByRole("button", { name: /^Test run/ }));
  await user.click(screen.getByRole("button", { name: /^Run$/ }));
  await waitFor(() => expect(screen.getAllByText(/quota/, { selector: "p" }).length).toBeGreaterThan(0));
}

describe("Resume here", () => {
  it("does not save an unchanged workflow that has settings before running", async () => {
    // The saved snapshot carries the workflow settings: comparing against a
    // graph without them would save again on every Test run or Resume here.
    api.getWorkflowDef.mockResolvedValue({
      workflow_id: "wf1", name: "W", description: "", status: "draft", version: 1,
      graph: { ...GRAPH, settings: { notify_on_failure: true } },
    });
    api.retryWorkflowRunFromFailure.mockResolvedValueOnce(sse(RESUMED));
    const user = userEvent.setup();
    await runAndFail(user);
    await user.click(screen.getByRole("button", { name: "Resume here" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /resume/i }));
    await waitFor(() => expect(api.retryWorkflowRunFromFailure).toHaveBeenCalled());
    expect(api.updateWorkflowDef).not.toHaveBeenCalled();
  });

  it("is offered on the failed step only, and only when the engine kept what was done", async () => {
    const user = userEvent.setup();
    await runAndFail(user);
    const buttons = screen.getAllByRole("button", { name: "Resume here" });
    expect(buttons).toHaveLength(1);
    // On the failed step's row, not on the steps done before it.
    expect(buttons[0].closest(".py-2")).toHaveTextContent("Writer");
  });

  it("is not offered when the failure cannot be resumed", async () => {
    const user = userEvent.setup();
    await runAndFail(user, false);
    expect(screen.queryByRole("button", { name: "Resume here" })).not.toBeInTheDocument();
  });

  it("asks first, listing only what will really run again, and runs nothing on cancel", async () => {
    const user = userEvent.setup();
    await runAndFail(user);
    await user.click(screen.getByRole("button", { name: "Resume here" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading")).toHaveTextContent("Resume from Writer?");
    expect(within(dialog).getByText(/send, write and call nothing again/)).toBeInTheDocument();
    const effects = within(dialog).getAllByRole("listitem").map((li) => li.textContent);
    expect(effects).toEqual(["Writer (calls an agent)", "Mail client (sends a message)"]);
    // The tool above was done before the failure: replayed, not run.
    expect(within(dialog).queryByText(/CRM lookup/)).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(api.retryWorkflowRunFromFailure).not.toHaveBeenCalled();
  });

  it("resumes the failed run and shows the steps above as replayed, not run again", async () => {
    api.retryWorkflowRunFromFailure.mockResolvedValue(sse(RESUMED));
    const user = userEvent.setup();
    await runAndFail(user);
    await user.click(screen.getByRole("button", { name: "Resume here" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Resume here" }));

    await waitFor(() => expect(api.retryWorkflowRunFromFailure).toHaveBeenCalledTimes(1));
    expect(api.retryWorkflowRunFromFailure.mock.calls[0][0]).toBe("r1");
    expect(api.runWorkflowDef).toHaveBeenCalledTimes(1); // no full run again
    expect(await screen.findAllByText("Replayed — done before the failure")).toHaveLength(2);
    expect(screen.queryByText("Before the answer")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resume here" })).not.toBeInTheDocument();
  });

  it("lists the steps up to where a failed Test up to here stopped, not below", async () => {
    api.runWorkflowDef.mockResolvedValueOnce(sse(failedRun()));
    const user = userEvent.setup();
    render(<WorkflowStudio workflowId="wf1" />);
    await user.click(await screen.findByTestId("node-writer"));
    await user.click(within(document.querySelector("[data-studio-inspector]")).getByRole("button", { name: "Test up to here" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Run up to here" }));
    await user.click(await screen.findByRole("button", { name: "Resume here" }));

    const effects = within(screen.getByRole("dialog")).getAllByRole("listitem").map((li) => li.textContent);
    expect(effects).toEqual(["Writer (calls an agent)"]);
  });

  it("keeps the failed run on screen and says why when the server refuses", async () => {
    api.retryWorkflowRunFromFailure.mockRejectedValue(
      Object.assign(new Error("409"), { status: 409, detail: { code: "retry_graph_changed", params: { nodes: ["lookup"] } } }),
    );
    const user = userEvent.setup();
    await runAndFail(user);
    await user.click(screen.getByRole("button", { name: "Resume here" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Resume here" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/changed since the failure.*CRM lookup/);
    // Nothing changed in the Test panel: the failure and its button are still there.
    expect(screen.getAllByText(/quota/, { selector: "p" }).length).toBeGreaterThan(0);
  });

  it("does not resume when the workflow was saved elsewhere, since another version would run", async () => {
    api.updateWorkflowDef.mockRejectedValue(Object.assign(new Error("409"), { status: 409, detail: { current_version: 5 } }));
    const user = userEvent.setup();
    await runAndFail(user);
    await user.click(screen.getByTestId("node-writer"));
    const inspector = document.querySelector("[data-studio-inspector]");
    await user.type(within(inspector).getAllByRole("textbox")[0], "x");

    await user.click(screen.getByRole("button", { name: "Resume here" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Resume here" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/changed elsewhere/);
    await user.click(within(dialog).getByRole("button", { name: "Resume here" }));
    expect(api.retryWorkflowRunFromFailure).not.toHaveBeenCalled();
  });

  it("lists what a failed loop sends again, and says its done iterations run again", async () => {
    const graph = {
      version: 1,
      nodes: [
        GRAPH.nodes[0],
        {
          id: "each",
          type: "loop",
          label: "Each customer",
          config: { items: "{{trigger1.list}}", body: { version: 1, nodes: [{ id: "bt", type: "trigger", config: { kind: "manual" } }, { id: "send", type: "notification", label: "Mail", config: {} }], edges: [{ source: "bt", target: "send" }] } },
          position: { x: 200, y: 0 },
        },
      ],
      edges: [{ source: "trigger1", target: "each" }],
    };
    api.getWorkflowDef.mockResolvedValue({ workflow_id: "wf1", name: "W", description: "", status: "draft", version: 1, graph });
    api.runWorkflowDef.mockResolvedValueOnce(
      sse([
        { event: "run_started", wid: "r1" },
        { event: "node_start", node_id: "trigger1" },
        { event: "node_complete", node_id: "trigger1", output: {} },
        { event: "node_start", node_id: "each" },
        { event: "node_error", node_id: "each", code: "workflow_error", detail: "quota" },
        { event: "error", code: "workflow_error", detail: "quota", failed_node: "each", retryable: true },
      ]),
    );
    const user = userEvent.setup();
    render(<WorkflowStudio workflowId="wf1" />);
    await screen.findByTestId("node-each");
    await user.click(screen.getByRole("button", { name: /^Test run/ }));
    await user.click(screen.getByRole("button", { name: /^Run$/ }));
    await user.click(await screen.findByRole("button", { name: "Resume here" }));

    const dialog = screen.getByRole("dialog");
    const effects = within(dialog).getAllByRole("listitem").map((li) => li.textContent);
    expect(effects).toEqual(["Each customer › Mail (sends a message)"]);
    expect(within(dialog).getByText(/iterations it had already done run again/)).toBeInTheDocument();
  });

  it("offers to resume the original again after a resumption was stopped", async () => {
    api.retryWorkflowRunFromFailure.mockResolvedValueOnce(
      sse([
        ...RESUMED.slice(0, 6),
        { event: "node_start", node_id: "writer" },
        { event: "node_complete", node_id: "writer", output: "texte" },
        { event: "node_start", node_id: "notify" },
        { event: "cancelled" },
      ]),
    );
    const user = userEvent.setup();
    await runAndFail(user);
    await user.click(screen.getByRole("button", { name: "Resume here" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Resume here" }));
    await waitFor(() => expect(api.retryWorkflowRunFromFailure).toHaveBeenCalledTimes(1));

    const again = await screen.findByRole("button", { name: "Resume here" });
    expect(again.closest(".py-2")).toHaveTextContent("Writer");
    await user.click(again);
    // Writer ran in the stopped resumption, not in the original: it runs again.
    const effects = within(screen.getByRole("dialog")).getAllByRole("listitem").map((li) => li.textContent);
    expect(effects).toEqual(["Writer (calls an agent)", "Mail client (sends a message)"]);
    api.retryWorkflowRunFromFailure.mockResolvedValueOnce(sse(RESUMED));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Resume here" }));
    await waitFor(() => expect(api.retryWorkflowRunFromFailure).toHaveBeenCalledTimes(2));
    expect(api.retryWorkflowRunFromFailure.mock.calls[1][0]).toBe("r1");
  });

  it("stops a resumption through the engine, without dropping its stream", async () => {
    // The engine keeps a resumption going when its client leaves: Stop must
    // ask it, and the stream says how it ended.
    const encode = (events) => new TextEncoder().encode(events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(""));
    let release;
    const rest = new Promise((resolve) => (release = resolve));
    let reads = 0;
    api.retryWorkflowRunFromFailure.mockResolvedValueOnce({
      body: {
        getReader: () => ({
          read: async () => {
            reads += 1;
            if (reads === 1) return { done: false, value: encode(RESUMED.slice(0, 7)) };
            if (reads === 2) return { done: false, value: await rest };
            return { done: true };
          },
          releaseLock: () => {},
          cancel: async () => {},
        }),
      },
    });
    api.cancelWorkflowRun.mockResolvedValue(undefined);
    const user = userEvent.setup();
    await runAndFail(user);
    await user.click(screen.getByRole("button", { name: "Resume here" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Resume here" }));
    await waitFor(() => expect(reads).toBeGreaterThan(1));

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(api.cancelWorkflowRun).toHaveBeenCalledWith("r2"));
    expect(api.retryWorkflowRunFromFailure.mock.calls[0][1].signal.aborted).toBe(false);
    release(encode([{ event: "cancelled" }]));
    expect(await screen.findByRole("button", { name: "Resume here" })).toBeInTheDocument();
  });

  it("saves an unsaved fix of the failed step before resuming, since the server runs the saved version", async () => {
    api.retryWorkflowRunFromFailure.mockResolvedValue(sse(RESUMED));
    const user = userEvent.setup();
    await runAndFail(user);
    await user.click(screen.getByTestId("node-writer"));
    const inspector = document.querySelector("[data-studio-inspector]");
    await user.type(within(inspector).getAllByRole("textbox")[0], "x");

    await user.click(screen.getByRole("button", { name: "Resume here" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Resume here" }));

    await waitFor(() => expect(api.retryWorkflowRunFromFailure).toHaveBeenCalledTimes(1));
    expect(api.updateWorkflowDef).toHaveBeenCalled();
    expect(api.updateWorkflowDef.mock.invocationCallOrder.at(-1)).toBeLessThan(
      api.retryWorkflowRunFromFailure.mock.invocationCallOrder[0],
    );
  });
});

describe("Resume here — when the button shows", () => {
  const failed = [
    { event: "run_started", wid: "r1" },
    { event: "node_start", node_id: "writer" },
    { event: "node_error", node_id: "writer", code: "workflow_error", detail: "quota" },
    { event: "error", code: "workflow_error", detail: "quota", failed_node: "writer", retryable: true },
  ].reduce(applyRunEvent, createRunState());
  const panel = (props) =>
    render(
      <ExecutionPanel open payloadText="{}" onPayloadTextChange={() => {}} runState={failed} onRun={() => {}} onCancel={() => {}} onRetryHere={() => {}} nodeLabels={{ writer: "Writer" }} {...props} />,
    );

  it("shows on the failed step of a run at rest", () => {
    panel({ isRunning: false, replay: null });
    expect(screen.getByRole("button", { name: "Resume here" })).toBeInTheDocument();
  });

  it("hides while a run is going", () => {
    panel({ isRunning: true, replay: null });
    expect(screen.queryByRole("button", { name: "Resume here" })).not.toBeInTheDocument();
  });

  it("hides while a past run is being replayed step by step", () => {
    panel({ isRunning: false, replay: { active: true, total: 4, index: 1 } });
    expect(screen.queryByRole("button", { name: "Resume here" })).not.toBeInTheDocument();
  });
});
