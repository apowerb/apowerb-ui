"use client";

import { useEffect, useState } from "react";
import { Play, Square, ChevronDown, ChevronUp, ChevronRight, Loader2, CheckCircle2, XCircle, Circle } from "lucide-react";
import { useTranslations } from "use-intl";
import PayloadEditor from "./PayloadEditor";
import ReplayControls from "./ReplayControls";
import ChartRenderer from "@/components/bi/ChartRenderer";

const STATUS_ICON = { running: Loader2, done: CheckCircle2, error: XCircle, pending: Circle, cancelled: XCircle };
const STATUS_COLOR = { running: "text-purple-300", done: "text-blue-400", error: "text-red-400", pending: "th-text-ghost", cancelled: "text-amber-400" };

function StatusIcon({ status, size = 13 }) {
  const Icon = STATUS_ICON[status] || Circle;
  return <Icon size={size} className={`${STATUS_COLOR[status] || "th-text-ghost"} ${status === "running" ? "animate-spin" : ""}`} />;
}

const PRE_CLASS = "mt-1 p-2 rounded-lg th-bg-elevated border th-border-secondary text-[10px] font-mono th-text-secondary overflow-x-auto max-h-40 overflow-y-auto whitespace-pre-wrap break-words";

function asText(value) {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function Disclosure({ label, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mt-1">
      <button type="button" onClick={() => setOpen(!open)} className="text-[10px] font-medium th-text-ghost hover:th-text-faint flex items-center gap-0.5">
        <ChevronRight size={10} className={open ? "rotate-90" : ""} />
        {label(open)}
      </button>
      {open && children}
    </div>
  );
}

function QuestionWarning({ show, t }) {
  if (!show) return null;
  return <p className="text-[10px] text-amber-400 mt-0.5">{t("asksQuestion")}</p>;
}

// Text or JSON: what the next node will read, and what `{{id.field}}` can
// reach (a field exists only in a JSON output).
function OutputType({ value, t }) {
  const json = value !== null && typeof value === "object";
  return (
    <span data-testid="output-type" className="ml-1 px-1 rounded th-bg-surface th-text-faint font-mono">
      {json ? t("outputTypeJson") : t("outputTypeText")}
    </span>
  );
}

function OutputBlock({ value, t, defaultOpen = false }) {
  if (value == null) return null;
  return (
    <Disclosure
      defaultOpen={defaultOpen}
      label={(open) => (
        <>
          {open ? t("hideOutput") : t("showOutput")}
          <OutputType value={value} t={t} />
        </>
      )}
    >
      <pre className={PRE_CLASS}>{asText(value) || t("noOutput")}</pre>
    </Disclosure>
  );
}

// What the node received: the rendered Input of an agent, the arguments of a
// tool. An empty Input sends only the previous node's output, without the
// original request, and this is where the user can see it.
function InputBlock({ value, truncated, t }) {
  if (value == null) return null;
  return (
    <Disclosure label={(open) => (open ? t("hideInput") : t("showInput"))}>
      <pre className={PRE_CLASS}>{asText(value) || t("noOutput")}</pre>
      {truncated && truncated.length != null && <p className="mt-0.5 text-[10px] th-text-ghost">{t("inputTruncated", { length: truncated.length })}</p>}
    </Disclosure>
  );
}

function ToolCallsBlock({ calls, t }) {
  if (!calls || calls.length === 0) return null;
  return (
    <Disclosure label={() => t("toolCalls", { count: calls.length })}>
      <ol className="mt-1 space-y-1.5">
        {calls.map((call, i) => (
          <li key={i} className="pl-2 border-l th-border-secondary">
            <p className="text-[10px] font-semibold font-mono th-text-secondary">{call.name}</p>
            <pre className={PRE_CLASS}>{asText(call.args ?? {})}</pre>
            {call.result != null ? (
              <pre className={PRE_CLASS}>{asText(call.result)}</pre>
            ) : (
              <p className="text-[10px] th-text-ghost">{t("toolNoResult")}</p>
            )}
            {(call.args_truncated || call.result_truncated) && <p className="text-[10px] th-text-ghost">{t("toolCallTruncated")}</p>}
          </li>
        ))}
      </ol>
    </Disclosure>
  );
}

// What a node created while it ran: a chart is drawn right here, a dashboard
// or a dataset is linked. Without it an agent "talks about" a chart nobody
// can see.
function ArtifactsBlock({ artifacts, t }) {
  if (!artifacts || artifacts.length === 0) return null;
  return (
    <div className="mt-1 space-y-1.5">
      {artifacts.map((a, i) => {
        const chartId = a.chart_id ?? a.forecast_chart_id;
        if (chartId != null) {
          return (
            <div key={i} className="h-56 rounded-lg border th-border-secondary th-bg-elevated overflow-hidden p-1">
              <ChartRenderer chartId={String(chartId)} />
            </div>
          );
        }
        if (a.dashboard_id != null) {
          return (
            <a key={i} href={`/bi/${a.dashboard_id}`} target="_blank" rel="noreferrer" className="block text-[10px] font-semibold text-brand underline">
              {t("openDashboard")}
            </a>
          );
        }
        if (a.dataset_id != null) {
          return <p key={i} className="text-[10px] th-text-faint">{t("artifactDataset", { id: String(a.dataset_id) })}</p>;
        }
        return null;
      })}
    </div>
  );
}

function ReportedError({ message, t }) {
  if (!message) return null;
  return <p className="text-[10px] text-amber-400 mt-0.5">{t("toolReportedError", { message })}</p>;
}

// Codes the server sends for failures whose cause stays in its logs: the panel
// words them itself, with the reference to quote. Other codes (the studio's
// own written errors) are shown as the server wrote them.
const TRANSLATED_ERRORS = new Set([
  "internal",
  // Set by the studio itself when the run request never reached the server.
  "server_unreachable",
  "model_provider_auth",
  "model_provider_rate_limit",
  "model_provider_unavailable",
  "no_output",
  // Errors the user can fix: worded with the node or tool and what to do.
  "tool_arguments",
  "tool_not_found",
  "tool_ambiguous",
  "tool_needs_agent_context",
  "agent_not_found",
  "no_route",
  "classifier_no_route",
  "loop_items_not_list",
  "convert_failed",
  "template_ref_invalid",
  // a template that grows past the engine limit once rendered (21/10).
  "render_too_large",
  // http / notification nodes (LOT 3, 21/09).
  "http_url_refused",
  "http_response_too_large",
  "http_timeout",
  "http_failed",
  "http_header_forbidden",
  "notification_rate_limited",
  "notification_bad_recipient",
  "teams_not_configured",
  "teams_failed",
  "extract_failed",
  "rag_no_knowledge",
  "rag_failed",
  "subworkflow_not_found",
  "subworkflow_cycle",
  "subworkflow_too_deep",
  // refused before the run (validation), 22/09.
  "single_trigger",
  // what a node promised to return (21/10).
  "output_type_mismatch",
  "agent_asked_question",
  "node_not_runnable",
]);

function errorText(t, error) {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (error.code === "invalid_graph" && TRANSLATED_ERRORS.has(error.cause)) {
    error = { ...error, code: error.cause };
  }
  if (error.code && TRANSLATED_ERRORS.has(error.code)) {
    const params = { ...error.params, ref: error.ref ?? "-" };
    // ICU's `select` needs a matched keyword, not the bare JS value — a
    // param the server sends as `null` (e.g. teams_failed.status when the
    // webhook never got a response) must become the string "null" or
    // intl-messageformat throws instead of falling into the `null {}`
    // branch. Mirrors the `remaining ?? "null"` fix already used for
    // loopCapped below.
    for (const key of Object.keys(params)) {
      if (params[key] === null) params[key] = "null";
    }
    return t(`runError_${error.code}`, params);
  }
  return error.detail || t("statusError");
}

function IterationRow({ innerId, status, duration, output, error, route, input, inputTruncated, toolCalls, asksQuestion, artifacts, reportedError, t }) {
  return (
    <div className="flex items-start gap-1.5 py-1 pl-3 border-l th-border-secondary">
      <StatusIcon status={status} size={11} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="th-text-secondary font-mono truncate">{innerId}</span>
          {duration != null && <span className="th-text-ghost shrink-0">{t("duration", { ms: duration })}</span>}
        </div>
        {route && <p className="text-[10px] th-text-ghost">{t("routeTaken", { route })}</p>}
        {error && <p className="text-[10px] text-red-400">{errorText(t, error)}</p>}
        <QuestionWarning show={asksQuestion} t={t} />
        <InputBlock value={input} truncated={inputTruncated} t={t} />
        <ToolCallsBlock calls={toolCalls} t={t} />
        <OutputBlock value={output} t={t} />
        <ArtifactsBlock artifacts={artifacts} t={t} />
        <ReportedError message={reportedError} t={t} />
      </div>
    </div>
  );
}

function TimelineEntry({ entry, label, t }) {
  const [open, setOpen] = useState(true);
  const iterationKeys = Object.keys(entry.iterations || {});
  return (
    <div className="py-2 border-b th-border-secondary last:border-b-0">
      <div className="flex items-start gap-2">
        <StatusIcon status={entry.status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-semibold th-text truncate">{label || entry.id}</span>
            {label && label !== entry.id && <span className="th-text-ghost font-mono text-[10px] truncate">{entry.id}</span>}
            {entry.duration != null && <span className="th-text-ghost text-[10px] shrink-0">{t("duration", { ms: entry.duration })}</span>}
          </div>
          {entry.route && <p className="text-[10px] th-text-ghost mt-0.5">{t("routeTaken", { route: entry.route })}</p>}
          {entry.error && <p className="text-[10px] text-red-400 mt-0.5">{errorText(t, entry.error)}</p>}
          {entry.capped && (
            <p className="text-[10px] text-amber-400 mt-0.5">
              {t("loopCapped", { max: entry.capped.max, remaining: entry.capped.remaining ?? "null" })}
            </p>
          )}
          <QuestionWarning show={entry.asksQuestion} t={t} />
          <InputBlock value={entry.input} truncated={entry.inputTruncated} t={t} />
          <ToolCallsBlock calls={entry.toolCalls} t={t} />
          <OutputBlock value={entry.output} t={t} />
          <ArtifactsBlock artifacts={entry.artifacts} t={t} />
          <ReportedError message={entry.reportedError} t={t} />
          {iterationKeys.length > 0 && (
            <div className="mt-1.5">
              <button type="button" onClick={() => setOpen(!open)} className="text-[10px] font-semibold th-text-faint hover:th-text-secondary flex items-center gap-0.5 mb-1">
                <ChevronRight size={10} className={open ? "rotate-90" : ""} />
                {iterationKeys.length}
              </button>
              {open && iterationKeys.map((k) => (
                <div key={k} className="mb-1.5">
                  <p className="text-[10px] font-semibold th-text-faint mb-0.5">
                    {t(entry.type === "try" ? "attempt" : "iteration", { index: k })}
                  </p>
                  {entry.iterations[k].map((inner) => (
                    <IterationRow key={inner.innerId} {...inner} t={t} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Bottom test panel: payload editor, run/cancel, live per-node timeline.
 * `runState` is the pure reducer's output (src/lib/workflowRunState.js) —
 * this component only renders it.
 */
export default function ExecutionPanel({
  open,
  onToggle,
  payloadText,
  onPayloadTextChange,
  payloadError,
  payloadInitialMode,
  isRunning,
  runState,
  replay,
  onRun,
  onCancel,
  nodeLabels = {},
}) {
  const t = useTranslations("WorkflowExecutionPanel");

  return (
    <div className={`shrink-0 border-t th-border-secondary th-bg-sidebar flex flex-col ${open ? "h-80" : "h-11"} transition-[height] duration-200`}>
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center justify-between px-4 h-11 shrink-0 text-left"
      >
        <span className="text-xs font-bold th-text flex items-center gap-2">
          {t("title")}
          {runState.status !== "idle" && (
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold th-bg-surface ${STATUS_COLOR[runState.status] || "th-text-ghost"}`}>
              {t(`status${capitalize(runState.status)}`)}
            </span>
          )}
        </span>
        {open ? <ChevronDown size={16} className="th-text-ghost" /> : <ChevronUp size={16} className="th-text-ghost" />}
      </button>

      {open && (
        <div className="flex-1 min-h-0 flex overflow-hidden">
          <div className="w-72 shrink-0 border-r th-border-secondary p-3 flex flex-col overflow-y-auto">
            <p className="text-[11px] font-semibold th-text-secondary mb-1">{t("payloadTitle")}</p>
            <PayloadEditor value={payloadText} onChange={onPayloadTextChange} error={payloadError} initialMode={payloadInitialMode} t={t} />
            <div className="mt-2 flex gap-2">
              {isRunning ? (
                <button type="button" onClick={onCancel} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-500/15 text-red-300 hover:bg-red-500/25 border border-red-500/30">
                  <Square size={12} />
                  {t("cancel")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onRun}
                  disabled={!!payloadError}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-linear-to-r from-brand to-brand-secondary text-white hover:opacity-90 disabled:opacity-40"
                >
                  <Play size={12} />
                  {t("run")}
                </button>
              )}
            </div>
            {replay && replay.total > 0 && !isRunning && <ReplayControls replay={replay} t={t} />}
            {runState.status === "error" && runState.finalError && (
              <p className="mt-2 text-[11px] text-red-400">
                {t("errorDetail")}: {errorText(t, runState.finalError)}
                {runState.finalError.code === "server_unreachable" && (
                  <button type="button" onClick={onRun} className="ml-2 underline font-semibold hover:opacity-80">
                    {t("retry")}
                  </button>
                )}
              </p>
            )}
            {runState.status === "done" && (
              <div className="mt-2">
                <p className="text-[11px] font-semibold th-text-secondary mb-1">{t("finalOutput")}</p>
                <OutputBlock value={runState.finalOutput} t={t} defaultOpen />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 overflow-y-auto px-3">
            {runState.timeline.length === 0 ? (
              <p className="text-xs th-text-ghost text-center py-8">{t("statusIdle")}</p>
            ) : (
              runState.timeline.map((entry) => <TimelineEntry key={entry.id} entry={entry} label={nodeLabels[entry.id]} t={t} />)
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
