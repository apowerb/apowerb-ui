"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { resolveColor, rowColor, seriesColor, withPercent } from "../format";
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

/**
 * Vertical (`bar`) or horizontal (`hbar`) bars. A `_color_<key>` on a row
 * colours that mark (traffic lights, thresholds); the others keep the series
 * colour. Clicking a mark applies the visual's `click_filters`.
 */
export default function BarVisual({ visual, result, horizontal = false }) {
  const rows = result?.rows || [];
  const series = (visual.series || []).map((s, i) => ({
    ...s,
    label: s.label || s.key,
    stroke: seriesColor(s.color, i),
  }));
  const onRowClick = useRowClick(visual);
  const active = useActiveClickValue(visual);
  const formats = useFormats(visual);
  if (rows.length === 0 || series.length === 0 || !visual.x) {
    return <EmptyState>—</EmptyState>;
  }
  const labels = Object.fromEntries(series.map((s) => [s.key, s.label]));
  const dim = (row) =>
    active != null && onRowClick && String(row?.[visual.x]) !== active ? 0.4 : 1;
  const total = rows.reduce((sum, r) => sum + (Number(r[series[0]?.key]) || 0), 0);
  const showValues = horizontal && rows.length <= 14 && series.length === 1;

  const refs = (result?.reference_lines || [])
    .filter((l) => Number.isFinite(Number(l.value)))
    .map((l, i) => {
      const common = {
        stroke: resolveColor(l.color, "var(--v2-muted)"),
        strokeDasharray: l.dash === false ? undefined : "5 4",
        ifOverflow: "extendDomain",
        label: l.label
          ? { value: l.label, position: "right", fill: "var(--text-muted)", fontSize: 10 }
          : undefined,
      };
      return horizontal ? (
        <ReferenceLine key={`ref-${i}`} {...common} x={Number(l.value)} />
      ) : (
        <ReferenceLine key={`ref-${i}`} {...common} y={Number(l.value)} />
      );
    });

  return (
    <ChartBox>
      <BarChart
        data={rows}
        layout={horizontal ? "vertical" : "horizontal"}
        margin={horizontal ? { ...MARGIN, right: 96 } : marginFor(result)}
      >
        <CartesianGrid {...GRID} vertical={horizontal} horizontal={!horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" tickFormatter={formats.tick(series[0].key)} {...AXIS} />
            <YAxis
              type="category"
              dataKey={visual.x}
              tickFormatter={formats.xTick}
              width={96}
              {...AXIS}
            />
          </>
        ) : (
          <>
            <XAxis dataKey={visual.x} tickFormatter={formats.xTick} {...AXIS} minTickGap={12} />
            <YAxis tickFormatter={formats.tick(series[0].key)} width={48} {...AXIS} />
          </>
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
        {series.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            fill={s.stroke}
            radius={horizontal ? [0, 3, 3, 0] : [3, 3, 0, 0]}
            maxBarSize={horizontal ? 22 : 36}
            isAnimationActive={false}
            cursor={onRowClick ? "pointer" : undefined}
            onClick={onRowClick ? (d) => onRowClick(d?.payload ?? d) : undefined}
          >
            {rows.map((row, i) => (
              <Cell key={i} fill={rowColor(row, s.key, s.stroke)} fillOpacity={dim(row)} />
            ))}
            {showValues && (
              <LabelList
                dataKey={s.key}
                position="right"
                content={({ x, y, width, height, value }) => {
                  const share = total > 0 ? Math.round((Number(value) / total) * 100) : null;
                  const text = formats.value(s.key, value);
                  return (
                    <text
                      x={Number(x) + Number(width) + 6}
                      y={Number(y) + Number(height) / 2}
                      dominantBaseline="middle"
                      className="bi-v2-num"
                      style={{ fill: "var(--text-secondary)", fontSize: 11 }}
                    >
                      {share == null ? text : `${withPercent(share, formats.locale)} \u00b7 ${text}`}
                    </text>
                  );
                }}
              />
            )}
          </Bar>
        ))}
        {refs}
      </BarChart>
    </ChartBox>
  );
}
