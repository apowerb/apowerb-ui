"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, UserCheck } from "lucide-react";
import { useTranslations, useFormatter } from "use-intl";
import { Link } from "@/lib/navigation";
import { listAwaitingDecisions, abandonWorkflowRun } from "@/lib/api";
import DecisionModal from "./DecisionModal";
import { parseRunDate } from "@/lib/workflowRuns";

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
    ownerId: row.owner_id ?? null,
    mine: typeof row.mine === "boolean" ? row.mine : null,
    pausedAt: row.paused_at ?? null,
    expiresAt: row.expires_at ?? null,
  };
}

// A run closed with no answer possible: the server says why.
const CLOSED_CODES = new Set(["decision_expired", "decision_state_unreadable"]);

// Owner of the run? `userEmail` undefined: the studio, which only the owner
// opens. Otherwise the server's `mine` says it (an older server sent the
// owner's address instead); while the user is unknown, nothing is theirs.
function isOwner(item, userEmail) {
  if (userEmail === undefined) return true;
  if (item.mine !== null) return item.mine;
  if (!userEmail || !item.ownerId) return false;
  return String(item.ownerId).toLowerCase() === String(userEmail).toLowerCase();
}

function Row({ item, onReply, onAbandoned, showWorkflow, replyHref, canAbandon, studioLink, t }) {
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
      const code = err?.detail?.code;
      setError(CLOSED_CODES.has(code) ? t(`error_${code}`) : err?.message || "-");
      setBusy(false);
    }
  };

  const short = (date) => (date ? format.dateTime(date, { dateStyle: "short", timeStyle: "short" }) : null);
  const when = short(parseRunDate(item.pausedAt));
  const until = short(parseRunDate(item.expiresAt));
  const replyClass = "px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-linear-to-r from-brand to-brand-secondary text-white hover:opacity-90";

  return (
    <li className="py-2.5 border-b th-border-secondary last:border-b-0">
      <div className="flex items-start gap-2">
        <UserCheck size={13} className="mt-0.5 text-purple-400 shrink-0" />
        <div className="flex-1 min-w-0">
          {showWorkflow && <p className="text-[11px] font-semibold th-text-secondary truncate">{item.workflowName}</p>}
          <p className="text-xs th-text break-words">{item.question}</p>
          {when && <p className="text-[10px] th-text-ghost mt-0.5">{t("since", { when: String(when) })}</p>}
          {until && <p className="text-[10px] th-text-ghost">{t("expires", { when: String(until) })}</p>}
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
              {onReply && studioLink && (
                <Link href={replyHref} className="px-2 py-1 text-[11px] font-medium rounded-lg th-text-secondary border th-border-secondary hover:th-bg-surface-hover">
                  {t("openInStudio")}
                </Link>
              )}
              {canAbandon && (
                <button type="button" onClick={() => setConfirming(true)} className="px-2 py-1 text-[11px] font-medium rounded-lg th-text-secondary border th-border-secondary hover:th-bg-surface-hover">
                  {t("abandon")}
                </button>
              )}
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
 * - `userEmail` is the signed-in user: Abandon (and, with `studioLink`, "Open in
 *   the Studio", which loads the workflow) belong to the owner of the run; an
 *   assignee only replies (the server answers 403 to their abandon). Left
 *   undefined (the studio, which only the owner opens) every row is theirs.
 * - `refreshKey` reloads the list (a run just parked, or resumed).
 * - `hideWhenEmpty` renders nothing while no decision waits (the workflows page).
 * - `openRunId` (with `onAnswer`) opens that run's dialog once the list is
 *   loaded: the link of a decision notice. Once only; a run no longer in the
 *   list is said to be gone.
 * - `className` spaces the section (default: the panel's).
 */
export default function AwaitingDecisionsList({ workflowId, onAnswer, onAbandoned, refreshKey, userEmail, openRunId = null, studioLink = false, hideWhenEmpty = false, className = "mt-3" }) {
  const t = useTranslations("WorkflowDecision");
  const [items, setItems] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [open, setOpen] = useState(null);
  // The linked decision, until the first list that loads answers for it.
  const linkRef = useRef(openRunId && onAnswer ? openRunId : null);
  const [linkGone, setLinkGone] = useState(false);

  const load = useCallback(
    () =>
      Promise.resolve(listAwaitingDecisions())
        .then((rows) => {
          const list = (Array.isArray(rows) ? rows : []).map(decisionFromRow);
          setLoadError(null);
          setItems(list);
          const wanted = linkRef.current;
          if (!wanted) return;
          linkRef.current = null;
          const linked = list.find((d) => d.runId === wanted && (workflowId == null || String(d.workflowId) === String(workflowId)));
          if (linked) setOpen(linked);
          else setLinkGone(true);
        })
        .catch((err) => setLoadError(err?.message || "-")),
    [workflowId],
  );

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const visible = useMemo(
    () => (items || []).filter((d) => workflowId == null || String(d.workflowId) === String(workflowId)),
    [items, workflowId],
  );

  const answer = async (answerBody) => {
    try {
      await onAnswer(open, answerBody);
    } catch (err) {
      // Expired, answered elsewhere, or no longer reachable: the row is gone;
      // the dialog stays to say why.
      if (err?.status === 404 || err?.status === 409) {
        setItems((list) => (list || []).filter((d) => d.runId !== open.runId));
      }
      throw err;
    }
    setOpen(null);
    load();
  };

  const retry = () => {
    setLoadError(null);
    load();
  };

  const modal = open && <DecisionModal decision={open} onAnswer={answer} onClose={() => setOpen(null)} />;

  // The dialog keeps its place in the tree when the list hides itself (the
  // last decision refused): its message stays on screen.
  const hidden = hideWhenEmpty && !loadError && items !== null && visible.length === 0;

  return (
    <>
      {linkGone && (
        <p role="status" className={`text-[11px] text-amber-300 ${className}`}>{t("linkedGone")}</p>
      )}
      {!hidden && (
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
                  canAbandon={isOwner(item, userEmail)}
                  studioLink={studioLink && isOwner(item, userEmail)}
                  replyHref={`/workflows/${item.workflowId}?decision=${encodeURIComponent(item.runId)}`}
                  onAbandoned={(gone) => {
                    setItems((list) => (list || []).filter((d) => d.runId !== gone.runId));
                    onAbandoned?.(gone);
                  }}
                />
              ))}
            </ul>
          )}
        </section>
      )}
      {modal}
    </>
  );
}
