/**
 * Workflow triggers (studio UI, 21/09): the kind selector and its 8 forms,
 * a clean reset on kind change, local validation wired into the graph, the
 * cron presets, the live status panel (reasons, webhook copy/rotate with a
 * once-only secret), the run source badge, and the Test panel's payload
 * prefill for agent_tool/form. `GET/POST /api/workflows/{wid}/triggers[/rotate]`
 * is mocked — this exercises the UI's contract with it, not the server.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { useTranslations } from "use-intl";
import StudioInspector from "@/components/workflow-studio/StudioInspector";
import TriggerStatusPanel from "@/components/workflow-studio/TriggerStatusPanel";
import TriggerSourceBadge from "@/components/workflow-studio/TriggerSourceBadge";
import ExecutionPanel from "@/components/workflow-studio/ExecutionPanel";
import { graphToFlow, validateGraphLocal } from "@/lib/workflowGraph";
import { createRunState } from "@/lib/workflowRunState";
import { TRIGGER_KINDS, triggerSamplePayloadFromSchema, triggerPayloadInitialMode } from "@/lib/workflowTriggers";

const { getWorkflowTriggerState, rotateWorkflowTrigger } = vi.hoisted(() => ({
  getWorkflowTriggerState: vi.fn(),
  rotateWorkflowTrigger: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ getWorkflowTriggerState, rotateWorkflowTrigger }));

function idleTriggerState(overrides = {}) {
  return {
    kind: "manual",
    active: false,
    reason: "unpublished",
    webhook_url: null,
    form_url: null,
    hmac_enabled: false,
    next_run_at: null,
    last_fired_at: null,
    last_status: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getWorkflowTriggerState.mockResolvedValue(idleTriggerState());
  Object.defineProperty(window.navigator, "clipboard", {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
});

/** Selects `nodeId` in a real StudioInspector, mirroring WorkflowStudio's own shallow-merge `onPatchConfig`. */
function Inspector({ graph, nodeId, onConfig, workflowId = "wf1", workflowOptions = [] }) {
  const [flow, setFlow] = useState(() => graphToFlow(graph));
  const node = flow.nodes.find((n) => n.id === nodeId);
  return (
    <StudioInspector
      selection={{ kind: "node", node }}
      nodes={flow.nodes}
      edges={flow.edges}
      workflowId={workflowId}
      workflowOptions={workflowOptions}
      triggerRefreshKey={0}
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

function triggerGraph(config) {
  return { nodes: [{ id: "trigger1", type: "trigger", config }], edges: [] };
}

describe("kind switch", () => {
  it("clears the previous kind's fields instead of merging them", async () => {
    const user = userEvent.setup();
    render(
      <Inspector
        graph={triggerGraph({ kind: "schedule", cron: "0 9 * * *", at: null, timezone: "Europe/Paris" })}
        nodeId="trigger1"
        onConfig={() => {}}
      />,
    );
    expect(screen.getByLabelText(/Cron \(5 fields\)/i)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Kind"), "webhook");

    // The schedule-only fields are gone…
    expect(screen.queryByLabelText(/Cron \(5 fields\)/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Timezone/i)).not.toBeInTheDocument();
    // …and webhook's own field is there, unpolluted by a leftover `cron`/`at`/`timezone`.
    expect(screen.getByLabelText(/Sign requests with an HMAC secret/i)).toBeInTheDocument();
  });
});

describe("a form for each of the 8 trigger kinds", () => {
  it("covers every kind in the contract", () => {
    expect(TRIGGER_KINDS).toEqual(["manual", "webhook", "schedule", "email", "agent_tool", "form", "file", "workflow_done"]);
  });

  it("manual: just an explanatory note, no config fields", () => {
    render(<Inspector graph={triggerGraph({ kind: "manual" })} nodeId="trigger1" onConfig={() => {}} />);
    expect(screen.getByText(/Started from the studio's Test panel/i)).toBeInTheDocument();
  });

  it("webhook: the HMAC toggle", () => {
    render(<Inspector graph={triggerGraph({ kind: "webhook", hmac: false })} nodeId="trigger1" onConfig={() => {}} />);
    expect(screen.getByLabelText(/Sign requests with an HMAC secret/i)).toBeInTheDocument();
  });

  it("schedule: mode toggle, presets, cron and timezone", () => {
    render(<Inspector graph={triggerGraph({ kind: "schedule", cron: "0 9 * * *", at: null, timezone: "Europe/Paris" })} nodeId="trigger1" onConfig={() => {}} />);
    expect(screen.getByLabelText(/Cron \(5 fields\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Every hour/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Timezone/i)).toHaveValue("Europe/Paris");
  });

  it("email: provider and filters", () => {
    render(<Inspector graph={triggerGraph({ kind: "email", provider: "outlook", from_filter: null, subject_filter: null })} nodeId="trigger1" onConfig={() => {}} />);
    expect(screen.getByLabelText(/^From$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Subject contains/i)).toBeInTheDocument();
  });

  it("agent_tool: tool_name, description and the input schema editor", () => {
    render(
      <Inspector
        graph={triggerGraph({ kind: "agent_tool", tool_name: "get_weather", description: "Fetch weather", input_schema: [{ name: "city", type: "string", description: "", required: true }] })}
        nodeId="trigger1"
        onConfig={() => {}}
      />,
    );
    expect(screen.getByPlaceholderText("get_weather")).toHaveValue("get_weather");
    expect(screen.getByDisplayValue("city")).toBeInTheDocument();
  });

  it("form: title, description, access and the fields editor", () => {
    render(
      <Inspector
        graph={triggerGraph({ kind: "form", title: "Contact us", description: null, fields: [{ name: "email", label: "Email", type: "text", required: true, options: null }], access: "public" })}
        nodeId="trigger1"
        onConfig={() => {}}
      />,
    );
    expect(screen.getByLabelText("Title")).toHaveValue("Contact us");
    expect(screen.getByDisplayValue("Email")).toBeInTheDocument();
  });

  it("file: provider, folder fallback fields and the interval", () => {
    render(<Inspector graph={triggerGraph({ kind: "file", provider: "onedrive", folder_id: "abc", folder_label: "Reports", interval_min: 15 })} nodeId="trigger1" onConfig={() => {}} />);
    expect(screen.getByLabelText(/Check interval/i)).toHaveValue(15);
    expect(screen.getByPlaceholderText("folder id")).toHaveValue("abc");
  });

  it("workflow_done: target workflow (excluding itself) and the 'on' condition", () => {
    render(
      <Inspector
        graph={triggerGraph({ kind: "workflow_done", workflow_id: "wf2", on: "success" })}
        nodeId="trigger1"
        onConfig={() => {}}
        workflowOptions={[{ value: "wf2", label: "Other workflow" }]}
      />,
    );
    expect(screen.getByText("Source workflow")).toBeInTheDocument();
    expect(screen.getByText("Other workflow")).toBeInTheDocument();
  });
});

describe("cron presets", () => {
  it("fill the cron field with a readable schedule", async () => {
    const user = userEvent.setup();
    const patches = [];
    render(
      <Inspector
        graph={triggerGraph({ kind: "schedule", cron: "1 2 3 4 5", at: null, timezone: "Europe/Paris" })}
        nodeId="trigger1"
        onConfig={(p) => patches.push(p)}
      />,
    );
    await user.click(screen.getByText("Weekdays at…"));
    expect(patches.at(-1)).toEqual({ cron: "0 9 * * 1-5" });

    await user.click(screen.getByText("Every hour"));
    expect(patches.at(-1)).toEqual({ cron: "0 * * * *" });
  });
});

describe("validation contre-examples, wired end to end into the graph", () => {
  it("flags an invalid cron, an invalid tool name, and a self-listening workflow_done", () => {
    const schedule = validateGraphLocal(triggerGraph({ kind: "schedule", cron: "not a cron", at: null, timezone: "Europe/Paris" }));
    expect(schedule.errors.map((e) => e.message)).toContain("cronInvalidFormat:not a cron");

    const tool = validateGraphLocal(triggerGraph({ kind: "agent_tool", tool_name: "BAD", description: "", input_schema: [] }));
    expect(tool.errors.map((e) => e.message).some((m) => m.startsWith("toolNameInvalid"))).toBe(true);

    const done = validateGraphLocal(triggerGraph({ kind: "workflow_done", workflow_id: "wf1", on: "success" }), { currentWorkflowId: "wf1" });
    expect(done.errors.map((e) => e.message)).toContain("workflowDoneSelfListen");
  });

  it("accepts a well-formed trigger of every kind", () => {
    const valid = {
      manual: { kind: "manual" },
      webhook: { kind: "webhook", hmac: true },
      schedule: { kind: "schedule", cron: "0 9 * * 1-5", at: null, timezone: "Europe/Paris" },
      email: { kind: "email", provider: "gmail", from_filter: null, subject_filter: null },
      agent_tool: { kind: "agent_tool", tool_name: "get_weather", description: "Fetch weather", input_schema: [{ name: "city", type: "string" }] },
      form: { kind: "form", title: "Contact", description: null, fields: [{ name: "email", label: "Email", type: "text" }], access: "public" },
      file: { kind: "file", provider: "onedrive", folder_id: "abc", folder_label: "Reports", interval_min: 15 },
      workflow_done: { kind: "workflow_done", workflow_id: "wf2", on: "any" },
    };
    for (const kind of TRIGGER_KINDS) {
      const { errors } = validateGraphLocal(triggerGraph(valid[kind]), { currentWorkflowId: "wf1" });
      expect(errors, `kind=${kind}`).toEqual([]);
    }
  });
});

describe("TriggerStatusPanel", () => {
  function Harness(props) {
    const t = useTranslations("WorkflowInspector");
    return <TriggerStatusPanel t={t} {...props} />;
  }

  it.each([
    ["unpublished", "Publish the workflow to activate this trigger."],
    ["not_available", "Coming soon."],
    ["integration_missing", "Connect the integration first."],
    ["something_else_the_ui_has_never_seen", "Not active yet."],
  ])("translates the inactive reason %s", async (reason, expectedText) => {
    getWorkflowTriggerState.mockResolvedValue(idleTriggerState({ reason }));
    render(<Harness workflowId="wf1" kind="manual" refreshKey={0} />);
    await waitFor(() => expect(screen.getByText("Inactive")).toBeInTheDocument());
    expect(screen.getByText(expectedText)).toBeInTheDocument();
  });

  it("shows the webhook URL with a working copy button", async () => {
    const user = userEvent.setup();
    // userEvent.setup() installs its own navigator.clipboard stub for its copy/paste
    // helpers, overwriting the one from beforeEach — redefine it after setup() so the
    // app's own writeText call below still hits our spy.
    Object.defineProperty(window.navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
    getWorkflowTriggerState.mockResolvedValue(
      idleTriggerState({ kind: "webhook", active: true, reason: null, webhook_url: "https://api.test/api/hooks/workflows/tok1", hmac_enabled: true }),
    );
    render(<Harness workflowId="wf1" kind="webhook" refreshKey={0} />);
    await waitFor(() => expect(screen.getByText("https://api.test/api/hooks/workflows/tok1")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(window.navigator.clipboard.writeText).toHaveBeenCalledWith("https://api.test/api/hooks/workflows/tok1");
  });

  it("rotate: asks to confirm, then shows the new HMAC secret exactly once", async () => {
    const user = userEvent.setup();
    getWorkflowTriggerState.mockResolvedValue(
      idleTriggerState({ kind: "webhook", active: true, reason: null, webhook_url: "https://api.test/.../tok1", hmac_enabled: true }),
    );
    rotateWorkflowTrigger.mockResolvedValue({ webhook_url: "https://api.test/.../tok2", hmac_secret: "super-secret-hmac" });
    render(<Harness workflowId="wf1" kind="webhook" refreshKey={0} />);
    await waitFor(() => expect(screen.getByText("Regenerate")).toBeInTheDocument());

    expect(screen.queryByText("super-secret-hmac")).not.toBeInTheDocument();
    await user.click(screen.getByText("Regenerate"));
    // confirmation gate — rotate hasn't been called yet
    expect(rotateWorkflowTrigger).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Regenerate" }));

    await waitFor(() => expect(screen.getByText("super-secret-hmac")).toBeInTheDocument());
    expect(screen.getByText(/shown only once/i)).toBeInTheDocument();

    await user.click(screen.getByText("Hide"));
    expect(screen.queryByText("super-secret-hmac")).not.toBeInTheDocument();
  });

  it("shows the form page URL", async () => {
    getWorkflowTriggerState.mockResolvedValue(
      idleTriggerState({ kind: "form", active: true, reason: null, form_url: "https://app.test/forms/tok" }),
    );
    render(<Harness workflowId="wf1" kind="form" refreshKey={0} />);
    await waitFor(() => expect(screen.getByText("https://app.test/forms/tok")).toBeInTheDocument());
  });

  it("shows the next scheduled run and the last run's status", async () => {
    getWorkflowTriggerState.mockResolvedValue(
      idleTriggerState({
        kind: "schedule",
        active: true,
        reason: null,
        next_run_at: "2030-01-01T09:00:00Z",
        last_fired_at: "2026-09-20T09:00:00Z",
        last_status: "done",
      }),
    );
    render(<Harness workflowId="wf2" kind="schedule" refreshKey={0} />);
    await waitFor(() => expect(screen.getByText(/Next run:/)).toBeInTheDocument());
    expect(screen.getByText(/Last run:.*done/)).toBeInTheDocument();
  });

  it("refetches when refreshKey changes (publish/unpublish)", async () => {
    const { rerender } = render(<Harness workflowId="wf1" kind="manual" refreshKey={0} />);
    await waitFor(() => expect(getWorkflowTriggerState).toHaveBeenCalledTimes(1));
    getWorkflowTriggerState.mockResolvedValue(idleTriggerState({ active: true, reason: null }));
    rerender(<Harness workflowId="wf1" kind="manual" refreshKey={1} />);
    await waitFor(() => expect(getWorkflowTriggerState).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText("Active")).toBeInTheDocument());
  });

  it("links to /integrations when the reason is integration_missing (T2)", async () => {
    getWorkflowTriggerState.mockResolvedValue(idleTriggerState({ reason: "integration_missing" }));
    render(<Harness workflowId="wf1" kind="email" refreshKey={0} />);
    await waitFor(() => expect(screen.getByText("Connect the integration first.")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Go to Integrations →" })).toHaveAttribute("href", "/integrations");
  });
});

const TRIGGER_KIND_LABEL = {
  manual: "Manual",
  webhook: "Webhook",
  schedule: "Scheduled",
  email: "Email received",
  agent_tool: "Called by an agent",
  form: "Form",
  file: "New file",
  workflow_done: "End of a workflow",
};

describe("run source badge", () => {
  it("shows a translated label for every kind — this is what the runs list shows as `trigger.kind`", () => {
    for (const kind of TRIGGER_KINDS) {
      const { unmount } = render(<TriggerSourceBadge kind={kind} />);
      expect(screen.getByText(TRIGGER_KIND_LABEL[kind])).toBeInTheDocument();
      unmount();
    }
  });

  it("falls back to the raw kind for anything unrecognised", () => {
    render(<TriggerSourceBadge kind="future_kind" />);
    expect(screen.getByText("future_kind")).toBeInTheDocument();
  });
});

describe("Test panel payload prefill", () => {
  it("agent_tool's input_schema and form's fields build the same payload the form-mode editor would show", () => {
    const agentToolCfg = { kind: "agent_tool", input_schema: [{ name: "city", type: "string" }, { name: "count", type: "number" }] };
    expect(triggerSamplePayloadFromSchema(agentToolCfg)).toEqual({ city: "", count: 0 });
    expect(triggerPayloadInitialMode(agentToolCfg)).toBe("form");

    const formCfg = { kind: "form", fields: [{ name: "email", type: "text" }] };
    expect(triggerSamplePayloadFromSchema(formCfg)).toEqual({ email: "" });
    expect(triggerPayloadInitialMode(formCfg)).toBe("form");
  });

  it("opens the ExecutionPanel's payload editor straight into form mode, prefilled with the schema's fields", () => {
    const payload = triggerSamplePayloadFromSchema({ kind: "agent_tool", input_schema: [{ name: "city", type: "string" }] });
    render(
      <ExecutionPanel
        open
        onToggle={() => {}}
        payloadText={JSON.stringify(payload)}
        onPayloadTextChange={() => {}}
        payloadError={null}
        payloadInitialMode="form"
        isRunning={false}
        runState={createRunState()}
        onRun={() => {}}
        onCancel={() => {}}
      />,
    );
    // Form mode renders one labeled input pair per key — "city" is already there, no JSON textarea in sight.
    expect(screen.getByDisplayValue("city")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Payload" })).not.toBeInTheDocument();
  });

  it("stays in JSON mode for a plain kind (schedule, webhook…)", () => {
    expect(triggerPayloadInitialMode({ kind: "schedule" })).toBe("json");
    render(
      <ExecutionPanel
        open
        onToggle={() => {}}
        payloadText="{}"
        onPayloadTextChange={() => {}}
        payloadError={null}
        payloadInitialMode="json"
        isRunning={false}
        runState={createRunState()}
        onRun={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByRole("textbox", { name: "Payload" })).toBeInTheDocument();
  });
});
