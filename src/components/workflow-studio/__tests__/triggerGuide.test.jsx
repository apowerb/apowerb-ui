/**
 * The trigger guide leaves nothing to guess: for each of the 8 kinds, what
 * it does, whether publishing is needed, numbered steps, and — for manual
 * and webhook — the exact call to copy, built from the real workflow id,
 * sample payload and live webhook URL. A server without the trigger routes
 * gets a useful message instead of a bare "Not Found".
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useTranslations, createTranslator } from "use-intl";
import en from "../../../../messages/en.json";
import fr from "../../../../messages/fr.json";
import TriggerUsageGuide from "@/components/workflow-studio/TriggerUsageGuide";
import TriggerStatusPanel from "@/components/workflow-studio/TriggerStatusPanel";
import { TRIGGER_KINDS } from "@/lib/workflowTriggers";
import { TRIGGER_GUIDE, triggerCall, curlSnippet, jsSnippet, pythonSnippet, isMissingRouteError } from "@/lib/triggerGuide";

const { getWorkflowTriggerState, rotateWorkflowTrigger } = vi.hoisted(() => ({
  getWorkflowTriggerState: vi.fn(),
  rotateWorkflowTrigger: vi.fn(),
}));
vi.mock("@/lib/api", () => ({ getWorkflowTriggerState, rotateWorkflowTrigger }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("guide content", () => {
  it("covers every trigger kind, with all its steps, in English and French", () => {
    expect(Object.keys(TRIGGER_GUIDE).sort()).toEqual([...TRIGGER_KINDS].sort());
    for (const messages of [en, fr]) {
      const g = messages.WorkflowTriggerGuide;
      for (const kind of TRIGGER_KINDS) {
        expect(g[`${kind}_what`], `${kind}_what`).toBeTruthy();
        for (let i = 1; i <= TRIGGER_GUIDE[kind].steps; i++) expect(g[`${kind}_step${i}`], `${kind}_step${i}`).toBeTruthy();
      }
    }
  });

  it("formats every message without an ICU error", () => {
    for (const [locale, messages] of [["en", en], ["fr", fr]]) {
      const t = createTranslator({ locale, messages, namespace: "WorkflowTriggerGuide", onError: (e) => { throw e; } });
      for (const key of Object.keys(messages.WorkflowTriggerGuide)) expect(t(key, { id: "n" }), key).not.toBe(`WorkflowTriggerGuide.${key}`);
    }
  });

  it.each(TRIGGER_KINDS)("renders %s with its publishing requirement and numbered steps", (kind) => {
    render(<TriggerUsageGuide kind={kind} config={{ kind }} workflowId="wf1" nodeId="trigger1" />);
    const g = en.WorkflowTriggerGuide;
    expect(screen.getByText(g[`${kind}_what`])).toBeInTheDocument();
    expect(screen.getByText(kind === "manual" ? g.publishNotRequired : g.publishRequired)).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(TRIGGER_GUIDE[kind].steps);
  });

  it("names the selected node in the references it shows", () => {
    render(<TriggerUsageGuide kind="manual" config={{ kind: "manual" }} workflowId="wf1" nodeId="start" />);
    expect(screen.getByText(/\{\{start\}\}/)).toBeInTheDocument();
    expect(screen.getByText(/\{\{start\.field\}\}/)).toBeInTheDocument();
  });
});

describe("manual: the exact API call", () => {
  const config = { kind: "manual", sample_payload: { subject: "Appel API", priority: "high" } };

  it("builds the run call from the real id and sample payload", () => {
    const call = triggerCall("manual", { origin: "https://app.test", workflowId: "wf1", config });
    const curl = curlSnippet(call);
    expect(curl).toContain("'https://app.test/api/workflows/defs/wf1/run'");
    expect(curl).toContain("Authorization: Bearer <ACCESS_TOKEN>");
    expect(curl).toContain(`'{"payload":{"subject":"Appel API","priority":"high"}}'`);
    expect(jsSnippet(call)).toContain('"https://app.test/api/workflows/defs/wf1/run"');
    expect(pythonSnippet(call)).toContain("stream=True");
  });

  it("keeps a single quote in the payload valid for the shell", () => {
    const call = triggerCall("manual", { origin: "https://app.test", workflowId: "wf1", config: { sample_payload: { name: "l'équipe" } } });
    expect(curlSnippet(call)).toContain(`'{"payload":{"name":"l'\\''équipe"}}'`);
  });

  it("shows curl, JavaScript and Python, each copyable", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<TriggerUsageGuide kind="manual" config={config} workflowId="wf1" nodeId="trigger1" />);
    expect(screen.getByText(/curl -N -X POST/)).toBeInTheDocument();
    expect(screen.getByText(en.WorkflowTriggerGuide.tokenHelp)).toBeInTheDocument();
    expect(screen.getByText(en.WorkflowTriggerGuide.response_sse)).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Python" }));
    expect(screen.getByText(/import requests/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Copy code" }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("/api/workflows/defs/wf1/run"));
  });

  it("asks to save first when the workflow has no id yet", () => {
    render(<TriggerUsageGuide kind="manual" config={config} workflowId={null} nodeId="trigger1" />);
    expect(screen.getByText(en.WorkflowTriggerGuide.saveFirst)).toBeInTheDocument();
    expect(screen.queryByText(/curl/)).not.toBeInTheDocument();
  });
});

describe("webhook: the exact call", () => {
  it("uses the live webhook URL and signs the body when HMAC is on", () => {
    const call = triggerCall("webhook", {
      origin: "https://app.test",
      workflowId: "wf1",
      webhookUrl: "https://api.test/api/hooks/workflows/tok1",
      config: { kind: "webhook", hmac: true, sample_payload: { a: 1 } },
    });
    const curl = curlSnippet(call);
    expect(curl).toContain("BODY='{\"a\":1}'");
    expect(curl).toContain('openssl dgst -sha256 -hmac "$APOWERB_WEBHOOK_SECRET"');
    expect(curl).toContain('X-Apowerb-Signature: sha256=$SIG');
    expect(curl).toContain("'https://api.test/api/hooks/workflows/tok1'");
    expect(jsSnippet(call)).toContain('createHmac("sha256"');
    expect(pythonSnippet(call)).toContain("hmac.new(");
  });

  it("says where the URL will come from before publishing", () => {
    render(<TriggerUsageGuide kind="webhook" config={{ kind: "webhook", hmac: false }} workflowId="wf1" nodeId="trigger1" />);
    expect(screen.getByText(/WEBHOOK_URL \(shown below once published\)/)).toBeInTheDocument();
    expect(screen.queryByText(/X-Apowerb-Signature/)).not.toBeInTheDocument();
    expect(screen.getByText(/Response: 202 with \{"run_id": …\} right away/)).toBeInTheDocument();
  });
});

describe("a server without the trigger routes", () => {
  function Harness(props) {
    const t = useTranslations("WorkflowInspector");
    return <TriggerStatusPanel t={t} {...props} />;
  }

  it("tells the route is missing instead of showing a bare Not Found", async () => {
    getWorkflowTriggerState.mockRejectedValue(Object.assign(new Error("Not Found"), { status: 404 }));
    render(<Harness workflowId="wf1" kind="webhook" refreshKey={0} />);
    await waitFor(() => expect(screen.getByText(en.WorkflowInspector.triggerRouteMissing)).toBeInTheDocument());
    expect(screen.queryByText(/Not Found/)).not.toBeInTheDocument();
  });

  it("says a manual trigger is ready rather than inactive", async () => {
    getWorkflowTriggerState.mockResolvedValue({ kind: "manual", active: false, reason: null });
    render(<Harness workflowId="wf1" kind="manual" refreshKey={0} />);
    await waitFor(() => expect(screen.getByText(en.WorkflowInspector.triggerManualReady)).toBeInTheDocument());
    expect(screen.queryByText("Inactive")).not.toBeInTheDocument();
  });

  it("keeps the real message for an unknown workflow", async () => {
    getWorkflowTriggerState.mockRejectedValue(Object.assign(new Error("Unknown workflow: wf1"), { status: 404 }));
    render(<Harness workflowId="wf1" kind="webhook" refreshKey={0} />);
    await waitFor(() => expect(screen.getByText(/Unknown workflow: wf1/)).toBeInTheDocument());
    expect(isMissingRouteError({ status: 404, message: "Unknown workflow: wf1" })).toBe(false);
  });
});
