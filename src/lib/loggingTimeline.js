/**
 * Pure helpers turning raw telemetry (OTel logs + spans) into the
 * human-readable timeline items rendered by LoggingPage. No React, no
 * I/O — fully unit-testable.
 *
 * Semantics: spans carry the practical substance (tool names, durations,
 * args, responses); GenAI event logs are redacted by design and only
 * witness the exchange. A tool call is shown as failed when its
 * *response payload* carries an error-like code (e.g. INTEGRATION_MISSING)
 * — ADK leaves the span status UNSET even when the tool business-fails.
 */

// Fallback role per GenAI event. ADK replays the whole conversation
// history as `gen_ai.user.message` events, so the event name alone is NOT
// the real speaker — the true role lives in `body.content.role`
// ("user" | "model"). messageRole() prefers that; this map is the fallback.
export const EVENT_ROLE = {
  "gen_ai.user.message": "User",
  "gen_ai.system.message": "System",
  "gen_ai.assistant.message": "Assistant",
  "gen_ai.tool.message": "Tool result",
  "gen_ai.choice": "Model response",
};

/** Real speaker of a message: content.role wins over the event name. */
export function messageRole(row) {
  if (row.event_name === "gen_ai.system.message") return "System";
  if (row.event_name === "gen_ai.choice") return "Assistant";
  try {
    const parsed = typeof row.body === "string" ? JSON.parse(row.body) : row.body;
    const r = parsed?.content?.role;
    if (r === "user") return "User";
    if (r === "model") return "Assistant";
  } catch {
    // fall through to the event-name default
  }
  return EVENT_ROLE[row.event_name] || "Message";
}

/** Turn one Gemini "part" into a readable fragment (never the raw
 * thought_signature, which is base64 noise appended to call ids). */
function partToText(part) {
  if (typeof part === "string") return part.trim();
  if (!part || typeof part !== "object") return "";
  if (typeof part.text === "string") return part.text.trim();
  if (part.function_call) {
    const name = part.function_call.name || "tool";
    const args = part.function_call.args;
    const argStr = args && Object.keys(args).length
      ? ` ${JSON.stringify(args)}` : "";
    return `→ call ${name}${argStr}`;
  }
  if (part.function_response) {
    const name = part.function_response.name || "tool";
    return `← ${name} result`;
  }
  return "";
}

/** Pull human-readable content out of a GenAI event/message body.
 * Handles plain strings, {content: "..."}, and the Gemini shape
 * {content: {parts: [...]}} where parts mix text / function_call /
 * function_response. Returns "<elided>" when capture is off. */
export function extractContent(body) {
  if (body == null) return null;
  let value = body;
  if (typeof body === "string") {
    try {
      value = JSON.parse(body);
    } catch {
      return body.trim() || null;
    }
  }
  if (typeof value === "string") return value.trim() || null;
  if (value && typeof value === "object") {
    let content = value.content ?? value.text ?? value.message;
    // Gemini nests the real payload one level down: {content: {parts: [...]}}.
    if (content && typeof content === "object" && !Array.isArray(content)) {
      content = content.parts ?? content.text ?? content;
    }
    if (Array.isArray(content)) {
      const joined = content.map(partToText).filter(Boolean).join(" · ").trim();
      return joined || null;
    }
    if (typeof content === "string") {
      const t = content.trim();
      return t && t !== "<elided>" ? t : content === "<elided>" ? "<elided>" : null;
    }
  }
  return null;
}

const ERROR_CODE_RE = /missing|error|fail|denied|invalid|unauthorized|timeout/i;

export function toolOutcome(span) {
  const raw = span.attributes?.["gcp.vertex.agent.tool_response"];
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const code =
      parsed.code || parsed.error || (typeof parsed.status === "string" ? parsed.status : null);
    if (code && ERROR_CODE_RE.test(String(code))) {
      return {
        failed: true,
        code: String(code),
        message: parsed.message || parsed.reason || "",
      };
    }
    if (code && /pending|required/i.test(String(code))) {
      return { failed: false, waiting: true, code: String(code) };
    }
    return { failed: false };
  } catch {
    return null;
  }
}

/** True when the span's OTLP status is ERROR (proto JSON encodes it as
 * the string "2" or "STATUS_CODE_ERROR"). */
export function spanErrored(span) {
  const code = span.status_code;
  return code === "2" || code === "STATUS_CODE_ERROR";
}

