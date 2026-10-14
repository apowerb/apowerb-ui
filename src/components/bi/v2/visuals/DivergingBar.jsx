"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
  VisualTooltip,
  useActiveClickValue,
  useFormats,
  useRowClick,
} from "./shared";

/** Bars around a zero baseline: positive and negative use different colours. */
export default function DivergingBar({ visual, result }) {
  const rows = result?.rows || [];
  const s = (visual.series || [])[0];
  const onRowClick = useRowClick(visual);
  const active = useActiveClickValue(visual);
  const formats = useFormats(visual);
  if (rows.length === 0 || !s || !visual.x) return <EmptyState>—</EmptyState>;
  const label = s.label || s.key;
  const base = seriesColor(s.color, 0);
  const dim = (row) =>
    active != null && onRowClick && String(row?.[visual.x]) !== active ? 0.4 : 1;

  return (
    <ChartBox>
      <BarChart data={rows} margin={MARGIN} stackOffset="sign">
        <CartesianGrid {...GRID} />
        <XAxis
          dataKey={visual.x}
          tickFormatter={formats.xTick}
          {...AXIS}
          minTickGap={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis tickFormatter={formats.tick(s.key)} width={48} {...AXIS} />
        <Tooltip
          content={<VisualTooltip labels={{ [s.key]: label }} fmt={formats.value} />}
          cursor={{ fill: "var(--bg-surface-hover)", opacity: 0.5 }}
        />
        <ReferenceLine y={0} stroke="var(--text-muted)" strokeWidth={1} />
        {(result?.reference_lines || [])
          .filter((l) => Number.isFinite(Number(l.value)))
          .map((l, i) => (
            <ReferenceLine
              key={`ref-${i}`}
              y={Number(l.value)}
              stroke={resolveColor(l.color, "var(--v2-muted)")}
              strokeDasharray={l.dash === false ? undefined : "5 4"}
            />
          ))}
        <Bar
          dataKey={s.key}
          name={label}
          fill={base}
          radius={2}
          maxBarSize={36}
          isAnimationActive={false}
          cursor={onRowClick ? "pointer" : undefined}
          onClick={onRowClick ? (d) => onRowClick(d?.payload ?? d) : undefined}
        >
          {rows.map((row, i) => {
            const v = Number(row[s.key]);
            const sign = v < 0 ? "var(--v2-bad)" : "var(--v2-good)";
            return <Cell key={i} fill={rowColor(row, s.key, sign)} fillOpacity={dim(row)} />;
          })}
        </Bar>
      </BarChart>
    </ChartBox>
  );
}
