"use client";

import { useState, useMemo } from "react";
import { FileEdit, Check, X, Loader2 } from "lucide-react";
import { STATUS_STYLES } from "./statusStyles";
import useActionCardSubmit from "./useActionCardSubmit";

const PREVIEW_LINES = 20;

function DiffLine({ line }) {
  if (line.startsWith("+")) {
    return <span className="block diff-add">{line}</span>;
  }
  if (line.startsWith("-")) {
    return <span className="block diff-remove">{line}</span>;
  }
  return <span className="block th-text-muted">{line}</span>;
}

export default function ArtifactEditCard({ card, onRespond }) {
  const [expanded, setExpanded] = useState(false);
  const { submitting, handleSubmit } = useActionCardSubmit(card);

  const stats = useMemo(() => {
    const lines = (card?.data?.diff || "").split("\n");
    let add = 0;
    let remove = 0;
    for (const l of lines) {
      if (l.startsWith("+")) add += 1;
      else if (l.startsWith("-")) remove += 1;
    }
    return { add, remove, total: lines.length, lines };
  }, [card?.data?.diff]);

  if (!card) return null;
  const { data = {}, status } = card;
  const border = STATUS_STYLES[status] || STATUS_STYLES.pending;

  const shownLines = expanded ? stats.lines : stats.lines.slice(0, PREVIEW_LINES);
  const hasMore = stats.total > PREVIEW_LINES;

  const onApply = () => {
    handleSubmit(() => onRespond?.("applied"));
  };
  const onCancel = () => {
    handleSubmit(() => onRespond?.("rejected", { sendFollowup: false }));
  };

  return (
    <div
      role="group"
      aria-label={card.ariaLabel || `Artifact edit: ${data.filename || ""}`}
      className={`my-3 rounded-xl border overflow-hidden ${border}`}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b th-border-secondary">
        <FileEdit size={16} className="text-blue-300 shrink-0" />
        <span
          title={data.filename}
          className="text-xs font-mono th-text-secondary truncate flex-1"
        >
          {data.filename}
        </span>
        <span className="text-[11px] th-text-muted font-mono shrink-0">
          <span className="text-emerald-300">+{stats.add}</span>{" "}
          <span className="text-red-300">−{stats.remove}</span>
          <span className="th-text-faint"> · {stats.total} lines</span>
        </span>
      </div>

      {data.summary && (
        <p className="px-3 pt-2 text-[11px] th-text-muted">{data.summary}</p>
      )}

      <pre className="px-3 py-2 my-1 text-[11px] font-mono leading-relaxed overflow-x-auto max-h-60 custom-scrollbar">
        {shownLines.map((line, i) => (
          <DiffLine key={i} line={line || " "} />
        ))}
      </pre>

      {hasMore && !expanded && (
        <div className="px-3 pb-2">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-[11px] th-text-muted hover:th-text-secondary underline focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Show all {stats.total} lines
          </button>
        </div>
      )}

      {status === "pending" && (
        <div className="flex items-center gap-2 px-3 py-2 border-t th-border-secondary">
          <button
            type="button"
            onClick={onApply}
            disabled={submitting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 text-xs font-semibold transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            {submitting ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Check size={12} />
            )}
            Apply
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
        <p className="px-3 py-2 text-[11px] text-emerald-400 flex items-center gap-1 border-t th-border-secondary">
          <Check size={12} /> Applied
        </p>
      )}

      {status === "cancelled" && (
        <p className="px-3 py-2 text-[11px] th-text-faint flex items-center gap-1 border-t th-border-secondary">
          <X size={12} /> Cancelled
        </p>
      )}

      {status === "error" && (
        <p className="px-3 py-2 text-[11px] text-red-400 border-t th-border-secondary">
          {card.errorMessage || "Action failed"}
        </p>
      )}
    </div>
  );
}
