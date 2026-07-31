"use client";

import { Sparkles, Check, X, Loader2 } from "lucide-react";
import { STATUS_STYLES } from "./statusStyles";
import useActionCardSubmit from "./useActionCardSubmit";

const LOCAL_STATUS_STYLES = {
  ...STATUS_STYLES,
  pending: "border-amber-500/30 bg-amber-500/5",
};

export default function AgentUpgradeCard({ card, onRespond }) {
  const { submitting, handleSubmit } = useActionCardSubmit(card);

  if (!card) return null;
  const { data = {}, status } = card;
  const border = LOCAL_STATUS_STYLES[status] || LOCAL_STATUS_STYLES.pending;

  const onEnable = () => handleSubmit(() => onRespond?.("accepted"));
  const onCancel = () =>
    handleSubmit(() => onRespond?.("skipped", { sendFollowup: false }));

  return (
    <div
      role="group"
      aria-label={card.ariaLabel || `Agent upgrade: ${data.capability || ""}`}
      className={`my-3 rounded-xl border overflow-hidden ${border}`}
    >
      <div className="flex items-start gap-3 px-3 py-2.5">
        <span className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30">
          <Sparkles size={16} className="text-amber-300" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold th-text">{data.capability}</p>
          {data.reason && (
            <p className="text-[11px] th-text-muted mt-0.5">{data.reason}</p>
          )}

          {status === "pending" && (
            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={onEnable}
                disabled={submitting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-semibold transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                {submitting ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Check size={12} />
                )}
                Enable
              </button>
              <button
                type="button"
                onClick={onCancel}
                disabled={submitting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg th-bg-surface hover:th-bg-surface-hover border th-border text-xs font-medium th-text-muted transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <X size={12} />
                Cancel
              </button>
            </div>
          )}

          {status === "done" && (
            <p className="text-[11px] text-emerald-400 mt-2 flex items-center gap-1">
              <Check size={12} /> Enabled
            </p>
          )}

          {status === "cancelled" && (
            <p className="text-[11px] th-text-faint mt-2 flex items-center gap-1">
              <X size={12} /> Skipped
            </p>
          )}

          {status === "error" && (
            <p className="text-[11px] text-red-400 mt-2">
              {card.errorMessage || "Action failed"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
