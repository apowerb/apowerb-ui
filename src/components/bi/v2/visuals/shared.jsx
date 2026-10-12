"use client";

import { ResponsiveContainer } from "recharts";
import { useOptionalDashboardData } from "../DashboardDataContext";
import { compactFr, formatFull, isIsoDate, longDate, tickByKind, xTick } from "../format";

export const AXIS = {
  tick: { fill: "var(--text-secondary)", fontSize: 11 },
  axisLine: { stroke: "var(--border)" },
  tickLine: false,
};
export const GRID = {
  strokeDasharray: "3 3",
  stroke: "var(--border)",
  vertical: false,
};
export const MARGIN = { top: 16, right: 8, bottom: 0, left: 0 };
/** Room on the right for reference-line labels. */
export const marginFor = (result) =>
  (result?.reference_lines || []).some((l) => l?.label) ? { ...MARGIN, right: 72 } : MARGIN;

/** Fills its parent; recharts needs a sized box. */
export function ChartBox({ children, minHeight = 120 }) {
  return (
    <div className="h-full w-full min-w-0" style={{ minHeight }}>
      <ResponsiveContainer width="100%" height="100%" minHeight={minHeight}>
        {children}
      </ResponsiveContainer>
    </div>
  );
}

/** Tooltip using the series labels (not raw column names) and French numbers. */
export function VisualTooltip({ active, payload, label, labels = {}, fmt }) {
  if (!active || !payload || payload.length === 0) return null;
  const rows = payload.filter((p) => p && p.value != null && !String(p.dataKey).startsWith("_"));
  if (rows.length === 0) return null;
  return (
    <div
      role="tooltip"
      className="bi-v2-num rounded-lg border px-3 py-2 text-xs shadow-xl"
      style={{
        borderColor: "var(--border)",
        background: "var(--bg-dropdown)",
        color: "var(--foreground)",
      }}
    >
      {label != null && label !== "" && (
        <div className="mb-1.5 font-semibold">{isIsoDate(label) ? longDate(label) : xTick(label)}</div>
      )}
      <div className="flex flex-col gap-1">
        {rows.map((p, i) => {
          const key = String(p.dataKey);
          return (
            <div key={`${key}-${i}`} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ background: p.color || p.fill || p.stroke }}
              />
              <span style={{ color: "var(--text-secondary)" }}>{labels[key] || p.name || key}</span>
              <span className="ml-auto pl-3 font-semibold">
                {fmt ? fmt(key, p.value) : formatFull(p.value, null)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Click handler for a visual: maps a clicked row to the filters declared in
 * `visual.click_filters` ({filterId: field}).
 */
export function useRowClick(visual) {
  const ctx = useOptionalDashboardData();
  const entries = Object.entries(visual?.click_filters || {});
  if (!ctx || entries.length === 0) return null;
  const { crossFilter } = ctx;
  return (row) => {
    if (!row) return;
    for (const [filterId, field] of entries) {
      const value = row[field] ?? row[visual.x];
      if (value != null) crossFilter(filterId, value);
    }
  };
}

/** Value of the first click-filter currently applied (to dim other marks). */
export function useActiveClickValue(visual) {
  const ctx = useOptionalDashboardData();
  const first = Object.keys(visual?.click_filters || {})[0];
  if (!ctx || !first) return null;
  const v = ctx.values[first];
  if (v == null) return null;
  return Array.isArray(v) ? (v.length === 1 ? String(v[0]) : null) : String(v);
}

export function EmptyState({ children }) {
  return (
    <div className="flex h-full min-h-16 items-center justify-center text-xs th-text-faint">
      {children}
    </div>
  );
}

/**
 * Number formatting of a visual's series: the measure's own format (percent,
 * weeks, ...) when the dashboard declares one, compact otherwise.
 */
export function useFormats(visual) {
  const ctx = useOptionalDashboardData();
  const source = ctx?.dashboard?.sources?.find((s) => s.name === visual?.source);
  const fields = ctx?.data?.sources?.[visual?.source]?.fields;
  const kind = (key) =>
    source?.measures?.find((m) => m.name === key)?.format ||
    fields?.find((f) => f.name === key)?.format ||
    null;
  return {
    kind,
    value: (key, v) => formatFull(v, kind(key)),
    tick: (key) => tickByKind(kind(key)),
  };
}
