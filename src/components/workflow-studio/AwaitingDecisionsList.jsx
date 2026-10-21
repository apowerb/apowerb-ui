"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, UserCheck } from "lucide-react";
import { useTranslations, useFormatter } from "use-intl";
import { Link } from "@/lib/navigation";
import { listAwaitingDecisions, abandonWorkflowRun } from "@/lib/api";
import DecisionModal from "./DecisionModal";

/** A row of `GET /api/workflows/runs/awaiting`, as the modal and the run state name it. */
export function decisionFromRow(row) {
  return {
    runId: row.run_id,
    workflowId: row.workflow_id,
    workflowName: row.workflow_name,
    nodeId: row.node_id,
    question: row.question,
    mode: row.mode,
    choices: row.choices || [],
    assignee: row.assignee ?? null,
    pausedAt: row.paused_at ?? null,
  };
}

function Row({ item, onReply, onAbandoned, showWorkflow, replyHref, t }) {
  const format = useFormatter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const abandon = async () => {
    setBusy(true);
    setError(null);
    try {
      await abandonWorkflowRun(item.runId);
      onAbandoned(item);
    } catch (err) {
      setError(err?.message || "-");
      setBusy(false);
    }
  };

  const when = item.pausedAt ? format.dateTime(new Date(item.pausedAt), { dateStyle: "short", timeStyle: "short" }) : null;
  const replyClass = "px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-linear-to-r from-brand to-brand-secondary text-white hover:opacity-90";

  return (
    <li className="py-2.5 border-b th-border-secondary last:border-b-0">
      <div className="flex items-start gap-2">
        <UserCheck size={13} className="mt-0.5 text-purple-400 shrink-0" />
        <div className="flex-1 min-w-0">
          {showWorkflow && <p className="text-[11px] font-semibold th-text-secondary truncate">{item.workflowName}</p>}
          <p className="text-xs th-text break-words">{item.question}</p>
          {when && <p className="text-[10px] th-text-ghost mt-0.5">{t("since", { when: String(when) })}</p>}
          {error && <p role="alert" className="text-[10px] text-red-400 mt-1">{t("abandonFailed", { message: error })}</p>}
          {confirming ? (
            <div className="mt-1.5">
              <p className="text-[10px] text-red-300 mb-1">{t("abandonConfirm")}</p>
              <div className="flex gap-1.5">
                <button type="button" disabled={busy} onClick={abandon} className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50">
                  {busy ? t("abandoning") : t("abandonYes")}
                </button>
                <button type="button" disabled={busy} onClick={() => setConfirming(false)} className="px-2 py-1 text-[11px] font-medium rounded-lg th-bg-elevated th-text-secondary">
                  {t("abandonKeep")}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-1.5 flex gap-1.5">
              {onReply ? (
                <button type="button" onClick={() => onReply(item)} className={replyClass}>{t("reply")}</button>
              ) : (
                <Link href={replyHref} className={replyClass}>{t("reply")}</Link>
              )}
              <button type="button" onClick={() => setConfirming(true)} className="px-2 py-1 text-[11px] font-medium rounded-lg th-text-secondary border th-border-secondary hover:th-bg-surface-hover">
                {t("abandon")}
              </button>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

/**
 * "Waiting for a decision": the runs parked on a person's answer, reopened
 * from here once the tab that started them is gone.
 *
 * - `workflowId` keeps only that workflow's runs (the studio); without it the
 *   list is every workflow's (the workflows page).
 * - `onAnswer(decision, {choice}|{text})` resumes the run (throws the API
 *   error for the modal to show). Without it (the workflows page), Reply links
 *   to the studio, which opens the decision there and plays the resumption.
 * - `refreshKey` reloads the list (a run just parked, or resumed).
 * - `hideWhenEmpty` renders nothing while no decision waits (the workflows page).
 * - `className` spaces the section (default: the panel's).
 */
export default function AwaitingDecisionsList({ workflowId, onAnswer, onAbandoned, refreshKey, hideWhenEmpty = false, className = "mt-3" }) {
  const t = useTranslations("WorkflowDecision");
  const [items, setItems] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [open, setOpen] = useState(null);

  const load = useCallback(
    () =>
      Promise.resolve(listAwaitingDecisions())
        .then((rows) => {
          setLoadError(null);
          setItems((Array.isArray(rows) ? rows : []).map(decisionFromRow));
        })
        .catch((err) => setLoadError(err?.message || "-")),
    [],
  );

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const visible = useMemo(
    () => (items || []).filter((d) => workflowId == null || String(d.workflowId) === String(workflowId)),
    [items, workflowId],
  );

  const answer = async (answerBody) => {
    await onAnswer(open, answerBody);
    setOpen(null);
    load();
  };

  const retry = () => {
    setLoadError(null);
    load();
  };

  if (hideWhenEmpty && !loadError && items !== null && visible.length === 0) return null;

  return (
    <section aria-label={t("listTitle")} className={className}>
      <p className="text-[11px] font-semibold th-text-secondary mb-1">{t("listTitle")}</p>
      {loadError ? (
        <div>
          <p role="alert" className="text-[11px] text-red-400">{t("listLoadFailed", { message: loadError })}</p>
          <button type="button" onClick={retry} className="mt-1 text-[11px] font-semibold underline th-text-secondary">{t("retry")}</button>
        </div>
      ) : items === null ? (
        <p className="flex items-center gap-1.5 text-[11px] th-text-ghost"><Loader2 size={11} className="animate-spin" />{t("listLoading")}</p>
      ) : visible.length === 0 ? (
        <p className="text-[11px] th-text-ghost">{t("listEmpty")}</p>
      ) : (
        <ul>
          {visible.map((item) => (
            <Row
              key={`${item.runId}:${item.nodeId}`}
              item={item}
              t={t}
              showWorkflow={workflowId == null}
              onReply={onAnswer ? setOpen : null}
              replyHref={`/workflows/${item.workflowId}?decision=${encodeURIComponent(item.runId)}`}
              onAbandoned={(gone) => {
                setItems((list) => (list || []).filter((d) => d.runId !== gone.runId));
                onAbandoned?.(gone);
              }}
            />
          ))}
        </ul>
      )}
      {open && <DecisionModal decision={open} onAnswer={answer} onClose={() => setOpen(null)} />}
    </section>
  );
}
