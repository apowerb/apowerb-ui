/**
 * Two agents in a row: what the studio shows and pre-fills so nothing about
 * the hand-off has to be guessed.
 *
 * Real case (21/10/26): a business analyst agent wired to a forecasting
 * agent; the second one answered it "could not get the previous agent's
 * values". The hand-off worked, but the first agent ended on a question nobody
 * would answer,
 * and the second agent was added from the palette, unwired.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ExecutionPanel from "@/components/workflow-studio/ExecutionPanel";
import { applyRunEvent, createRunState } from "@/lib/workflowRunState";
import { prefillFor, suggestNextNodes } from "@/lib/nextNodeSuggestions";
import { validateGraphLocal } from "@/lib/workflowGraph";

function reduce(events) {
  return events.reduce(applyRunEvent, createRunState());
}

const RUN = [
  { event: "run_started", workflow_id: "w1" },
  { event: "node_start", node_id: "agent2", type: "agent" },
  { event: "node_complete", node_id: "agent2", output: "Which horizon do you want?", duration_ms: 5, asks_question: true },
  { event: "done", output: "Which horizon do you want?" },
];

function panel(runState) {
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
    />,
  );
}

describe("run state and test panel — an agent asking a question", () => {
  it("flags an agent that ended on a question", () => {
    expect(reduce(RUN).timeline[0].asksQuestion).toBe(true);
    const plain = reduce([{ event: "node_complete", node_id: "a", output: "ok", duration_ms: 1 }]);
    expect(plain.timeline[0].asksQuestion).toBe(false);
  });

  it("flags it inside a loop body too", () => {
    const s = reduce([{ event: "node_complete", node_id: "loop1.agentB", iteration: 0, output: "Which one?", asks_question: true }]);
    expect(s.timeline[0].iterations[0][0].asksQuestion).toBe(true);
  });

  it("warns in the panel when an agent ended on a question", () => {
    panel(reduce(RUN));
    expect(screen.getByText(/ended on a question/i)).toBeInTheDocument();
  });
});

const trigger = { id: "trigger1", type: "trigger", config: { kind: "manual" } };
const agent1 = { id: "agent1", type: "agent", config: { agent_id: "a1" } };
const output = { id: "output1", type: "output", config: {} };
const wired = [{ source: "trigger1", target: "agent1" }];

describe("suggestions — a second agent", () => {
  it("offers an Agent after an Agent", () => {
    const types = suggestNextNodes(agent1, [trigger, agent1, output], wired).map((s) => s.type);
    expect(types).toContain("agent");
  });

  it("pre-fills the original request and the previous result", () => {
    const [suggestion] = suggestNextNodes(agent1, [trigger, agent1, output], wired).filter((s) => s.type === "agent");
    expect(suggestion.config.input).toContain("{{trigger1}}");
    expect(suggestion.config.input).toContain("{{agent1}}");
    expect(suggestion.config.input.indexOf("{{trigger1}}")).toBeLessThan(suggestion.config.input.indexOf("{{agent1}}"));
  });

  it("only refers to a trigger that is really upstream", () => {
    expect(prefillFor("agent", agent1, { nodes: [trigger, agent1], edges: [] })).toEqual({ input: "{{agent1}}" });
  });

  it("keeps the plain reference after a trigger", () => {
    expect(prefillFor("agent", trigger, { nodes: [trigger], edges: [] })).toEqual({ input: "{{trigger1}}" });
  });
});

describe("validation — an unwired or empty agent", () => {
  const graph = (nodes, edges) => validateGraphLocal({ nodes, edges }, {});
  const messages = (r) => r.errors.map((e) => `${e.nodeId}:${e.message}:${e.level || "error"}`);

  it("warns about a node nothing leads to", () => {
    const agent2 = { id: "agent2", type: "agent", config: { agent_id: "a2" } };
    const r = graph([trigger, agent1, agent2], wired);
    expect(messages(r)).toContain("agent2:nodeNotConnected:warning");
    expect(messages(r).filter((m) => m.startsWith("trigger1:nodeNotConnected"))).toEqual([]);
    expect(messages(r).filter((m) => m.startsWith("agent1:nodeNotConnected"))).toEqual([]);
  });

  it("does not add it to a node that never runs", () => {
    const approval = { id: "approval1", type: "approval", config: {} };
    const r = graph([trigger, agent1, approval], wired);
    expect(messages(r)).toContain("approval1:notRunnable:approval:warning");
    expect(messages(r).filter((m) => m.startsWith("approval1:nodeNotConnected"))).toEqual([]);
  });

  it("blocks an agent node with no agent chosen", () => {
    const empty = { id: "agent2", type: "agent", config: { agent_id: "" } };
    const r = graph([trigger, empty], [{ source: "trigger1", target: "agent2" }]);
    expect(messages(r)).toContain("agent2:agentRequired:error");
    expect(r.valid).toBe(false);
  });
});
