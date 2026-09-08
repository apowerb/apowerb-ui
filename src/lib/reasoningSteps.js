/**
 * Reasoning trail — the ordered record of what an agent did during one turn.
 *
 * The streaming reducer keeps, next to the legacy `thinking` string and
 * `toolCalls` array, a `steps` array that preserves the REAL order of events:
 * a thought, then a tool call, then more thought, then the answer. The chat
 * renders that array as one collapsible timeline instead of a wall of text
 * followed by a stack of cards.
 *
 * A step:
 *   { id, kind: "thinking" | "tool" | "handoff",
 *     startedAt, endedAt?,
 *     text?                         (thinking)
 *     name?, args?, result?, status? (tool: running | done | error | interrupted)
 *     from?, to?, reason?           (handoff) }
 *
 * Pure functions only: the reducer and the tests call them with explicit
 * timestamps so nothing here reads the clock.
 */

let counter = 0;
function nextId(prefix) {
  counter += 1;
  return `${prefix}_${counter}_${Math.random().toString(36).slice(2, 7)}`;
}

function last(arr) {
  return arr.length ? arr[arr.length - 1] : null;
}

/** Append thinking text to the open thinking step, or open a new one. */
export function appendThinkingStep(steps = [], text, now) {
  if (!text) return steps;
  const tail = last(steps);
  if (tail && tail.kind === "thinking" && !tail.endedAt) {
    return [...steps.slice(0, -1), { ...tail, text: (tail.text || "") + text }];
  }
  return [...steps, { id: nextId("step"), kind: "thinking", text, startedAt: now }];
}

/** Close every step still open (thinking without endedAt, tool still running). */
export function closeOpenSteps(steps = [], now, { toolStatus = "done" } = {}) {
  let changed = false;
  const out = steps.map((s) => {
    if (s.kind === "thinking" && !s.endedAt) {
      changed = true;
      return { ...s, endedAt: now };
    }
    if (s.kind === "tool" && s.status === "running") {
      changed = true;
      return { ...s, status: toolStatus, endedAt: now };
    }
    return s;
  });
  return changed ? out : steps;
}

/** Close only the open thinking step — the answer or a tool call just began. */
export function closeThinkingStep(steps = [], now) {
  const tail = last(steps);
  if (tail && tail.kind === "thinking" && !tail.endedAt) {
    return [...steps.slice(0, -1), { ...tail, endedAt: now }];
  }
  return steps;
}

/** Register a tool call as a running step. */
export function addToolStep(steps = [], toolCall, now) {
  const closed = closeThinkingStep(steps, now);
  return [
    ...closed,
    {
      id: nextId("step"),
      kind: "tool",
      name: toolCall?.name || "tool",
      args: toolCall?.args || {},
      status: "running",
      startedAt: now,
    },
  ];
}

/** Heuristic: did the tool report a failure? */
export function isToolResultError(result) {
  if (result == null) return false;
  if (typeof result === "string") return /^\s*(error|exception|traceback)/i.test(result);
  if (typeof result !== "object") return false;
  if (result.error || result.exception) return true;
  if (result.success === false || result.ok === false) return true;
  if (typeof result.status === "string" && /^(error|failed|failure)$/i.test(result.status)) return true;
  return false;
}

/** Attach a result to the last running step of that tool name. */
export function setToolStepResult(steps = [], toolName, result, now) {
  for (let i = steps.length - 1; i >= 0; i--) {
    const s = steps[i];
    if (s.kind === "tool" && s.name === toolName && s.status === "running") {
      const status = isToolResultError(result) ? "error" : "done";
      const next = [...steps];
      next[i] = { ...s, result, status, endedAt: now };
      return next;
    }
  }
  return steps;
}

/** Register a hand-off between agents. */
export function addHandoffStep(steps = [], handoff, now) {
  const closed = closeThinkingStep(steps, now);
  return [
    ...closed,
    {
      id: nextId("step"),
      kind: "handoff",
      from: handoff?.from || "",
      to: handoff?.to || "",
      reason: handoff?.reason || "",
      startedAt: now,
      endedAt: now,
    },
  ];
}

/**
 * Older messages (or another front end) carry `thinking` / `toolCalls` /
 * `handoffs` without `steps`. Rebuild a plausible trail: thought first, then
 * the tools in call order, then hand-offs.
 */
export function deriveSteps(message) {
  if (!message) return [];
  if (Array.isArray(message.steps) && message.steps.length) return message.steps;
  const out = [];
  const t0 = message.meta?.startTime || message.timestamp || 0;
  if (typeof message.thinking === "string" && message.thinking.trim()) {
    out.push({ id: `${message.id}_thinking`, kind: "thinking", text: message.thinking, startedAt: t0, endedAt: t0 });
  }
  (message.toolCalls || []).forEach((tc, i) => {
    out.push({
      id: `${message.id}_tool_${i}`,
      kind: "tool",
      name: tc.name,
      args: tc.args || {},
      result: tc.result,
      status: tc.status || (tc.result === undefined ? (message.isStreaming ? "running" : "done") : isToolResultError(tc.result) ? "error" : "done"),
      startedAt: t0,
      endedAt: tc.result === undefined && message.isStreaming ? undefined : t0,
    });
  });
  (message.handoffs || []).forEach((h, i) => {
    out.push({ id: `${message.id}_handoff_${i}`, kind: "handoff", from: h.from, to: h.to, reason: h.reason, startedAt: t0, endedAt: t0 });
  });
  return out;
}

/**
 * The status a message should display. `message.status` wins when the reducer
 * set it; otherwise it is derived, which keeps conversations saved before
 * this field existed readable.
 *   streaming | done | empty | interrupted | error
 */
export function deriveMessageStatus(message) {
  if (!message) return "done";
  if (message.status) return message.status;
  if (message.isStreaming) return "streaming";
  if (message.error) return "error";
  if (message.role !== "assistant") return "done";
  const hasContent = typeof message.content === "string" && message.content.trim().length > 0;
  const hasCards = (message.actionCards || []).length > 0 || (message.integrationRequests || []).length > 0;
  const hasTools = (message.toolCalls || []).length > 0;
  if (!hasContent && !hasCards && !hasTools) return "empty";
  return "done";
}

/** Counts and elapsed time, for the one-line summary above the trail. */
export function summarizeSteps(steps = [], now) {
  let thinking = 0;
  let tools = 0;
  let toolErrors = 0;
  let handoffs = 0;
  let start = Infinity;
  let end = 0;
  let open = false;
  for (const s of steps) {
    if (s.kind === "thinking") thinking += 1;
    else if (s.kind === "tool") {
      tools += 1;
      if (s.status === "error") toolErrors += 1;
    } else if (s.kind === "handoff") handoffs += 1;
    if (typeof s.startedAt === "number") start = Math.min(start, s.startedAt);
    if (typeof s.endedAt === "number") end = Math.max(end, s.endedAt);
    else open = true;
  }
  const finish = open && typeof now === "number" ? Math.max(end, now) : end;
  const durationMs = start === Infinity || !finish ? 0 : Math.max(0, finish - start);
  return { total: steps.length, thinking, tools, toolErrors, handoffs, durationMs, open };
}

/** "850ms", "4.2s", "1m 05s" — one style everywhere in the trail. */
export function formatDuration(ms) {
  if (!ms || ms < 0) return "";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m}m ${String(s).padStart(2, "0")}s`;
}
