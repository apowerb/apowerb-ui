/**
 * Warnings that anticipate a failure (they never block Test or Publish):
 * an automatic workflow nobody hears fail, a `{{agent.field}}` read from an
 * agent that is not asked for JSON, a Try with nothing inside that can fail.
 */
import { describe, it, expect } from "vitest";
import { validateGraphLocal, notifiesOnFailure } from "@/lib/workflowGraph";

const trigger = (kind, extra = {}) => ({ id: "trigger1", type: "trigger", config: { kind, ...extra } });
const agent = (id, config = {}) => ({ id, type: "agent", config: { agent_id: "agent7", ...config } });
const output = (id, value) => ({ id, type: "output", config: { value } });

function graph(nodes, edges) {
  return { version: 1, nodes, edges };
}

function warnings(result, code) {
  return result.errors.filter((e) => e.level === "warning" && e.message.split(":")[0] === code);
}

describe("noErrorHandling", () => {
  const scheduled = graph(
    [trigger("schedule", { cron: "0 9 * * *", timezone: "Europe/Paris" }), agent("agent1")],
    [{ source: "trigger1", target: "agent1" }],
  );

  it("warns on an automatic trigger with nothing to catch or report a failure", () => {
    const result = validateGraphLocal(scheduled);
    expect(warnings(result, "noErrorHandling")).toEqual([
      { nodeId: "trigger1", message: "noErrorHandling", level: "warning" },
    ]);
    // A warning, never an error: Test and Publish stay possible.
    expect(result.valid).toBe(true);
  });

  it("stays quiet for a manual workflow, whoever runs it sees the failure", () => {
    const manual = graph([trigger("manual"), agent("agent1")], [{ source: "trigger1", target: "agent1" }]);
    expect(warnings(validateGraphLocal(manual), "noErrorHandling")).toEqual([]);
  });

  it("stays quiet once a Try guards the work", () => {
    const guarded = graph(
      [
        trigger("webhook"),
        {
          id: "try1",
          type: "try",
          config: { retries: 0, body: graph([{ id: "trigger1", type: "trigger", config: {} }, agent("agent1")], [{ source: "trigger1", target: "agent1" }]) },
        },
      ],
      [{ source: "trigger1", target: "try1" }],
    );
    expect(warnings(validateGraphLocal(guarded), "noErrorHandling")).toEqual([]);
  });

  it("stays quiet when a published workflow listens to its failures", () => {
    const result = validateGraphLocal(scheduled, { failureListeners: [{ workflow_id: "wf9", name: "Alerte" }] });
    expect(warnings(result, "noErrorHandling")).toEqual([]);
  });

  it("stays quiet when the failure alert is on", () => {
    expect(warnings(validateGraphLocal(scheduled, { failureAlert: true }), "noErrorHandling")).toEqual([]);
    expect(warnings(validateGraphLocal(scheduled, { failureAlert: false }), "noErrorHandling")).toHaveLength(1);
  });

  it("stays quiet when a step handles its own failure", () => {
    for (const mode of ["continue", "route"]) {
      const handled = graph(
        [trigger("schedule", { cron: "0 9 * * *", timezone: "Europe/Paris" }), agent("agent1", { on_error: mode })],
        [{ source: "trigger1", target: "agent1" }],
      );
      expect(warnings(validateGraphLocal(handled), "noErrorHandling")).toEqual([]);
    }
    const stops = graph(
      [trigger("schedule", { cron: "0 9 * * *", timezone: "Europe/Paris" }), agent("agent1", { on_error: "fail" })],
      [{ source: "trigger1", target: "agent1" }],
    );
    expect(warnings(validateGraphLocal(stops), "noErrorHandling")).toHaveLength(1);
  });

  it("does not repeat itself for the trigger inside a Try body", () => {
    const nested = graph(
      [
        trigger("email", { provider: "outlook" }),
        {
          id: "try1",
          type: "try",
          config: { retries: 0, body: graph([trigger("schedule", { cron: "0 9 * * *" }), agent("agent1")], [{ source: "trigger1", target: "agent1" }]) },
        },
      ],
      [{ source: "trigger1", target: "try1" }],
    );
    expect(warnings(validateGraphLocal(nested), "noErrorHandling")).toEqual([]);
  });
});

