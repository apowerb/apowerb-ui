"use client";

import { useId } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { resolveColor, rowColor, seriesColor } from "../format";
import {
  AXIS,
  ChartBox,
  EmptyState,
  GRID,
  MARGIN,
  marginFor,
  VisualTooltip,
  useActiveClickValue,
  useFormats,
  useRowClick,
} from "./shared";

const DASH = "6 4";

/** Light vertical fade under an area series (top colour -> transparent). */
function AreaGradient({ id, color }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={color} stopOpacity={0.28} />
      <stop offset="100%" stopColor={color} stopOpacity={0.02} />
    </linearGradient>
  );
}

export function seriesOf(visual, defaultMark) {
  return (visual.series || []).map((s, i) => ({
    ...s,
    mark: s.mark || defaultMark,
    label: s.label || s.key,
    stroke: seriesColor(s.color, i),
    axis: s.axis === "right" ? "right" : "left",
  }));
}

export function referenceLinesOf(result, axisId = "left") {
  return (result?.reference_lines || [])
    .filter((l) => Number.isFinite(Number(l.value)))
    .map((l, i) => (
      <ReferenceLine
        key={`ref-${i}`}
        yAxisId={axisId}
        y={Number(l.value)}
        stroke={resolveColor(l.color, "var(--v2-muted)")}
        strokeDasharray={l.dash === false ? undefined : DASH}
        ifOverflow="extendDomain"
        label={
          l.label
            ? { value: l.label, position: "right", fill: "var(--text-muted)", fontSize: 10 }
            : undefined
        }
      />
    ));
}

/**
 * Bars + lines + areas on one or two axes. Line and Area visuals are this chart
 * with a different default mark.
 */
export default function ComboChart({ visual, result, defaultMark = "bar" }) {
  const rows = result?.rows || [];
  const series = seriesOf(visual, defaultMark);
  const onRowClick = useRowClick(visual);
  const active = useActiveClickValue(visual);
  const formats = useFormats(visual);
  const uid = useId().replace(/[^\w]/g, "");
  if (rows.length === 0 || series.length === 0 || !visual.x) {
    return <EmptyState>—</EmptyState>;
  }
  const hasRight = series.some((s) => s.axis === "right");
  const labels = Object.fromEntries(series.map((s) => [s.key, s.label]));
  const hasBar = series.some((s) => s.mark === "bar");
  // Bars next to a line/area are thin appro ticks; a bar-only chart keeps wide bars.
  const barSize = series.every((s) => s.mark === "bar") ? 28 : 8;
  const gradId = (key) => `v2g-${uid}-${String(key).replace(/[^\w]/g, "")}`;
  // Bars next to a curve are a backdrop (0.55); bar-only charts stay opaque.
  const barOpacity = hasBar && series.some((s) => s.mark !== "bar") ? 0.55 : 1;
  // Recharts layers by zIndex (area 100 < bar 300 < line 400): a backdrop bar sits at 50,
  // under the area; JSX order alone would not do it.
  const drawOrder = ["bar", "area"];
  const rank = (m) => (drawOrder.includes(m) ? drawOrder.indexOf(m) : 2);
  const ordered = [...series].sort((x, y) => rank(x.mark) - rank(y.mark));
  const dim = (row) =>
    active != null && onRowClick && String(row?.[visual.x]) !== active ? 0.4 : 1;

  return (
    <ChartBox>
      <ComposedChart data={rows} margin={marginFor(result)}>
        <defs>
          {series
            .filter((s) => s.mark === "area")
            .map((s) => (
              <AreaGradient key={s.key} id={gradId(s.key)} color={s.stroke} />
            ))}
        </defs>
        <CartesianGrid {...GRID} />
        <XAxis dataKey={visual.x} tickFormatter={formats.xTick} {...AXIS} minTickGap={28} tickMargin={6} />
        <YAxis yAxisId="left" tickFormatter={formats.tick(series.find((s) => s.axis === "left")?.key)} width={44} tickCount={5} {...AXIS} axisLine={false} />
        {hasRight && (
          <YAxis yAxisId="right" orientation="right" tickFormatter={formats.tick(series.find((s) => s.axis === "right")?.key)} width={44} tickCount={5} {...AXIS} axisLine={false} />
        )}
        <Tooltip
          content={<VisualTooltip labels={labels} fmt={formats.value} />}
          cursor={
            hasBar
              ? { fill: "var(--bg-surface-hover)", opacity: 0.4 }
              : { stroke: "var(--border-hover)", strokeDasharray: "3 3" }
          }
          isAnimationActive={false}
        />
        {series.length > 1 && (
          <Legend
            iconType="circle"
            iconSize={7}
            verticalAlign="top"
            align="right"
            wrapperStyle={{ fontSize: 11, color: "var(--text-secondary)", paddingBottom: 4 }}
            formatter={(v) => <span style={{ color: "var(--text-secondary)" }}>{labels[v] || v}</span>}
          />
        )}
        {ordered.map((s) => {
          const common = { dataKey: s.key, name: s.label, yAxisId: s.axis };
          if (s.mark === "bar") {
            return (
              <Bar
                key={s.key}
                {...common}
                fill={s.stroke}
                radius={[2, 2, 0, 0]}
                maxBarSize={barSize}
                zIndex={barOpacity < 1 ? 50 : undefined}
                isAnimationActive={false}
                cursor={onRowClick ? "pointer" : undefined}
                onClick={onRowClick ? (d) => onRowClick(d?.payload ?? d) : undefined}
              >
                {rows.map((row, i) => (
                  <Cell
                    key={i}
                    fill={rowColor(row, s.key, s.stroke)}
                    fillOpacity={barOpacity * dim(row)}
                  />
                ))}
              </Bar>
            );
          }
          if (s.mark === "area") {
            return (
              <Area
                key={s.key}
                {...common}
                type="monotone"
                stroke={s.stroke}
                fill={`url(#${gradId(s.key)})`}
                strokeWidth={2}
                strokeDasharray={s.dash ? DASH : undefined}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            );
          }
          return (
            <Line
              key={s.key}
              {...common}
              type="monotone"
              stroke={s.stroke}
              strokeWidth={s.dash ? 1.75 : 2}
              strokeDasharray={s.dash ? DASH : undefined}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              connectNulls
              isAnimationActive={false}
            />
          );
        })}
        {referenceLinesOf(result)}
      </ComposedChart>
    </ChartBox>
  );
}
