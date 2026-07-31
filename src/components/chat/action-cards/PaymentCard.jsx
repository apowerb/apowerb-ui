"use client";

import { useState } from "react";
import { CreditCard, ExternalLink, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { STATUS_STYLES } from "./statusStyles";
import { validatePaymentUrl } from "@/lib/validateAgentUrl";
import useActionCardSubmit from "./useActionCardSubmit";

function formatAmount(amount, currency) {
  if (amount == null) return "";
  const n = Number(amount);
  if (Number.isNaN(n)) return String(amount);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
    }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency || ""}`.trim();
  }
}

export default function PaymentCard({ card, onRespond }) {
  const { submitting, handleSubmit } = useActionCardSubmit(card);
  const [opened, setOpened] = useState(false);

  if (!card) return null;
  const { data = {}, status } = card;
  const border = STATUS_STYLES[status] || STATUS_STYLES.pending;
  const formatted = formatAmount(data.amount, data.currency);

  const urlCheck = validatePaymentUrl(data.checkout_url);
  if (!urlCheck.safe && data.checkout_url) {
    console.warn("[PaymentCard] Unsafe checkout URL blocked", {
      reason: urlCheck.reason,
      url: data.checkout_url,
    });
  }

  const onPayClick = (e) => {
    // Let the browser open the new tab, but also notify parent with a
    // non-terminal "checkout_opened" event so we can show a waiting label
    // until a webhook/SSE updates the status.
    handleSubmit(() => {
      setOpened(true);
      onRespond?.("checkout_opened", { sendFollowup: false, status: "pending" });
    });
    // Do NOT preventDefault — let the link navigate to Stripe.
    e.stopPropagation();
  };

  return (
    <div
      role="group"
      aria-label={card.ariaLabel || `Payment request: ${formatted}`}
      className={`my-3 rounded-xl border overflow-hidden ${border}`}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30">
          <CreditCard size={16} className="text-blue-300" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold th-text">{formatted}</p>
          {data.reason && (
            <p className="text-[11px] th-text-muted truncate">{data.reason}</p>
          )}
        </div>

        {status === "pending" && data.checkout_url && urlCheck.safe && (
          <a
            href={data.checkout_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onPayClick}
            aria-disabled={submitting || undefined}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-300 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            {submitting ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <ExternalLink size={12} />
            )}
            {opened ? "Opened" : "Pay now"}
          </a>
        )}

        {status === "done" && (
          <span className="shrink-0 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-medium">
            <CheckCircle2 size={13} />
            Paid
          </span>
        )}
      </div>

      {status === "pending" && opened && (
        <p className="px-3 pb-2 text-[11px] th-text-muted italic">
          Waiting for payment confirmation…
        </p>
      )}

      {data.checkout_url && !urlCheck.safe && (
        <p className="flex items-center gap-1 px-3 pb-2 text-[11px] text-red-400">
          <AlertCircle size={12} />
          Unsafe payment URL blocked
        </p>
      )}

      {status === "error" && (
        <p className="flex items-center gap-1 px-3 pb-2 text-[11px] text-red-400">
          <AlertCircle size={12} />
          {card.errorMessage || "Payment failed"}
        </p>
      )}
    </div>
  );
}