describe("notifiesOnFailure", () => {
  it("follows the status when unset, as the engine does", () => {
    expect(notifiesOnFailure(null, "published")).toBe(true);
    expect(notifiesOnFailure({}, "draft")).toBe(false);
    expect(notifiesOnFailure({ notify_on_failure: false }, "published")).toBe(false);
    expect(notifiesOnFailure({ notify_on_failure: true }, "draft")).toBe(true);
  });
});

describe("templateRefAgentNotJson", () => {
  const withRef = (agentConfig) =>
    graph(
      [trigger("manual"), agent("agent1", agentConfig), output("out1", "{{agent1.montant}}")],
      [
        { source: "trigger1", target: "agent1" },
        { source: "agent1", target: "out1" },
      ],
    );

  it("warns when a field is read from an agent not asked for JSON", () => {
    const result = validateGraphLocal(withRef({}));
    expect(warnings(result, "templateRefAgentNotJson")).toEqual([
      { nodeId: "out1", message: "templateRefAgentNotJson:{{agent1.montant}}", level: "warning" },
    ]);
    expect(result.valid).toBe(true);
  });

  it("warns for an agent explicitly set to text", () => {
    expect(warnings(validateGraphLocal(withRef({ output_type: "text" })), "templateRefAgentNotJson")).toHaveLength(1);
  });

  it("stays quiet once the agent's expected output is JSON", () => {
    expect(warnings(validateGraphLocal(withRef({ output_type: "json" })), "templateRefAgentNotJson")).toEqual([]);
  });

  it("stays quiet for the whole reply ({{agent1}}) and leaves the legacy .output warning alone", () => {
    const whole = graph(
      [trigger("manual"), agent("agent1"), output("out1", "{{agent1}} / {{agent1.output}}")],
      [
        { source: "trigger1", target: "agent1" },
        { source: "agent1", target: "out1" },
      ],
    );
    const result = validateGraphLocal(whole);
    expect(warnings(result, "templateRefAgentNotJson")).toEqual([]);
    expect(warnings(result, "templateRefLegacyOutput")).toHaveLength(1);
  });
});

describe("tryNothingToCatch", () => {
  const tryWith = (bodyNodes) =>
    graph(
      [
        trigger("manual"),
        {
          id: "try1",
          type: "try",
          config: {
            retries: 0,
            body: graph(
              [{ id: "trigger1", type: "trigger", config: {} }, ...bodyNodes],
              bodyNodes.map((n) => ({ source: "trigger1", target: n.id })),
            ),
          },
        },
      ],
      [{ source: "trigger1", target: "try1" }],
    );

  it("warns when nothing in the body can fail", () => {
    const result = validateGraphLocal(tryWith([{ id: "set1", type: "set", config: { fields: [{ key: "a", value: "1" }] } }]));
    expect(warnings(result, "tryNothingToCatch")).toEqual([{ nodeId: "try1", message: "tryNothingToCatch", level: "warning" }]);
    expect(result.valid).toBe(true);
  });

  it("stays quiet when the body calls an agent, a tool or the web", () => {
    expect(warnings(validateGraphLocal(tryWith([agent("agent1")])), "tryNothingToCatch")).toEqual([]);
    expect(warnings(validateGraphLocal(tryWith([{ id: "http1", type: "http", config: { method: "GET", url: "https://x.test" } }])), "tryNothingToCatch")).toEqual([]);
  });

  it("stays quiet when the body creates or saves a file, both can fail", () => {
    const file = { id: "file1", type: "file", config: { format: "csv", content: "{{trigger1}}" } };
    const save = { id: "save1", type: "file_save", config: { provider: "onedrive", file: "{{file1}}" } };
    expect(warnings(validateGraphLocal(tryWith([file])), "tryNothingToCatch")).toEqual([]);
    expect(warnings(validateGraphLocal(tryWith([save])), "tryNothingToCatch")).toEqual([]);
  });
});
