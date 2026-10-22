/**
 * What each node promises to return, and what the test panel shows of it.
 *
 * Feedback of 21/10/26: no way to say an agent must return JSON, no way to
 * see the chart an agent "talked about", and an approval node that blocked
 * the run without saying how a person is meant to step in.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import ExecutionPanel from "@/components/workflow-studio/ExecutionPanel";
import StudioInspector from "@/components/workflow-studio/StudioInspector";
import { applyRunEvent, createRunState } from "@/lib/workflowRunState";
import { graphToFlow, validateGraphLocal } from "@/lib/workflowGraph";

vi.mock("@/components/bi/ChartRenderer", () => ({
  default: ({ chartId }) => <div data-testid="chart">{chartId}</div>,
}));
vi.mock("@/lib/api", () => ({ getToolSchema: vi.fn().mockResolvedValue({ params: [], accepts_kwargs: true }) }));

function reduce(events) {
  return events.reduce(applyRunEvent, createRunState());
}

function panel(runState, extra = {}) {
  return render(
    <ExecutionPanel
      open
      onToggle={() => {}}
      payloadText="{}"
      onPayloadTextChange={() => {}}
      payloadError={null}
      isRunning={false}
      runState={runState}
      onRun={() => {}}
      onCancel={() => {}}
      {...extra}
    />,
  );
}

const CHART_RUN = [
  { event: "run_started" },
  { event: "node_start", node_id: "agent1", type: "agent" },
  {
    event: "node_complete",
    node_id: "agent1",
    output: "Voici le graphique des ventes.",
    duration_ms: 3,
    artifacts: [
      { tool: "tool_create_chart", chart_id: "c42" },
      { tool: "tool_create_dashboard", dashboard_id: "d7" },
    ],
  },
  { event: "done", output: "Voici le graphique des ventes.", artifacts: [{ node_id: "agent1", tool: "tool_create_chart", chart_id: "c42" }] },
];

describe("run state — artifacts, reported errors, unfinished nodes", () => {
  it("keeps the artifacts a node created", () => {
    const s = reduce(CHART_RUN);
    expect(s.timeline[0].artifacts).toHaveLength(2);
  });

  it("keeps the error a tool reported in continue mode", () => {
    const s = reduce([{ event: "node_complete", node_id: "o", output: { success: false }, reported_error: "table introuvable" }]);
    expect(s.timeline[0].reportedError).toBe("table introuvable");
  });

  it("does not leave a node spinning after the run failed or was cancelled", () => {
    const failed = reduce([{ event: "node_start", node_id: "a" }, { event: "error", code: "internal" }]);
    expect(failed.timeline[0].status).toBe("error");
    const cancelled = reduce([{ event: "node_start", node_id: "a" }, { event: "cancelled" }]);
    expect(cancelled.timeline[0].status).toBe("cancelled");
  });
});

describe("test panel — what a node returned", () => {
  it("draws the chart an agent created, and links its dashboard", () => {
    panel(reduce(CHART_RUN));
    expect(screen.getAllByTestId("chart").map((c) => c.textContent)).toContain("c42");
    expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute("href", "/bi/d7");
  });

  it("says whether an output is text or JSON", () => {
    panel(reduce([
      { event: "node_complete", node_id: "a", output: "prose" },
      { event: "node_complete", node_id: "b", output: { total: 3 } },
    ]));
    expect(screen.getAllByTestId("output-type").map((b) => b.textContent)).toEqual(["Text", "JSON"]);
  });

  it("shows the node's label, not only its id", () => {
    panel(reduce(CHART_RUN), { nodeLabels: { agent1: "Analyste" } });
    expect(screen.getByText("Analyste")).toBeInTheDocument();
  });

  it("warns when a tool reported an error but the flow went on", () => {
    panel(reduce([{ event: "node_complete", node_id: "o", output: {}, reported_error: "table introuvable" }]));
    expect(screen.getByText(/table introuvable/)).toBeInTheDocument();
  });

  it("explains a wrong output type", () => {
    panel(reduce([
      { event: "node_error", node_id: "a", code: "output_type_mismatch", params: { node: "a", expected: "json", actual: "text" } },
      { event: "error", code: "output_type_mismatch", params: { node: "a", expected: "json", actual: "text" } },
    ]));
    expect(screen.getAllByText(/expected JSON/i).length).toBeGreaterThan(0);
  });

  it("names a value that is neither text nor JSON", () => {
    panel(reduce([{ event: "error", code: "output_type_mismatch", params: { node: "o", expected: "text", actual: "int" } }]));
    expect(screen.getByText(/returned a int value/i)).toBeInTheDocument();
  });

  it("explains why a human decision is refused, and what to do (was: not runnable, 21/10/26)", () => {
    panel(reduce([{ event: "error", code: "invalid_graph", cause: "approval_text_route_missing", params: { node: "h" }, detail: "x" }]));
    expect(screen.getByText(/nothing is connected to its “text” route/i)).toBeInTheDocument();
  });

  it.each([
    ["approval_question_missing", /has no question/],
    ["approval_mode_unknown", /unknown answer mode/],
    ["approval_choices_missing", /offers no choice/],
    ["approval_choice_reserved", /reserved for written answers/],
    ["approval_choice_duplicate", /share the same route/],
    ["approval_nested", /where nobody can answer/],
  ])("words the engine's %s refusal", (cause, pattern) => {
    panel(reduce([{ event: "error", code: "invalid_graph", cause, params: { node: "h" }, detail: "x" }]));
    expect(screen.getByText(pattern)).toBeInTheDocument();
  });
});

describe("a decision that could not be parked", () => {
  it.each([
    ["decision_not_saved", /could not be saved/i],
    ["decision_unavailable", /cannot wait for a decision/i],
  ])("words %s", (code, pattern) => {
    panel(reduce([{ event: "error", code }]));
    expect(screen.getAllByText(pattern).length).toBeGreaterThan(0);
  });
});

describe("validation — approval", () => {
  it("is no longer refused as not runnable; an unconfigured one is still blocked by its own checks", () => {
    const r = validateGraphLocal({
      nodes: [{ id: "t", type: "trigger", config: {} }, { id: "h", type: "approval", config: {} }],
      edges: [{ source: "t", target: "h" }],
    });
    expect(r.errors.find((x) => x.message === "notRunnable:approval")).toBeUndefined();
    const e = r.errors.find((x) => x.message === "approvalQuestionRequired");
    expect(e).toBeTruthy();
    expect(e.level).toBeUndefined();
  });
});

function Inspector({ type, onConfig }) {
  const graph = {
    nodes: [{ id: "t", type: "trigger", config: {} }, { id: "n", type, config: type === "agent" ? { agent_id: "1" } : { tool: "x", args: {} } }],
    edges: [{ source: "t", target: "n" }],
  };
  const [flow, setFlow] = useState(() => graphToFlow(graph));
  const node = flow.nodes.find((n) => n.id === "n");
  return (
    <StudioInspector
      selection={{ kind: "node", node }}
      nodes={flow.nodes}
      edges={flow.edges}
      agentOptions={[{ value: "1", label: "Analyste" }]}
      toolOptions={[{ value: "x", label: "X", source: "config" }]}
      toolSchemas={{}}
      ensureToolSchema={() => {}}
      onChangeLabel={() => {}}
      onRenameNode={() => {}}
      onPatchConfig={(id, partial) => {
        setFlow((f) => ({ ...f, nodes: f.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, config: { ...n.data.config, ...partial } } } : n)) }));
        onConfig(partial);
      }}
      onChangeEdgeRoute={() => {}}
      onDeleteNode={() => {}}
      onDeleteEdge={() => {}}
      onOpenLoopBody={() => {}}
    />
  );
}

describe("inspector — the output a node must return", () => {
  it("lets an agent node require JSON", async () => {
    const onConfig = vi.fn();
    render(<Inspector type="agent" onConfig={onConfig} />);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: /expected output/i }), "json");
    expect(onConfig).toHaveBeenCalledWith({ output_type: "json" });
  });

  it("lets an agent node stop the run when it asks a question", async () => {
    const onConfig = vi.fn();
    render(<Inspector type="agent" onConfig={onConfig} />);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: /asks a question/i }), "fail");
    expect(onConfig).toHaveBeenCalledWith({ on_question: "fail" });
  });

  it("lets a tool node require JSON too", async () => {
    const onConfig = vi.fn();
    render(<Inspector type="tool" onConfig={onConfig} />);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: /expected output/i }), "json");
    expect(onConfig).toHaveBeenCalledWith({ output_type: "json" });
  });
});
