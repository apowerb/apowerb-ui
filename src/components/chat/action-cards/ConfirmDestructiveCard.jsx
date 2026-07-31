"use client";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "use-intl";
import { AlertTriangle, Check, X, Loader2 } from "lucide-react";
import { STATUS_STYLES } from "./statusStyles";
import useActionCardSubmit from "./useActionCardSubmit";

const COUNTDOWN_SECONDS = 3;

export default function ConfirmDestructiveCard({ card, onRespond }) {
  const t = useTranslations("ConfirmDestructiveCard");
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [typedConfirm, setTypedConfirm] = useState("");
  const { submitting, handleSubmit } = useActionCardSubmit(card);
  const impactId = useId();

  useEffect(() => {
    if (card?.status !== "pending") return undefined;
    if (countdown <= 0) return undefined;
    const timer = setTimeout(() => setCountdown((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, card?.status]);

  if (!card) return null;
  const { data = {}, status } = card;
  const border = STATUS_STYLES[status] || STATUS_STYLES.pending;
  const isHighDanger = data.danger_level === "high";
  const typedOk = !isHighDanger || typedConfirm === "DELETE";
  const canConfirm =
    status === "pending" && countdown <= 0 && typedOk && !submitting;

  const confirmLabel =
    countdown > 0 ? t("confirmCountdown", { countdown }) : t("confirm");

  const onConfirm = () => {
    if (!canConfirm) return;
    handleSubmit(() => onRespond?.("confirmed"));
  };

  const onCancel = () => {
    if (submitting) return;
    handleSubmit(() => onRespond?.("cancelled", { sendFollowup: false }));
  };

  return (
    <div
      role="group"
      aria-label={card.ariaLabel || t("confirmActionLabel", { action: data.action || "" })}
      className={`my-3 rounded-xl border overflow-hidden ${border}`}
    >
      <div className="flex items-start gap-3 px-3 py-2.5">
        <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold th-text">{data.action}</p>
          <div id={impactId}>
            {data.item && (
              <p className="text-[11px] th-text-muted mt-0.5">
                {t("target")} <span className="font-mono">{data.item}</span>
              </p>
            )}
            {data.impact && (
              <p className="text-[11px] th-text font-medium mt-1">{data.impact}</p>
            )}
          </div>

          {status === "pending" && isHighDanger && (
            <input
              type="text"
              value={typedConfirm}
              onChange={(e) => setTypedConfirm(e.target.value)}
              placeholder={t("typeDeleteConfirm")}
              aria-label={t("typeDeleteConfirm")}
              className="mt-2 w-full px-2.5 py-1.5 rounded-lg th-bg-surface border th-border text-xs th-text-secondary outline-none focus:border-red-500/40 focus-visible:ring-2 focus-visible:ring-red-500"
            />
          )}

          {status === "pending" && (
            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={onCancel}
                disabled={submitting}
                aria-describedby={impactId}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-200 text-xs font-semibold transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <X size={12} />
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={!canConfirm}
                aria-describedby={impactId}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-red-500"
              >
                {submitting ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Check size={12} />
                )}
                {confirmLabel}
              </button>
            </div>
          )}

          {status === "done" && (
            <p className="text-[11px] text-emerald-400 mt-2 flex items-center gap-1">
              <Check size={12} /> {t("confirmed")}
            </p>
          )}

          {status === "cancelled" && (
            <p className="text-[11px] th-text-faint mt-2 flex items-center gap-1">
              <X size={12} /> {t("cancelled")}
            </p>
          )}

          {status === "error" && (
            <p className="text-[11px] text-red-400 mt-2">
              {card.errorMessage || t("actionFailed")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
