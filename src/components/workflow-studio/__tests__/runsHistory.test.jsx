/**
 * Run history of a workflow: the Runs drawer lists its runs (date, trigger,
 * status, duration, faulty node and translated error), filters them through
 * the API (All / Failures / Awaiting), pages through them, and opens one in
 * the Test panel's replay. Reached from the studio's top bar, from
 * `?runs=1`, and from the Workflows page.
 */
import { Suspense } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RunsDrawer from "@/components/workflow-studio/RunsDrawer";
import WorkflowStudio from "@/components/workflow-studio/WorkflowStudio";
import StudioTopBar from "@/components/workflow-studio/StudioTopBar";
import StudioPage from "@/app/(dashboard)/workflows/[workflowId]/page";

vi.mock("@/lib/navigation", () => ({
  Link: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
  usePathname: () => "/workflows/wf1",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/components/workflow-studio/StudioCanvas", () => ({
  default: (props) => (
    <div data-testid="canvas-mock">
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
  listWorkflowRuns: vi.fn(),
  getWorkflowRunTrace: vi.fn(),
}));
vi.mock("@/lib/api", () => api);

const FAILED = {
  run_id: "r2",
  workflow_id: "wf1",
  trigger_kind: "schedule",
  status: "error",
  created_at: "2026-10-22T09:00:00.000+00:00",
  finished_at: "2026-10-22T09:00:12.400+00:00",
  duration_ms: 12400,
  error_message: "HTTP http1 timed out",
  error: { code: "http_timeout", params: { node: "http1", seconds: "10" } },
  failure_node: "http1",
  replay_of: null,
};
const OK = { ...FAILED, run_id: "r1", trigger_kind: "manual", status: "success", duration_ms: 800, error_message: null, error: null };
const WAITING = { ...FAILED, run_id: "r3", trigger_kind: "webhook", status: "awaiting", duration_ms: null, error_message: null, error: null, decision: { question: "Valider le devis ?" } };

const NODE_LABELS = { trigger1: "Every morning", http1: "Fetch prices" };

describe("RunsDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.listWorkflowRuns.mockResolvedValue([FAILED, OK]);
  });

  it("lists the workflow's runs with trigger, status, duration, faulty node and translated error", async () => {
    render(<RunsDrawer workflowId="wf1" nodeLabels={NODE_LABELS} onClose={() => {}} onOpenRun={() => {}} />);
    expect(api.listWorkflowRuns).toHaveBeenCalledWith({ workflowId: "wf1", status: null, limit: 21, offset: 0 });
    const failed = await screen.findByTestId("run-row-r2");
    expect(within(failed).getByText("Scheduled")).toBeInTheDocument();
    expect(within(failed).getByText("Failed")).toBeInTheDocument();
    expect(within(failed).getByText("12.4 s")).toBeInTheDocument();
    expect(within(failed).getByText(/Fetch prices/)).toBeInTheDocument();
    expect(within(failed).getByText(/timed out after 10s/)).toBeInTheDocument();
    const ok = screen.getByTestId("run-row-r1");
    expect(within(ok).getByText("Manual")).toBeInTheDocument();
    expect(within(ok).getByText("Succeeded")).toBeInTheDocument();
  });

  it("asks the API for failures, then for runs awaiting a decision", async () => {
    const user = userEvent.setup();
    render(<RunsDrawer workflowId="wf1" nodeLabels={NODE_LABELS} onClose={() => {}} onOpenRun={() => {}} />);
    await screen.findByTestId("run-row-r2");

    api.listWorkflowRuns.mockResolvedValueOnce([FAILED]);
    await user.click(screen.getByRole("tab", { name: "Failures" }));
    await waitFor(() => expect(api.listWorkflowRuns).toHaveBeenLastCalledWith({ workflowId: "wf1", status: "error", limit: 21, offset: 0 }));
    await waitFor(() => expect(screen.queryByTestId("run-row-r1")).not.toBeInTheDocument());

    api.listWorkflowRuns.mockResolvedValueOnce([WAITING]);
    await user.click(screen.getByRole("tab", { name: "Awaiting" }));
    await waitFor(() => expect(api.listWorkflowRuns).toHaveBeenLastCalledWith({ workflowId: "wf1", status: "awaiting", limit: 21, offset: 0 }));
    const row = await screen.findByTestId("run-row-r3");
    expect(within(row).getByText("Valider le devis ?")).toBeInTheDocument();
  });

  it("pages through the runs", async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 21 }, (_, i) => ({ ...OK, run_id: `p${i}` }));
    api.listWorkflowRuns.mockResolvedValueOnce(many);
    render(<RunsDrawer workflowId="wf1" nodeLabels={NODE_LABELS} onClose={() => {}} onOpenRun={() => {}} />);
    await screen.findByTestId("run-row-p0");
    expect(screen.queryByTestId("run-row-p20")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();

    api.listWorkflowRuns.mockResolvedValueOnce([{ ...OK, run_id: "q0" }]);
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(api.listWorkflowRuns).toHaveBeenLastCalledWith({ workflowId: "wf1", status: null, limit: 21, offset: 20 }));
    await screen.findByTestId("run-row-q0");
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("says when nothing failed", async () => {
    const user = userEvent.setup();
    render(<RunsDrawer workflowId="wf1" nodeLabels={NODE_LABELS} onClose={() => {}} onOpenRun={() => {}} />);
    await screen.findByTestId("run-row-r2");
    api.listWorkflowRuns.mockResolvedValueOnce([]);
    await user.click(screen.getByRole("tab", { name: "Failures" }));
    expect(await screen.findByText(/No failed run/)).toBeInTheDocument();
  });

  it("opens a run", async () => {
    const user = userEvent.setup();
    const onOpenRun = vi.fn().mockResolvedValue(undefined);
    render(<RunsDrawer workflowId="wf1" nodeLabels={NODE_LABELS} onClose={() => {}} onOpenRun={onOpenRun} />);
    await user.click(await screen.findByRole("button", { name: /Open run r2/ }));
    expect(onOpenRun).toHaveBeenCalledWith(FAILED);
  });

  it("explains a run recorded before its steps were kept", async () => {
    const user = userEvent.setup();
    const onOpenRun = vi.fn().mockRejectedValue(Object.assign(new Error("no trace"), { code: "trace_unavailable" }));
    render(<RunsDrawer workflowId="wf1" nodeLabels={NODE_LABELS} onClose={() => {}} onOpenRun={onOpenRun} />);
    await user.click(await screen.findByRole("button", { name: /Open run r2/ }));
    expect(await screen.findByText(/recorded before its steps were kept/)).toBeInTheDocument();
  });
});

