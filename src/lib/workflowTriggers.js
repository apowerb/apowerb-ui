/**
 * Pure logic for workflow trigger `config.kind` — no React, no fetch, no DOM.
 *
 * Mirrors the shared trigger contract (core + UI): the 8 kinds, their default
 * configs, cron/timezone/schema helpers used by the inspector's forms, and
 * the local (fast, first-pass) validation that keeps the publish button
 * honest before the server's `POST /defs/validate` has a say. Kept next to
 * `workflowGraph.js` rather than inside it because a trigger's config shape
 * is its own small domain (cron, schema editors, form fields) that would
 * otherwise bloat the generic graph module.
 */

export const TRIGGER_KINDS = [
  "manual",
  "webhook",
  "schedule",
  "email",
  "agent_tool",
  "form",
  "file",
  "workflow_done",
];

export const EMAIL_PROVIDERS = ["outlook", "gmail"];
export const FILE_PROVIDERS = ["onedrive", "google_drive"];
export const FORM_FIELD_TYPES = ["text", "textarea", "number", "boolean", "select", "date"];
export const TOOL_SCHEMA_FIELD_TYPES = ["string", "number", "boolean", "array", "object"];
export const WORKFLOW_DONE_ON = ["success", "error", "any"];

export const TOOL_NAME_PATTERN = /^[a-z][a-z0-9_]{2,40}$/;

// A short, curated list rather than the full IANA database (~600 zones): it
// covers where the product's users actually are, stays readable in a
// `<select>`, and "Europe/Paris" is always first since it's the default.
export const COMMON_TIMEZONES = [
  "Europe/Paris",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Brussels",
  "Europe/Zurich",
  "Europe/Lisbon",
  "Africa/Abidjan",
  "Africa/Casablanca",
  "Africa/Lagos",
  "Africa/Nairobi",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "America/Toronto",
  "America/Montreal",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
  "Pacific/Auckland",
  "UTC",
];

