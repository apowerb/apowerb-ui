/**
 * Proactive Studio, step 2: the fields of the previous step are proposed in
 * the inspector, and "Test up to here" runs a node and what is above it —
 * only after the person has seen which steps have an effect.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
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
}));

vi.mock("@/lib/api", () => api);

const GRAPH = {
  version: 1,
  nodes: [
    { id: "trigger1", type: "trigger", label: "Start", config: { kind: "manual" }, position: { x: 0, y: 0 } },
    { id: "lookup", type: "tool", label: "CRM lookup", config: { tool: "crm.lookup" }, position: { x: 200, y: 0 } },
    { id: "writer", type: "agent", label: "Writer", config: { agent_id: "1" }, position: { x: 400, y: 0 } },
  ],
  edges: [
    { source: "trigger1", target: "lookup" },
    { source: "lookup", target: "writer" },
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

async function openNode(user, id) {
  render(<WorkflowStudio workflowId="wf1" />);
  await user.click(await screen.findByTestId(`node-${id}`));
}

const inspector = () => document.querySelector("[data-studio-inspector]");
// Agent and tool nodes show the fields of the steps above in "Available data".
const panelRow = (id) => within(screen.getByRole("region", { name: "Available data" })).getByTestId(`upstream-${id}`);

describe("fields of the previous step", () => {
  it("proposes the learned fields of the tool above and puts one in the agent's input on click", async () => {
    api.getWorkflowNodeShapes.mockResolvedValue({
      shapes: { lookup: { source: "learned", shape: { type: "object", fields: { customer: { type: "object", fields: { email: { type: "string" } } } } } } },
    });
    const user = userEvent.setup();
    await openNode(user, "writer");

    // The shapes are asked for after a short pause, once the graph is loaded.
    await within(inspector()).findByText(/from the tool's last run/i, {}, { timeout: 2000 });
    await user.click(within(panelRow("lookup")).getByRole("button", { name: /customer\.email/ }));

    expect(within(inspector()).getByDisplayValue("{{lookup.customer.email}}")).toBeInTheDocument();
    // The server was asked about the draft on screen, positions left out.
    const sentGraph = api.getWorkflowNodeShapes.mock.calls[0][0];
    expect(sentGraph.nodes.map((n) => n.id)).toEqual(["trigger1", "lookup", "writer"]);
    expect(sentGraph.nodes[0].position).toBeUndefined();
  });

  it("offers to test the step above when its fields are unknown, and runs nothing on cancel", async () => {
    const user = userEvent.setup();
    await openNode(user, "writer");

    await user.click(await within(panelRow("lookup")).findByRole("button", { name: "Test up to CRM lookup" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading")).toHaveTextContent("Test up to CRM lookup?");
    expect(within(dialog).getByRole("listitem")).toHaveTextContent("CRM lookup (runs a tool)");
    expect(within(dialog).queryByText(/Writer/)).not.toBeInTheDocument(); // below: not run
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(api.runWorkflowDef).not.toHaveBeenCalled();
  });
});

describe("nodes without the Available data panel", () => {
  it("keep the fields of the previous step in their own block", async () => {
    const withRouter = structuredClone(GRAPH);
    withRouter.nodes.push({ id: "route", type: "router", label: "Route", config: { rules: [] }, position: { x: 600, y: 0 } });
    withRouter.edges.push({ source: "lookup", target: "route" });
    api.getWorkflowDef.mockResolvedValue({ workflow_id: "wf1", name: "W", description: "", status: "draft", version: 1, graph: withRouter });
    api.getWorkflowNodeShapes.mockResolvedValue({
      shapes: { lookup: { source: "learned", shape: { type: "object", fields: { status: { type: "string" } } } } },
    });
    const user = userEvent.setup();
    await openNode(user, "route");

    await within(inspector()).findByText(/from the tool's last run/i, {}, { timeout: 2000 });
    expect(inspector().querySelector('[data-upstream-node="lookup"]')).not.toBeNull();
    expect(screen.queryByRole("region", { name: "Available data" })).not.toBeInTheDocument();
  });

  it("agent and tool nodes have a single block", async () => {
    const user = userEvent.setup();
    await openNode(user, "writer");
    expect(screen.getByRole("region", { name: "Available data" })).toBeInTheDocument();
    expect(inspector().querySelector("[data-upstream-shapes]")).toBeNull();
  });
});

describe("Test up to here", () => {
  it("runs up to the node once confirmed and shows that node's output in the Test panel", async () => {
    api.runWorkflowDef.mockResolvedValue(
      sse([
        { event: "run_started", wid: "r1" },
        { event: "node_start", node_id: "trigger1" },
        { event: "node_complete", node_id: "trigger1", output: {} },
        { event: "node_start", node_id: "lookup" },
        { event: "node_complete", node_id: "lookup", output: { customer: { email: "a@b.fr" } } },
        { event: "done", output: { customer: { email: "a@b.fr" } }, until: "lookup", partial: true },
      ]),
    );
    const user = userEvent.setup();
    await openNode(user, "lookup");

    await user.click(within(inspector()).getByRole("button", { name: "Test up to here" }));
    expect(api.runWorkflowDef).not.toHaveBeenCalled();
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Run up to here" }));

    await waitFor(() => expect(api.runWorkflowDef).toHaveBeenCalledTimes(1));
    expect(api.runWorkflowDef.mock.calls[0][2].until).toBe("lookup");
    expect(await screen.findByText("Output of CRM lookup (test up to here)")).toBeInTheDocument();

    // The run's real output now feeds "Available data" of the step below.
    await user.click(screen.getByTestId("node-writer"));
    expect(within(panelRow("lookup")).getByText("a@b.fr")).toBeInTheDocument();
    expect(within(panelRow("lookup")).queryByRole("button", { name: /Test up to/ })).not.toBeInTheDocument();
  });

  it("saves an unsaved draft before testing, since the server runs the saved version", async () => {
    api.runWorkflowDef.mockResolvedValue(sse([{ event: "done", output: null, until: "lookup", partial: true }]));
    const user = userEvent.setup();
    await openNode(user, "lookup");
    await user.type(within(inspector()).getByPlaceholderText(/./, { selector: "input" }), "x");

    await user.click(within(inspector()).getByRole("button", { name: "Test up to here" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Run up to here" }));

    await waitFor(() => expect(api.runWorkflowDef).toHaveBeenCalledTimes(1));
    expect(api.updateWorkflowDef).toHaveBeenCalled();
    expect(api.updateWorkflowDef.mock.invocationCallOrder[0]).toBeLessThan(api.runWorkflowDef.mock.invocationCallOrder[0]);
  });
});

describe("run state of a partial run", () => {
  it("remembers which node the output belongs to, and only for a partial run", async () => {
    const { applyRunEvent, createRunState } = await import("@/lib/workflowRunState");
    const partial = applyRunEvent(createRunState(), { event: "done", output: 1, until: "lookup", partial: true });
    expect(partial).toMatchObject({ status: "done", finalOutput: 1, partialUntil: "lookup" });
    const full = applyRunEvent(createRunState(), { event: "done", output: 1 });
    expect(full.partialUntil).toBeUndefined();
  });

  it("says in words why the node was not reached", async () => {
    api.runWorkflowDef.mockResolvedValue(
      sse([{ event: "error", code: "until_not_reached", detail: "lookup n'a pas été atteint", params: { node: "lookup" } }]),
    );
    const user = userEvent.setup();
    await openNode(user, "lookup");
    await user.click(within(inspector()).getByRole("button", { name: "Test up to here" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Run up to here" }));

    expect(await screen.findByText(/Step lookup was not reached/)).toBeInTheDocument();
  });
});

describe("payload of a Test up to here", () => {
  it("uses the trigger's sample payload even when the Test panel was never opened", async () => {
    const withSample = structuredClone(GRAPH);
    withSample.nodes[0].config.sample_payload = { customer_id: "C-42" };
    api.getWorkflowDef.mockResolvedValue({ workflow_id: "wf1", name: "W", description: "", status: "draft", version: 1, graph: withSample });
    api.runWorkflowDef.mockResolvedValue(sse([{ event: "done", output: null, until: "lookup", partial: true }]));
    const user = userEvent.setup();
    await openNode(user, "lookup");

    await user.click(within(inspector()).getByRole("button", { name: "Test up to here" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Run up to here" }));

    await waitFor(() => expect(api.runWorkflowDef).toHaveBeenCalledTimes(1));
    expect(api.runWorkflowDef.mock.calls[0][1]).toEqual({ customer_id: "C-42" });
  });
});