function shortErr(msg, max = 120) {
  const s = (msg || "").trim();
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export function spanToItem(span) {
  const attrs = span.attributes || {};
  const op = attrs["gen_ai.operation.name"] || "";
  const name = span.name || "";
  // An OTLP error status (e.g. an LLM API/auth failure) propagates up the
  // whole span tree, so we only surface it on the leaf that renders as a
  // row (execute_tool / generate_content) — showing it on call_llm /
  // invoke_agent / invocation too would duplicate one failure into four.
  const errored = spanErrored(span);

  if (op === "execute_tool" || name.startsWith("execute_tool")) {
    const tool = attrs["gen_ai.tool.name"] || name.replace(/^execute_tool\s*/, "");
    const outcome = toolOutcome(span);
    if (outcome?.failed) {
      return {
        kind: "ERROR",
        label: `Tool ${tool} failed — ${outcome.code}${outcome.message ? `: ${outcome.message}` : ""}`,
        span,
      };
    }
    if (errored) {
      return {
        kind: "ERROR",
        label: `Tool ${tool} failed — ${shortErr(span.status_message) || "error"}`,
        span,
      };
    }
    return {
      kind: "TOOL",
      label: outcome?.waiting
        ? `Tool ${tool} → waiting for user input`
        : `Tool ${tool}`,
      span,
    };
  }

  if (op === "generate_content" || name.startsWith("generate_content")) {
    const model =
      attrs["gen_ai.request.model"] || name.replace(/^generate_content\s*/, "");
    if (errored) {
      return {
        kind: "ERROR",
        label: `LLM call failed · ${model} — ${shortErr(span.status_message) || "error"}`,
        span,
      };
    }
    return { kind: "LLM", label: `LLM call · ${model}`, span };
  }

  // invocation / invoke_agent / call_llm: structural, kept for turn durations
  // (their error status is already surfaced on the leaf span above).
  return null;
}

export function logToItem(row) {
  if (row.severity) {
    const sev = row.severity.toUpperCase().startsWith("WARN")
      ? "WARN"
      : row.severity.toUpperCase();
    return { kind: sev === "ERROR" ? "ERROR" : sev, label: row.body, log: row };
  }
  const role = messageRole(row);
  const content = extractContent(row.body);

  let label;
  if (content && content !== "<elided>") {
    // Captured content (masked at ingestion) — show it. Tool activity
    // ("→ call X" / "← X result") is self-describing, no role prefix.
    const snippet = content.length > 160 ? `${content.slice(0, 160)}…` : content;
    const isToolActivity = /^[→←]/.test(snippet);
    label = isToolActivity ? snippet : `${role}: ${snippet}`;
  } else if (content === "<elided>") {
    label = `${role} (content elided)`;
  } else {
    try {
      const parsed = JSON.parse(row.body);
      if (parsed.finish_reason) {
        label = `Model response · finish_reason=${parsed.finish_reason}`;
      }
    } catch {
      // keep raw body below
    }
    label = label || `${role} (content elided)`;
  }
  return { kind: "AGENT", label, log: row };
}

/* Collapse consecutive AGENT rows sharing a label into one row ×N. */
export function collapseAgentRuns(items) {
  const out = [];
  for (const item of items) {
    const prev = out[out.length - 1];
    if (
      item.kind === "AGENT" &&
      prev?.kind === "AGENT" &&
      prev.label === item.label
    ) {
      prev.count = (prev.count || 1) + 1;
    } else {
      out.push({ ...item });
    }
  }
  return out;
}

/**
 * Merge raw logs + spans into stable-keyed, chronologically sorted items,
 * plus per-turn (trace) durations from `invocation` spans and per-kind
 * counts. Depends only on the data — filtering happens downstream.
 */
export function buildTimeline(data) {
  const items = [];
  const turnDurations = new Map();
  for (const span of data?.spans || []) {
    if ((span.name || "") === "invocation" && span.duration_ms != null) {
      turnDurations.set(
        span.trace_id,
        Math.max(turnDurations.get(span.trace_id) || 0, span.duration_ms),
      );
    }
    const item = spanToItem(span);
    if (item) {
      items.push({
        ...item,
        ts: span.ts,
        trace: span.trace_id,
        id: `s-${span.trace_id}-${span.span_id}-${span.name}`,
      });
    }
  }
  for (const row of data?.logs || []) {
    items.push({
      ...logToItem(row),
      ts: row.ts,
      trace: row.trace_id || "no-trace",
      id: `l-${row.trace_id || "x"}-${row.ts}-${items.length}`,
    });
  }
  items.sort((a, b) => new Date(a.ts) - new Date(b.ts));

  const counts = { ALL: items.length, TOOL: 0, LLM: 0, AGENT: 0, INFO: 0, WARN: 0, ERROR: 0 };
  for (const item of items) counts[item.kind] = (counts[item.kind] || 0) + 1;

  return { items, counts, turnDurations };
}

/**
 * Aggregate one turn's *unfiltered* items into the summary shown on the
 * turn card, plus the [start, end] time window used by the waterfall.
 */
export function turnStats(list) {
  let start = null;
  let end = null;
  const stats = {
    llmCalls: 0, llmMs: 0, toolCalls: 0, toolFails: 0, errors: 0,
    inputTokens: 0, outputTokens: 0,
  };
  const models = new Set();
  for (const it of list) {
    const t = new Date(it.ts).getTime();
    const dur = it.span?.duration_ms || 0;
    if (start === null || t < start) start = t;
    if (end === null || t + dur > end) end = t + dur;
    if (it.kind === "LLM") {
      stats.llmCalls += 1;
      stats.llmMs += dur;
      const attrs = it.span?.attributes || {};
      const model = attrs["gen_ai.request.model"] ||
        (it.span?.name || "").replace(/^generate_content\s*/, "");
      if (model) models.add(String(model).split("/").pop());
      stats.inputTokens += Number(attrs["gen_ai.usage.input_tokens"]) || 0;
      stats.outputTokens += Number(attrs["gen_ai.usage.output_tokens"]) || 0;
    }
    if (it.kind === "TOOL") stats.toolCalls += 1;
    if (it.kind === "ERROR") {
      stats.errors += 1;
      if (it.span) {
        stats.toolCalls += 1;
        stats.toolFails += 1;
      }
    }
  }
  return { ...stats, models: [...models], window: { start, end } };
}

/**
 * Position an item inside its turn's waterfall track. Returns
 * { leftPct, widthPct } (widthPct 0 for instant events → rendered as a
 * dot), or null when the window is degenerate.
 */
export function waterfallGeometry(item, window) {
  if (window?.start == null || window?.end == null) return null;
  const span = window.end - window.start;
  if (span <= 0) return null;
  const t = new Date(item.ts).getTime();
  const dur = item.span?.duration_ms || 0;
  const leftPct = Math.min(((t - window.start) / span) * 100, 100);
  const widthPct = Math.min((dur / span) * 100, 100 - leftPct);
  return { leftPct: Math.max(leftPct, 0), widthPct };
}

export function itemToolName(item) {
  if (!item.span) return null;
  const attrs = item.span.attributes || {};
  if (attrs["gen_ai.operation.name"] === "execute_tool" ||
      (item.span.name || "").startsWith("execute_tool")) {
    return attrs["gen_ai.tool.name"] ||
      (item.span.name || "").replace(/^execute_tool\s*/, "");
  }
  return null;
}

export function itemModelName(item) {
  if (item.kind !== "LLM" || !item.span) return null;
  const model = item.span.attributes?.["gen_ai.request.model"] ||
    (item.span.name || "").replace(/^generate_content\s*/, "");
  return model ? String(model).split("/").pop() : null;
}

export const SLOW_THRESHOLD_MS = 1000;

/**
 * Free-text match over an item's non-sensitive metadata: labels, span
 * names, tool/model names, attribute keys and values, event names.
 * Message contents are elided upstream, so this searches what actually
 * exists: the structure.
 */
export function matchesSearch(item, search) {
  const q = (search || "").trim().toLowerCase();
  if (!q) return true;
  const hay = [
    item.label,
    item.span?.name,
    itemToolName(item),
    itemModelName(item),
    item.log?.event_name,
    item.log?.body,
  ];
  const attrs = (item.span || item.log)?.attributes;
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      hay.push(k, typeof v === "string" ? v : JSON.stringify(v));
    }
  }
  return hay.some((h) => h && String(h).toLowerCase().includes(q));
}

