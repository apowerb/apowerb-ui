"use client";

import { useEffect, useState } from "react";
import { Play, Square, ChevronDown, ChevronUp, ChevronRight, Loader2, CheckCircle2, XCircle, Circle } from "lucide-react";
import { useTranslations } from "use-intl";
import PayloadEditor from "./PayloadEditor";
import ReplayControls from "./ReplayControls";

const STATUS_ICON = { running: Loader2, done: CheckCircle2, error: XCircle, pending: Circle, cancelled: XCircle };
const STATUS_COLOR = { running: "text-purple-300", done: "text-blue-400", error: "text-red-400", pending: "th-text-ghost", cancelled: "text-amber-400" };

function StatusIcon({ status, size = 13 }) {
  const Icon = STATUS_ICON[status] || Circle;
  return <Icon size={size} className={`${STATUS_COLOR[status] || "th-text-ghost"} ${status === "running" ? "animate-spin" : ""}`} />;
}

function OutputBlock({ value, t }) {
  const [open, setOpen] = useState(false);
  if (value == null) return null;
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return (
    <div className="mt-1">
      <button type="button" onClick={() => setOpen(!open)} className="text-[10px] font-medium th-text-ghost hover:th-text-faint flex items-center gap-0.5">
        <ChevronRight size={10} className={open ? "rotate-90" : ""} />
        {open ? t("hideOutput") : t("showOutput")}
      </button>
      {open && (
        <pre className="mt-1 p-2 rounded-lg th-bg-elevated border th-border-secondary text-[10px] font-mono th-text-secondary overflow-x-auto max-h-40 overflow-y-auto whitespace-pre-wrap break-words">
          {text || t("noOutput")}
        </pre>
      )}
    </div>
  );
}

// Codes the server sends for failures whose cause stays in its logs: the panel
// words them itself, with the reference to quote. Other codes (the studio's
// own written errors) are shown as the server wrote them.
const TRANSLATED_ERRORS = new Set([
  "internal",
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
  // http / notification nodes (LOT 3, 21/09).
  "http_url_refused",
  "http_response_too_large",
  "http_timeout",
  "http_failed",
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
]);

function errorText(t, error) {
  if (!error) return "";
  if (typeof error === "string") return error;
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

function IterationRow({ innerId, status, duration, output, error, route, t }) {
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
        <OutputBlock value={output} t={t} />
      </div>
    </div>
  );
}

function TimelineEntry({ entry, t }) {
  const [open, setOpen] = useState(true);
  const iterationKeys = Object.keys(entry.iterations || {});
  return (
    <div className="py-2 border-b th-border-secondary last:border-b-0">
      <div className="flex items-start gap-2">
        <StatusIcon status={entry.status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-semibold th-text truncate">{entry.id}</span>
            {entry.duration != null && <span className="th-text-ghost text-[10px] shrink-0">{t("duration", { ms: entry.duration })}</span>}
          </div>
          {entry.route && <p className="text-[10px] th-text-ghost mt-0.5">{t("routeTaken", { route: entry.route })}</p>}
          {entry.error && <p className="text-[10px] text-red-400 mt-0.5">{errorText(t, entry.error)}</p>}
          {entry.capped && (
            <p className="text-[10px] text-amber-400 mt-0.5">
              {t("loopCapped", { max: entry.capped.max, remaining: entry.capped.remaining ?? "null" })}
            </p>
          )}
          <OutputBlock value={entry.output} t={t} />
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
  isRunning,
  runState,
  replay,
  onRun,
  onCancel,
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
            <PayloadEditor value={payloadText} onChange={onPayloadTextChange} error={payloadError} t={t} />
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
              <p className="mt-2 text-[11px] text-red-400">{t("errorDetail")}: {errorText(t, runState.finalError)}</p>
            )}
            {runState.status === "done" && (
              <div className="mt-2">
                <p className="text-[11px] font-semibold th-text-secondary mb-1">{t("finalOutput")}</p>
                <OutputBlock value={runState.finalOutput} t={t} />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 overflow-y-auto px-3">
            {runState.timeline.length === 0 ? (
              <p className="text-xs th-text-ghost text-center py-8">{t("statusIdle")}</p>
            ) : (
              runState.timeline.map((entry) => <TimelineEntry key={entry.id} entry={entry} t={t} />)
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
