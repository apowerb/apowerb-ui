/**
 * What each node received and which tools its agent called, in the Test panel.
 *
 * Without it, a user could not see that the second of two agents got only the
 * first one's reply, without the original request (repro of 21/10/2026).
 */
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ExecutionPanel from "@/components/workflow-studio/ExecutionPanel";
import { applyRunEvent, createRunState } from "@/lib/workflowRunState";

function run(events) {
  return events.reduce(applyRunEvent, createRunState());
}

function panel(runState) {
  return render(
    <ExecutionPanel
      open
      onToggle={() => {}}
      payloadText="{}"
      onPayloadTextChange={() => {}}
      payloadError={null}
      isRunning
      runState={runState}
      onRun={() => {}}
      onCancel={() => {}}
    />,
  );
}

describe("node trace in the Test panel", () => {
  it("shows what a running agent received", () => {
    panel(
      run([
        { event: "run_started" },
        { event: "node_start", node_id: "agent2", type: "agent" },
        { event: "node_input", node_id: "agent2", input: '"Voici les chiffres"' },
      ]),
    );
    fireEvent.click(screen.getByRole("button", { name: /show input/i }));
    expect(screen.getByText('"Voici les chiffres"')).toBeInTheDocument();
  });

  it("says when the input shown was cut", () => {
    panel(
      run([
        { event: "node_input", node_id: "a", input: "xxx", input_truncated: true, input_length: 30000 },
      ]),
    );
    fireEvent.click(screen.getByRole("button", { name: /show input/i }));
    expect(screen.getByText(/30,?000/)).toBeInTheDocument();
  });

  it("lists the tools an agent called, with their arguments and results", () => {
    panel(
      run([
        {
          event: "node_complete",
          node_id: "agent1",
          output: "ok",
          duration_ms: 3,
          tool_calls: [
            { name: "tool_list_datasets", args: { q: "ventes" }, result: '{"datasets": []}' },
            { name: "tool_create_chart", args: { sql: "select 1" } },
          ],
        },
      ]),
    );
    fireEvent.click(screen.getByRole("button", { name: /2 tool calls/i }));
    expect(screen.getByText("tool_list_datasets")).toBeInTheDocument();
    expect(screen.getByText("tool_create_chart")).toBeInTheDocument();
    expect(screen.getByText(/"q": "ventes"/)).toBeInTheDocument();
    expect(screen.getByText('{"datasets": []}')).toBeInTheDocument();
    // A call with no result (the agent stopped, or the tool failed) says so.
    expect(screen.getByText(/no result/i)).toBeInTheDocument();
  });

  it("shows nothing extra for a node without trace", () => {
    panel(run([{ event: "node_complete", node_id: "t", output: 1, duration_ms: 1 }]));
    expect(screen.queryByRole("button", { name: /show input/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /tool call/i })).not.toBeInTheDocument();
  });
});
