"use client";

import { Cell, Legend, Pie, PieChart, Tooltip } from "recharts";
import { CATEGORICAL_PALETTE } from "@/lib/chart-tokens";
import { resolveColor, withPercent } from "../format";
import { ChartBox, EmptyState, VisualTooltip, useFormats, useRowClick } from "./shared";

export default function PieVisual({ visual, result }) {
  const rows = (result?.rows || []).filter((r) => Number(r.value) > 0);
  const onRowClick = useRowClick({ ...visual, x: "x" });
  const formats = useFormats(visual);
  if (rows.length === 0) return <EmptyState>—</EmptyState>;
  const total = rows.reduce((sum, r) => sum + Number(r.value), 0);
  return (
    <ChartBox>
      <PieChart>
        <Tooltip content={<VisualTooltip />} />
        <Legend
          iconType="circle"
          iconSize={8}
          layout="vertical"
          align="right"
          verticalAlign="middle"
          wrapperStyle={{ fontSize: 11, color: "var(--text-secondary)" }}
          formatter={formats.xTick}
        />
        <Pie
          data={rows}
          dataKey="value"
          nameKey="x"
          innerRadius="55%"
          outerRadius="85%"
          paddingAngle={2}
          stroke="none"
          isAnimationActive={false}
          cursor={onRowClick ? "pointer" : undefined}
          onClick={onRowClick ? (d) => onRowClick(d?.payload ?? d) : undefined}
          label={({ value }) => withPercent(Math.round((Number(value) / total) * 100), formats.locale)}
          labelLine={false}
        >
          {rows.map((row, i) => (
            <Cell
              key={i}
              fill={
                row._color ? resolveColor(row._color) : CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length]
              }
            />
          ))}
        </Pie>
      </PieChart>
    </ChartBox>
  );
}
