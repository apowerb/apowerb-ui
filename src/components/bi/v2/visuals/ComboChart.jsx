"use client";

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
import { resolveColor, rowColor, seriesColor, xTick } from "../format";
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

const DASH = "5 4";

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
  if (rows.length === 0 || series.length === 0 || !visual.x) {
    return <EmptyState>—</EmptyState>;
  }
  const hasRight = series.some((s) => s.axis === "right");
  const labels = Object.fromEntries(series.map((s) => [s.key, s.label]));
  const dim = (row) =>
    active != null && onRowClick && String(row?.[visual.x]) !== active ? 0.4 : 1;

  return (
    <ChartBox>
      <ComposedChart data={rows} margin={marginFor(result)}>
        <CartesianGrid {...GRID} />
        <XAxis dataKey={visual.x} tickFormatter={xTick} {...AXIS} minTickGap={16} />
        <YAxis yAxisId="left" tickFormatter={formats.tick(series.find((s) => s.axis === "left")?.key)} width={48} {...AXIS} />
        {hasRight && (
          <YAxis yAxisId="right" orientation="right" tickFormatter={formats.tick(series.find((s) => s.axis === "right")?.key)} width={48} {...AXIS} />
        )}
        <Tooltip
          content={<VisualTooltip labels={labels} fmt={formats.value} />}
          cursor={{ fill: "var(--bg-surface-hover)", opacity: 0.5 }}
        />
        {series.length > 1 && (
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, color: "var(--text-secondary)" }}
            formatter={(v) => labels[v] || v}
          />
        )}
        {series.map((s) => {
          const common = { dataKey: s.key, name: s.label, yAxisId: s.axis };
          if (s.mark === "bar") {
            return (
              <Bar
                key={s.key}
                {...common}
                fill={s.stroke}
                radius={[3, 3, 0, 0]}
                maxBarSize={36}
                isAnimationActive={false}
                cursor={onRowClick ? "pointer" : undefined}
                onClick={onRowClick ? (d) => onRowClick(d?.payload ?? d) : undefined}
              >
                {rows.map((row, i) => (
                  <Cell
                    key={i}
                    fill={rowColor(row, s.key, s.stroke)}
                    fillOpacity={dim(row)}
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
                fill={s.stroke}
                fillOpacity={0.18}
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
              strokeWidth={2}
              strokeDasharray={s.dash ? DASH : undefined}
              dot={false}
              activeDot={{ r: 4 }}
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
