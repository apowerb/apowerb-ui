"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, UserCheck } from "lucide-react";
import { useTranslations } from "use-intl";

// The refusals the engine codes before any stream (`err.detail.code`).
const CODED_ERRORS = new Set(["decision_already_answered", "decision_invalid_answer", "decision_expired", "decision_state_unreadable"]);

function errorMessage(t, err) {
  const code = err?.detail?.code;
  if (code && CODED_ERRORS.has(code)) return t(`error_${code}`);
  if (err?.status === 404) return t("error_not_found");
  return t("error_generic", { message: err?.message || "-" });
}

/**
 * The dialog a person answers a paused run in. `decision` is
 * `{runId, nodeId, question, mode, choices:[{route,label}], assignee}`;
 * `onAnswer({choice})`, `onAnswer({text})` or, in `both` mode with a comment
 * typed, `onAnswer({choice, text})` resolves when the run was
 * resumed and throws the API error otherwise (shown here). "Later" closes
 * without answering: the run stays parked and can be reopened.
 */
export default function DecisionModal({ decision, onAnswer, onClose }) {
  const t = useTranslations("WorkflowDecision");
  const titleId = useId();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [settled, setSettled] = useState(false);
  const firstRef = useRef(null);

  const mode = decision?.mode;
  const canChoose = mode === "choices" || mode === "both";
  const canWrite = mode === "text" || mode === "both";
  const choices = Array.isArray(decision?.choices) ? decision.choices : [];
  const locked = sending || settled;
  const trimmed = text.trim();

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (answer) => {
    if (locked) return;
    setSending(true);
    setError(null);
    try {
      await onAnswer(answer);
    } catch (err) {
      setError(errorMessage(t, err));
      // Answered elsewhere: nothing left to send from here.
      if (err?.detail?.code === "decision_already_answered") setSettled(true);
    } finally {
      setSending(false);
    }
  };

  const sendText = () => {
    if (!trimmed) return;
    submit({ text: trimmed });
  };

  if (!decision) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-md rounded-2xl th-bg-modal border border-purple-500/30 shadow-2xl overflow-hidden"
      >
        <div className="flex items-center gap-2 px-4 py-3 bg-purple-500/5 border-b border-purple-500/20">
          <UserCheck size={16} className="text-purple-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 id={titleId} className="text-xs font-bold th-text">{t("title")}</h3>
            {decision.workflowName && <p className="text-[11px] th-text-muted truncate">{t("from", { workflow: decision.workflowName })}</p>}
          </div>
        </div>

        <div className="p-4">
          <p className="text-sm th-text whitespace-pre-wrap break-words">{decision.question}</p>
          {decision.assignee && <p className="mt-1 text-[11px] th-text-ghost">{t("assignee", { assignee: decision.assignee })}</p>}

          {canChoose && (
            <div className="mt-4">
              <p className="text-[11px] font-semibold th-text-secondary mb-1.5">{t("choices")}</p>
              <div className="flex flex-wrap gap-2">
                {choices.map((c, i) => (
                  <button
                    key={c.route}
                    ref={i === 0 ? firstRef : undefined}
                    type="button"
                    disabled={locked}
                    onClick={() => submit(canWrite && trimmed ? { choice: c.route, text: trimmed } : { choice: c.route })}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-linear-to-r from-brand to-brand-secondary text-white hover:opacity-90 disabled:opacity-40"
                  >
                    {c.label || c.route}
                  </button>
                ))}
              </div>
            </div>
          )}

          {canWrite && (
            <div className="mt-4">
              <label className="block">
                <span className="block text-[11px] font-semibold th-text-secondary mb-1.5">
                  {canChoose ? t("textLabelBoth") : t("textLabel")}
                </span>
                <textarea
                  ref={canChoose ? undefined : firstRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  disabled={locked}
                  rows={3}
                  placeholder={t("textPlaceholder")}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg th-bg-surface border th-border-secondary th-text placeholder:th-text-ghost focus:outline-none focus:ring-1 focus:ring-brand resize-y disabled:opacity-60"
                />
              </label>
              <button
                type="button"
                disabled={locked || !trimmed}
                onClick={sendText}
                className="mt-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-linear-to-r from-brand to-brand-secondary text-white hover:opacity-90 disabled:opacity-40"
              >
                {t("send")}
              </button>
            </div>
          )}

          {sending && (
            <p role="status" className="mt-3 flex items-center gap-1.5 text-[11px] th-text-faint">
              <Loader2 size={12} className="animate-spin" />
              {t("sending")}
            </p>
          )}
          {error && (
            <p role="alert" className="mt-3 text-[11px] text-red-400">{error}</p>
          )}
        </div>

        <div className="flex justify-end px-4 py-3 border-t th-border-secondary">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs font-medium rounded-lg th-bg-elevated th-text-secondary hover:th-text">
            {t("later")}
          </button>
        </div>
      </div>
    </div>
  );
}