/** Secondary filter: { type: "tool"|"model"|"slow", value } or null. */
export function matchesSubFilter(item, subFilter) {
  if (!subFilter) return true;
  if (subFilter.type === "tool") return itemToolName(item) === subFilter.value;
  if (subFilter.type === "model") return itemModelName(item) === subFilter.value;
  if (subFilter.type === "slow") {
    return (item.span?.duration_ms || 0) > SLOW_THRESHOLD_MS;
  }
  return true;
}

/** Distinct sub-filter options present in the loaded items. */
export function subFilterOptions(items) {
  const tools = new Set();
  const models = new Set();
  let hasSlow = false;
  for (const item of items) {
    const tool = itemToolName(item);
    if (tool) tools.add(tool);
    const model = itemModelName(item);
    if (model) models.add(model);
    if ((item.span?.duration_ms || 0) > SLOW_THRESHOLD_MS) hasSlow = true;
  }
  return { tools: [...tools].sort(), models: [...models].sort(), hasSlow };
}

/**
 * Group items per turn (latest turn first, rows chronological inside),
 * apply the kind filter + optional sub-filter, collapse repeated redacted
 * events. Each turn carries `stats` computed from the UNFILTERED items,
 * so the summary card stays truthful whatever the active filter.
 */
export function buildTurns(items, filter, subFilter = null, search = "") {
  const byTurn = new Map();
  for (const item of items) {
    if (!byTurn.has(item.trace)) byTurn.set(item.trace, []);
    byTurn.get(item.trace).push(item);
  }
  return [...byTurn.entries()]
    .map(([traceId, list], i) => ({
      no: i + 1,
      traceId,
      stats: turnStats(list),
      items: collapseAgentRuns(
        list.filter((it) =>
          (filter === "ALL" || it.kind === filter ||
            (filter === "ERROR" && it.kind === "WARN")) &&
          matchesSubFilter(it, subFilter) &&
          matchesSearch(it, search),
        ),
      ),
    }))
    .filter((t) => t.items.length > 0)
    .reverse();
}

export function fmtTime(ts) {
  try {
    return new Date(ts).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return ts;
  }
}

export function fmtDuration(ms) {
  if (ms == null) return null;
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export function fmtJson(raw, max = 800) {
  try {
    const pretty = JSON.stringify(JSON.parse(raw), null, 2);
    return pretty.length > max ? `${pretty.slice(0, max)}…` : pretty;
  } catch {
    return String(raw).slice(0, max);
  }
}
