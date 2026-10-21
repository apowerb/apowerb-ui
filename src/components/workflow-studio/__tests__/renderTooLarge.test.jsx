/**
 * A node whose template grows past the engine limit once rendered fails with
 * `render_too_large` (engine, 21/10): the panel words it with the node.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ExecutionPanel from "@/components/workflow-studio/ExecutionPanel";
import { applyRunEvent, createRunState } from "@/lib/workflowRunState";

// The panel never calls the API here; the real module pulls the SDK package.
vi.mock("@/lib/api", () => ({}));

describe("execution panel: render_too_large", () => {
  it("names the node and the limit", () => {
    let s = createRunState();
    s = applyRunEvent(s, { event: "node_start", node_id: "s", type: "set" });
    s = applyRunEvent(s, {
      event: "node_error",
      node_id: "s",
      code: "render_too_large",
      detail: "s : gabarit trop grand une fois rendu",
      params: { node: "s", max: "2097152" },
    });
    render(
      <ExecutionPanel open onToggle={() => {}} payloadText="{}" onPayloadTextChange={() => {}} payloadError={null} isRunning={false} runState={s} onRun={() => {}} onCancel={() => {}} />,
    );
    expect(screen.getByText(/Node s: its template becomes too large once rendered \(over 2097152 characters\)/)).toBeInTheDocument();
  });
});
