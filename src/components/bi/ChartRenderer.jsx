"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "use-intl";
import {
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  AreaChart, Area,
  ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Bot, Loader2 } from "lucide-react";
import { getChartData, getPublicChartData } from "@/lib/api";
import {
  AXIS_PROPS,
  CATEGORICAL_PALETTE,
  GRID_PROPS,
  colorForCategory,
  formatChartLabel,
  humanizeAxisLabel,
  humanizeColumnName,
} from "@/lib/chart-tokens";
import StatCard from "./StatCard";
import DataTable from "./DataTable";
import ChartTooltip from "./ChartTooltip";
import { useOAuthPopup } from "@/hooks/useOAuthPopup";

function OneDriveReconnectButton({ onDone }) {
  const t = useTranslations("ChartRenderer");
  const [connecting, setConnecting] = useState(false);
  const { openOAuth } = useOAuthPopup({
    onSuccess: (provider) => {
      if (provider !== "microsoft_onedrive") return;
      setConnecting(false);
      onDone?.();
    },
    onFailure: () => setConnecting(false),
    onCancel: () => setConnecting(false),
  });
  return (
    <button
      type="button"
      onClick={() => {
        setConnecting(true);
        openOAuth("microsoft_onedrive");
      }}
      disabled={connecting}
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-sky-500/20 text-sky-200 hover:bg-sky-500/30 text-[10px] font-semibold transition-colors disabled:opacity-60"
    >
      {connecting ? (
        <Loader2 size={10} className="animate-spin" />
      ) : null}
      {connecting ? t("connecting") : t("connectOneDrive")}
    </button>
  );
}

// Legacy palette kept ONLY as the index-based fallback. Semantic values
// (OK / NON_CONFORME / yes / no …) flow through colorForCategory() in
// @/lib/chart-tokens and never hit this array. See chart-tokens.js to
// add a new semantic mapping.
const COLORS = CATEGORICAL_PALETTE;

function getNumericKeys(data) {
  if (!data || data.length === 0) return [];
  const allKeys = Object.keys(data[0]);
  // Skip the first key (label / category axis) and keep only numeric ones
  return allKeys.slice(1).filter((key) => {
    return data.some((row) => typeof row[key] === "number" || !isNaN(Number(row[key])));
  });
}

function getLabelKey(data) {
  if (!data || data.length === 0) return "name";
  return Object.keys(data[0])[0] || "name";
}

// CSV data comes as strings — cast numeric columns to actual numbers for recharts
function castNumericValues(data, numericKeys) {
  if (!data || !numericKeys?.length) return data;
  return data.map((row) => {
    const cast = { ...row };
    for (const key of numericKeys) {
      const num = Number(cast[key]);
      if (!isNaN(num)) cast[key] = num;
    }
    return cast;
  });
}

