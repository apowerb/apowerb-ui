/**
 * Error handling v1: per-node `on_error` (fail / continue / route) and
 * `timeout_s`, HTTP error statuses, the Try retry warning and the workflow's
 * "Notify me on failure" setting. Local validation mirrors the engine
 * (core `workflow_graph._validate_error_handling` and the edge checks of
 * `validate_graph`), with the same refusals; settings the engine ignores (on a
 * node type without them) are warnings, so a saved graph still runs.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import StudioInspector from "@/components/workflow-studio/StudioInspector";
import ExecutionPanel from "@/components/workflow-studio/ExecutionPanel";
import { createNode, createLoopBody, graphToFlow, flowToGraph, validateGraphLocal, templateSuggestionsFor } from "@/lib/workflowGraph";
import { applyRunEvent, createRunState } from "@/lib/workflowRunState";

vi.mock("@/lib/api", () => ({ getTeamsWebhookStatus: vi.fn(() => Promise.resolve({ configured: false })) }));

const trigger = { id: "t", type: "trigger", config: {} };
const agent = (config = {}) => ({ id: "a", type: "agent", config: { agent_id: "agent1", ...config } });
const out = (id) => ({ id, type: "output", config: {} });
const sub = (config = {}) => ({ id: "a", type: "subworkflow", config: { workflow_id: "w2", ...config } });

function messages(graph) {
  return validateGraphLocal(graph).errors.map((e) => e.message);
}

function warnings(graph) {
  return validateGraphLocal(graph).errors.filter((e) => e.level === "warning").map((e) => e.message);
}

describe("on_error in the graph model", () => {
  const routed = {
    nodes: [trigger, agent({ on_error: "route" }), out("ok"), out("ko")],
    edges: [
      { source: "t", target: "a" },
      { source: "a", target: "ok" },
      { source: "a", target: "ko", route: "error" },
    ],
  };

  it("accepts a route node with its error output wired", () => {
    expect(validateGraphLocal(routed).valid).toBe(true);
  });

  it("refuses an unwired error output, like the engine", () => {
    const graph = { ...routed, edges: routed.edges.slice(0, 2) };
    expect(messages(graph)).toContain("onErrorRouteMissing");
  });

  it("refuses an error connection without on_error: route", () => {
    const graph = { ...routed, nodes: [trigger, agent(), out("ok"), out("ko")] };
    expect(messages(graph)).toContain("onErrorRouteUnexpected");
  });

  it("refuses any other route on a route node", () => {
    const graph = { ...routed, edges: [...routed.edges.slice(0, 2), { source: "a", target: "ko", route: "oops" }] };
    expect(messages(graph)).toContain("onErrorRouteUnknown:oops");
  });

  it("only warns about a mode the engine ignores: unknown, continue on a classifier, or a step without it", () => {
    // A saved graph keeps running: the engine treats these as fail.
    const unknown = { nodes: [trigger, agent({ on_error: "ignore" })], edges: [{ source: "t", target: "a" }] };
    expect(warnings(unknown)).toContain("onErrorUnknown:ignore");
    expect(validateGraphLocal(unknown).valid).toBe(true);
    const set = { id: "s", type: "set", config: { fields: [{ key: "k", value: "v" }], on_error: "continue" } };
    const withSet = { nodes: [trigger, set], edges: [{ source: "t", target: "s" }] };
    expect(warnings(withSet)).toContain("onErrorUnsupported:set");
    expect(validateGraphLocal(withSet).valid).toBe(true);
    const cls = { id: "c", type: "classifier", config: { agent_id: "x", routes: [{ route: "a", description: "a" }, { route: "b", description: "b" }], on_error: "continue" } };
    expect(warnings({ nodes: [trigger, cls], edges: [{ source: "t", target: "c" }] })).toContain("onErrorUnknown:continue");
  });

  it("gives a routing classifier an extra error route, and reserves its name", () => {
    const routes = [{ route: "x", description: "x" }, { route: "y", description: "y" }];
    const cls = { id: "c", type: "classifier", config: { agent_id: "ag", routes, on_error: "route" } };
    const edges = [
      { source: "t", target: "c" },
      { source: "c", target: "x", route: "x" },
      { source: "c", target: "y", route: "y" },
      { source: "c", target: "e", route: "error" },
    ];
    expect(messages({ nodes: [trigger, cls, out("x"), out("y"), out("e")], edges })).not.toContain("unknownRoute:error");
    const clash = { ...cls, config: { ...cls.config, routes: [{ route: "error", description: "e" }, routes[1]] } };
    expect(messages({ nodes: [trigger, clash, out("y"), out("e")], edges: [edges[0], edges[2], edges[3]] })).toContain("onErrorRouteConflict");
  });

  it("treats a null on_error as the default, like the engine", () => {
    expect(validateGraphLocal({ nodes: [trigger, agent({ on_error: null })], edges: [{ source: "t", target: "a" }] }).valid).toBe(true);
  });

  it("bounds timeout_s on a sub-workflow, the only step it really stops", () => {
    const edge = [{ source: "t", target: "a" }];
    expect(messages({ nodes: [trigger, sub({ timeout_s: 0 })], edges: edge })).toContain("nodeTimeoutInvalid");
    // null means no limit, like a null on_error means fail.
    expect(messages({ nodes: [trigger, sub({ timeout_s: null })], edges: edge })).toEqual([]);
    expect(messages({ nodes: [trigger, sub({ timeout_s: 3601 })], edges: edge })).toContain("nodeTimeoutInvalid");
    expect(messages({ nodes: [trigger, sub({ timeout_s: 60 })], edges: edge }).some((m) => m.startsWith("nodeTimeout"))).toBe(false);
    // An agent keeps running on the ADK server and a tool in its thread: ignored, said so.
    const slowAgent = { nodes: [trigger, agent({ timeout_s: 60 })], edges: edge };
    expect(warnings(slowAgent)).toContain("nodeTimeoutUnsupported:agent");
    expect(validateGraphLocal(slowAgent).valid).toBe(true);
  });

  it("lets downstream steps read the error fields of a handled node only", () => {
    const http = (onError) => ({ id: "h", type: "http", config: { method: "GET", url: "https://x.example", headers: [], timeout_s: 15, on_error: onError } });
    const reader = { id: "r", type: "output", config: { value: "{{h.code}}" } };
    const edges = [{ source: "t", target: "h" }, { source: "h", target: "r", route: "error" }];
    expect(messages({ nodes: [trigger, http("route"), reader], edges })).not.toContain("templateRefUnknownField:{{h.code}}");
    expect(messages({ nodes: [trigger, http("fail"), reader], edges: [edges[0], { source: "h", target: "r" }] })).toContain("templateRefUnknownField:{{h.code}}");
    expect(templateSuggestionsFor(http("continue"))).toContain("{{h.code}}");
  });
});

describe("http error statuses", () => {
  it("makes a new http node strict, while a saved node without the field stays lenient", () => {
    expect(createNode("http").config.accept_error_status).toBe(false);
  });

  it("only warns about a non-boolean accept_error_status, which the engine ignores", () => {
    const h = { id: "h", type: "http", config: { method: "GET", url: "https://x.example", headers: [], timeout_s: 15, accept_error_status: "no" } };
    const graph = { nodes: [trigger, h], edges: [{ source: "t", target: "h" }] };
    expect(warnings(graph)).toContain("httpAcceptErrorStatusInvalid");
    expect(validateGraphLocal(graph).valid).toBe(true);
  });
});

describe("workflow settings", () => {
  it("round-trip through flowToGraph, and stay absent when unset", () => {
    const flow = graphToFlow({ nodes: [trigger], edges: [] });
    expect(flowToGraph(flow.nodes, flow.edges)).not.toHaveProperty("settings");
    expect(flowToGraph(flow.nodes, flow.edges, { notify_on_failure: false }).settings).toEqual({ notify_on_failure: false });
    expect(flowToGraph(flow.nodes, flow.edges, {})).not.toHaveProperty("settings");
  });
});

function Inspector({ graph, selection, onConfig = () => {}, onRoute = () => {}, ...rest }) {
  const [flow, setFlow] = useState(() => graphToFlow(graph));
  const sel = selection?.kind === "node" ? { kind: "node", node: flow.nodes.find((n) => n.id === selection.id) } : selection;
  return (
    <StudioInspector
      selection={sel}
      nodes={flow.nodes}
      edges={flow.edges}
      onChangeLabel={() => {}}
      onRenameNode={() => {}}
      onPatchConfig={(id, partial) => {
        setFlow((f) => ({
          ...f,
          nodes: f.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, config: { ...n.data.config, ...partial } } } : n)),
        }));
        onConfig(partial);
      }}
      onChangeEdgeRoute={onRoute}
      onDeleteNode={() => {}}
      onDeleteEdge={() => {}}
      onOpenLoopBody={() => {}}
      {...rest}
    />
  );
}

describe("inspector: error handling", () => {
  it("sets on_error on a node that can fail, and writes nothing for the default", async () => {
    const onConfig = vi.fn();
    render(<Inspector graph={{ nodes: [trigger, agent()], edges: [] }} selection={{ kind: "node", id: "a" }} onConfig={onConfig} />);
    const select = screen.getByLabelText("If this step fails");
    await userEvent.selectOptions(select, "route");
    expect(onConfig).toHaveBeenLastCalledWith({ on_error: "route" });
    await userEvent.selectOptions(select, "fail");
    expect(onConfig).toHaveBeenLastCalledWith({ on_error: undefined });
  });

  it("offers no continue on a classifier and no setting on a node that cannot fail", () => {
    const cls = { id: "c", type: "classifier", config: { agent_id: "x", routes: [] } };
    const { unmount } = render(<Inspector graph={{ nodes: [trigger, cls], edges: [] }} selection={{ kind: "node", id: "c" }} />);
    const options = [...screen.getByLabelText("If this step fails").querySelectorAll("option")].map((o) => o.value);
    expect(options).toEqual(["fail", "route"]);
    unmount();
    const set = { id: "s", type: "set", config: { fields: [] } };
    render(<Inspector graph={{ nodes: [trigger, set], edges: [] }} selection={{ kind: "node", id: "s" }} />);
    expect(screen.queryByLabelText("If this step fails")).toBeNull();
  });

  it("offers no time limit on an agent, which it could not stop", () => {
    render(<Inspector graph={{ nodes: [trigger, agent()], edges: [] }} selection={{ kind: "node", id: "a" }} />);
    expect(screen.queryByLabelText("Time limit (seconds)")).toBeNull();
  });

  it("edits the time limit, empty meaning none", async () => {
    const onConfig = vi.fn();
    render(<Inspector graph={{ nodes: [trigger, sub()], edges: [] }} selection={{ kind: "node", id: "a" }} onConfig={onConfig} />);
    const input = screen.getByLabelText("Time limit (seconds)");
    await userEvent.type(input, "30");
    expect(onConfig).toHaveBeenLastCalledWith({ timeout_s: 30 });
    await userEvent.clear(input);
    expect(onConfig).toHaveBeenLastCalledWith({ timeout_s: undefined });
  });

  it("writes accept_error_status explicitly both ways on an http node", async () => {
    const onConfig = vi.fn();
    const http = { id: "h", type: "http", config: { method: "GET", url: "https://x.example", headers: [], timeout_s: 15, accept_error_status: false } };
    render(<Inspector graph={{ nodes: [trigger, http], edges: [] }} selection={{ kind: "node", id: "h" }} onConfig={onConfig} />);
    const toggle = screen.getByRole("switch", { name: "Treat 4xx/5xx responses as success" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    await userEvent.click(toggle);
    expect(onConfig).toHaveBeenLastCalledWith({ accept_error_status: true });
    await userEvent.click(toggle);
    // false, not undefined: a missing field means "accept", the old behaviour.
    expect(onConfig).toHaveBeenLastCalledWith({ accept_error_status: false });
  });

  it("shows a legacy http node (no field) as accepting error statuses", () => {
    const http = { id: "h", type: "http", config: { method: "GET", url: "https://x.example", headers: [], timeout_s: 15 } };
    render(<Inspector graph={{ nodes: [trigger, http], edges: [] }} selection={{ kind: "node", id: "h" }} />);
    expect(screen.getByRole("switch", { name: "Treat 4xx/5xx responses as success" })).toHaveAttribute("aria-checked", "true");
  });

  it("lets an edge leaving a route node be the success or the error output", async () => {
    const onRoute = vi.fn();
    const graph = { nodes: [trigger, agent({ on_error: "route" }), out("ko")], edges: [{ source: "t", target: "a" }, { source: "a", target: "ko" }] };
    const flow = graphToFlow(graph);
    render(<Inspector graph={graph} selection={{ kind: "edge", edge: flow.edges[1] }} onRoute={onRoute} />);
    const select = screen.getByLabelText("Route");
    expect([...select.querySelectorAll("option")].map((o) => o.textContent)).toEqual(["Success", "Error output"]);
    await userEvent.selectOptions(select, "error");
    expect(onRoute).toHaveBeenLastCalledWith(flow.edges[1].id, "error");
  });
});

describe("inspector: try warns about repeated effects", () => {
  const tryWith = (bodyNodes) => {
    const body = createLoopBody();
    return { ...createNode("try", { id: "try1" }), config: { body: { ...body, nodes: [...body.nodes, ...bodyNodes] }, retries: 2, retry_delay_ms: 0 } };
  };

  it("lists the external effects of its body, which each attempt repeats", () => {
    const node = tryWith([
      { id: "mail", type: "notification", label: "Mail client", config: {} },
      { id: "call", type: "http", config: {} },
      { id: "shape", type: "set", config: {} },
    ]);
    render(<Inspector graph={{ nodes: [trigger, node], edges: [] }} selection={{ kind: "node", id: "try1" }} />);
    const warning = screen.getByTestId("try-effects-warning");
    expect(warning).toHaveTextContent("Mail client");
    expect(warning).toHaveTextContent("call");
    expect(warning).toHaveTextContent("sends a message");
    expect(warning).not.toHaveTextContent("shape");
  });

  it("stays silent for a body without effects", () => {
    const node = tryWith([{ id: "shape", type: "set", config: {} }]);
    render(<Inspector graph={{ nodes: [trigger, node], edges: [] }} selection={{ kind: "node", id: "try1" }} />);
    expect(screen.queryByTestId("try-effects-warning")).toBeNull();
  });

  it("stays silent without retries, since the body then runs once", () => {
    const node = tryWith([{ id: "mail", type: "notification", config: {} }]);
    node.config.retries = 0;
    render(<Inspector graph={{ nodes: [trigger, node], edges: [] }} selection={{ kind: "node", id: "try1" }} />);
    expect(screen.queryByTestId("try-effects-warning")).toBeNull();
  });
});

describe("inspector: workflow settings", () => {
  it("shows the failure alert on by default once published, and writes an explicit choice", async () => {
    const onChangeSettings = vi.fn();
    render(<Inspector graph={{ nodes: [trigger], edges: [] }} selection={null} workflowStatus="published" workflowSettings={null} onChangeSettings={onChangeSettings} />);
    const toggle = screen.getByRole("switch", { name: "Notify me on failure" });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    await userEvent.click(toggle);
    expect(onChangeSettings).toHaveBeenLastCalledWith({ notify_on_failure: false });
  });

  it("shows it off by default on a draft", () => {
    render(<Inspector graph={{ nodes: [trigger], edges: [] }} selection={null} workflowStatus="draft" workflowSettings={null} onChangeSettings={() => {}} />);
    expect(screen.getByRole("switch", { name: "Notify me on failure" })).toHaveAttribute("aria-checked", "false");
  });
});

describe("run state and test panel", () => {
  function panel(state) {
    return render(
      <ExecutionPanel open onToggle={() => {}} payloadText="{}" onPayloadTextChange={() => {}} payloadError={null} isRunning={false} runState={state} onRun={() => {}} onCancel={() => {}} />,
    );
  }

  it("keeps a handled error on the completed node, so continue never looks like a success", () => {
    let s = createRunState();
    s = applyRunEvent(s, { event: "node_start", node_id: "a", type: "agent" });
    s = applyRunEvent(s, {
      event: "node_complete",
      node_id: "a",
      output: { code: "node_timeout" },
      handled_error: { code: "node_timeout", detail: "a : délai dépassé", params: { node: "a", seconds: "30" }, node: "a", on_error: "continue" },
    });
    const entry = s.timeline.find((e) => e.id === "a");
    expect(entry.status).toBe("done");
    expect(entry.handledError).toMatchObject({ code: "node_timeout", onError: "continue" });
    panel(s);
    expect(screen.getByText(/Failed, the run went on: Step a timed out after 30s/)).toBeInTheDocument();
  });

  it("says when the error output was taken", () => {
    let s = createRunState();
    s = applyRunEvent(s, { event: "node_start", node_id: "h", type: "http" });
    s = applyRunEvent(s, {
      event: "node_complete",
      node_id: "h",
      output: {},
      handled_error: { code: "http_error_status", detail: "h : réponse HTTP 404", params: { node: "h", status: "404" }, node: "h", on_error: "route" },
    });
    panel(s);
    expect(screen.getByText(/Failed, took the error output: .*status 404/)).toBeInTheDocument();
  });

  it("words a timeout that stops the run", () => {
    let s = createRunState();
    s = applyRunEvent(s, { event: "node_start", node_id: "a", type: "agent" });
    s = applyRunEvent(s, { event: "node_error", node_id: "a", code: "node_timeout", detail: "a : délai dépassé", params: { node: "a", seconds: "5" } });
    panel(s);
    expect(screen.getByText(/Step a timed out after 5s/)).toBeInTheDocument();
  });
});
