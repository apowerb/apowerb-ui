"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "use-intl";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { BarChart3, Table2, Copy, Check, TrendingUp, TrendingDown } from "lucide-react";
import { parseChartSpec, toSlices, toStat, formatNumber } from "@/lib/chartSpec";
import { CATEGORICAL_PALETTE, AXIS_PROPS, GRID_PROPS } from "@/lib/chart-tokens";
import { DataTable } from "./StructuredOutput";

// Series identity never relies on colour alone: a legend is shown for two or
// more series, every value is readable in the table view, and the tooltip
// names the series. (The project palette fails the CVD check on the
// violet/indigo pair, so the secondary encodings are mandatory here.)
function colorAt(i) {
  return CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length];
}

function ChartTip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border th-border px-2.5 py-2 text-[11px] shadow-lg" style={{ background: "var(--bg-dropdown)" }}>
      {label != null && <div className="font-semibold th-text mb-1">{String(label)}</div>}
      {payload.map((p) => (
        <div key={p.dataKey || p.name} className="flex items-center gap-2 th-text-secondary">
          <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: p.color || p.payload?.fill }} />
          <span className="flex-1">{p.name}</span>
          <span className="tabular-nums font-medium th-text">{formatNumber(p.value, unit)}</span>
        </div>
      ))}
    </div>
  );
}

function StatView({ spec }) {
  const stat = toStat(spec);
  if (!stat) return null;
  const up = stat.delta != null && stat.delta >= 0;
  return (
    <div className="px-4 py-5 flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wider th-text-faint">{stat.label}</span>
      <span className="text-3xl font-semibold tabular-nums th-text">{formatNumber(stat.value, spec.unit)}</span>
      {stat.delta != null && (
        <span className={`inline-flex items-center gap-1 text-xs font-medium ${up ? "text-emerald-400" : "text-red-400"}`}>
          {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
          {up ? "+" : ""}
          {stat.delta.toFixed(1)}%
        </span>
      )}
    </div>
  );
}

function Plot({ spec }) {
  const { type, rows, xKey, series, unit, stacked } = spec;
  const multi = series.length > 1;
  const legend = multi ? (
    <Legend wrapperStyle={{ color: "var(--text-secondary)", fontSize: "11px" }} iconType="circle" iconSize={8} />
  ) : null;
  const tip = <Tooltip content={<ChartTip unit={unit} />} cursor={{ fill: "var(--border)", fillOpacity: 0.25 }} />;
  const xAxis = <XAxis dataKey={xKey} {...AXIS_PROPS} interval="preserveStartEnd" minTickGap={16} />;
  const yAxis = <YAxis {...AXIS_PROPS} width={44} tickFormatter={(v) => formatNumber(v)} />;

  if (type === "pie" || type === "donut") {
    const slices = toSlices(spec);
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip content={<ChartTip unit={unit} />} />
          <Legend wrapperStyle={{ color: "var(--text-secondary)", fontSize: "11px" }} iconType="circle" iconSize={8} />
          <Pie
            data={slices}
            dataKey="value"
            nameKey="name"
            innerRadius={type === "donut" ? "55%" : 0}
            outerRadius="80%"
            paddingAngle={2}
            stroke="var(--bg-body-mid)"
            strokeWidth={2}
            label={({ percent }) => `${Math.round(percent * 100)}%`}
            labelLine={false}
            fontSize={11}
          >
            {slices.map((_, i) => (
              <Cell key={i} fill={colorAt(i)} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (type === "line") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid {...GRID_PROPS} />
          {xAxis}
          {yAxis}
          {tip}
          {legend}
          {series.map((s, i) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={colorAt(i)} strokeWidth={2} dot={{ r: 3, strokeWidth: 0 }} activeDot={{ r: 5 }} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (type === "area") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid {...GRID_PROPS} />
          {xAxis}
          {yAxis}
          {tip}
          {legend}
          {series.map((s, i) => (
            <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={colorAt(i)} fill={colorAt(i)} fillOpacity={0.18} strokeWidth={2} stackId={stacked ? "a" : undefined} isAnimationActive={false} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  // bar (default)
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 4 }} barCategoryGap="22%" barGap={2}>
        <CartesianGrid {...GRID_PROPS} />
        {xAxis}
        {yAxis}
        {tip}
        {legend}
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={colorAt(i)} radius={[4, 4, 0, 0]} stackId={stacked ? "a" : undefined} isAnimationActive={false} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Renders a ```chart fence. Invalid specs fall back to the raw JSON so the
 * reader never loses the data the agent produced.
 */
export default function InlineChart({ source }) {
  const t = useTranslations("InlineChart");
  const spec = useMemo(() => parseChartSpec(source), [source]);
  const [view, setView] = useState("chart");
  const [copied, setCopied] = useState(false);

  const copySpec = async () => {
    try {
      await navigator.clipboard.writeText(source);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  if (!spec.ok) {
    return (
      <div className="my-2 rounded-lg border th-border th-bg-surface overflow-hidden" data-chart="invalid">
        <div className="px-3 py-1.5 text-[11px] th-text-faint border-b th-border-secondary flex items-center gap-2">
          <BarChart3 size={12} /> {t("invalid", { reason: t(`reason_${spec.reason}`) })}
        </div>
        <pre className="p-3 text-[11px] font-mono th-text-muted whitespace-pre-wrap break-words">{source}</pre>
      </div>
    );
  }

  const isStat = spec.type === "stat";
  const tableRows = spec.rows.map((r) => {
    const out = { [spec.xKey]: r[spec.xKey] };
    for (const s of spec.series) out[s.label] = r[s.key];
    return out;
  });

  return (
    <figure className="my-3 rounded-xl border th-border th-bg-surface overflow-hidden" data-chart={spec.type}>
      <figcaption className="flex items-center gap-2 px-3 py-2 border-b th-border-secondary">
        <span className="w-6 h-6 rounded-md bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0">
          <BarChart3 size={12} className="text-brand" />
        </span>
        <span className="text-xs font-semibold th-text truncate flex-1">{spec.title || t("untitled")}</span>
        {spec.truncated && <span className="text-[10px] th-text-ghost">{t("truncated")}</span>}
        {!isStat && (
          <div className="flex items-center gap-0.5 rounded-lg th-bg-surface border th-border-secondary p-0.5">
            <button
              type="button"
              onClick={() => setView("chart")}
              aria-pressed={view === "chart"}
              className={`px-2 py-0.5 rounded-md text-[10px] font-medium flex items-center gap-1 transition-colors ${view === "chart" ? "bg-brand/20 text-brand" : "th-text-faint hover:th-text-secondary"}`}
            >
              <BarChart3 size={11} /> {t("chart")}
            </button>
            <button
              type="button"
              onClick={() => setView("table")}
              aria-pressed={view === "table"}
              className={`px-2 py-0.5 rounded-md text-[10px] font-medium flex items-center gap-1 transition-colors ${view === "table" ? "bg-brand/20 text-brand" : "th-text-faint hover:th-text-secondary"}`}
            >
              <Table2 size={11} /> {t("table")}
            </button>
          </div>
        )}
        <button type="button" onClick={copySpec} className="p-1 rounded th-text-faint hover:th-text-secondary" title={t("copySpec")} aria-label={t("copySpec")}>
          {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
        </button>
      </figcaption>
      {isStat ? (
        <StatView spec={spec} />
      ) : view === "table" ? (
        <div className="px-2 pb-2">
          <DataTable data={tableRows} />
        </div>
      ) : (
        <div className="h-64 w-full px-2 py-3">
          <Plot spec={spec} />
        </div>
      )}
    </figure>
  );
}
