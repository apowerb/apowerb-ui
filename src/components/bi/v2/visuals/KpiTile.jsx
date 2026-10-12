"use client";

import { useId } from "react";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { resolveColor } from "../format";

/**
 * KPI card: the value (nowrap, unit smaller beside it), a coloured evolution
 * badge, a small caption line and, when the server sends `spark`, a sparkline
 * in the colour of the status. The server sends display strings; nothing is
 * recomputed here.
 */
// "981 unités" -> ["981", "unités"]; "19,1 k unités" -> ["19,1 k", "unités"]; "100,0 %" stays whole.
export function splitUnit(formatted) {
  const m = /^([+−-]?[\d\s  ,.]*\d(?:[  ]?(?:k|M|%))?)[\s ]+(?![kM](?:\s|$))([A-Za-zÀ-ÿ].*)$/.exec(String(formatted ?? ""));
  return m ? [m[1], m[2]] : [String(formatted ?? ""), ""];
}

/** Evolution badge tone: green when up, red when down, quiet when flat. */
function deltaTone(delta) {
  if (typeof delta === "number" && delta > 0) return "good";
  if (typeof delta === "number" && delta < 0) return "bad";
  return "muted";
}

/** Sparkline without axes; a flat series is padded so it draws a mid-height line. */
function Sparkline({ values, color }) {
  const gid = `kpi-spark-${useId().replace(/[^\w]/g, "")}`;
  const data = values.map((v, i) => ({ i, v: Number(v) })).filter((d) => Number.isFinite(d.v));
  if (data.length < 2) return null;
  const min = Math.min(...data.map((d) => d.v));
  const max = Math.max(...data.map((d) => d.v));
  const pad = max === min ? Math.abs(max || 1) * 0.1 : (max - min) * 0.12;
  return (
    <div className="mt-1.5 min-h-8 w-full flex-1 [max-height:3.5rem]" data-testid="kpi-spark" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%" minHeight={32}>
        <AreaChart data={data} margin={{ top: 2, right: 1, bottom: 2, left: 1 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={[min - pad, max + pad]} />
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${gid})`}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function KpiTile({ result }) {
  const kpi = result?.value;
  if (!kpi) return null;
  const color = kpi.status ? resolveColor(kpi.status) : "var(--text-primary)";
  const delta = kpi.delta;
  const DeltaIcon = delta == null || delta === 0 ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;
  const tone = deltaTone(delta);
  const toneColor = tone === "muted" ? "var(--text-muted)" : `var(--v2-${tone})`;
  const [figure, unit] = splitUnit(kpi.formatted);
  const spark = Array.isArray(kpi.spark) ? kpi.spark : null;
  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="kpi-tile">
      <div className="flex min-w-0 flex-col gap-1 pt-1">
        <div className="flex min-w-0 items-center justify-between gap-x-2">
          <span
            data-testid="kpi-value"
            data-status={kpi.status || "none"}
            className="bi-v2-num flex min-w-0 items-baseline gap-x-1 whitespace-nowrap text-[clamp(1.25rem,12cqw,1.75rem)] font-bold leading-none tracking-tight"
            style={{ color }}
          >
            <span className="whitespace-nowrap">{figure}</span>
            {unit && (
              <span className="whitespace-nowrap text-[clamp(0.65rem,4.6cqw,0.8rem)] font-medium opacity-80">{unit}</span>
            )}
          </span>
          {kpi.delta_formatted && (
            <span
              data-testid="kpi-delta"
              data-tone={tone}
              className="bi-v2-num inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none"
              style={{
                color: toneColor,
                background: `color-mix(in srgb, ${toneColor} 14%, transparent)`,
              }}
            >
              <DeltaIcon size={11} aria-hidden="true" />
              {kpi.delta_formatted}
            </span>
          )}
        </div>
        {(kpi.secondary || kpi.target_label) && (
          <div className="line-clamp-2 text-[11px] leading-snug text-[color:var(--v2-caption)]">
            {kpi.secondary && <span className="bi-v2-num">{kpi.secondary}</span>}
            {kpi.secondary && kpi.target_label && <span aria-hidden="true"> · </span>}
            {kpi.target_label && <span>{kpi.target_label}</span>}
          </div>
        )}
      </div>
      {spark && <Sparkline values={spark} color={kpi.status ? color : "var(--v2-accent)"} />}
    </div>
  );
}
