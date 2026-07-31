"use client";

import { formatChartLabel, formatChartValue, humanizeColumnName } from "@/lib/chart-tokens";

/**
 * Recharts tooltip with human-friendly formatting.
 *
 * Drop in as ``<Tooltip content={<ChartTooltip />} />``. Replaces the
 * default Recharts tooltip that prints raw SQL column names + raw
 * values (e.g. ``nb_ars : 1`` for ``2026-05-10``).
 *
 * The component receives the standard Recharts payload:
 *   - ``active``  — true while a series is hovered
 *   - ``payload`` — list of ``{ name, value, dataKey, color, ... }``
 *   - ``label``   — the X-axis value at the cursor
 */
export default function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div
      className="rounded-lg border bg-bg-elevated px-3 py-2 text-xs shadow-xl"
      style={{
        borderColor: "var(--border)",
        background: "var(--bg-elevated)",
        color: "var(--foreground)",
      }}
      role="tooltip"
    >
      {label !== undefined && label !== null && (
        <div className="font-semibold mb-1.5" style={{ color: "var(--foreground)" }}>
          {formatChartLabel(label)}
        </div>
      )}
      <div className="flex flex-col gap-1">
        {payload.map((entry, idx) => {
          // Recharts gives both `name` (legend label) and `dataKey`. Use
          // the dataKey for humanisation because that's the SQL column.
          const columnName = entry.dataKey || entry.name;
          return (
            <div key={`${columnName}-${idx}`} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="inline-block h-2 w-2 rounded-full flex-shrink-0"
                style={{ background: entry.color || entry.fill }}
              />
              <span style={{ color: "var(--text-secondary)" }}>
                {humanizeColumnName(columnName)}
              </span>
              <span className="font-mono font-semibold ml-auto">
                {formatChartValue(entry.value)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
