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
      <div data-testid="focus-request">{props.focusRequest ? `${props.focusRequest.x},${props.focusRequest.y}` : ""}</div>
      <div data-testid="suggestion-anchor">{props.suggestionAnchor ? `${props.suggestionAnchor.x},${props.suggestionAnchor.y}` : ""}</div>
      {(props.suggestions || []).map((s) => (
        <button key={`${s.type}-${s.route || ""}`} data-testid={`suggest-${s.type}`} onClick={() => props.onPickSuggestion(s)}>
          {s.type}{s.route ? `:${s.route}` : ""}{s.source === "ai" ? " (ai)" : ""}
        </button>
      ))}
      {props.aiSuggest?.enabled && (
        <button data-testid="ai-suggest" onClick={props.aiSuggest.onRequest}>{props.aiSuggest.status}</button>
      )}
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
  listWorkflowDefs,
  runWorkflowDef,
  cancelWorkflowRun,
  listWorkflowRevisions,
  getWorkflowTriggerState,
  rotateWorkflowTrigger,
  restoreWorkflowRevision,
  getPublicConfig,
  suggestNextWorkflowNode,
} = vi.hoisted(() => ({
  getWorkflowDef: vi.fn(),
  updateWorkflowDef: vi.fn(),
  listAgents: vi.fn(),
  listTools: vi.fn(),
  listToolConfigs: vi.fn(),
  listWorkflowDefs: vi.fn(),
  runWorkflowDef: vi.fn(),
  cancelWorkflowRun: vi.fn(),
  listWorkflowRevisions: vi.fn(),
  getWorkflowTriggerState: vi.fn(),
  rotateWorkflowTrigger: vi.fn(),
  restoreWorkflowRevision: vi.fn(),
  getPublicConfig: vi.fn(),
  suggestNextWorkflowNode: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  getWorkflowDef,
  updateWorkflowDef,
  listAgents,
  listTools,
  listToolConfigs,
  listWorkflowDefs,
  runWorkflowDef,
  cancelWorkflowRun,
  listWorkflowRevisions,
  restoreWorkflowRevision,
  getWorkflowTriggerState,
  rotateWorkflowTrigger,
  getPublicConfig,
  suggestNextWorkflowNode,
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
  listWorkflowDefs.mockResolvedValue([]);
  listWorkflowRevisions.mockResolvedValue([]);
  listWorkflowDefs.mockResolvedValue([]);
  getWorkflowTriggerState.mockResolvedValue({ kind: "manual", active: false, reason: "unpublished", webhook_url: null, form_url: null, hmac_enabled: false, next_run_at: null, last_fired_at: null, last_status: null });
  getPublicConfig.mockResolvedValue({ workflow_suggest_enabled: false });
  rotateWorkflowTrigger.mockResolvedValue({ webhook_url: "https://example.test/api/hooks/workflows/tok", hmac_secret: null });
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

  it("shows the restored node in the inspector, not the version it replaced", async () => {
    const restoredGraph = baseGraph();
    restoredGraph.nodes[2] = { ...restoredGraph.nodes[2], label: "Agent Restored" };
    listWorkflowRevisions.mockResolvedValue([
      { revision_id: 7, version: 1, reason: "edit", saved_at: "2026-09-22T06:00:00Z", name: "Test workflow" },
    ]);
    getWorkflowDef.mockResolvedValue(baseWorkflow({ version: 2 }));
    restoreWorkflowRevision.mockResolvedValue(baseWorkflow({ version: 3, graph: restoredGraph }));
    const user = userEvent.setup();
    render(<WorkflowStudio workflowId="wf1" />);
    await waitFor(() => expect(screen.getByTestId("node-count")).toHaveTextContent("3"));

    await user.click(screen.getByTestId("node-agentA"));
    expect(screen.getByDisplayValue("Agent A")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Versions" }));
    await user.click(await screen.findByRole("button", { name: "Restore" }));
    await user.click(screen.getByRole("button", { name: "Restore" }));

    await waitFor(() => expect(screen.getByDisplayValue("Agent Restored")).toBeInTheDocument());
    expect(screen.queryByDisplayValue("Agent A")).not.toBeInTheDocument();
  });

  it("warns before a restore unpublishes a published workflow", async () => {
    getWorkflowDef.mockResolvedValue(baseWorkflow({ status: "published", version: 2 }));
    listWorkflowRevisions.mockResolvedValue([
      { revision_id: 7, version: 1, reason: "edit", saved_at: "2026-09-22T06:00:00Z", name: "Test workflow" },
    ]);
    const user = userEvent.setup();
    render(<WorkflowStudio workflowId="wf1" />);
    await waitFor(() => expect(screen.getByTestId("node-count")).toHaveTextContent("3"));

    await user.click(screen.getByRole("button", { name: "Versions" }));
    await user.click(await screen.findByRole("button", { name: "Restore" }));
    expect(screen.getByText(/disarms its trigger/i)).toBeInTheDocument();
    expect(restoreWorkflowRevision).not.toHaveBeenCalled();
  });

  it("names an unreachable server instead of printing the proxy page, and offers a retry", async () => {
    const proxyError = Object.assign(new Error("HTTP 502"), { status: 502 });
    runWorkflowDef.mockRejectedValueOnce(proxyError);
    const user = userEvent.setup();
    render(<WorkflowStudio workflowId="wf1" />);
    await waitFor(() => expect(screen.getByTestId("node-count")).toHaveTextContent("3"));

    await user.click(screen.getByRole("button", { name: /^Test run/ }));
    await user.click(screen.getByRole("button", { name: /^Run$/ }));
    expect(await screen.findByText(/server could not be reached/i)).toBeInTheDocument();
    runWorkflowDef.mockRejectedValueOnce(proxyError);
    await user.click(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() => expect(runWorkflowDef).toHaveBeenCalledTimes(2));
  });

  it("words a coded refusal in the UI language instead of the server's French sentence", async () => {
    const refused = Object.assign(new Error("un seul déclencheur par workflow (t1, t2) ; supprimez les autres"), {
      status: 422,
      detail: {
        code: "single_trigger",
        params: { triggers: "t1, t2" },
        message: "un seul déclencheur par workflow (t1, t2) ; supprimez les autres",
      },
    });
    runWorkflowDef.mockRejectedValueOnce(refused);
    const user = userEvent.setup();
    render(<WorkflowStudio workflowId="wf1" />);
    await waitFor(() => expect(screen.getByTestId("node-count")).toHaveTextContent("3"));

    await user.click(screen.getByRole("button", { name: /^Test run/ }));
    await user.click(screen.getByRole("button", { name: /^Run$/ }));
    expect(await screen.findByText(/single trigger \(t1, t2 found\)/i)).toBeInTheDocument();
    expect(screen.queryByText(/un seul déclencheur/)).not.toBeInTheDocument();
  });

  it("says the change is not saved yet while the autosave waits", async () => {
    const user = userEvent.setup();
    render(<WorkflowStudio workflowId="wf1" />);
    await waitFor(() => expect(screen.getByTestId("node-count")).toHaveTextContent("3"));
    expect(screen.getByText("All changes saved")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Tool$/ }));

    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    expect(screen.queryByText("All changes saved")).not.toBeInTheDocument();
    await waitFor(() => expect(updateWorkflowDef).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText("All changes saved")).toBeInTheDocument());
  });

  it("saves a pending change right away when the studio is left", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<WorkflowStudio workflowId="wf1" />);
    await waitFor(() => expect(screen.getByTestId("node-count")).toHaveTextContent("3"));

    await user.click(screen.getByRole("button", { name: /^Tool$/ }));
    unmount();

    expect(updateWorkflowDef).toHaveBeenCalledTimes(1);
    expect(updateWorkflowDef.mock.calls[0][1].graph.nodes).toHaveLength(4);
  });

  it("saves a pending change with keepalive when the page is hidden or closed", async () => {
    const user = userEvent.setup();
    render(<WorkflowStudio workflowId="wf1" />);
    await waitFor(() => expect(screen.getByTestId("node-count")).toHaveTextContent("3"));

    await user.click(screen.getByRole("button", { name: /^Tool$/ }));
    window.dispatchEvent(new Event("pagehide"));

    expect(updateWorkflowDef).toHaveBeenCalledTimes(1);
    expect(updateWorkflowDef.mock.calls[0][1].graph.nodes).toHaveLength(4);
    expect(updateWorkflowDef.mock.calls[0][2]).toEqual({ keepalive: true });
  });

  it("does not save on leaving when nothing changed", async () => {
    const { unmount } = render(<WorkflowStudio workflowId="wf1" />);
    await waitFor(() => expect(screen.getByTestId("node-count")).toHaveTextContent("3"));
    window.dispatchEvent(new Event("pagehide"));
    unmount();
    expect(updateWorkflowDef).not.toHaveBeenCalled();
  });
});

