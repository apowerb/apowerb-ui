"use client";

import { useEffect, useState } from "react";
import { X, Loader2, CheckCircle2, XCircle, UserCheck, Circle, ChevronRight } from "lucide-react";
import { useTranslations, useFormatter } from "use-intl";
import { listWorkflowRuns } from "@/lib/api";
import { RUN_FILTERS, runsQuery, pageOf, runTriggerKey, runError, runFailedNode, parseRunDate } from "@/lib/workflowRuns";
import { errorText } from "./ExecutionPanel";

const STATUS_ICON = { success: CheckCircle2, error: XCircle, cancelled: XCircle, awaiting: UserCheck, running: Loader2 };
const STATUS_COLOR = { success: "text-blue-400", error: "text-red-400", cancelled: "text-amber-400", awaiting: "text-purple-400", running: "text-purple-300" };

function duration(ms, t) {
  if (ms == null) return null;
  return ms < 1000 ? t("durationMs", { ms }) : t("durationS", { seconds: Math.round(ms / 100) / 10 });
}

function RunRow({ run, nodeLabels, onOpen, opening, t, tx }) {
  const format = useFormatter();
  const Icon = STATUS_ICON[run.status] || Circle;
  const when = parseRunDate(run.created_at);
  const failed = runFailedNode(run);
  const error = runError(run);
  const nodeName = failed ? [nodeLabels[failed[0]] || failed[0], failed[1]].filter(Boolean).join(" › ") : null;

  return (
    <li data-testid={`run-row-${run.run_id}`}>
      <button
        type="button"
        onClick={() => onOpen(run)}
        disabled={opening}
        aria-label={t("openRun", { id: run.run_id })}
        className="w-full text-left p-3 rounded-xl th-bg-surface border th-border-secondary hover:th-border-hover disabled:opacity-60 flex items-start gap-2"
      >
        <Icon size={14} className={`mt-0.5 shrink-0 ${STATUS_COLOR[run.status] || "th-text-ghost"} ${run.status === "running" ? "animate-spin" : ""}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className={`font-semibold ${STATUS_COLOR[run.status] || "th-text-secondary"}`}>{t(`status_${run.status}`)}</span>
            <span className="th-text-ghost">·</span>
            <span className="th-text-secondary">{t(`trigger_${runTriggerKey(run)}`)}</span>
            {run.duration_ms != null && (
              <>
                <span className="th-text-ghost">·</span>
                <span className="th-text-ghost">{duration(run.duration_ms, t)}</span>
              </>
            )}
          </div>
          {when && <p className="text-[10px] th-text-ghost mt-0.5">{format.dateTime(when, { dateStyle: "medium", timeStyle: "medium" })}</p>}
          {nodeName && <p className="text-[11px] th-text-secondary mt-1">{t("failedAt", { node: nodeName })}</p>}
          {error && <p className="text-[11px] text-red-400 mt-0.5 break-words">{errorText(tx, error)}</p>}
          {run.status === "awaiting" && run.decision?.question && (
            <p className="text-[11px] th-text-secondary mt-1 break-words">{run.decision.question}</p>
          )}
        </div>
        {opening ? <Loader2 size={13} className="animate-spin th-text-ghost shrink-0" /> : <ChevronRight size={13} className="th-text-ghost shrink-0" />}
      </button>
    </li>
  );
}

/**
 * The runs of one workflow, newest first: filter (All / Failures / Awaiting),
 * page, and open one — `onOpenRun(run)` loads it into the Test panel's
 * replay; it rejects with `code: "trace_unavailable"` for a run recorded
 * before its steps were kept.
 */
export default function RunsDrawer({ workflowId, nodeLabels = {}, onClose, onOpenRun }) {
  const t = useTranslations("WorkflowRuns");
  const tx = useTranslations("WorkflowExecutionPanel");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(0);
  // The answer is kept with the query it answers: a stale page shows as loading.
  const [result, setResult] = useState({ key: null, data: null, error: null });
  const [openingId, setOpeningId] = useState(null);
  const [openError, setOpenError] = useState(null);
  const key = `${workflowId}|${filter}|${page}`;
  const data = result.key === key ? result.data : null;
  const error = result.key === key ? result.error : null;

  useEffect(() => {
    let cancelled = false;
    listWorkflowRuns(runsQuery(workflowId, filter, page))
      .then((rows) => { if (!cancelled) setResult({ key, data: pageOf(rows), error: null }); })
      .catch((err) => { if (!cancelled) setResult({ key, data: null, error: err.message || "-" }); });
    return () => { cancelled = true; };
  }, [key, workflowId, filter, page]);

  const pickFilter = (next) => {
    setFilter(next);
    setPage(0);
    setOpenError(null);
  };

  const open = async (run) => {
    setOpeningId(run.run_id);
    setOpenError(null);
    try {
      await onOpenRun(run);
    } catch (err) {
      setOpenError(err?.code === "trace_unavailable" ? t("traceUnavailable") : t("openFailed", { message: err?.message || "-" }));
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="runs-drawer-title">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-[26rem] max-w-full h-full th-bg-modal border-l th-border-secondary flex flex-col shadow-2xl">
        <div className="p-4 border-b th-border-secondary flex items-start justify-between">
          <div>
            <h3 id="runs-drawer-title" className="text-sm font-bold th-text">{t("title")}</h3>
            <p className="text-xs th-text-ghost mt-0.5">{t("subtitle")}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t("close")} className="p-1 rounded-lg th-text-ghost hover:th-text">
            <X size={16} />
          </button>
        </div>

        <div role="tablist" aria-label={t("filtersLabel")} className="px-3 pt-3 flex gap-1.5">
          {RUN_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              onClick={() => pickFilter(f)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${filter === f ? "bg-brand/15 text-[#5B8AFF] border-brand/30" : "th-text-secondary th-border-secondary hover:th-bg-surface-hover"}`}
            >
              {t(`filter_${f}`)}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {openError && <p role="alert" className="text-xs text-amber-400 p-2 mb-2 rounded-lg bg-amber-500/10 border border-amber-500/30">{openError}</p>}
          {error && <p className="text-xs text-red-400 p-2">{t("loadFailed", { message: error })}</p>}
          {data === null && !error && (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={18} className="animate-spin th-text-ghost" />
            </div>
          )}
          {data && data.rows.length === 0 && <p className="text-xs th-text-ghost p-2">{t(`empty_${filter}`)}</p>}
          {data && data.rows.length > 0 && (
            <ul className="flex flex-col gap-2">
              {data.rows.map((run) => (
                <RunRow key={run.run_id} run={run} nodeLabels={nodeLabels} onOpen={open} opening={openingId === run.run_id} t={t} tx={tx} />
              ))}
            </ul>
          )}
        </div>

        <div className="p-3 border-t th-border-secondary flex items-center justify-between gap-2">
          <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="px-2.5 py-1 rounded-lg text-xs font-medium th-text-secondary border th-border-secondary hover:th-bg-surface-hover disabled:opacity-40">
            {t("previous")}
          </button>
          <span className="text-[11px] th-text-ghost">{t("page", { page: page + 1 })}</span>
          <button type="button" onClick={() => setPage((p) => p + 1)} disabled={!data?.hasMore} className="px-2.5 py-1 rounded-lg text-xs font-medium th-text-secondary border th-border-secondary hover:th-bg-surface-hover disabled:opacity-40">
            {t("next")}
          </button>
        </div>
      </div>
    </div>
  );
}
