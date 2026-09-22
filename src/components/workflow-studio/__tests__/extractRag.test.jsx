/**
 * Extract and RAG nodes (LOT 4, 21/09): local validation, defaults, the
 * inspector fields that configure them, and the run-error translations the
 * server can send for them. Modeled after outputConvert.test.jsx.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import StudioInspector from "@/components/workflow-studio/StudioInspector";
import ExecutionPanel from "@/components/workflow-studio/ExecutionPanel";
import {
  createNode,
  graphToFlow,
  validateGraphLocal,
  NODE_TYPES,
  EXTRACT_FIELD_TYPES,
  EXTRACT_FIELDS_MIN,
  EXTRACT_FIELDS_MAX,
  RAG_TOP_K_MIN,
  RAG_TOP_K_MAX,
} from "@/lib/workflowGraph";
import { applyRunEvent, createRunState } from "@/lib/workflowRunState";

const trigger = { id: "t", type: "trigger", config: {} };
const oneField = [{ name: "title", type: "string", description: "", required: true }];

describe("extract and rag in the graph model", () => {
  it("are known node types with safe defaults", () => {
    expect(NODE_TYPES).toEqual(expect.arrayContaining(["extract", "rag"]));
    expect(createNode("extract").config).toEqual({ agent_id: "", input: "", fields: [] });
    expect(createNode("rag").config).toEqual({ agent_id: "", query: "", top_k: 5 });
    expect(EXTRACT_FIELD_TYPES).toEqual(["string", "number", "boolean", "list", "object"]);
    expect(EXTRACT_FIELDS_MIN).toBe(1);
    expect(EXTRACT_FIELDS_MAX).toBe(30);
    expect(RAG_TOP_K_MIN).toBe(1);
    expect(RAG_TOP_K_MAX).toBe(20);
  });

  it("refuses an extract node with no agent, no field, or a bad field name", () => {
    const { errors } = validateGraphLocal({
      nodes: [trigger, { id: "e", type: "extract", config: { agent_id: "", input: "", fields: [] } }],
      edges: [{ source: "t", target: "e" }],
    });
    const messages = errors.map((e) => e.message);
    expect(messages).toContain("extractAgentRequired");
    expect(messages).toContain("extractFieldsCount:0");
  });

  it("refuses an invalid or duplicate field name", () => {
    const { errors } = validateGraphLocal({
      nodes: [trigger, {
        id: "e",
        type: "extract",
        config: {
          agent_id: "agent1",
          input: "",
          fields: [
            { name: "1bad", type: "string", description: "", required: false },
            { name: "ok", type: "string", description: "", required: false },
            { name: "ok", type: "number", description: "", required: false },
          ],
        },
      }],
      edges: [{ source: "t", target: "e" }],
    });
    const messages = errors.map((e) => e.message);
    expect(messages).toContain("extractFieldNameInvalid:1bad");
    expect(messages).toContain("extractFieldNameDuplicate:ok");
  });

  it("accepts a well-formed extract node", () => {
    const { errors } = validateGraphLocal({
      nodes: [trigger, { id: "e", type: "extract", config: { agent_id: "agent1", input: "", fields: oneField } }],
      edges: [{ source: "t", target: "e" }],
    });
    expect(errors.map((e) => e.message).some((m) => m.startsWith("extract"))).toBe(false);
  });

  it("refuses a rag node with no agent, an empty query, or an out-of-range top_k", () => {
    const { errors } = validateGraphLocal({
      nodes: [trigger, { id: "r", type: "rag", config: { agent_id: "", query: "", top_k: 21 } }],
      edges: [{ source: "t", target: "r" }],
    });
    const messages = errors.map((e) => e.message);
    expect(messages).toContain("ragAgentRequired");
    expect(messages).toContain("ragQueryRequired");
    expect(messages).toContain("ragTopKRange:21");
  });

  it("accepts a well-formed rag node", () => {
    const { errors } = validateGraphLocal({
      nodes: [trigger, { id: "r", type: "rag", config: { agent_id: "agent1", query: "{{t.payload}}", top_k: 5 } }],
      edges: [{ source: "t", target: "r" }],
    });
    expect(errors.map((e) => e.message).some((m) => m.startsWith("rag"))).toBe(false);
  });
});

function Inspector({ graph, nodeId, onConfig }) {
  const [flow, setFlow] = useState(() => graphToFlow(graph));
  const node = flow.nodes.find((n) => n.id === nodeId);
  return (
    <StudioInspector
      selection={{ kind: "node", node }}
      nodes={flow.nodes}
      edges={flow.edges}
      agentOptions={[{ value: "agent1", label: "Agent One" }]}
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

describe("palette", () => {
  it("lists extract and rag", async () => {
    const { default: StudioPalette } = await import("@/components/workflow-studio/StudioPalette");
    render(<StudioPalette onAdd={() => {}} />);
    expect(screen.getByText("Extract")).toBeInTheDocument();
    expect(screen.getByText("RAG")).toBeInTheDocument();
  });
});

describe("inspector: extract", () => {
  it("round-trips agent, input and the agent selector", async () => {
    const user = userEvent.setup();
    const patches = [];
    render(
      <Inspector
        graph={{ nodes: [trigger, { id: "e", type: "extract", config: { agent_id: "", input: "", fields: [] } }], edges: [{ source: "t", target: "e" }] }}
        nodeId="e"
        onConfig={(p) => patches.push(p)}
      />,
    );
    await user.selectOptions(screen.getByLabelText(/Agent/i), "agent1");
    expect(patches.at(-1)).toEqual({ agent_id: "agent1" });
  });

  it("adds a field through the editor", async () => {
    const user = userEvent.setup();
    const patches = [];
    render(
      <Inspector
        graph={{ nodes: [trigger, { id: "e", type: "extract", config: { agent_id: "agent1", input: "", fields: [] } }], edges: [{ source: "t", target: "e" }] }}
        nodeId="e"
        onConfig={(p) => patches.push(p)}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Add a field/i }));
    expect(patches.at(-1).fields).toHaveLength(1);
  });

  it("shows the field-access help", () => {
    render(
      <Inspector
        graph={{ nodes: [trigger, { id: "e", type: "extract", config: { agent_id: "agent1", input: "", fields: oneField } }], edges: [{ source: "t", target: "e" }] }}
        nodeId="e"
        onConfig={() => {}}
      />,
    );
    expect(screen.getByText(/\{\{e\.field_name\}\}/)).toBeInTheDocument();
  });
});

describe("inspector: rag", () => {
  it("round-trips agent, query and top_k", async () => {
    const user = userEvent.setup();
    const patches = [];
    render(
      <Inspector
        graph={{ nodes: [trigger, { id: "r", type: "rag", config: { agent_id: "", query: "", top_k: 5 } }], edges: [{ source: "t", target: "r" }] }}
        nodeId="r"
        onConfig={(p) => patches.push(p)}
      />,
    );
    await user.selectOptions(screen.getByLabelText(/Agent/i), "agent1");
    expect(patches.at(-1)).toEqual({ agent_id: "agent1" });

    await user.type(screen.getByLabelText(/Query/i), "hello");
    expect(patches.at(-1)).toEqual({ query: "hello" });

    const topK = screen.getByLabelText(/top_k/i);
    await user.clear(topK);
    await user.type(topK, "12");
    expect(patches.at(-1)).toEqual({ top_k: 12 });
  });

  it("shows the passages-access help", () => {
    render(
      <Inspector
        graph={{ nodes: [trigger, { id: "r", type: "rag", config: { agent_id: "agent1", query: "q", top_k: 5 } }], edges: [{ source: "t", target: "r" }] }}
        nodeId="r"
        onConfig={() => {}}
      />,
    );
    expect(screen.getByText(/\{\{r\.passages\}\}/)).toBeInTheDocument();
  });
});

describe("run error translations", () => {
  it("words a failed extraction with a field", () => {
    let s = createRunState();
    s = applyRunEvent(s, { event: "node_start", node_id: "e", type: "extract" });
    s = applyRunEvent(s, { event: "node_error", node_id: "e", code: "extract_failed", detail: "e : extraction", params: { node: "e", field: "title", problem: "not found" } });
    render(
      <ExecutionPanel open onToggle={() => {}} payloadText="{}" onPayloadTextChange={() => {}} payloadError={null} isRunning={false} runState={s} onRun={() => {}} onCancel={() => {}} />,
    );
    expect(screen.getByText(/title/)).toBeInTheDocument();
    expect(screen.getByText(/not found/)).toBeInTheDocument();
  });

  it("words a failed extraction with no field (field: null)", () => {
    let s = createRunState();
    s = applyRunEvent(s, { event: "node_start", node_id: "e", type: "extract" });
    s = applyRunEvent(s, { event: "node_error", node_id: "e", code: "extract_failed", detail: "e : extraction", params: { node: "e", field: null, problem: "agent returned no JSON" } });
    render(
      <ExecutionPanel open onToggle={() => {}} payloadText="{}" onPayloadTextChange={() => {}} payloadError={null} isRunning={false} runState={s} onRun={() => {}} onCancel={() => {}} />,
    );
    expect(screen.getByText(/agent returned no JSON/)).toBeInTheDocument();
    expect(screen.queryByText(/field null/i)).not.toBeInTheDocument();
  });

  it("words a rag node with no knowledge base and points to the fix", () => {
    let s = createRunState();
    s = applyRunEvent(s, { event: "node_start", node_id: "r", type: "rag" });
    s = applyRunEvent(s, { event: "node_error", node_id: "r", code: "rag_no_knowledge", detail: "r : rag", params: { node: "r", agent: "agent1" } });
    render(
      <ExecutionPanel open onToggle={() => {}} payloadText="{}" onPayloadTextChange={() => {}} payloadError={null} isRunning={false} runState={s} onRun={() => {}} onCancel={() => {}} />,
    );
    expect(screen.getByText(/knowledge base/i)).toBeInTheDocument();
  });

  it("words a generic rag failure", () => {
    let s = createRunState();
    s = applyRunEvent(s, { event: "node_start", node_id: "r", type: "rag" });
    s = applyRunEvent(s, { event: "node_error", node_id: "r", code: "rag_failed", detail: "r : rag", params: { node: "r" } });
    render(
      <ExecutionPanel open onToggle={() => {}} payloadText="{}" onPayloadTextChange={() => {}} payloadError={null} isRunning={false} runState={s} onRun={() => {}} onCancel={() => {}} />,
    );
    expect(screen.getByText(/RAG r/)).toBeInTheDocument();
  });
});
