"use client";

import { CalendarClock, ExternalLink, Check } from "lucide-react";
import { STATUS_STYLES } from "./statusStyles";
import { validateCalendarUrl } from "@/lib/validateAgentUrl";
import useActionCardSubmit from "./useActionCardSubmit";
import { formatDateTime } from "@/lib/datetime";

const PAST_STATUS_STYLES = {
  ...STATUS_STYLES,
  // Slightly muted purple for pending to differentiate from default blue
  pending: "border-purple-500/30 bg-purple-500/5",
};

function formatWhen(iso) {
  if (!iso) return "";
  const result = formatDateTime(iso);
  return result === "—" ? iso : result;
}

export default function FollowupCard({ card, onRespond }) {
  const { submitting, handleSubmit } = useActionCardSubmit(card);

  if (!card) return null;
  const { data = {}, status } = card;
  const border = PAST_STATUS_STYLES[status] || PAST_STATUS_STYLES.pending;
  const whenDate = data.when_iso ? new Date(data.when_iso) : null;
  const isPast =
    whenDate && !Number.isNaN(whenDate.getTime()) && whenDate.getTime() < Date.now();

  const calendarCheck = validateCalendarUrl(data.calendar_link);
  const calendarSafe = !!(data.calendar_link && calendarCheck.safe && !isPast);

  const onAcknowledge = () => {
    handleSubmit(() => onRespond?.("acknowledged", { sendFollowup: false }));
  };

  return (
    <div
      role="group"
      aria-label={card.ariaLabel || "Follow-up reminder"}
      className={`my-3 rounded-xl border overflow-hidden ${border}`}
    >
      <div className="flex items-start gap-3 px-3 py-2.5">
        <span className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/30">
          <CalendarClock size={16} className="text-purple-300" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p
              className={`text-xs font-semibold th-text ${
                isPast ? "line-through th-text-faint" : ""
              }`}
            >
              {formatWhen(data.when_iso)}
            </p>
            {isPast && (
              <span className="px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300 text-[10px] font-medium">
                Past
              </span>
            )}
          </div>
          {data.recap && (
            <p className="text-[11px] th-text-muted mt-0.5">{data.recap}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {calendarSafe && (
            <a
              href={data.calendar_link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-purple-500"
            >
              <ExternalLink size={12} />
              Add to Calendar
            </a>
          )}
          {status === "pending" && (
            <button
              type="button"
              onClick={onAcknowledge}
              disabled={submitting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg th-bg-surface hover:th-bg-surface-hover border th-border text-xs font-medium th-text-muted transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <Check size={12} />
              Got it
            </button>
          )}
        </div>
      </div>

      {status === "error" && (
        <p className="px-3 pb-2 text-[11px] text-red-400">
          {card.errorMessage || "Action failed"}
        </p>
      )}
    </div>
  );
}
