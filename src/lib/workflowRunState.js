/**
 * Pure reducer turning a stream of workflow-run SSE events (see
 * workflowSse.js) into UI-ready state: one timeline entry per top-level
 * node, and — for a `loop` or `try` node — its nested per-pass entries.
 *
 * A loop's inner nodes arrive as `node_id: "<loopId>.<innerId>"` with an
 * `iteration` field (0-based); a try's inner nodes arrive the same way but
 * with an `attempt` field (0-based) instead — same shape, same grouping
 * code, only the field name differs on the wire. This groups them under the
 * container's own timeline entry instead of flattening them into the
 * top-level list, so the execution panel can render "iteration 0 / 1 / 2 …"
 * (or "attempt 0 / 1 …") sub-rows.
 */

export function createRunState() {
  return { status: "idle", timeline: [], finalOutput: null, finalError: null, pendingDecision: null };
}

function splitNodeId(nodeId) {
  const dot = (nodeId || "").indexOf(".");
  if (dot === -1) return { topId: nodeId, innerId: null };
  return { topId: nodeId.slice(0, dot), innerId: nodeId.slice(dot + 1) };
}

function blankEntry(id) {
  return { id, status: "pending", type: null, duration: null, output: null, error: null, route: null, iterations: {}, capped: null, input: null, inputTruncated: null, toolCalls: null, asksQuestion: false, artifacts: null, reportedError: null, replayed: false };
}

function blankInner(innerId) {
  return { innerId, status: "pending", type: null, duration: null, output: null, error: null, route: null, input: null, inputTruncated: null, toolCalls: null, asksQuestion: false, artifacts: null, reportedError: null };
}

// A run that failed or was cancelled sends no node_complete for the nodes
// still running: without this they would keep spinning in the panel.
function settleRunning(timeline, status) {
  for (const entry of timeline) {
    if (entry.status === "running") entry.status = status;
    for (const [k, list] of Object.entries(entry.iterations)) {
      entry.iterations[k] = list.map((it) => (it.status === "running" ? { ...it, status } : it));
    }
  }
}

/** `applyRunEvent(state, evt) -> newState`. Never mutates `state`. */
export function applyRunEvent(state, evt) {
  const timeline = state.timeline.map((e) => ({ ...e, iterations: { ...e.iterations } }));
  const byId = {};
  for (const e of timeline) byId[e.id] = e;

  const getOrCreate = (id) => {
    if (!byId[id]) {
      const entry = blankEntry(id);
      byId[id] = entry;
      timeline.push(entry);
    }
    return byId[id];
  };

  let status = state.status;
  let finalOutput = state.finalOutput;
  let finalError = state.finalError;
  let pendingDecision = state.pendingDecision ?? null;

  switch (evt.event) {
    case "run_started":
      status = "running";
      pendingDecision = null;
      break;

    case "node_start":
    case "node_input":
    case "node_complete":
    case "node_error":
    case "route": {
      const { topId, innerId } = splitNodeId(evt.node_id);
      const top = getOrCreate(topId);
      if (innerId == null) {
        applyToEntry(top, evt);
      } else {
        if (top.status !== "error") top.status = "running";
        const iteration = evt.iteration ?? evt.attempt ?? 0;
        const list = (top.iterations[iteration] || []).slice();
        const idx = list.findIndex((it) => it.innerId === innerId);
        const inner = idx === -1 ? blankInner(innerId) : { ...list[idx] };
        applyToEntry(inner, evt);
        if (evt.event === "node_error") top.status = "error";
        if (idx === -1) list.push(inner);
        else list[idx] = inner;
        top.iterations = { ...top.iterations, [iteration]: list };
      }
      break;
    }

    case "loop_capped": {
      const top = getOrCreate(evt.node_id);
      top.capped = { max: evt.max_iterations, remaining: evt.remaining ?? null };
      break;
    }

    case "awaiting_input": {
      // The run is parked on a person's answer: not running, not over. The
      // decision node stays "awaiting" until a resume stream completes it.
      status = "awaiting";
      pendingDecision = {
        runId: evt.run_id ?? null,
        nodeId: evt.node_id,
        question: evt.question ?? "",
        mode: evt.mode,
        choices: Array.isArray(evt.choices) ? evt.choices : [],
        assignee: evt.assignee ?? null,
      };
      getOrCreate(evt.node_id).status = "awaiting";
      break;
    }

    case "done":
      status = "done";
      pendingDecision = null;
      finalOutput = evt.output;
      break;

    case "error":
      status = "error";
      pendingDecision = null;
      finalError = errorOf(evt);
      settleRunning(timeline, "error");
      break;

    case "cancelled":
      status = "cancelled";
      pendingDecision = null;
      settleRunning(timeline, "cancelled");
      break;

    default:
      break;
  }

  return { status, timeline, finalOutput, finalError, pendingDecision };
}

/**
 * An error event as the panel needs it: the server's stable `code` (translated
 * by the panel), its English `detail` as a fallback, and the log `ref`.
 */
function errorOf(evt) {
  const error = { code: evt.code ?? null, detail: evt.detail ?? "", ref: evt.ref ?? null };
  if (evt.params && typeof evt.params === "object") error.params = evt.params;
  // invalid_graph: the rule the graph broke, translated like a run error.
  if (evt.cause) error.cause = evt.cause;
  return error;
}

/**
 * What a node received (`node_input`, repeated on `node_complete` /
 * `node_error`) and, for an agent, the tools it called. An event without the
 * field keeps what an earlier one brought.
 */
function applyTrace(entry, evt) {
  if (evt.input !== undefined) {
    entry.input = evt.input;
    entry.inputTruncated = evt.input_truncated ? { length: evt.input_length ?? null } : null;
  }
  if (Array.isArray(evt.tool_calls)) entry.toolCalls = evt.tool_calls;
}

function applyToEntry(entry, evt) {
  applyTrace(entry, evt);
  // A node the engine re-emits on resume, to rebuild the run: already done
  // before the person answered.
  if (evt.replayed === true) entry.replayed = true;
  switch (evt.event) {
    case "node_start":
      entry.status = "running";
      if (evt.type) entry.type = evt.type;
      break;
    case "node_complete":
      entry.status = "done";
      entry.output = evt.output;
      entry.duration = evt.duration_ms ?? null;
      // The agent's reply ended on a question nobody in a run will answer.
      entry.asksQuestion = evt.asks_question === true;
      // Charts, dashboards… the node created, to show them where they were made.
      entry.artifacts = Array.isArray(evt.artifacts) && evt.artifacts.length > 0 ? evt.artifacts : null;
      // A tool in continue mode that reported an error: the flow went on anyway.
      entry.reportedError = evt.reported_error ?? null;
      break;
    case "node_error":
      entry.status = "error";
      entry.error = errorOf(evt);
      break;
    case "route":
      entry.route = evt.route;
      break;
    default:
      break;
  }
}

/** `{ [topLevelNodeId]: "running"|"done"|"error" }` — what the canvas needs to color nodes live. */
export function runStatusByNodeId(runState) {
  const map = {};
  for (const entry of runState.timeline) map[entry.id] = entry.status;
  return map;
}