describe("next-step suggestions", () => {
  it("offers the branch with no edge after the selected router, and one click adds, wires and pre-fills it", async () => {
    const user = userEvent.setup();
    render(<WorkflowStudio workflowId="wf1" />);
    await screen.findByTestId("canvas-mock");

    await user.click(screen.getByTestId("node-agentA"));
    expect(screen.getByTestId("suggestion-anchor").textContent).toBe("400,0");
    expect(screen.getByTestId("suggest-output")).toBeTruthy();

    await user.click(screen.getByTestId("suggest-output"));

    expect(screen.getByTestId("node-count").textContent).toBe("4");
    expect(screen.getByTestId("edge-agentA-output1")).toBeTruthy();
    const value = await screen.findByDisplayValue("{{agentA}}");
    expect(value).toBeTruthy();
    // The view follows the new node, so its own suggestions have room.
    expect(screen.getByTestId("focus-request").textContent).not.toBe("");
  });

  it("says nothing after a node that is already wired", async () => {
    const user = userEvent.setup();
    render(<WorkflowStudio workflowId="wf1" />);
    await screen.findByTestId("canvas-mock");

    await user.click(screen.getByTestId("node-trigger1"));

    expect(screen.getByTestId("suggestion-anchor").textContent).toBe("");
    expect(screen.queryByTestId("suggest-agent")).toBeNull();
  });
});

