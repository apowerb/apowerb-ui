/**
 * HTTP and Notification nodes (LOT 3, 21/09): local validation, defaults,
 * and the inspector fields that configure them. Mirrors
 * outputConvert.test.jsx (commit 8a1fc92), the model for this lot.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import StudioInspector from "@/components/workflow-studio/StudioInspector";
import ExecutionPanel from "@/components/workflow-studio/ExecutionPanel";
import { createNode, graphToFlow, validateGraphLocal, NODE_TYPES } from "@/lib/workflowGraph";
import { applyRunEvent, createRunState } from "@/lib/workflowRunState";
import { getTeamsWebhookStatus } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  getTeamsWebhookStatus: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
});

const trigger = { id: "t", type: "trigger", config: {} };

describe("http and notification in the graph model", () => {
  it("are known node types with safe defaults", () => {
    expect(NODE_TYPES).toEqual(expect.arrayContaining(["http", "notification"]));
    expect(createNode("http").config).toEqual({ method: "GET", url: "", headers: [], timeout_s: 15 });
    // No `to` key: an empty-array default would still fail email validation,
    // and the default channel (app) never reads it.
    expect(createNode("notification").config).toEqual({ channel: "app", subject: "", body: "" });
  });

  it("refuses a secret header, case-insensitively", () => {
    const withAuth = validateGraphLocal({
      nodes: [trigger, { id: "h", type: "http", config: { method: "GET", url: "https://api.example.com", headers: [{ key: "Authorization", value: "x" }], timeout_s: 15 } }],
      edges: [{ source: "t", target: "h" }],
    });
    expect(withAuth.errors.map((e) => e.message)).toContain("httpHeaderForbidden:Authorization");

    const withLowerKey = validateGraphLocal({
      nodes: [trigger, { id: "h", type: "http", config: { method: "GET", url: "https://api.example.com", headers: [{ key: "x-api-key", value: "x" }], timeout_s: 15 } }],
      edges: [{ source: "t", target: "h" }],
    });
    expect(withLowerKey.errors.map((e) => e.message)).toContain("httpHeaderForbidden:x-api-key");

    const withPlainHeader = validateGraphLocal({
      nodes: [trigger, { id: "h", type: "http", config: { method: "GET", url: "https://api.example.com", headers: [{ key: "X-Trace-Id", value: "x" }], timeout_s: 15 } }],
      edges: [{ source: "t", target: "h" }],
    });
    expect(withPlainHeader.errors.map((e) => e.message)).not.toContain(expect.stringMatching(/^httpHeaderForbidden/));
  });

  it("requires a public URL, or accepts a template", () => {
    const missing = validateGraphLocal({
      nodes: [trigger, { id: "h", type: "http", config: { method: "GET", url: "", headers: [], timeout_s: 15 } }],
      edges: [{ source: "t", target: "h" }],
    });
    expect(missing.errors.map((e) => e.message)).toContain("httpUrlRequired");

    const bad = validateGraphLocal({
      nodes: [trigger, { id: "h", type: "http", config: { method: "GET", url: "ftp://example.com", headers: [], timeout_s: 15 } }],
      edges: [{ source: "t", target: "h" }],
    });
    expect(bad.errors.map((e) => e.message)).toContain("httpUrlInvalid:ftp://example.com");

    const templated = validateGraphLocal({
      nodes: [trigger, { id: "h", type: "http", config: { method: "GET", url: "{{t.payload.url}}", headers: [], timeout_s: 15 } }],
      edges: [{ source: "t", target: "h" }],
    });
    expect(templated.errors.map((e) => e.message).some((m) => m.startsWith("httpUrl"))).toBe(false);
  });

  it("bounds the timeout to 1–30 seconds", () => {
    const tooHigh = validateGraphLocal({
      nodes: [trigger, { id: "h", type: "http", config: { method: "GET", url: "https://api.example.com", headers: [], timeout_s: 31 } }],
      edges: [{ source: "t", target: "h" }],
    });
    expect(tooHigh.errors.map((e) => e.message)).toContain("httpTimeoutRange");

    const tooLow = validateGraphLocal({
      nodes: [trigger, { id: "h", type: "http", config: { method: "GET", url: "https://api.example.com", headers: [], timeout_s: 0 } }],
      edges: [{ source: "t", target: "h" }],
    });
    expect(tooLow.errors.map((e) => e.message)).toContain("httpTimeoutRange");

    const ok = validateGraphLocal({
      nodes: [trigger, { id: "h", type: "http", config: { method: "GET", url: "https://api.example.com", headers: [], timeout_s: 15 } }],
      edges: [{ source: "t", target: "h" }],
    });
    expect(ok.errors.map((e) => e.message)).not.toContain("httpTimeoutRange");
  });

  it("validates notification recipients per channel", () => {
    const noRecipients = validateGraphLocal({
      nodes: [trigger, { id: "n", type: "notification", config: { channel: "email", to: [], subject: "hi", body: "" } }],
      edges: [{ source: "t", target: "n" }],
    });
    expect(noRecipients.errors.map((e) => e.message)).toContain("notificationRecipientsRequired");

    const tooMany = validateGraphLocal({
      nodes: [trigger, { id: "n", type: "notification", config: { channel: "email", to: Array.from({ length: 11 }, (_, i) => `a${i}@b.com`), subject: "hi", body: "" } }],
      edges: [{ source: "t", target: "n" }],
    });
    expect(tooMany.errors.map((e) => e.message)).toContain("notificationRecipientsRequired");

    const noSubject = validateGraphLocal({
      nodes: [trigger, { id: "n", type: "notification", config: { channel: "email", to: ["a@b.com"], subject: "", body: "" } }],
      edges: [{ source: "t", target: "n" }],
    });
    expect(noSubject.errors.map((e) => e.message)).toContain("notificationSubjectRequired");

    const emailOk = validateGraphLocal({
      nodes: [trigger, { id: "n", type: "notification", config: { channel: "email", to: ["a@b.com"], subject: "hi", body: "" } }],
      edges: [{ source: "t", target: "n" }],
    });
    expect(emailOk.errors.map((e) => e.message)).not.toContain("notificationRecipientsRequired");
    expect(emailOk.errors.map((e) => e.message)).not.toContain("notificationSubjectRequired");

    const appWithRecipients = validateGraphLocal({
      nodes: [trigger, { id: "n", type: "notification", config: { channel: "app", to: ["a@b.com"], subject: "", body: "" } }],
      edges: [{ source: "t", target: "n" }],
    });
    expect(appWithRecipients.errors.map((e) => e.message)).toContain("notificationRecipientsNotAllowed");

    const appOk = validateGraphLocal({
      nodes: [trigger, { id: "n", type: "notification", config: { channel: "app", subject: "", body: "" } }],
      edges: [{ source: "t", target: "n" }],
    });
    expect(appOk.errors.map((e) => e.message)).not.toContain(expect.stringMatching(/^notification/));
  });

  it("validates the teams channel: subject required, no recipients", () => {
    const teamsOk = validateGraphLocal({
      nodes: [trigger, { id: "n", type: "notification", config: { channel: "teams", subject: "hi", body: "" } }],
      edges: [{ source: "t", target: "n" }],
    });
    expect(teamsOk.errors.map((e) => e.message)).not.toContain("notificationSubjectRequired");
    expect(teamsOk.errors.map((e) => e.message)).not.toContain("notificationRecipientsNotAllowed");

    const teamsNoSubject = validateGraphLocal({
      nodes: [trigger, { id: "n", type: "notification", config: { channel: "teams", subject: "", body: "" } }],
      edges: [{ source: "t", target: "n" }],
    });
    expect(teamsNoSubject.errors.map((e) => e.message)).toContain("notificationSubjectRequired");

    const teamsWithRecipients = validateGraphLocal({
      nodes: [trigger, { id: "n", type: "notification", config: { channel: "teams", subject: "hi", body: "", to: ["a@b.com"] } }],
      edges: [{ source: "t", target: "n" }],
    });
    expect(teamsWithRecipients.errors.map((e) => e.message)).toContain("notificationRecipientsNotAllowed");
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

describe("inspector: http node", () => {
  it("hides the body field for GET", () => {
    render(
      <Inspector
        graph={{ nodes: [trigger, { id: "h", type: "http", config: { method: "GET", url: "", headers: [], timeout_s: 15 } }], edges: [{ source: "t", target: "h" }] }}
        nodeId="h"
        onConfig={() => {}}
      />,
    );
    expect(screen.queryByLabelText(/^Body/i)).not.toBeInTheDocument();
  });

  it("shows the body field for POST", async () => {
    const user = userEvent.setup();
    const patches = [];
    render(
      <Inspector
        graph={{ nodes: [trigger, { id: "h", type: "http", config: { method: "GET", url: "", headers: [], timeout_s: 15 } }], edges: [{ source: "t", target: "h" }] }}
        nodeId="h"
        onConfig={(p) => patches.push(p)}
      />,
    );
    await user.selectOptions(screen.getByLabelText(/Method/i), "POST");
    expect(patches.at(-1)).toEqual({ method: "POST" });
    expect(screen.getByLabelText(/^Body/i)).toBeInTheDocument();
  });

  it("flags an Authorization header as soon as it's typed", async () => {
    const user = userEvent.setup();
    render(
      <Inspector
        graph={{ nodes: [trigger, { id: "h", type: "http", config: { method: "GET", url: "", headers: [{ key: "", value: "" }], timeout_s: 15 } }], edges: [{ source: "t", target: "h" }] }}
        nodeId="h"
        onConfig={() => {}}
      />,
    );
    await user.type(screen.getByPlaceholderText(/^Header/i), "Authorization");
    expect(screen.getByText(/carries a secret/i)).toBeInTheDocument();
  });
});

describe("inspector: notification node", () => {
  it("hides recipients for the app channel", () => {
    render(
      <Inspector
        graph={{ nodes: [trigger, { id: "n", type: "notification", config: { channel: "app", subject: "", body: "" } }], edges: [{ source: "t", target: "n" }] }}
        nodeId="n"
        onConfig={() => {}}
      />,
    );
    expect(screen.queryByText(/^Recipients/i)).not.toBeInTheDocument();
    expect(screen.getByText(/No recipients to configure/i)).toBeInTheDocument();
  });

  it("shows recipients and subject for the email channel", () => {
    render(
      <Inspector
        graph={{ nodes: [trigger, { id: "n", type: "notification", config: { channel: "email", to: [], subject: "", body: "" } }], edges: [{ source: "t", target: "n" }] }}
        nodeId="n"
        onConfig={() => {}}
      />,
    );
    expect(screen.getByText(/^Recipients/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Subject/i)).toBeInTheDocument();
  });

  it("configures the teams channel with a subject but no recipients", () => {
    render(
      <Inspector
        graph={{ nodes: [trigger, { id: "n", type: "notification", config: { channel: "teams", subject: "", body: "" } }], edges: [{ source: "t", target: "n" }] }}
        nodeId="n"
        onConfig={() => {}}
      />,
    );
    expect(screen.queryByText(/^Recipients/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^Subject/i)).toBeInTheDocument();
    expect(screen.getByText(/webhook/i)).toBeInTheDocument();
  });

  it("shows a hint linking to Integrations when no Teams webhook is configured", async () => {
    getTeamsWebhookStatus.mockResolvedValue({ configured: false });
    render(
      <Inspector
        graph={{ nodes: [trigger, { id: "n", type: "notification", config: { channel: "teams", subject: "hi", body: "" } }], edges: [{ source: "t", target: "n" }] }}
        nodeId="n"
        onConfig={() => {}}
      />,
    );
    expect(await screen.findByText(/no teams webhook configured/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /set it up in integrations/i })).toHaveAttribute(
      "href",
      "/integrations",
    );
  });

  it("hides the hint once a Teams webhook is configured", async () => {
    getTeamsWebhookStatus.mockResolvedValue({ configured: true });
    render(
      <Inspector
        graph={{ nodes: [trigger, { id: "n", type: "notification", config: { channel: "teams", subject: "hi", body: "" } }], edges: [{ source: "t", target: "n" }] }}
        nodeId="n"
        onConfig={() => {}}
      />,
    );
    await waitFor(() => expect(getTeamsWebhookStatus).toHaveBeenCalled());
    expect(screen.queryByText(/no teams webhook configured/i)).not.toBeInTheDocument();
  });
});

describe("execution panel: server error codes", () => {
  const cases = [
    ["http_url_refused", { node: "h", reason: "internal_address" }, /URL was refused/i],
    ["http_response_too_large", { node: "h", max: 1000000 }, /exceeded the 1000000-byte limit/i],
    ["http_timeout", { node: "h", seconds: 15 }, /timed out after 15s/i],
    ["http_failed", { node: "h" }, /failed to complete the request/i],
    ["notification_rate_limited", { node: "n", limit: 5 }, /rate limited/i],
    ["notification_bad_recipient", { node: "n", recipient: "a@b" }, /could not be sent to a@b/i],
    ["teams_not_configured", { node: "n" }, /no webhook configured/i],
    ["teams_failed", { node: "n", status: null }, /could not be delivered\./i],
    ["teams_failed", { node: "n", status: 500 }, /could not be delivered \(status 500\)/i],
  ];

  it.each(cases)("words %s", (code, params, pattern) => {
    let s = createRunState();
    s = applyRunEvent(s, { event: "node_start", node_id: params.node, type: "notification" });
    s = applyRunEvent(s, { event: "node_error", node_id: params.node, code, detail: `${params.node} : erreur`, params });
    render(
      <ExecutionPanel open onToggle={() => {}} payloadText="{}" onPayloadTextChange={() => {}} payloadError={null} isRunning={false} runState={s} onRun={() => {}} onCancel={() => {}} />,
    );
    expect(screen.getByText(pattern)).toBeInTheDocument();
  });
});
