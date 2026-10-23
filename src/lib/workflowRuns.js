/**
 * The run history of a workflow (`GET /api/workflows/runs`), as the Runs
 * drawer shows it: which filter asks for which statuses, how a page is
 * requested and cut, and what a row says about its trigger and its failure.
 * Pure: no fetch, no React.
 */

export const RUN_FILTERS = ["all", "failures", "awaiting"];

const FILTER_STATUS = { all: null, failures: "error", awaiting: "awaiting" };

export const RUNS_PAGE_SIZE = 20;

/**
 * The `listWorkflowRuns` arguments for a filter and a 0-based page. One row
 * more than shown is asked for: its presence says there is a next page,
 * without the server having to count.
 */
export function runsQuery(workflowId, filter, page) {
  return {
    workflowId,
    status: FILTER_STATUS[filter] ?? null,
    limit: RUNS_PAGE_SIZE + 1,
    offset: page * RUNS_PAGE_SIZE,
  };
}

export function pageOf(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return { rows: list.slice(0, RUNS_PAGE_SIZE), hasMore: list.length > RUNS_PAGE_SIZE };
}

const TRIGGER_KINDS = new Set([
  "manual", "webhook", "schedule", "email", "simulated_email", "form", "file", "workflow_done", "agent_tool",
]);

/** The translation suffix of a run's trigger: a replay first, then its kind. */
export function runTriggerKey(run) {
  if (run?.replay_of) return "replay";
  return TRIGGER_KINDS.has(run?.trigger_kind) ? run.trigger_kind : "other";
}

/**
 * A failed run's error as `errorText` (the Test panel's translation) reads
 * it: the server's stable code and params when it recorded them, the raw
 * message otherwise.
 */
export function runError(run) {
  if (!run || run.status !== "error") return null;
  const structured = run.error || {};
  const error = { code: structured.code ?? null, detail: run.error_message || "", ref: structured.ref ?? null };
  if (structured.params && typeof structured.params === "object") error.params = structured.params;
  return error;
}

/**
 * The node a failure happened on, as `[topLevelId, innerId]` (`innerId` for a
 * node inside a loop or try body), or `null` when the run failed as a whole.
 */
export function runFailedNode(run) {
  // The engine names it (`failure_node`, the node « Retry here » restarts from).
  const nodeId = run?.status === "error" ? run.failure_node : null;
  if (!nodeId) return null;
  const dot = nodeId.indexOf(".");
  return dot === -1 ? [nodeId, null] : [nodeId.slice(0, dot), nodeId.slice(dot + 1)];
}

/**
 * A time sent by the engine. It sends ISO UTC ("2026-10-21T08:00:00.123+00:00"):
 * the offset is kept, so the browser shows its own local time. An older engine
 * sent "2026-10-21 10:00:00.123456" without zone, read as local time. Safari only
 * reads ISO with milliseconds, hence the cut.
 */
export function parseRunDate(value) {
  if (!value) return null;
  const iso = String(value).replace(" ", "T").replace(/(\.\d{3})\d+/, "$1");
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}