/** True for any string `Intl` recognises as an IANA zone (jsdom/Node ship the full tz database). */
export function isValidTimezone(tz) {
  if (!tz || typeof tz !== "string") return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Config a freshly-picked kind starts from — deliberately minimal, matching the contract's schema per kind. */
export function defaultTriggerConfig(kind) {
  switch (kind) {
    case "webhook":
      return { kind, hmac: false };
    case "schedule":
      return { kind, cron: "0 9 * * *", at: null, timezone: "Europe/Paris" };
    case "email":
      return { kind, provider: "outlook", from_filter: null, subject_filter: null };
    case "agent_tool":
      return { kind, tool_name: "", description: "", input_schema: [] };
    case "form":
      return { kind, title: "", description: null, fields: [], access: "authenticated" };
    case "file":
      return { kind, provider: "onedrive", folder_id: "", folder_label: "", interval_min: 15 };
    case "workflow_done":
      return { kind, workflow_id: "", on: "success" };
    case "manual":
    default:
      return { kind: "manual" };
  }
}

/**
 * A patch that both clears every key the previous config carried and sets
 * the new kind's defaults, so switching kinds never leaves stale fields
 * (e.g. an old `cron` surviving a switch to `webhook`) behind — an `onChange`
 * merge (`{...config, ...patch}`) only drops a key when the patch sets it to
 * `undefined`, since `JSON.stringify`/`toEqual` both treat that as absent.
 */
export function triggerKindChangePatch(currentConfig, newKind) {
  const cleared = Object.fromEntries(Object.keys(currentConfig || {}).map((k) => [k, undefined]));
  return { ...cleared, ...defaultTriggerConfig(newKind) };
}

// --- schedule: cron presets -------------------------------------------------

export const CRON_PRESETS = ["hourly", "dailyAt", "weekdaysAt", "weeklyAt"];

/** Build a 5-field cron string for one of the readable presets. */
export function buildCronFromPreset(preset, { hour = 9, minute = 0, weekday = 1 } = {}) {
  const h = Math.min(23, Math.max(0, Number(hour) || 0));
  const m = Math.min(59, Math.max(0, Number(minute) || 0));
  const d = Math.min(6, Math.max(0, Number(weekday) || 0));
  switch (preset) {
    case "hourly":
      return "0 * * * *";
    case "dailyAt":
      return `${m} ${h} * * *`;
    case "weekdaysAt":
      return `${m} ${h} * * 1-5`;
    case "weeklyAt":
      return `${m} ${h} * * ${d}`;
    default:
      return null;
  }
}

/** The reverse of `buildCronFromPreset`: which preset (if any) a typed cron matches, so the UI can highlight it. */
export function classifyCron(cron) {
  if (typeof cron !== "string") return { preset: null };
  const fields = cron.trim().split(/\s+/);
  if (fields.length !== 5) return { preset: null };
  const [min, hour, dom, mon, dow] = fields;
  if (dom !== "*" || mon !== "*") return { preset: "custom" };
  if (min === "0" && hour === "*" && dow === "*") return { preset: "hourly" };
  if (/^\d+$/.test(min) && /^\d+$/.test(hour)) {
    const hh = Number(hour);
    const mm = Number(min);
    if (dow === "*") return { preset: "dailyAt", hour: hh, minute: mm };
    if (dow === "1-5") return { preset: "weekdaysAt", hour: hh, minute: mm };
    if (/^[0-6]$/.test(dow)) return { preset: "weeklyAt", hour: hh, minute: mm, weekday: Number(dow) };
  }
  return { preset: "custom" };
}

/**
 * What the canvas node's subtitle should say about a `schedule` trigger's
 * timing, as an i18n key + params rather than a rendered string — this
 * module stays translation-agnostic, the caller (which has a `t`) does the
 * final `t(key, params)`. `hour`/`minute` are zero-padded `HH`/`mm` strings.
 */
export function triggerScheduleDetail(cfg) {
  if (cfg?.at) {
    return { key: "scheduleAt", params: { at: String(cfg.at).slice(0, 16).replace("T", " ") } };
  }
  const info = classifyCron(cfg?.cron || "");
  if (info.preset === "hourly") return { key: "scheduleHourly", params: {} };
  if (info.hour != null && info.minute != null) {
    const time = `${String(info.hour).padStart(2, "0")}:${String(info.minute).padStart(2, "0")}`;
    if (info.preset === "dailyAt") return { key: "scheduleDailyAt", params: { time } };
    if (info.preset === "weekdaysAt") return { key: "scheduleWeekdaysAt", params: { time } };
    if (info.preset === "weeklyAt") return { key: "scheduleWeeklyAt", params: { time, weekday: info.weekday } };
  }
  return { key: "scheduleCustom", params: {} };
}

const CRON_FIELD_RE = /^(\*(\/\d+)?|\d+(-\d+)?(\/\d+)?)(,(\*(\/\d+)?|\d+(-\d+)?(\/\d+)?))*$/;

/** Loose 5-field syntax check — a fast mirror of the server's cron parser, not a replacement for it. */
export function isValidCronSyntax(cron) {
  if (typeof cron !== "string" || !cron.trim()) return false;
  const fields = cron.trim().split(/\s+/);
  return fields.length === 5 && fields.every((f) => CRON_FIELD_RE.test(f));
}

/** Rough lower bound, in minutes, on how often a syntactically-valid cron can fire — used to reject sub-5-minute schedules client-side. */
export function cronMinIntervalMinutes(cron) {
  const [min, hour] = cron.trim().split(/\s+/);
  const step = /^\*\/(\d+)$/.exec(min);
  if (step) return Math.max(1, Number(step[1]));
  if (min === "*") return 1;
  const values = [...new Set(min.split(",").filter((v) => /^\d+$/.test(v)).map(Number))].sort((a, b) => a - b);
  if (values.length > 1 && hour === "*") {
    let gap = 60 - values[values.length - 1] + values[0];
    for (let i = 1; i < values.length; i += 1) gap = Math.min(gap, values[i] - values[i - 1]);
    return gap;
  }
  return 60;
}

// --- agent_tool / form: sample payload from the declared schema ------------

function defaultForSchemaType(type) {
  switch (type) {
    case "number":
      return 0;
    case "boolean":
      return false;
    case "array":
      return [];
    case "object":
      return {};
    default:
      return "";
  }
}

function defaultForFieldType(type) {
  switch (type) {
    case "number":
      return 0;
    case "boolean":
      return false;
    default:
      return "";
  }
}

/**
 * A ready-to-run payload built straight from `input_schema` (agent_tool) or
 * `fields` (form) — the Test panel should never ask the person to retype a
 * schema they just declared. Returns `null` for every other kind, or an
 * empty schema, so the caller can fall back to `sample_payload`.
 */
export function triggerSamplePayloadFromSchema(config) {
  if (!config) return null;
  if (config.kind === "agent_tool") {
    const schema = config.input_schema || [];
    if (!schema.length) return null;
    const payload = {};
    for (const field of schema) {
      if (field?.name) payload[field.name] = defaultForSchemaType(field.type);
    }
    return payload;
  }
  if (config.kind === "form") {
    const fields = config.fields || [];
    if (!fields.length) return null;
    const payload = {};
    for (const field of fields) {
      if (field?.name) payload[field.name] = defaultForFieldType(field.type);
    }
    return payload;
  }
  return null;
}

/** Whether the Test panel's payload editor should default to form mode (fields declared right there in the trigger) instead of raw JSON. */
export function triggerPayloadInitialMode(config) {
  return config?.kind === "agent_tool" || config?.kind === "form" ? "form" : "json";
}

// --- validation --------------------------------------------------------------

function pushIf(errors, nodeId, condition, message) {
  if (condition) errors.push({ nodeId, message });
}

function validateScheduleConfig(node, cfg, now) {
  const errors = [];
  const hasCron = cfg.cron != null && cfg.cron !== "";
  const hasAt = cfg.at != null && cfg.at !== "";
  if (hasCron === hasAt) {
    errors.push({ nodeId: node.id, message: "scheduleExactlyOne" });
    return errors;
  }
  if (hasCron) {
    if (!isValidCronSyntax(cfg.cron)) {
      errors.push({ nodeId: node.id, message: `cronInvalidFormat:${cfg.cron}` });
    } else if (cronMinIntervalMinutes(cfg.cron) < 5) {
      errors.push({ nodeId: node.id, message: `cronTooFrequent:${cfg.cron}` });
    }
  }
  if (hasAt) {
    const parsed = Date.parse(cfg.at);
    if (Number.isNaN(parsed)) {
      errors.push({ nodeId: node.id, message: `atInvalid:${cfg.at}` });
    } else if (parsed <= (now || new Date()).getTime()) {
      errors.push({ nodeId: node.id, message: "atInPast" });
    }
  }
  pushIf(errors, node.id, !isValidTimezone(cfg.timezone), `timezoneUnknown:${cfg.timezone}`);
  return errors;
}

function validateAgentToolConfig(node, cfg) {
  const errors = [];
  pushIf(errors, node.id, !TOOL_NAME_PATTERN.test(cfg.tool_name || ""), `toolNameInvalid:${cfg.tool_name || ""}`);
  pushIf(errors, node.id, !String(cfg.description || "").trim(), "toolDescriptionRequired");
  const seen = new Set();
  for (const field of cfg.input_schema || []) {
    const name = field?.name || "";
    if (!name) {
      errors.push({ nodeId: node.id, message: "toolSchemaFieldNameRequired" });
    } else if (seen.has(name)) {
      errors.push({ nodeId: node.id, message: `toolSchemaFieldNameDuplicate:${name}` });
    }
    seen.add(name);
    if (!TOOL_SCHEMA_FIELD_TYPES.includes(field?.type)) {
      errors.push({ nodeId: node.id, message: `toolSchemaFieldTypeUnknown:${field?.type}` });
    }
  }
  return errors;
}

function validateFormConfig(node, cfg) {
  const errors = [];
  pushIf(errors, node.id, !String(cfg.title || "").trim(), "formTitleRequired");
  const seen = new Set();
  for (const field of cfg.fields || []) {
    const name = field?.name || "";
    if (!name) errors.push({ nodeId: node.id, message: "formFieldNameRequired" });
    else if (seen.has(name)) errors.push({ nodeId: node.id, message: `formFieldNameDuplicate:${name}` });
    seen.add(name);
    if (!String(field?.label || "").trim()) errors.push({ nodeId: node.id, message: "formFieldLabelRequired" });
    if (!FORM_FIELD_TYPES.includes(field?.type)) {
      errors.push({ nodeId: node.id, message: `formFieldTypeUnknown:${field?.type}` });
    } else if (field.type === "select" && !(field.options || []).filter((o) => String(o || "").trim()).length) {
      errors.push({ nodeId: node.id, message: "formFieldOptionsRequired" });
    }
  }
  return errors;
}

function validateFileConfig(node, cfg) {
  const errors = [];
  pushIf(errors, node.id, !FILE_PROVIDERS.includes(cfg.provider), `fileProviderUnknown:${cfg.provider}`);
  pushIf(errors, node.id, !String(cfg.folder_id || "").trim(), "fileFolderRequired");
  const interval = cfg.interval_min;
  pushIf(
    errors,
    node.id,
    !Number.isInteger(interval) || interval < 5 || interval > 1440,
    `fileIntervalRange:${interval}`,
  );
  return errors;
}

function validateWorkflowDoneConfig(node, cfg, context) {
  const errors = [];
  pushIf(errors, node.id, !String(cfg.workflow_id || "").trim(), "workflowDoneTargetRequired");
  pushIf(errors, node.id, !WORKFLOW_DONE_ON.includes(cfg.on), `workflowDoneOnUnknown:${cfg.on}`);
  if (context?.currentWorkflowId && cfg.workflow_id && cfg.workflow_id === context.currentWorkflowId) {
    errors.push({ nodeId: node.id, message: "workflowDoneSelfListen" });
  }
  return errors;
}

/**
 * Local mirror of the server-side trigger validation — same codes as
 * `validateGraphLocal`'s other checks (`"code"` or `"code:value"`), so the
 * inspector and the publish-blocking popover read them the same way.
 * `context.now` and `context.currentWorkflowId` default to safe values so
 * callers that don't care (most tests) can omit them.
 */
export function validateTriggerConfig(node, context = {}) {
  const cfg = node.config || {};
  const kind = cfg.kind;
  if (!TRIGGER_KINDS.includes(kind)) {
    return [{ nodeId: node.id, message: `triggerKindUnknown:${kind}` }];
  }
  switch (kind) {
    case "schedule":
      return validateScheduleConfig(node, cfg, context.now);
    case "email":
      return cfg.provider && !EMAIL_PROVIDERS.includes(cfg.provider)
        ? [{ nodeId: node.id, message: `emailProviderUnknown:${cfg.provider}` }]
        : [];
    case "agent_tool":
      return validateAgentToolConfig(node, cfg);
    case "form":
      return validateFormConfig(node, cfg);
    case "file":
      return validateFileConfig(node, cfg);
    case "workflow_done":
      return validateWorkflowDoneConfig(node, cfg, context);
    case "manual":
    case "webhook":
    default:
      return [];
  }
}

// --- status panel: reasons / kind metadata ----------------------------------

/** i18n key suffix for an inactive trigger's `reason`, falling back to a generic message for anything the UI doesn't know yet. */
export function triggerInactiveReasonKey(reason) {
  const KNOWN = ["unpublished", "not_available", "integration_missing"];
  return KNOWN.includes(reason) ? reason : "other";
}
