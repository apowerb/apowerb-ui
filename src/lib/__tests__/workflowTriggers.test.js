import { describe, it, expect } from "vitest";
import {
  TRIGGER_KINDS,
  defaultTriggerConfig,
  triggerKindChangePatch,
  buildCronFromPreset,
  classifyCron,
  isValidCronSyntax,
  cronMinIntervalMinutes,
  isValidTimezone,
  triggerSamplePayloadFromSchema,
  triggerPayloadInitialMode,
  validateTriggerConfig,
} from "@/lib/workflowTriggers";

describe("defaultTriggerConfig / triggerKindChangePatch", () => {
  it("has a minimal default for all 8 kinds", () => {
    expect(TRIGGER_KINDS).toHaveLength(8);
    for (const kind of TRIGGER_KINDS) {
      const cfg = defaultTriggerConfig(kind);
      expect(cfg.kind).toBe(kind);
    }
  });

  it("clears every stale key when switching kind", () => {
    const scheduleCfg = { kind: "schedule", cron: "0 9 * * *", at: null, timezone: "Europe/Paris" };
    const patch = triggerKindChangePatch(scheduleCfg, "webhook");
    const merged = { ...scheduleCfg, ...patch };
    expect(JSON.parse(JSON.stringify(merged))).toEqual({ kind: "webhook", hmac: false });
  });
});

describe("cron presets", () => {
  it("builds a cron string for each readable preset", () => {
    expect(buildCronFromPreset("hourly")).toBe("0 * * * *");
    expect(buildCronFromPreset("dailyAt", { hour: 8, minute: 30 })).toBe("30 8 * * *");
    expect(buildCronFromPreset("weekdaysAt", { hour: 9, minute: 0 })).toBe("0 9 * * 1-5");
    expect(buildCronFromPreset("weeklyAt", { hour: 7, minute: 15, weekday: 1 })).toBe("15 7 * * 1");
  });

  it("classifies a cron back into its preset", () => {
    expect(classifyCron("0 * * * *")).toEqual({ preset: "hourly" });
    expect(classifyCron("30 8 * * *")).toEqual({ preset: "dailyAt", hour: 8, minute: 30 });
    expect(classifyCron("0 9 * * 1-5")).toEqual({ preset: "weekdaysAt", hour: 9, minute: 0 });
    expect(classifyCron("15 7 * * 1")).toEqual({ preset: "weeklyAt", hour: 7, minute: 15, weekday: 1 });
    expect(classifyCron("*/2 * * * *")).toEqual({ preset: "custom" });
  });

  it("rejects a cron that isn't 5 fields", () => {
    expect(isValidCronSyntax("0 9 * *")).toBe(false);
    expect(isValidCronSyntax("0 9 * * *")).toBe(true);
    expect(isValidCronSyntax("not a cron at all")).toBe(false);
  });

  it("estimates the minimal interval to reject sub-5-minute schedules", () => {
    expect(cronMinIntervalMinutes("* * * * *")).toBeLessThan(5);
    expect(cronMinIntervalMinutes("*/2 * * * *")).toBeLessThan(5);
    expect(cronMinIntervalMinutes("*/15 * * * *")).toBeGreaterThanOrEqual(5);
    expect(cronMinIntervalMinutes("0 * * * *")).toBeGreaterThanOrEqual(5);
    // every preset stays at or above the 5-minute floor
    for (const preset of ["hourly", "dailyAt", "weekdaysAt", "weeklyAt"]) {
      const cron = buildCronFromPreset(preset, { hour: 9, minute: 0, weekday: 1 });
      expect(cronMinIntervalMinutes(cron)).toBeGreaterThanOrEqual(5);
    }
  });
});

describe("isValidTimezone", () => {
  it("accepts a real IANA zone and rejects garbage", () => {
    expect(isValidTimezone("Europe/Paris")).toBe(true);
    expect(isValidTimezone("UTC")).toBe(true);
    expect(isValidTimezone("Not/AZone")).toBe(false);
    expect(isValidTimezone("")).toBe(false);
    expect(isValidTimezone(null)).toBe(false);
  });
});

describe("triggerSamplePayloadFromSchema / triggerPayloadInitialMode", () => {
  it("builds a payload from agent_tool's input_schema", () => {
    const cfg = {
      kind: "agent_tool",
      input_schema: [
        { name: "city", type: "string", required: true },
        { name: "count", type: "number", required: false },
        { name: "active", type: "boolean", required: false },
      ],
    };
    expect(triggerSamplePayloadFromSchema(cfg)).toEqual({ city: "", count: 0, active: false });
    expect(triggerPayloadInitialMode(cfg)).toBe("form");
  });

  it("builds a payload from form's fields", () => {
    const cfg = { kind: "form", fields: [{ name: "email", type: "text" }, { name: "age", type: "number" }] };
    expect(triggerSamplePayloadFromSchema(cfg)).toEqual({ email: "", age: 0 });
    expect(triggerPayloadInitialMode(cfg)).toBe("form");
  });

  it("returns null (and json mode) for every other kind or an empty schema", () => {
    expect(triggerSamplePayloadFromSchema({ kind: "webhook" })).toBeNull();
    expect(triggerSamplePayloadFromSchema({ kind: "agent_tool", input_schema: [] })).toBeNull();
    expect(triggerPayloadInitialMode({ kind: "schedule" })).toBe("json");
  });
});

