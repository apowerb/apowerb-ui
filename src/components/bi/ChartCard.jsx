"use client";

import { useTranslations } from "use-intl";
import { Pencil, Trash2 } from "lucide-react";

/**
 * Card wrapper for any chart in the dashboard.
 *
 * Replaces the generic "Chart" header with a real title + optional
 * subtitle (context line: total, period, filters) + optional KPI
 * summary chips. Keeps the edit/delete actions in the top-right.
 *
 * Use this for every new chart placement; the legacy ChartRenderer
 * call sites can migrate progressively — passing only the children
 * works and renders an unadorned card.
 *
 * Props:
 *   title    — short phrase, e.g. "ARs traités par jour"
 *   subtitle — context line, e.g. "7 derniers jours · 78 au total"
 *   kpis     — optional array of {label, value, tone?} chips
 *   onEdit   — callback for the pencil button
 *   onDelete — callback for the trash button
 *   children — the actual chart (usually <ChartRenderer />)
 */
export default function ChartCard({
  title,
  subtitle,
  kpis,
  onEdit,
  onDelete,
  children,
  className = "",
}) {
  const t = useTranslations("ChartCard");
  return (
    <div
      className={`flex flex-col rounded-xl border bg-bg-elevated overflow-hidden ${className}`}
      style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-4 pt-3 pb-2">
        <div className="min-w-0 flex-1">
          <h3
            className="text-sm font-semibold truncate"
            style={{ color: "var(--foreground)" }}
            title={title}
          >
            {title || t("chartFallback")}
          </h3>
          {subtitle && (
            <p
              className="text-xs mt-0.5 truncate"
              style={{ color: "var(--text-secondary)" }}
              title={subtitle}
            >
              {subtitle}
            </p>
          )}
        </div>
        {(onEdit || onDelete) && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                aria-label={t("editChart")}
                className="p-1.5 rounded-md hover:bg-bg-hover transition-colors"
                style={{ color: "var(--text-secondary)" }}
              >
                <Pencil size={14} />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                aria-label={t("deleteChart")}
                className="p-1.5 rounded-md hover:bg-red-500/15 hover:text-red-400 transition-colors"
                style={{ color: "var(--text-secondary)" }}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* KPI chips */}
      {kpis && kpis.length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-3">
          {kpis.map((kpi, idx) => (
            <KpiChip key={`${kpi.label}-${idx}`} {...kpi} />
          ))}
        </div>
      )}

      {/* Chart body */}
      <div className="flex-1 min-h-0 px-2 pb-3">{children}</div>
    </div>
  );
}

function KpiChip({ label, value, tone = "neutral" }) {
  const toneStyles = {
    neutral: { color: "var(--text-secondary)" },
    success: { color: "#10b981" },
    warning: { color: "#f59e0b" },
    danger: { color: "#ef4444" },
    info: { color: "#3b82f6" },
  };
  return (
    <div className="flex items-baseline gap-1.5">
      <span
        className="text-lg font-semibold tabular-nums"
        style={toneStyles[tone] || toneStyles.neutral}
      >
        {value}
      </span>
      <span className="text-xs" style={{ color: "var(--text-faint)" }}>
        {label}
      </span>
    </div>
  );
}
