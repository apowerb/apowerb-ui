/**
 * Pure reducer turning a stream of workflow-run SSE events (see
 * workflowSse.js) into UI-ready state: one timeline entry per top-level
 * node, and — for a `loop` node — its nested per-iteration entries.
 *
 * A loop's inner nodes arrive as `node_id: "<loopId>.<innerId>"` with an
 * `iteration` field (0-based); this groups them under the loop's own
 * timeline entry instead of flattening them into the top-level list, so the
 * execution panel can render "iteration 0 / 1 / 2 …" sub-rows.
 */

export function createRunState() {
  return { status: "idle", timeline: [], finalOutput: null, finalError: null };
}

function splitNodeId(nodeId) {
  const dot = (nodeId || "").indexOf(".");
  if (dot === -1) return { topId: nodeId, innerId: null };
  return { topId: nodeId.slice(0, dot), innerId: nodeId.slice(dot + 1) };
}

function blankEntry(id) {
  return { id, status: "pending", type: null, duration: null, output: null, error: null, route: null, iterations: {}, capped: null };
}

function blankInner(innerId) {
  return { innerId, status: "pending", type: null, duration: null, output: null, error: null, route: null };
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

  switch (evt.event) {
    case "run_started":
      status = "running";
      break;

    case "node_start":
    case "node_complete":
    case "node_error":
    case "route": {
      const { topId, innerId } = splitNodeId(evt.node_id);
      const top = getOrCreate(topId);
      if (innerId == null) {
        applyToEntry(top, evt);
      } else {
        if (top.status !== "error") top.status = "running";
        const iteration = evt.iteration ?? 0;
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

    case "done":
      status = "done";
      finalOutput = evt.output;
      break;

    case "error":
      status = "error";
      finalError = errorOf(evt);
      break;

    case "cancelled":
      status = "cancelled";
      break;

    default:
      break;
  }

  return { status, timeline, finalOutput, finalError };
}

/**
 * An error event as the panel needs it: the server's stable `code` (translated
 * by the panel), its English `detail` as a fallback, and the log `ref`.
 */
function errorOf(evt) {
  return { code: evt.code ?? null, detail: evt.detail ?? "", ref: evt.ref ?? null };
}

function applyToEntry(entry, evt) {
  switch (evt.event) {
    case "node_start":
      entry.status = "running";
      if (evt.type) entry.type = evt.type;
      break;
    case "node_complete":
      entry.status = "done";
      entry.output = evt.output;
      entry.duration = evt.duration_ms ?? null;
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