describe("validateTriggerConfig", () => {
  const node = (config) => ({ id: "trigger1", config });

  it("accepts manual and webhook with no extra config", () => {
    expect(validateTriggerConfig(node({ kind: "manual" }))).toEqual([]);
    expect(validateTriggerConfig(node({ kind: "webhook", hmac: true }))).toEqual([]);
  });

  it("rejects a schedule with both cron and at, or neither", () => {
    expect(validateTriggerConfig(node({ kind: "schedule", cron: "0 9 * * *", at: "2030-01-01T00:00:00Z", timezone: "Europe/Paris" })).map((e) => e.message)).toContain("scheduleExactlyOne");
    expect(validateTriggerConfig(node({ kind: "schedule", cron: null, at: null, timezone: "Europe/Paris" })).map((e) => e.message)).toContain("scheduleExactlyOne");
  });

  it("rejects a too-frequent or malformed cron, and an unknown timezone", () => {
    const errs = validateTriggerConfig(node({ kind: "schedule", cron: "* * * * *", at: null, timezone: "Not/AZone" })).map((e) => e.message);
    expect(errs).toContain("cronTooFrequent:* * * * *");
    expect(errs.some((m) => m.startsWith("timezoneUnknown:"))).toBe(true);
    expect(validateTriggerConfig(node({ kind: "schedule", cron: "not a cron", at: null, timezone: "Europe/Paris" })).map((e) => e.message)).toContain("cronInvalidFormat:not a cron");
  });

  it("rejects a schedule 'at' in the past", () => {
    const errs = validateTriggerConfig(node({ kind: "schedule", cron: null, at: "2000-01-01T00:00:00Z", timezone: "Europe/Paris" }), { now: new Date("2026-09-21T00:00:00Z") }).map((e) => e.message);
    expect(errs).toContain("atInPast");
  });

  it("accepts a valid recurring schedule and a valid one-off schedule", () => {
    expect(validateTriggerConfig(node({ kind: "schedule", cron: "0 9 * * 1-5", at: null, timezone: "Europe/Paris" }))).toEqual([]);
    expect(
      validateTriggerConfig(
        node({ kind: "schedule", cron: null, at: "2030-01-01T09:00:00Z", timezone: "Europe/Paris" }),
        { now: new Date("2026-09-21T00:00:00Z") },
      ),
    ).toEqual([]);
  });

  it("validates agent_tool's tool_name, description and input_schema", () => {
    const bad = validateTriggerConfig(node({ kind: "agent_tool", tool_name: "BadName!", description: "", input_schema: [{ name: "", type: "string" }, { name: "x", type: "nope" }] })).map((e) => e.message);
    expect(bad.some((m) => m.startsWith("toolNameInvalid"))).toBe(true);
    expect(bad).toContain("toolDescriptionRequired");
    expect(bad).toContain("toolSchemaFieldNameRequired");
    expect(bad.some((m) => m.startsWith("toolSchemaFieldTypeUnknown"))).toBe(true);

    expect(
      validateTriggerConfig(node({ kind: "agent_tool", tool_name: "get_weather", description: "Fetch weather", input_schema: [{ name: "city", type: "string" }] })),
    ).toEqual([]);
  });

  it("rejects a duplicate field name in agent_tool's schema", () => {
    const errs = validateTriggerConfig(node({ kind: "agent_tool", tool_name: "dup_tool", description: "d", input_schema: [{ name: "x", type: "string" }, { name: "x", type: "number" }] })).map((e) => e.message);
    expect(errs).toContain("toolSchemaFieldNameDuplicate:x");
  });

  it("validates form title, field names/labels/types and select options", () => {
    const bad = validateTriggerConfig(
      node({
        kind: "form",
        title: "",
        fields: [
          { name: "", label: "", type: "text" },
          { name: "choice", label: "Choice", type: "select", options: [] },
        ],
      }),
    ).map((e) => e.message);
    expect(bad).toContain("formTitleRequired");
    expect(bad).toContain("formFieldNameRequired");
    expect(bad).toContain("formFieldLabelRequired");
    expect(bad).toContain("formFieldOptionsRequired");

    expect(
      validateTriggerConfig(node({ kind: "form", title: "Contact", fields: [{ name: "email", label: "Email", type: "text" }], access: "public" })),
    ).toEqual([]);
  });

  it("validates file provider, folder and interval bounds", () => {
    const bad = validateTriggerConfig(node({ kind: "file", provider: "dropbox", folder_id: "", interval_min: 2 })).map((e) => e.message);
    expect(bad.some((m) => m.startsWith("fileProviderUnknown"))).toBe(true);
    expect(bad).toContain("fileFolderRequired");
    expect(bad.some((m) => m.startsWith("fileIntervalRange"))).toBe(true);

    expect(
      validateTriggerConfig(node({ kind: "file", provider: "onedrive", folder_id: "abc", folder_label: "Reports", interval_min: 15 })),
    ).toEqual([]);
  });

  it("requires a workflow_done target and refuses a workflow listening to itself", () => {
    expect(validateTriggerConfig(node({ kind: "workflow_done", workflow_id: "", on: "success" })).map((e) => e.message)).toContain("workflowDoneTargetRequired");
    const selfListen = validateTriggerConfig(
      node({ kind: "workflow_done", workflow_id: "wf_1", on: "success" }),
      { currentWorkflowId: "wf_1" },
    ).map((e) => e.message);
    expect(selfListen).toContain("workflowDoneSelfListen");
    expect(
      validateTriggerConfig(node({ kind: "workflow_done", workflow_id: "wf_2", on: "any" }), { currentWorkflowId: "wf_1" }),
    ).toEqual([]);
  });
});
