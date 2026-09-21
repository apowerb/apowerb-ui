/**
 * Try and Subworkflow nodes (LOT 2, 21/09): local validation, defaults, the
 * inspector fields that configure them, the generalized loop/try body
 * editor, and the run-state/execution-panel wiring for the try node's
 * "<try>.<inner>" events with `attempt` instead of `iteration`.
 *
 * Mirrors outputConvert.test.jsx's structure and scope: the graph model,
 * StudioInspector and ExecutionPanel are exercised directly (no
 * @xyflow/react rendering — the node visual components (TryNode,
 * SubworkflowNode) aren't unit-tested here either, same as ConvertNode/
 * OutputNode weren't), plus LoopBodyEditor for the generalized body editor.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import StudioInspector from "@/components/workflow-studio/StudioInspector";
import StudioPalette from "@/components/workflow-studio/StudioPalette";
import ExecutionPanel from "@/components/workflow-studio/ExecutionPanel";
import LoopBodyEditor from "@/components/workflow-studio/LoopBodyEditor";
import { createNode, createLoopBody, graphToFlow, flowToGraph, validateGraphLocal, NODE_TYPES } from "@/lib/workflowGraph";
import { applyRunEvent, createRunState } from "@/lib/workflowRunState";

// LoopBodyEditor mounts the real StudioCanvas, which wraps @xyflow/react —
// jsdom lacks the layout/ResizeObserver APIs it needs. Same convention as
// WorkflowStudio.test.jsx: stub the canvas, exercise everything around it
// (here, the palette it's paired with) for real.
vi.mock("@/components/workflow-studio/StudioCanvas", () => ({
  default: () => <div data-testid="canvas-mock" />,
}));

const trigger = { id: "t", type: "trigger", config: {} };

describe("try and subworkflow in the graph model", () => {
  it("are known node types with safe defaults", () => {
    expect(NODE_TYPES).toEqual(expect.arrayContaining(["try", "subworkflow"]));

    const tryNode = createNode("try");
    expect(tryNode.config.retries).toBe(0);
    expect(tryNode.config.retry_delay_ms).toBe(0);
    expect(tryNode.config.body.nodes).toHaveLength(1);
    expect(tryNode.config.body.nodes[0].type).toBe("trigger");

    // No `input` key: an empty template would replace the sub-workflow's
    // own input, same reasoning as output's `value`.
    expect(createNode("subworkflow").config).toEqual({ workflow_id: "" });
  });

  it("round-trips a try node's ok/error routes and body opaquely through graphToFlow/flowToGraph", () => {
    const tryNode = createNode("try", { id: "try1" });
    const graph = {
      version: 1,
      nodes: [
        { id: "trigger1", type: "trigger", label: "", config: { kind: "manual" }, position: { x: 0, y: 0 } },
        { ...tryNode, config: { ...tryNode.config, retries: 2, retry_delay_ms: 500 }, position: { x: 200, y: 0 } },
        { id: "okNode", type: "agent", label: "", config: { agent_id: "" }, position: { x: 400, y: -60 } },
        { id: "errNode", type: "agent", label: "", config: { agent_id: "" }, position: { x: 400, y: 60 } },
      ],
      edges: [
        { source: "trigger1", target: "try1" },
        { source: "try1", target: "okNode", route: "ok" },
        { source: "try1", target: "errNode", route: "error" },
      ],
    };

    const { nodes, edges } = graphToFlow(graph);
    const back = flowToGraph(nodes, edges);

    const backTry = back.nodes.find((n) => n.id === "try1");
    expect(backTry.config.retries).toBe(2);
    expect(backTry.config.retry_delay_ms).toBe(500);
    expect(backTry.config.body).toEqual(tryNode.config.body); // opaque — untouched by the round-trip

    expect(back.edges).toEqual(
      expect.arrayContaining([
        { source: "try1", target: "okNode", route: "ok" },
        { source: "try1", target: "errNode", route: "error" },
      ]),
    );
  });

  it("round-trips a subworkflow node's config", () => {
    const graph = {
      version: 1,
      nodes: [
        { id: "trigger1", type: "trigger", label: "", config: { kind: "manual" }, position: { x: 0, y: 0 } },
        { id: "sw1", type: "subworkflow", label: "", config: { workflow_id: "wf9", input: "{{trigger1.payload}}" }, position: { x: 200, y: 0 } },
      ],
      edges: [{ source: "trigger1", target: "sw1" }],
    };
    const { nodes, edges } = graphToFlow(graph);
    const back = flowToGraph(nodes, edges);
    expect(back.nodes.find((n) => n.id === "sw1").config).toEqual({ workflow_id: "wf9", input: "{{trigger1.payload}}" });
  });
});

describe("try node — validation", () => {
  function tryGraph(overrides = {}, extraNodes = [], extraEdges = []) {
    return {
      nodes: [trigger, { id: "try1", type: "try", config: { body: createLoopBody(), retries: 0, retry_delay_ms: 0, ...overrides } }, ...extraNodes],
      edges: [{ source: "t", target: "try1" }, ...extraEdges],
    };
  }

  it("bounds retries to 0..3", () => {
    expect(validateGraphLocal(tryGraph({ retries: 4 })).errors.map((e) => e.message)).toContain("tryRetries:4");
    expect(validateGraphLocal(tryGraph({ retries: -1 })).errors.some((e) => e.message.startsWith("tryRetries:"))).toBe(true);
    expect(validateGraphLocal(tryGraph({ retries: 3 })).errors.some((e) => e.message.startsWith("tryRetries:"))).toBe(false);
  });

  it("bounds retry_delay_ms to 0..5000", () => {
    expect(validateGraphLocal(tryGraph({ retry_delay_ms: 5001 })).errors.map((e) => e.message)).toContain("tryRetryDelay:5001");
    expect(validateGraphLocal(tryGraph({ retry_delay_ms: -1 })).errors.some((e) => e.message.startsWith("tryRetryDelay:"))).toBe(true);
    expect(validateGraphLocal(tryGraph({ retry_delay_ms: 5000 })).errors.some((e) => e.message.startsWith("tryRetryDelay:"))).toBe(false);
  });

  it("requires a body", () => {
    const graph = { nodes: [trigger, { id: "try1", type: "try", config: { retries: 0, retry_delay_ms: 0 } }], edges: [{ source: "t", target: "try1" }] };
    expect(validateGraphLocal(graph).errors.map((e) => e.message)).toContain("tryBodyMissing");
  });

  it("refuses an outgoing route other than ok/error", () => {
    const graph = tryGraph({}, [{ id: "a", type: "agent", config: {} }], [{ source: "try1", target: "a", route: "maybe" }]);
    expect(validateGraphLocal(graph).errors.map((e) => e.message)).toContain("unknownRoute:maybe");
  });

  it("refuses two connections on the same route", () => {
    const graph = tryGraph(
      {},
      [{ id: "a", type: "agent", config: {} }, { id: "b", type: "agent", config: {} }],
      [{ source: "try1", target: "a", route: "ok" }, { source: "try1", target: "b", route: "ok" }],
    );
    expect(validateGraphLocal(graph).errors.map((e) => e.message)).toContain("tryDuplicateRoute:ok");
  });

  it("accepts one ok and one error connection", () => {
    const graph = tryGraph(
      {},
      [{ id: "a", type: "agent", config: {} }, { id: "b", type: "agent", config: {} }],
      [{ source: "try1", target: "a", route: "ok" }, { source: "try1", target: "b", route: "error" }],
    );
    expect(validateGraphLocal(graph).errors.map((e) => e.message)).not.toEqual(expect.arrayContaining([expect.stringMatching(/^(unknownRoute|tryDuplicateRoute):/)]));
  });

  it("validates the body recursively, namespacing errors as try1.innerId — like a loop", () => {
    const badBody = {
      version: 1,
      nodes: [
        { id: "trigger1", type: "trigger", config: { kind: "manual" }, position: { x: 0, y: 0 } },
        { id: "router1", type: "router", config: { rules: [{ route: "a", field: "x", op: "eq", value: 1 }], default_route: "" }, position: { x: 200, y: 0 } },
        { id: "agentA", type: "agent", config: { agent_id: "" }, position: { x: 400, y: 0 } },
      ],
      edges: [{ source: "trigger1", target: "router1" }, { source: "router1", target: "agentA" }], // missing route on this edge
    };
    const result = validateGraphLocal(tryGraph({ body: badBody }));
    expect(result.errors.some((e) => e.nodeId === "try1.router1" && e.message.startsWith("missingRoute:"))).toBe(true);
  });
});

describe("subworkflow node — validation", () => {
  it("requires a workflow_id", () => {
    const graph = { nodes: [trigger, { id: "sw", type: "subworkflow", config: { workflow_id: "" } }], edges: [{ source: "t", target: "sw" }] };
    expect(validateGraphLocal(graph).errors.map((e) => e.message)).toContain("subworkflowRequired");
  });

  it("refuses calling the workflow currently being edited", () => {
    const graph = { nodes: [trigger, { id: "sw", type: "subworkflow", config: { workflow_id: "wf1" } }], edges: [{ source: "t", target: "sw" }] };
    expect(validateGraphLocal(graph, { currentWorkflowId: "wf1" }).errors.map((e) => e.message)).toContain("subworkflowSelfReference");
    expect(validateGraphLocal(graph, { currentWorkflowId: "wf2" }).errors.map((e) => e.message)).not.toContain("subworkflowSelfReference");
    // No context at all (e.g. the loop/try body validator called without it) — never false-positives.
    expect(validateGraphLocal(graph).errors.map((e) => e.message)).not.toContain("subworkflowSelfReference");
  });
});

function Inspector({ graph, nodeId, onConfig, workflowOptions, currentWorkflowId }) {
  const [flow, setFlow] = useState(() => graphToFlow(graph));
  const node = flow.nodes.find((n) => n.id === nodeId);
  return (
    <StudioInspector
      selection={{ kind: "node", node }}
      nodes={flow.nodes}
      edges={flow.edges}
      workflowOptions={workflowOptions}
      currentWorkflowId={currentWorkflowId}
      onChangeLabel={() => {}}
      onRenameNode={() => {}}
      onPatchConfig={(id, partial) => {
        setFlow((f) => ({
          ...f,
          nodes: f.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, config: { ...n.data.config, ...partial } } } : n)),
        }));
        onConfig(partial);
      }}
      onChangeEdgeRoute={() => {}}
      onDeleteNode={() => {}}
      onDeleteEdge={() => {}}
      onOpenLoopBody={() => {}}
    />
  );
}

describe("inspector", () => {
  it("configures a try node's retries and retry delay", async () => {
    const user = userEvent.setup();
    const patches = [];
    render(
      <Inspector
        graph={{ nodes: [trigger, { id: "try1", type: "try", config: { body: createLoopBody(), retries: 0, retry_delay_ms: 0 } }], edges: [{ source: "t", target: "try1" }] }}
        nodeId="try1"
        onConfig={(p) => patches.push(p)}
      />,
    );
    await user.clear(screen.getByLabelText(/^Retries/i));
    await user.type(screen.getByLabelText(/^Retries/i), "2");
    expect(patches.at(-1)).toEqual({ retries: 2 });

    await user.clear(screen.getByLabelText(/Delay between retries/i));
    await user.type(screen.getByLabelText(/Delay between retries/i), "750");
    expect(patches.at(-1)).toEqual({ retry_delay_ms: 750 });
  });

  it("shows the ok/error routes translated (OK / Error) in the edge inspector for a try node", () => {
    const nodes = [
      { id: "try1", type: "try", data: { label: "", config: { body: createLoopBody(), retries: 0, retry_delay_ms: 0 } } },
      { id: "a", type: "agent", data: { label: "", config: {} } },
    ];
    const edge = { id: "e1", source: "try1", target: "a", data: { route: "ok" } };
    render(
      <StudioInspector
        selection={{ kind: "edge", edge }}
        nodes={nodes}
        edges={[edge]}
        onChangeLabel={() => {}}
        onRenameNode={() => {}}
        onPatchConfig={() => {}}
        onChangeEdgeRoute={() => {}}
        onDeleteNode={() => {}}
        onDeleteEdge={() => {}}
        onOpenLoopBody={() => {}}
      />,
    );
    const select = screen.getByLabelText(/Route/i);
    expect(within(select).getByText("OK")).toBeInTheDocument();
    expect(within(select).getByText("Error")).toBeInTheDocument();
  });

  it("excludes the current workflow from the subworkflow selector", () => {
    render(
      <Inspector
        graph={{ nodes: [trigger, { id: "sw", type: "subworkflow", config: { workflow_id: "" } }], edges: [{ source: "t", target: "sw" }] }}
        nodeId="sw"
        onConfig={() => {}}
        workflowOptions={[{ value: "wf1", label: "This one" }, { value: "wf2", label: "Some other workflow" }]}
        currentWorkflowId="wf1"
      />,
    );
    const select = screen.getByLabelText(/^Workflow$/i);
    expect(within(select).queryByText("This one")).not.toBeInTheDocument();
    expect(within(select).getByText("Some other workflow")).toBeInTheDocument();
  });
});

describe("palette", () => {
  it("lists try and subworkflow in the main palette", () => {
    render(<StudioPalette onAdd={() => {}} />);
    expect(screen.getByText("Try")).toBeInTheDocument();
    expect(screen.getByText("Subworkflow")).toBeInTheDocument();
  });
});

describe("LoopBodyEditor — generalized to also edit a try body", () => {
  it("hides loop and try from the palette when editing a try body (no nesting)", () => {
    render(
      <LoopBodyEditor
        node={{ id: "try1", type: "try", data: { label: "", config: {} } }}
        body={createLoopBody()}
        onChange={() => {}}
        onClose={() => {}}
        agentOptions={[]}
        toolOptions={[]}
        workflowOptions={[]}
        currentWorkflowId="wf1"
      />,
    );
    expect(screen.queryByText("Loop")).not.toBeInTheDocument();
    expect(screen.queryByText("Try")).not.toBeInTheDocument();
    // Ordinary node types stay available.
    expect(screen.getByText("Agent")).toBeInTheDocument();
    expect(screen.getByText("Subworkflow")).toBeInTheDocument();
  });

  it("also hides try from a loop body (symmetric — no flow-control nesting either way)", () => {
    render(
      <LoopBodyEditor
        node={{ id: "loop1", type: "loop", data: { label: "", config: {} } }}
        body={createLoopBody()}
        onChange={() => {}}
        onClose={() => {}}
        agentOptions={[]}
        toolOptions={[]}
      />,
    );
    expect(screen.queryByText("Try")).not.toBeInTheDocument();
    expect(screen.queryByText("Loop")).not.toBeInTheDocument();
  });

  it("titles the modal for a try body distinctly from a loop body", () => {
    render(
      <LoopBodyEditor
        node={{ id: "try1", type: "try", data: { label: "", config: {} } }}
        body={createLoopBody()}
        onChange={() => {}}
        onClose={() => {}}
        agentOptions={[]}
        toolOptions={[]}
      />,
    );
    expect(screen.getByText(/Try body.*try1/)).toBeInTheDocument();
  });
});

describe("execution panel — the three new subworkflow error codes", () => {
  function stateWithError(code, params) {
    let s = createRunState();
    s = applyRunEvent(s, { event: "node_start", node_id: "sw1", type: "subworkflow" });
    s = applyRunEvent(s, { event: "node_error", node_id: "sw1", code, detail: "raw detail", params });
    return s;
  }

  it("words subworkflow_not_found", () => {
    render(
      <ExecutionPanel open onToggle={() => {}} payloadText="{}" onPayloadTextChange={() => {}} payloadError={null} isRunning={false}
        runState={stateWithError("subworkflow_not_found", { node: "sw1", workflow: "wf9" })} onRun={() => {}} onCancel={() => {}} />,
    );
    expect(screen.getByText(/Sub-workflow wf9 referenced by sw1 was not found/i)).toBeInTheDocument();
  });

  it("words subworkflow_cycle", () => {
    render(
      <ExecutionPanel open onToggle={() => {}} payloadText="{}" onPayloadTextChange={() => {}} payloadError={null} isRunning={false}
        runState={stateWithError("subworkflow_cycle", { node: "sw1", workflow: "wf9" })} onRun={() => {}} onCancel={() => {}} />,
    );
    expect(screen.getByText(/Sub-workflow wf9 called from sw1 would call back/i)).toBeInTheDocument();
  });

  it("words subworkflow_too_deep", () => {
    render(
      <ExecutionPanel open onToggle={() => {}} payloadText="{}" onPayloadTextChange={() => {}} payloadError={null} isRunning={false}
        runState={stateWithError("subworkflow_too_deep", { node: "sw1", max: 5 })} onRun={() => {}} onCancel={() => {}} />,
    );
    expect(screen.getByText(/Sub-workflow sw1 exceeds the nesting depth limit \(5\)/i)).toBeInTheDocument();
  });
});

describe("run state and execution panel — a try node's inner events carry `attempt`", () => {
  it("groups try1.innerId events by attempt, the same way a loop groups by iteration", () => {
    let s = createRunState();
    s = applyRunEvent(s, { event: "node_start", node_id: "try1", type: "try" });
    s = applyRunEvent(s, { event: "node_start", node_id: "try1.tool1", attempt: 0 });
    s = applyRunEvent(s, { event: "node_complete", node_id: "try1.tool1", attempt: 0, output: "x", duration_ms: 5 });
    s = applyRunEvent(s, { event: "node_start", node_id: "try1.tool1", attempt: 1 });
    s = applyRunEvent(s, { event: "node_complete", node_id: "try1.tool1", attempt: 1, output: "y", duration_ms: 3 });

    const top = s.timeline.find((e) => e.id === "try1");
    expect(Object.keys(top.iterations)).toEqual(["0", "1"]);
    expect(top.iterations[0][0]).toMatchObject({ innerId: "tool1", status: "done", output: "x" });
    expect(top.iterations[1][0]).toMatchObject({ innerId: "tool1", status: "done", output: "y" });
  });

  it("labels the group 'Attempt N' (not 'Iteration N') in the execution panel for a try node", () => {
    let s = createRunState();
    s = applyRunEvent(s, { event: "node_start", node_id: "try1", type: "try" });
    s = applyRunEvent(s, { event: "node_start", node_id: "try1.tool1", attempt: 0 });
    s = applyRunEvent(s, { event: "node_complete", node_id: "try1.tool1", attempt: 0, output: "x", duration_ms: 5 });

    render(
      <ExecutionPanel open onToggle={() => {}} payloadText="{}" onPayloadTextChange={() => {}} payloadError={null} isRunning={false}
        runState={s} onRun={() => {}} onCancel={() => {}} />,
    );
    expect(screen.getByText("Attempt 0")).toBeInTheDocument();
    expect(screen.queryByText("Iteration 0")).not.toBeInTheDocument();
  });

  it("still labels a loop's group 'Iteration N' (unchanged)", () => {
    let s = createRunState();
    s = applyRunEvent(s, { event: "node_start", node_id: "loop1", type: "loop" });
    s = applyRunEvent(s, { event: "node_start", node_id: "loop1.tool1", iteration: 0 });
    s = applyRunEvent(s, { event: "node_complete", node_id: "loop1.tool1", iteration: 0, output: "x", duration_ms: 5 });

    render(
      <ExecutionPanel open onToggle={() => {}} payloadText="{}" onPayloadTextChange={() => {}} payloadError={null} isRunning={false}
        runState={s} onRun={() => {}} onCancel={() => {}} />,
    );
    expect(screen.getByText("Iteration 0")).toBeInTheDocument();
  });
});