// Build the (rows, series) pair fed to bar / line charts. When the source
// has no numeric column (typical for text-heavy sheets — Email / Status /
// Sent at…), fall back to a count aggregation grouped on the label column
// so the chart actually has something to draw instead of an empty canvas.
function buildCategoricalSeries({ rows, castedRows, labelKey, numericKeys, emptyLabel = "(empty)" }) {
  if (numericKeys?.length) {
    return { rows: castedRows, seriesKeys: numericKeys, xKey: labelKey };
  }
  if (!rows?.length) {
    return { rows: [], seriesKeys: [], xKey: labelKey };
  }
  const counts = new Map();
  for (const r of rows) {
    const key = String(r[labelKey] ?? emptyLabel);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const aggregated = Array.from(counts, ([k, v]) => ({ [labelKey]: k, count: v }));
  return { rows: aggregated, seriesKeys: ["count"], xKey: labelKey };
}

// Shared Recharts axis props — centralised in chart-tokens.js so a
// typography or border-colour change propagates to every chart.
const commonAxisProps = AXIS_PROPS;
const xAxisProps = { ...AXIS_PROPS, interval: 0, angle: -30, textAnchor: 'end', height: 80 };

// X-axis tick formatter — date-aware AND status-aware. SCREAMING_SNAKE
// statuses (NON_CONFORME, PRICE_MISMATCH, ORDER_NOT_FOUND…) become the
// curated French short forms ("Non conformes", "Prix", "Commande
// absente"); ISO dates become "lun. 12 mai"; everything else passes
// through unchanged.
const xAxisTickFormatter = (value) => humanizeAxisLabel(value);

export default function ChartRenderer({
  chartId,
  filterParams,
  publicMode = false,
  onDelete,
  // Called once with ``{ title, chart_type }`` after the chart's
  // metadata has been resolved from the backend. The dashboard uses
  // this to render the real chart title in its card header instead
  // of the generic "Chart" fallback.
  onLoaded,
}) {
  const t = useTranslations("ChartRenderer");
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const intervalRef = useRef(null);
  // Stable ref for the onLoaded callback so a parent re-render that
  // produces a new function identity does not retrigger fetchData via
  // useCallback dependency.
  const onLoadedRef = useRef(onLoaded);
  useEffect(() => {
    onLoadedRef.current = onLoaded;
  }, [onLoaded]);

  const fetchData = useCallback(async () => {
    if (!chartId) {
      setLoading(false);
      setError(t("noChartId"));
      return;
    }
    try {
      const params = filterParams || {};
      const fetchFn = publicMode ? getPublicChartData : getChartData;
      const result = await fetchFn(chartId, params);
      // Executors (OneDrive, Google Drive, agent) return a single-row error
      // envelope rather than raising. Surface it as a real chart error so the
      // user sees a clear message + actionable buttons instead of a broken viz.
      const rows = result?.rows || [];
      if (rows.length === 1 && typeof rows[0]?.error === "string" && Object.keys(rows[0]).length <= 2) {
        setChartData(null);
        setError(rows[0].error);
        return;
      }
      setChartData(result);
      setError(null);

      // Surface the chart's resolved metadata (title, chart_type, row
      // count) so dashboard / embedding contexts can render their own
      // header rather than the generic "Chart" placeholder.
      const cb = onLoadedRef.current;
      if (typeof cb === "function") {
        try {
          cb({
            title: result?.title || null,
            description: result?.description || null,
            chart_type: result?.chart_type || null,
            row_count: Array.isArray(result?.rows) ? result.rows.length : null,
          });
        } catch {
          // Never let a consumer's callback break the chart render.
        }
      }

      // Set up auto-refresh if configured
      if (result?.refresh_interval && result.refresh_interval > 0) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(async () => {
          try {
            const refreshed = (publicMode ? getPublicChartData : getChartData)(chartId, params);
            setChartData(await refreshed);
          } catch {
            // Silently fail on auto-refresh
          }
        }, result.refresh_interval * 1000);
      }
    } catch (err) {
      console.error(`[ChartRenderer] chart=${chartId} status=${err.status ?? "?"} message=`, err.message);
      setError(
        err.status
          ? t("httpError", { status: err.status, message: err.message })
          : err.message,
      );
    } finally {
      setLoading(false);
    }
  }, [chartId, filterParams, publicMode, t]);

  useEffect(() => {
    setLoading(true);
    fetchData();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-2 th-border border-t-blue-500" />
      </div>
    );
  }

  if (error || !chartData) {
    const needsOneDrive =
      error && /onedrive.*(not connected|not configured|credentials)/i.test(error);
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 px-3">
        <p className="text-xs th-text-faint text-center select-text break-words max-w-full" style={{ userSelect: "text" }}>
          {error || t("noData")}
        </p>
        {error && (
          <div className="flex items-center gap-3 flex-wrap justify-center">
            {needsOneDrive && (
              <OneDriveReconnectButton
                onDone={async () => {
                  setRetrying(true);
                  try {
                    await fetchData();
                  } finally {
                    setRetrying(false);
                  }
                }}
              />
            )}
            <button
              type="button"
              onClick={async (e) => {
                e.stopPropagation();
                if (retrying) return;
                setRetrying(true);
                try {
                  await fetchData();
                } finally {
                  setRetrying(false);
                }
              }}
              disabled={retrying}
              className="inline-flex items-center gap-1 text-[10px] th-text-faint hover:th-text underline disabled:opacity-60"
            >
              {retrying ? (
                <Loader2 size={10} className="animate-spin" />
              ) : null}
              {retrying ? t("retrying") : t("retry")}
            </button>
            <button
              type="button"
              onClick={async (e) => {
                e.stopPropagation();
                const payload = `chart=${chartId}\n${error}`;
                try {
                  if (navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(payload);
                  } else {
                    const ta = document.createElement("textarea");
                    ta.value = payload;
                    ta.style.position = "fixed";
                    ta.style.left = "-9999px";
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand("copy");
                    document.body.removeChild(ta);
                  }
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                } catch (err) {
                  console.error("[ChartRenderer] copy failed:", err);
                }
              }}
              className="text-[10px] th-text-faint hover:th-text underline"
            >
              {copied ? t("copied") : t("copyError")}
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!confirm(t("deleteConfirm"))) return;
                try {
                  // If the parent (e.g. DashboardDetail) handles deletion,
                  // let it detach the component first so we don't leave a
                  // dangling chart_id reference that causes a 404 on reload.
                  if (typeof onDelete === "function") {
                    await onDelete();
                    return;
                  }
                  const { deleteChart } = await import("@/lib/api");
                  await deleteChart(chartId);
                  window.location.reload();
                } catch (err) {
                  alert(t("deleteFailed", { message: err.message }));
                }
              }}
              className="text-[10px] text-red-400 hover:text-red-300 underline"
            >
              {t("deleteChart")}
            </button>
          </div>
        )}
      </div>
    );
  }

  const chartType = chartData.chart_type || "bar";
  const data = chartData.rows || [];
  const isAgentSource = chartData.source?.source_type === "agent";

  const AgentBadge = () =>
    isAgentSource ? (
      <span className="inline-flex items-center gap-1 text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full mb-1">
        <Bot className="h-3 w-3" />
        {t("agentPowered")}
      </span>
    ) : null;

  if (!data.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <AgentBadge />
        <p className="text-xs th-text-faint">{t("noDataToDisplay")}</p>
      </div>
    );
  }

  // Stat / KPI type — render StatCard
  if (chartType === "stat") {
    const cfg = chartData.config || {};
    const firstRow = data[0];
    const keys = Object.keys(firstRow);

    // Custom formula: evaluate {col1} + {col2} etc.
    if (cfg.formula) {
      const formulaValues = data.map((row) => {
        let expr = cfg.formula;
        for (const k of keys) {
          const num = Number(row[k]);
          if (!isNaN(num)) expr = expr.replaceAll(`{${k}}`, String(num));
        }
        try { return Function(`"use strict"; return (${expr})`)(); } catch { return NaN; }
      }).filter((v) => !isNaN(v));

      const agg = cfg.aggregation || "sum";
      let value = 0;
      if (formulaValues.length > 0) {
        if (agg === "sum") value = formulaValues.reduce((a, b) => a + b, 0);
        else if (agg === "avg") value = formulaValues.reduce((a, b) => a + b, 0) / formulaValues.length;
        else if (agg === "count") value = formulaValues.length;
        else if (agg === "min") value = Math.min(...formulaValues);
        else if (agg === "max") value = Math.max(...formulaValues);
        else value = formulaValues.reduce((a, b) => a + b, 0);
      }
      value = Math.round(value * 100) / 100;
      return <StatCard value={value} label={chartData.title || t("kpiLabel")} unit={cfg.unit || ""} prefix={cfg.prefix || ""} format={cfg.format || null} tone={cfg.tone || null} thresholds={cfg.thresholds || null} color={cfg.color || "default"} icon={cfg.icon || null} description={cfg.description || ""} trend={chartData.trend || null} />;
    }

    // Column-based: use config.column or detect first numeric
    const configColumn = cfg.column;
    let valueKey;
    if (configColumn && keys.includes(configColumn)) {
      valueKey = configColumn;
    } else {
      valueKey = keys.find((k) => typeof firstRow[k] === "number" || !isNaN(Number(firstRow[k])));
      if (!valueKey) valueKey = keys[keys.length - 1];
    }

    const numericValues = data.map((r) => Number(r[valueKey])).filter((n) => !isNaN(n));
    const agg = cfg.aggregation || "sum";
    let value = 0;
    if (numericValues.length > 0) {
      if (agg === "sum") value = numericValues.reduce((a, b) => a + b, 0);
      else if (agg === "avg") value = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
      else if (agg === "count") value = numericValues.length;
      else if (agg === "min") value = Math.min(...numericValues);
      else if (agg === "max") value = Math.max(...numericValues);
      else value = numericValues.reduce((a, b) => a + b, 0);
    } else if (data.length === 1) {
      value = firstRow[valueKey];
    }
    if (typeof value === "number") value = Math.round(value * 100) / 100;

    // Optional dual-value support: if cfg.secondary_column is set and
    // present in the result, surface it as the StatCard's secondaryValue
    // (Conformes / Non conformes pattern).
    let secondaryValue = null;
    const secondaryKey = cfg.secondary_column;
    if (secondaryKey && keys.includes(secondaryKey)) {
      const secValues = data.map((r) => Number(r[secondaryKey])).filter((n) => !isNaN(n));
      if (secValues.length > 0) {
        let s = secValues.reduce((a, b) => a + b, 0);
        if (agg === "avg") s = s / secValues.length;
        else if (agg === "count") s = secValues.length;
        else if (agg === "min") s = Math.min(...secValues);
        else if (agg === "max") s = Math.max(...secValues);
        secondaryValue = Math.round(s * 100) / 100;
      } else if (data.length === 1) {
        secondaryValue = firstRow[secondaryKey];
      }
    }

    return (
      <StatCard
        value={value}
        label={chartData.title || valueKey}
        unit={cfg.unit || ""}
        prefix={cfg.prefix || ""}
        format={cfg.format || null}
        tone={cfg.tone || null}
        thresholds={cfg.thresholds || null}
        color={cfg.color || "default"}
        icon={cfg.icon || null}
        secondaryValue={secondaryValue}
        secondaryTone={cfg.secondary_tone || null}
        secondaryFormat={cfg.secondary_format || null}
        description={cfg.description || ""}
        trend={chartData.trend || null}
      />
    );
  }

  // Table type — render DataTable
  if (chartType === "table") {
    const columns = chartData.labels || (data.length > 0 ? Object.keys(data[0]) : []);
    return (
      <div className="h-full flex flex-col">
        <AgentBadge />
        <div className="flex-1 min-h-0">
          <DataTable
            data={data}
            columns={columns}
            title={chartData.title}
            pageSize={25}
            actionColumn={chartData.config?.actionColumn}
          />
        </div>
      </div>
    );
  }

  const cfg = chartData.config || {};
  const labelKey = cfg.labelColumn || getLabelKey(data);
  const numericKeys = cfg.valueColumns?.length > 0
    ? cfg.valueColumns.filter((k) => Object.keys(data[0]).includes(k))
    : getNumericKeys(data);

  // Cast string values to numbers for recharts
  const chartData_ = castNumericValues(data, numericKeys);

  // Pie / Donut chart (donut = pie with innerRadius — same rendering
  // path, the wider/inner ring just makes it more readable on a
  // dashboard. Routing them through the same branch avoids the
  // "donut falls through to the bar fallback" silent bug.)
  if (chartType === "pie" || chartType === "donut") {
    const nameKey = cfg.labelColumn || getLabelKey(data);
    const explicitValueKey =
      (cfg.valueColumns?.length > 0 ? cfg.valueColumns[0] : null) ||
      numericKeys[0] ||
      null;

    // If the explicit value column isn't numeric (common for text-heavy
    // spreadsheets like "Email / Status / Sent at"), aggregate by grouping
    // rows on nameKey and counting occurrences so the pie actually has
    // values to draw.
    let pieRows;
    let valueKey;
    let nameKeyForPie = nameKey;
    if (explicitValueKey && data.some((r) => typeof r[explicitValueKey] === "number" && !Number.isNaN(r[explicitValueKey]))) {
      pieRows = chartData_;
      valueKey = explicitValueKey;
    } else {
      const counts = new Map();
      for (const r of data) {
        const key = String(r[nameKey] ?? t("emptyValue"));
        counts.set(key, (counts.get(key) || 0) + 1);
      }
      pieRows = Array.from(counts, ([k, v]) => ({ [nameKey]: k, count: v }));
      valueKey = "count";
      nameKeyForPie = nameKey;
    }

    if (!pieRows.length) {
      return (
        <div className="flex items-center justify-center h-full">
          <p className="text-xs th-text-faint">{t("noDataToDisplay")}</p>
        </div>
      );
    }

    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={pieRows}
            dataKey={valueKey}
            nameKey={nameKeyForPie}
            cx="50%"
            cy="50%"
            outerRadius="80%"
            innerRadius="40%"
            paddingAngle={2}
            label={({ percent }) => `${(percent * 100).toFixed(1)}%`}
            labelLine={{ stroke: "var(--text-faint)" }}
          >
            {pieRows.map((row, idx) => (
              <Cell
                key={idx}
                fill={colorForCategory(row[nameKeyForPie], idx)}
              />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
          <Legend
            wrapperStyle={{ color: "var(--text-secondary)", fontSize: "12px" }}
          />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  // Bar chart
  if (chartType === "bar") {
    const {
      rows: barRows,
      seriesKeys: barSeries,
      xKey: barXKey,
    } = buildCategoricalSeries({
      rows: data,
      castedRows: chartData_,
      labelKey,
      numericKeys,
      emptyLabel: t("emptyValue"),
    });
    if (!barRows.length || !barSeries.length) {
      return (
        <div className="flex items-center justify-center h-full">
          <p className="text-xs th-text-faint">{t("noDataToDisplay")}</p>
        </div>
      );
    }
    // Single-series bar: colour each bar by its X value so statuses
    // (OK / NON_CONFORME / …) get their semantic colour. Multi-series:
    // each series keeps its categorical palette colour.
    const singleSeries = barSeries.length === 1;
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={barRows} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey={barXKey} tickFormatter={xAxisTickFormatter} {...xAxisProps} />
          <YAxis {...commonAxisProps} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--border)", fillOpacity: 0.25 }} />
          {barSeries.length > 1 && (
            <Legend
              wrapperStyle={{ color: "var(--text-secondary)", fontSize: "12px" }}
              formatter={(v) => humanizeColumnName(v)}
            />
          )}
          {barSeries.map((key, idx) => (
            <Bar
              key={key}
              dataKey={key}
              name={humanizeColumnName(key)}
              fill={colorForCategory(key, idx)}
              radius={[4, 4, 0, 0]}
              stackId={cfg.stacked ? "stack-a" : undefined}
            >
              {singleSeries &&
                barRows.map((row, rowIdx) => (
                  <Cell
                    key={`cell-${rowIdx}`}
                    fill={colorForCategory(row[barXKey], rowIdx)}
                  />
                ))}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // Line chart
  if (chartType === "line") {
    const {
      rows: lineRows,
      seriesKeys: lineSeries,
      xKey: lineXKey,
    } = buildCategoricalSeries({
      rows: data,
      castedRows: chartData_,
      labelKey,
      numericKeys,
      emptyLabel: t("emptyValue"),
    });
    if (!lineRows.length || !lineSeries.length) {
      return (
        <div className="flex items-center justify-center h-full">
          <p className="text-xs th-text-faint">{t("noDataToDisplay")}</p>
        </div>
      );
    }
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={lineRows} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey={lineXKey} tickFormatter={xAxisTickFormatter} {...xAxisProps} />
          <YAxis {...commonAxisProps} />
          <Tooltip content={<ChartTooltip />} />
          {lineSeries.length > 1 && (
            <Legend
              wrapperStyle={{ color: "var(--text-secondary)", fontSize: "12px" }}
              formatter={(v) => humanizeColumnName(v)}
            />
          )}
          {lineSeries.map((key, idx) => {
            const stroke = colorForCategory(key, idx);
            return (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                name={humanizeColumnName(key)}
                stroke={stroke}
                strokeWidth={2}
                dot={{ r: 3, fill: stroke }}
                activeDot={{ r: 5 }}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // Area chart
  if (chartType === "area") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData_} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <defs>
            {numericKeys.map((key, idx) => {
              const color = colorForCategory(key, idx);
              return (
                <linearGradient key={key} id={`area-${key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              );
            })}
          </defs>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey={labelKey} tickFormatter={xAxisTickFormatter} {...xAxisProps} />
          <YAxis {...commonAxisProps} />
          <Tooltip content={<ChartTooltip />} />
          {numericKeys.length > 1 && (
            <Legend
              wrapperStyle={{ color: "var(--text-secondary)", fontSize: "12px" }}
              formatter={(v) => humanizeColumnName(v)}
            />
          )}
          {numericKeys.map((key, idx) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              name={humanizeColumnName(key)}
              stroke={colorForCategory(key, idx)}
              strokeWidth={2}
              fill={`url(#area-${key})`}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  // Scatter chart (fallback)
  if (chartType === "scatter") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis
            dataKey={numericKeys[0] || labelKey}
            name={humanizeColumnName(numericKeys[0] || labelKey)}
            {...commonAxisProps}
          />
          <YAxis
            dataKey={numericKeys[1] || numericKeys[0]}
            name={humanizeColumnName(numericKeys[1] || numericKeys[0])}
            {...commonAxisProps}
          />
          <Tooltip content={<ChartTooltip />} />
          <Scatter data={chartData_} fill={colorForCategory(null, 0)} />
        </ScatterChart>
      </ResponsiveContainer>
    );
  }

  // Default fallback — render as bar (same semantic colouring as the
  // explicit "bar" branch above).
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData_} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey={labelKey} tickFormatter={xAxisTickFormatter} {...xAxisProps} />
        <YAxis {...commonAxisProps} />
        <Tooltip content={<ChartTooltip />} />
        {numericKeys.map((key, idx) => (
          <Bar
            key={key}
            dataKey={key}
            name={humanizeColumnName(key)}
            fill={colorForCategory(key, idx)}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
