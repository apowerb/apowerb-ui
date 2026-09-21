/**
 * WorkflowStudio render tests.
 *
 * StudioCanvas (the @xyflow/react wrapper) is mocked out, same convention
 * as DiagramEditor.smoke.test.jsx mocking WorkflowCanvas — xyflow needs
 * ResizeObserver/layout APIs jsdom doesn't provide. Node count and edge
 * selection are exercised through the mock's props, which are the REAL
 * callbacks wired up by WorkflowStudio; everything downstream (graph
 * mutation, validation, the inspector's route dropdown, autosave, the 409
 * conflict banner) is the actual production code.
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
      <div data-testid="node-count">{props.nodes.length}</div>
      {props.nodes.map((n) => (
        <button key={n.id} data-testid={`node-${n.id}`} onClick={() => props.onNodeClick(n)}>
          {n.id}
        </button>
      ))}
      <button data-testid="undo" onClick={props.onUndo}>undo</button>
      {props.edges.map((e) => (
        <button key={e.id} data-testid={`edge-${e.source}-${e.target}`} onClick={() => props.onEdgeClick(e)}>
          {e.source}-{e.target}
          {e.data?.needsRoute ? " (needs route)" : ""}
        </button>
      ))}
    </div>
  ),
}));

const {
  getWorkflowDef,
  updateWorkflowDef,
  listAgents,
  listTools,
  listToolConfigs,
  runWorkflowDef,
  cancelWorkflowRun,
  listWorkflowRevisions,
} = vi.hoisted(() => ({
  getWorkflowDef: vi.fn(),
  updateWorkflowDef: vi.fn(),
  listAgents: vi.fn(),
  listTools: vi.fn(),
  listToolConfigs: vi.fn(),
  runWorkflowDef: vi.fn(),
  cancelWorkflowRun: vi.fn(),
  listWorkflowRevisions: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  getWorkflowDef,
  updateWorkflowDef,
  listAgents,
  listTools,
  listToolConfigs,
  runWorkflowDef,
  cancelWorkflowRun,
  listWorkflowRevisions,
  restoreWorkflowRevision: vi.fn(),
}));

function baseGraph() {
  return {
    version: 1,
    nodes: [
      { id: "trigger1", type: "trigger", label: "Start", config: { kind: "manual" }, position: { x: 0, y: 0 } },
      { id: "router1", type: "router", label: "Route", config: { rules: [{ route: "ok", field: "{{trigger1.payload.x}}", op: "eq", value: 1 }], default_route: "" }, position: { x: 200, y: 0 } },
      { id: "agentA", type: "agent", label: "Agent A", config: { agent_id: "" }, position: { x: 400, y: 0 } },
    ],
    edges: [
      { source: "trigger1", target: "router1" },
      { source: "router1", target: "agentA" }, // deliberately missing a route label
    ],
  };
}

function baseWorkflow(overrides = {}) {
  return {
    workflow_id: "wf1",
    name: "Test workflow",
    description: "",
    status: "draft",
    version: 1,
    graph: baseGraph(),
    validation: { valid: false, errors: [] },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getWorkflowDef.mockResolvedValue(baseWorkflow());
  updateWorkflowDef.mockResolvedValue(baseWorkflow({ version: 2 }));
  listAgents.mockResolvedValue([{ agent_id: 1, agent_name: "Agent One" }]);
  listTools.mockResolvedValue({});
  listToolConfigs.mockResolvedValue([]);
  listWorkflowRevisions.mockResolvedValue([]);
});

describe("WorkflowStudio", () => {
  it("loads the workflow and renders its name, status and node count", async () => {
    render(<WorkflowStudio workflowId="wf1" />);
    await waitFor(() => {
      expect(screen.getByText("Test workflow")).toBeInTheDocument();
    });
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByTestId("node-count")).toHaveTextContent("3");
    // the router->agentA edge starts without a route label
    expect(screen.getByTestId("edge-router1-agentA")).toHaveTextContent("needs route");
  });

  it("adds a node from the palette", async () => {
    const user = userEvent.setup();
    render(<WorkflowStudio workflowId="wf1" />);
    await waitFor(() => expect(screen.getByTestId("node-count")).toHaveTextContent("3"));

    await user.click(screen.getByRole("button", { name: /^Tool$/ }));

    expect(screen.getByTestId("node-count")).toHaveTextContent("4");
  });

  it("labels a router edge with a declared route from the inspector, clearing the validation error", async () => {
    const user = userEvent.setup();
    render(<WorkflowStudio workflowId="wf1" />);
    await waitFor(() => expect(screen.getByTestId("node-count")).toHaveTextContent("3"));

    // 1 real error (missing route) — the loop/approval "soon" warning doesn't apply here.
    expect(screen.getByRole("button", { name: /1 graph issue/i })).toBeInTheDocument();

    await user.click(screen.getByTestId("edge-router1-agentA"));

    const routeSelect = await screen.findByLabelText(/Route/i);
    await user.selectOptions(routeSelect, "ok");

    expect(screen.getByTestId("edge-router1-agentA")).not.toHaveTextContent("needs route");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Graph valid/i })).toBeInTheDocument();
    });
  });

  it("shows the 409 conflict banner on a stale save and clears it on reload", async () => {
    const user = userEvent.setup();
    // Publish is a save with no debounce — good place to trigger the conflict deterministically.
    updateWorkflowDef.mockRejectedValueOnce(
      Object.assign(new Error('{"message":"stale","current_version":5}'), {
        status: 409,
        detail: { message: "stale", current_version: 5 },
      }),
    );

    render(<WorkflowStudio workflowId="wf1" />);
    await waitFor(() => expect(screen.getByTestId("node-count")).toHaveTextContent("3"));

    // Clear the pre-existing validation error so Publish isn't disabled.
    await user.click(screen.getByTestId("edge-router1-agentA"));
    const routeSelect = await screen.findByLabelText(/Route/i);
    await user.selectOptions(routeSelect, "ok");
    await waitFor(() => expect(screen.getByRole("button", { name: /Graph valid/i })).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /Publish/i }));

    expect(await screen.findByText(/modified elsewhere/i)).toBeInTheDocument();
    expect(screen.getByText(/\(5\)/)).toBeInTheDocument();

    getWorkflowDef.mockResolvedValueOnce(baseWorkflow({ version: 5, name: "Reloaded" }));
    await user.click(screen.getByRole("button", { name: /Reload the latest version/i }));

    await waitFor(() => {
      expect(screen.queryByText(/modified elsewhere/i)).not.toBeInTheDocument();
    });
    expect(screen.getByText("Reloaded")).toBeInTheDocument();
  });
  it("renames a node id and rewires its edges and templates, undoably", async () => {
    const user = userEvent.setup();
    render(<WorkflowStudio workflowId="wf1" />);
    await waitFor(() => expect(screen.getByTestId("node-count")).toHaveTextContent("3"));

    await user.click(screen.getByTestId("node-trigger1"));
    const idInput = screen.getByLabelText(/Node ID/i);
    await user.clear(idInput);
    await user.type(idInput, "start{Enter}");

    expect(screen.getByTestId("edge-start-router1")).toBeInTheDocument();
    expect(screen.queryByTestId("node-trigger1")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("node-router1"));
    expect(screen.getByDisplayValue("{{start.payload.x}}")).toBeInTheDocument();

    await user.click(screen.getByTestId("undo"));
    expect(screen.getByTestId("edge-trigger1-router1")).toBeInTheDocument();
  });

  it("refuses a duplicate node id and keeps the graph unchanged", async () => {
    const user = userEvent.setup();
    render(<WorkflowStudio workflowId="wf1" />);
    await waitFor(() => expect(screen.getByTestId("node-count")).toHaveTextContent("3"));

    await user.click(screen.getByTestId("node-trigger1"));
    const idInput = screen.getByLabelText(/Node ID/i);
    await user.clear(idInput);
    await user.type(idInput, "agentA{Enter}");

    expect(screen.getByText(/already used/i)).toBeInTheDocument();
    expect(screen.getByTestId("edge-trigger1-router1")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.getByLabelText(/Node ID/i)).toHaveValue("trigger1");
  });

  it("filters the tool picker as you type", async () => {
    listTools.mockResolvedValue({ tools_erp: ["erp.tool_get_order", "erp.tool_list_clients"], tools_weather: ["weather.get_weather"] });
    const user = userEvent.setup();
    render(<WorkflowStudio workflowId="wf1" />);
    await waitFor(() => expect(screen.getByTestId("node-count")).toHaveTextContent("3"));

    await user.click(screen.getByRole("button", { name: /^Tool$/ }));
    const picker = await screen.findByRole("combobox", { name: /^Tool$/ });
    expect(within(picker).getAllByRole("option")).toHaveLength(4);

    await user.type(screen.getByRole("searchbox", { name: /Search tools/i }), "weather");
    expect(within(picker).getAllByRole("option").map((o) => o.value)).toEqual(["", "weather.get_weather"]);
  });
});
