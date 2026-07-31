"use client";

import { AlertCircle } from "lucide-react";
import { STATUS_STYLES } from "./statusStyles";

/**
 * Common wrapper for all action cards.
 *
 * Responsibilities:
 * - applies the status-based border/background
 * - exposes role="group" + aria-label for screen readers
 * - lays out icon, title, body (children), optional actions slot
 * - renders an error block (with icon + message) when `status === "error"`
 *
 * @param {object} props
 * @param {object} props.card - the action card ({ status, ariaLabel, ... })
 * @param {React.ReactNode} props.icon - icon element rendered at size 16 inside a w-8 h-8 box
 * @param {string} props.title - header title (used as fallback aria-label)
 * @param {React.ReactNode} props.children - body content
 * @param {React.ReactNode} [props.actions] - optional footer actions
 * @param {string} [props.errorMessage] - explicit error message to show when status=error
 */
export default function ActionCardShell({
  card,
  icon,
  title,
  children,
  actions,
  errorMessage,
}) {
  const status = card?.status || "pending";
  const border = STATUS_STYLES[status] || STATUS_STYLES.pending;
  const ariaLabel = card?.ariaLabel || title || "Action card";

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`my-3 rounded-xl border overflow-hidden ${border}`}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg th-bg-surface border th-border">
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          {title && <p className="text-xs font-semibold th-text truncate">{title}</p>}
        </div>
      </div>

      <div className="px-3 pb-2">{children}</div>

      {actions && (
        <div className="flex items-center gap-2 px-3 pb-3">{actions}</div>
      )}

      {status === "error" && (
        <div className="flex items-center gap-2 px-3 pb-3 text-[11px] text-red-400">
          <AlertCircle size={12} className="shrink-0" />
          <span>{errorMessage || "Action failed"}</span>
        </div>
      )}
    </div>
  );
}