// --- In the studio -----------------------------------------------------------

const GRAPH = {
  version: 1,
  nodes: [
    { id: "trigger1", type: "trigger", label: "Every morning", config: { kind: "schedule", cron: "0 9 * * *", timezone: "Europe/Paris" }, position: { x: 0, y: 0 } },
    { id: "http1", type: "http", label: "Fetch prices", config: { method: "GET", url: "https://prices.test" }, position: { x: 200, y: 0 } },
  ],
  edges: [{ source: "trigger1", target: "http1" }],
};

const TRACE = {
  available: true,
  truncated: false,
  events: [
    { event: "run_started", wid: "r2" },
    { event: "node_start", node_id: "trigger1", type: "trigger" },
    { event: "node_complete", node_id: "trigger1", output: {}, duration_ms: 1 },
    { event: "node_start", node_id: "http1", type: "http" },
    { event: "node_error", node_id: "http1", code: "http_timeout", detail: "x", params: { node: "http1", seconds: "10" } },
    { event: "error", code: "http_timeout", detail: "x", params: { node: "http1", seconds: "10" } },
  ],
};

function setupStudio({ triggerState = {}, status = "published", settings } = {}) {
  const graph = settings ? { ...GRAPH, settings } : GRAPH;
  api.getWorkflowDef.mockResolvedValue({ workflow_id: "wf1", name: "Prices", description: "", status, version: 3, graph, validation: { valid: true, errors: [] } });
  api.updateWorkflowDef.mockResolvedValue({});
  api.listAgents.mockResolvedValue([]);
  api.listTools.mockResolvedValue({});
  api.listToolConfigs.mockResolvedValue([]);
  api.listWorkflowDefs.mockResolvedValue([]);
  api.listWorkflowRevisions.mockResolvedValue([]);
  api.getWorkflowTriggerState.mockResolvedValue({ kind: "schedule", active: true, reason: null, webhook_url: null, form_url: null, hmac_enabled: false, next_run_at: null, last_fired_at: null, last_status: null, failure_listeners: [], ...triggerState });
  api.getPublicConfig.mockResolvedValue({ workflow_suggest_enabled: false });
  api.sendWorkflowSuggestEvent.mockResolvedValue(undefined);
  api.listAwaitingDecisions.mockResolvedValue([]);
  api.listWorkflowRuns.mockResolvedValue([FAILED, OK]);
  api.getWorkflowRunTrace.mockResolvedValue(TRACE);
}

