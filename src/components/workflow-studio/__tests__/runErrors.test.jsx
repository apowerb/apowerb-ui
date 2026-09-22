/**
 * What the studio says when a run fails, and how it names past versions.
 *
 * The server sends a stable `code` (plus a `ref` for the logs); the studio
 * translates the code and never shows the server's fallback sentence when it
 * knows better. Its own written errors (`workflow_error`, `invalid_graph`)
 * are shown as sent.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import ExecutionPanel from "@/components/workflow-studio/ExecutionPanel";
import VersionsDrawer from "@/components/workflow-studio/VersionsDrawer";
import { applyRunEvent, createRunState } from "@/lib/workflowRunState";

vi.mock("@/lib/api", () => ({
  listWorkflowRevisions: vi.fn(async () => [
    { revision_id: 4, version: 4, reason: "restore", saved_at: "2026-09-21T12:00:00Z", name: "w" },
    { revision_id: 3, version: 3, reason: "unpublish", saved_at: "2026-09-21T11:00:00Z", name: "w" },
    { revision_id: 2, version: 2, reason: "publish", saved_at: "2026-09-21T10:00:00Z", name: "w" },
    { revision_id: 1, version: 1, reason: "update", saved_at: "2026-09-21T09:00:00Z", name: "w" },
  ]),
  restoreWorkflowRevision: vi.fn(),
}));

function failedRun(fields) {
  let s = createRunState();
  s = applyRunEvent(s, { event: "node_start", node_id: "agentB", type: "agent" });
  s = applyRunEvent(s, { event: "node_error", node_id: "agentB", ...fields });
  return applyRunEvent(s, { event: "error", ...fields });
}

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

describe("run errors", () => {
  it("keeps the code and ref of an error in the run state", () => {
    const s = failedRun({ code: "internal", detail: "Internal error during the run (ref. ab12cd34).", ref: "ab12cd34" });
    expect(s.timeline[0].error).toEqual({ code: "internal", detail: "Internal error during the run (ref. ab12cd34).", ref: "ab12cd34" });
    expect(s.finalError).toEqual(s.timeline[0].error);
  });

  it("names a provider refusal with an action, on the node and for the run", () => {
    panel(failedRun({ code: "model_provider_auth", detail: "server text", ref: "ab12cd34" }));
    const shown = screen.getAllByText(/model provider rejected the credentials/i);
    expect(shown).toHaveLength(2);
    expect(shown[0]).toHaveTextContent("ab12cd34");
    expect(screen.queryByText(/server text/)).not.toBeInTheDocument();
  });

  it("translates an internal error and keeps its reference", () => {
    panel(failedRun({ code: "internal", detail: "server text", ref: "ab12cd34" }));
    expect(screen.getAllByText(/internal error.*ab12cd34/i)).toHaveLength(2);
  });

  it("names a refused HTTP header instead of showing the server's French text", () => {
    panel(failedRun({ code: "http_header_forbidden", detail: "h : en-tête 'authorization' interdit", params: { node: "h", header: "authorization" } }));
    const shown = screen.getAllByText(/header .authorization. can.t be sent/i);
    expect(shown).toHaveLength(2);
    expect(screen.queryByText(/interdit/)).not.toBeInTheDocument();
  });

  it("shows the studio's own errors as written", () => {
    panel(failedRun({ code: "workflow_error", detail: "unknown agent: agent9" }));
    expect(screen.getAllByText(/unknown agent: agent9/)).toHaveLength(2);
  });

  it("still shows an error sent without a code", () => {
    panel(failedRun({ detail: "legacy message" }));
    expect(screen.getAllByText(/legacy message/)).toHaveLength(2);
  });
});

describe("version history", () => {
  it("names each version after the change that replaced it", async () => {
    render(<VersionsDrawer workflowId="wf1" currentVersion={5} onClose={() => {}} onRestored={() => {}} />);
    await waitFor(() => expect(screen.getByText(/before restoring/i)).toBeInTheDocument());
    expect(screen.getByText(/before unpublishing/i)).toBeInTheDocument();
    expect(screen.getByText(/before publishing/i)).toBeInTheDocument();
    // Rows archived by the first release say "update": they were edits.
    expect(screen.getByText(/^edited/i)).toBeInTheDocument();
    expect(screen.queryByText(/manual save/i)).not.toBeInTheDocument();
  });
});