describe("model suggestions", () => {
  const answer = {
    route: null,
    suggestions: [
      { type: "output", label: "Réponse", config: { value: "{{agentA.text}}" }, reason: "Rendre la réponse." },
      { type: "notification", label: "", config: { channel: "app", body: "{{agentA}}" }, reason: "" },
    ],
  };

  async function openAgent(user) {
    render(<WorkflowStudio workflowId="wf1" />);
    await screen.findByTestId("canvas-mock");
    await user.click(screen.getByTestId("node-agentA"));
  }

  it("shows no AI button when the server does not serve model suggestions", async () => {
    const user = userEvent.setup();
    await openAgent(user);
    expect(screen.getByTestId("suggest-output")).toBeTruthy();
    expect(screen.queryByTestId("ai-suggest")).toBeNull();
    expect(suggestNextWorkflowNode).not.toHaveBeenCalled();
  });

  it("asks only on click, sends the draft on screen, and puts the model's complete nodes first", async () => {
    getPublicConfig.mockResolvedValue({ workflow_suggest_enabled: true });
    suggestNextWorkflowNode.mockResolvedValue(answer);
    const user = userEvent.setup();
    await openAgent(user);
    await user.click(await screen.findByTestId("ai-suggest"));

    expect(suggestNextWorkflowNode).toHaveBeenCalledTimes(1);
    const [body] = suggestNextWorkflowNode.mock.calls[0];
    expect(body.node_id).toBe("agentA");
    expect(body.name).toBe("Test workflow");
    expect(body.graph.nodes.map((n) => n.id)).toEqual(["trigger1", "router1", "agentA"]);

    await waitFor(() => expect(screen.getByTestId("suggest-output").textContent).toBe("output (ai)"));
    const chips = screen.getAllByTestId(/^suggest-/).map((b) => b.textContent);
    expect(chips).toEqual(["output (ai)", "notification (ai)", "condition"]);

    await user.click(screen.getByTestId("suggest-output"));
    expect(screen.getByTestId("edge-agentA-output1")).toBeTruthy();
    expect(await screen.findByDisplayValue("{{agentA.text}}")).toBeTruthy();
  });

  it("keeps the rule chips and says why when the model is unavailable or the quota is reached", async () => {
    getPublicConfig.mockResolvedValue({ workflow_suggest_enabled: true });
    suggestNextWorkflowNode.mockRejectedValueOnce(Object.assign(new Error("unavailable"), { status: 503 }));
    const user = userEvent.setup();
    await openAgent(user);
    await user.click(await screen.findByTestId("ai-suggest"));
    await waitFor(() => expect(screen.getByTestId("ai-suggest").textContent).toBe("unavailable"));
    expect(screen.getByTestId("suggest-output").textContent).toBe("output");

    suggestNextWorkflowNode.mockRejectedValueOnce(Object.assign(new Error("quota"), { status: 402 }));
    await user.click(screen.getByTestId("ai-suggest"));
    await waitFor(() => expect(screen.getByTestId("ai-suggest").textContent).toBe("quota"));
  });

  it("drops the model's chips when another node is selected", async () => {
    getPublicConfig.mockResolvedValue({ workflow_suggest_enabled: true });
    suggestNextWorkflowNode.mockResolvedValue(answer);
    const user = userEvent.setup();
    await openAgent(user);
    await user.click(await screen.findByTestId("ai-suggest"));
    await waitFor(() => expect(screen.getByTestId("suggest-output").textContent).toBe("output (ai)"));

    await user.click(screen.getByTestId("node-trigger1"));
    await user.click(screen.getByTestId("node-agentA"));
    expect(screen.getByTestId("suggest-output").textContent).toBe("output");
    expect(screen.getByTestId("ai-suggest").textContent).toBe("idle");
  });
});
