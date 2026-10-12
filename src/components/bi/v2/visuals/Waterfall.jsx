"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { compactFr, resolveColor, signedCompactFr, xTick } from "../format";
import { AXIS, ChartBox, EmptyState, GRID, MARGIN } from "./shared";

const KIND_COLOR = {
  start: "var(--v2-accent)",
  end: "var(--v2-accent)",
  increase: "var(--v2-good)",
  decrease: "var(--v2-bad)",
};

function signedText(n) {
  return n < 0 ? `\u2212${compactFr(Math.abs(n))}` : compactFr(n);
}

/**
 * Rows `{label, value, base, kind, color}` → floating bars spanning
 * `range = [low, high]` (so a total below zero draws below the axis and the Y
 * domain includes both ends). `height` is signed for start/end totals and a
 * magnitude for increase/decrease. Falls back to a running total when the
 * server omits `base`.
 */
export function buildWaterfallBars(rows) {
  let running = 0;
  return (rows || []).map((row) => {
    const kind = row.kind || "increase";
    const raw = Number(row.value);
    const finite = Number.isFinite(raw);
    const magnitude = finite ? Math.abs(raw) : 0;
    let base;
    let height;
    if (kind === "start" || kind === "end") {
      base = 0;
      height = finite ? raw : kind === "end" ? running : 0;
      running = height;
    } else if (kind === "decrease") {
      running -= magnitude;
      base = running;
      height = magnitude;
    } else {
      base = running;
      height = magnitude;
      running += magnitude;
    }
    const serverBase = Number(row.base);
    if (row.base != null && Number.isFinite(serverBase)) base = serverBase;
    const edge = base + height;
    const text =
      kind === "increase"
        ? signedCompactFr(magnitude)
        : kind === "decrease"
          ? signedCompactFr(-magnitude)
          : signedText(height);
    return {
      label: row.label,
      kind,
      base,
      height,
      range: [Math.min(base, edge), Math.max(base, edge)],
      color: row.color ? resolveColor(row.color) : KIND_COLOR[kind] || KIND_COLOR.increase,
      text,
    };
  });
}

function WaterfallTooltip({ active, payload }) {
  const bar = payload?.[0]?.payload;
  if (!active || !bar) return null;
  return (
    <div
      role="tooltip"
      className="bi-v2-num rounded-lg border px-3 py-2 text-xs shadow-xl"
      style={{ borderColor: "var(--border)", background: "var(--bg-dropdown)", color: "var(--foreground)" }}
    >
      <span className="mr-3" style={{ color: "var(--text-secondary)" }}>{xTick(bar.label)}</span>
      <span className="font-semibold">{bar.text}</span>
    </div>
  );
}

export default function Waterfall({ result }) {
  const bars = buildWaterfallBars(result?.rows);
  if (bars.length === 0) return <EmptyState>—</EmptyState>;
  return (
    <ChartBox>
      <BarChart data={bars} margin={{ ...MARGIN, top: 22 }}>
        <CartesianGrid {...GRID} />
        <XAxis dataKey="label" tickFormatter={xTick} {...AXIS} interval={0} />
        <YAxis tickFormatter={compactFr} width={44} {...AXIS} />
        <Tooltip content={<WaterfallTooltip />} cursor={{ fill: "var(--bg-surface-hover)", opacity: 0.5 }} />
        <Bar dataKey="range" radius={2} maxBarSize={56} isAnimationActive={false}>
          {bars.map((b, i) => (
            <Cell key={i} fill={b.color} />
          ))}
          <LabelList
            dataKey="text"
            content={({ x, y, width, value }) => (
              <text
                x={Number(x) + Number(width) / 2}
                y={Number(y) - 6}
                textAnchor="middle"
                className="bi-v2-num"
                style={{ fill: "var(--text-primary)", fontSize: 11, fontWeight: 600 }}
              >
                {value}
              </text>
            )}
          />
        </Bar>
      </BarChart>
    </ChartBox>
  );
}