describe("Runs in the studio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/workflows/wf1");
  });
  afterEach(() => window.history.replaceState({}, "", "/"));

  it("opens the drawer from the top bar and replays a failed run in the Test panel", async () => {
    setupStudio();
    const user = userEvent.setup();
    render(<WorkflowStudio workflowId="wf1" />);
    await user.click(await screen.findByRole("button", { name: "Runs" }));

    const drawer = await screen.findByRole("dialog", { name: "Runs" });
    expect(api.listWorkflowRuns).toHaveBeenCalledWith({ workflowId: "wf1", status: null, limit: 21, offset: 0 });
    await user.click(await within(drawer).findByRole("button", { name: /Open run r2/ }));

    expect(api.getWorkflowRunTrace).toHaveBeenCalledWith("r2");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Runs" })).not.toBeInTheDocument());
    // The canvas and the Test panel show the run as it ended.
    expect(await screen.findByTestId("status-http1")).toHaveTextContent("error");
    expect(screen.getAllByText(/timed out after 10s/).length).toBeGreaterThan(0);
    expect(screen.getByRole("group", { name: /Replay/i })).toBeInTheDocument();
  });

  it("keeps the drawer and the canvas as they were when a run has no kept steps", async () => {
    setupStudio();
    api.getWorkflowRunTrace.mockResolvedValue({ events: [], truncated: false, available: false });
    const user = userEvent.setup();
    render(<WorkflowStudio workflowId="wf1" />);
    await user.click(await screen.findByRole("button", { name: "Runs" }));
    const drawer = await screen.findByRole("dialog", { name: "Runs" });
    await user.click(await within(drawer).findByRole("button", { name: /Open run r2/ }));

    expect(await within(drawer).findByText(/recorded before its steps were kept/)).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Runs" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /Replay/i })).not.toBeInTheDocument();
  });

  it("opens the drawer straight from ?runs=1, read by the page", async () => {
    setupStudio();
    // A click on the Workflows page's link renders the studio before the
    // address bar changes: the query must come from the route, not the window.
    window.history.replaceState({}, "", "/workflows");
    await act(async () => render(
      <Suspense fallback={null}>
        <StudioPage params={Promise.resolve({ workflowId: "wf1" })} searchParams={Promise.resolve({ runs: "1" })} />
      </Suspense>,
    ));
    expect(await screen.findByRole("dialog", { name: "Runs" })).toBeInTheDocument();
    expect(api.listWorkflowRuns).toHaveBeenCalledWith(expect.objectContaining({ workflowId: "wf1" }));
  });

  it("keeps the drawer closed without ?runs=1", async () => {
    setupStudio();
    await act(async () => render(
      <Suspense fallback={null}>
        <StudioPage params={Promise.resolve({ workflowId: "wf1" })} searchParams={Promise.resolve({})} />
      </Suspense>,
    ));
    await screen.findByRole("button", { name: "Runs" });
    expect(screen.queryByRole("dialog", { name: "Runs" })).not.toBeInTheDocument();
  });

  it("warns that nothing handles a failure, until a workflow listens to it", async () => {
    setupStudio({ settings: { notify_on_failure: false } });
    const user = userEvent.setup();
    const { unmount } = render(<WorkflowStudio workflowId="wf1" />);
    await screen.findByRole("button", { name: "Runs" });
    await user.click(screen.getByRole("button", { name: /graph/i }));
    expect(await screen.findByText(/starts on its own/)).toBeInTheDocument();
    unmount();

    setupStudio({ settings: { notify_on_failure: false }, triggerState: { failure_listeners: [{ workflow_id: "wf9", name: "Alert" }] } });
    render(<WorkflowStudio workflowId="wf1" />);
    await screen.findByRole("button", { name: "Runs" });
    await waitFor(() => expect(api.getWorkflowTriggerState).toHaveBeenCalledWith("wf1"));
    await user.click(screen.getByRole("button", { name: /graph/i }));
    expect(await screen.findByText("Validation")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/starts on its own/)).not.toBeInTheDocument());
  });
});

describe("Failure alert and the missing error handling warning", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stays quiet on a published workflow, whose failure alert is on by default", async () => {
    setupStudio();
    const user = userEvent.setup();
    render(<WorkflowStudio workflowId="wf1" />);
    await screen.findByRole("button", { name: "Runs" });
    await waitFor(() => expect(api.getWorkflowTriggerState).toHaveBeenCalledWith("wf1"));
    await user.click(screen.getByRole("button", { name: /graph/i }));
    expect(await screen.findByText("Validation")).toBeInTheDocument();
    expect(screen.queryByText(/starts on its own/)).not.toBeInTheDocument();
  });

  it("warns on a draft, whose failure alert is off until published", async () => {
    setupStudio({ status: "draft" });
    const user = userEvent.setup();
    render(<WorkflowStudio workflowId="wf1" />);
    await screen.findByRole("button", { name: "Runs" });
    await user.click(screen.getByRole("button", { name: /graph/i }));
    expect(await screen.findByText(/starts on its own/)).toBeInTheDocument();
  });
});

describe("StudioTopBar warnings", () => {
  it("shows warnings in orange, errors in red", async () => {
    const user = userEvent.setup();
    render(
      <StudioTopBar
        name="W"
        status="draft"
        version={1}
        saveState="idle"
        validation={{ valid: false, errors: [{ nodeId: "a", message: "agentRequired" }, { nodeId: "t", message: "noErrorHandling", level: "warning" }] }}
        onOpenVersions={() => {}}
        onOpenRuns={() => {}}
        onExport={() => {}}
        onToggleTest={() => {}}
        onPublish={() => {}}
      />,
    );
    await user.click(screen.getByRole("button", { name: /1 graph issue/i }));
    expect(screen.getByText(/starts on its own/).closest("li")).toHaveClass("text-amber-400");
    expect(screen.getByText(/Choose the agent/).closest("li")).toHaveClass("text-red-400");
  });
});
