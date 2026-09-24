"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "use-intl";
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Loader2, Download, Table2, Info } from "lucide-react";
import { postForecast } from "@/lib/api";
import { buildDiagnostics, forecastToCsv, reliabilityBadge, toChartSeries } from "@/lib/forecast";
import ChartTooltip from "./ChartTooltip";

const RELIABILITY_TONE = {
  good: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  fair: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  poor: "bg-red-500/10 text-red-400 border-red-500/20",
  unknown: "bg-gray-500/10 th-text-faint border-gray-500/20",
};

function downloadCsv(csv, filename) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Runtime widget "Prévision" — appelle POST /api/v1/forecast (cœur) avec
 * les lignes déjà chargées par ChartRenderer, puis affiche historique +
 * prévision + bandes de confiance, un badge de fiabilité, et un export CSV.
 *
 * `rows` : lignes brutes de la source du widget (mêmes que les autres
 * chart_type — déjà résolues par le cœur via chart_type=forecast).
 * `config` : { date_var, target_var, group_var, horizon, frequency,
 * models, confidence_levels } — construit par l'assistant de création.
 */
export default function ForecastChart({ rows, config, title }) {
  const t = useTranslations("ForecastChart");
  const [status, setStatus] = useState("idle"); // idle|loading|success|error
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(0);
  const [showTable, setShowTable] = useState(false);
  const abortRef = useRef(null);

  const safeRows = useMemo(() => (Array.isArray(rows) ? rows : []), [rows]);

  useEffect(() => {
    // No historical rows: nothing to compute. The empty-state render below
    // never reads `status`, so no state update is needed here.
    if (safeRows.length === 0) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus("loading");
    setError(null);

    postForecast(
      {
        data: safeRows,
        date_var: config.date_var,
        target_var: config.target_var,
        group_var: config.group_var || null,
        horizon: config.horizon,
        frequency: config.frequency || null,
        models: config.models || ["prophet"],
        confidence_levels: config.confidence_levels || [0.8, 0.95],
      },
      { signal: controller.signal },
    )
      .then((res) => {
        setResponse(res);
        setStatus("success");
      })
      .catch((err) => {
        if (err?.name === "AbortError") {
          setStatus("cancelled");
          return;
        }
        setError(err);
        setStatus("error");
      });

    return () => controller.abort();
  }, [safeRows, config]);

  const diagnostics = useMemo(
    () =>
      buildDiagnostics({
        rows: safeRows,
        dateColumn: config.date_var,
        targetColumn: config.target_var,
        horizon: config.horizon,
      }),
    [safeRows, config.date_var, config.target_var, config.horizon],
  );

  if (safeRows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-1 px-3">
        <p className="text-xs th-text-faint text-center">{t("empty")}</p>
      </div>
    );
  }

  if (status === "cancelled") {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-xs th-text-faint">{t("cancelled")}</p>
      </div>
    );
  }

  if (status === "loading" || status === "idle") {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Loader2 size={24} className="animate-spin text-blue-400" />
        <p className="text-xs th-text-faint">{t("computing")}</p>
        <button
          type="button"
          onClick={() => abortRef.current?.abort()}
          className="text-[11px] th-text-faint hover:th-text underline"
        >
          {t("cancel")}
        </button>
      </div>
    );
  }

  if (status === "error") {
    const firstError = error?.errors?.[0];
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 px-3 text-center">
        <p className="text-xs text-red-400 break-words max-w-full select-text">{error.message}</p>
        {firstError?.field && (
          <p className="text-[10px] th-text-faint">{t("errorFieldLabel", { field: firstError.field })}</p>
        )}
      </div>
    );
  }

  const series = response?.series || [];
  const current = series[selectedGroup] || series[0];
  if (!current) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-xs th-text-faint">{t("empty")}</p>
      </div>
    );
  }

  const badge = reliabilityBadge(current);
  const badgeLabel = t(
    `reliability${badge.level.charAt(0).toUpperCase()}${badge.level.slice(1)}`,
  );
  const chartPoints = toChartSeries(current);
  const historyEndIndex = (current.history || []).length - 1;
  const splitDate = current.history?.[historyEndIndex]?.date;
  const hasBands = chartPoints.some((p) => p.lower_95 != null);
  const csv = forecastToCsv(current);

  return (
    <div className="flex flex-col h-full gap-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            tabIndex={0}
            title={badge.explanation}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${RELIABILITY_TONE[badge.level]}`}
          >
            <Info size={11} />
            {badgeLabel}
          </span>
          {series.length > 1 && (
            <label className="flex items-center gap-1 text-[11px] th-text-faint">
              {t("seriesSelectorLabel")}
              <select
                aria-label={t("seriesSelectorLabel")}
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(Number(e.target.value))}
                className="th-bg-surface border th-border rounded px-1.5 py-0.5 th-text text-[11px]"
              >
                {series.map((s, idx) => (
                  <option key={s.group ?? idx} value={idx}>
                    {s.group ?? t("noGroup")}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            className="inline-flex items-center gap-1 text-[11px] th-text-faint hover:th-text underline"
          >
            <Table2 size={11} />
            {showTable ? t("hideTable") : t("tableView")}
          </button>
          <button
            type="button"
            onClick={() => downloadCsv(csv, `${(title || "forecast").replace(/\s+/g, "_")}.csv`)}
            className="inline-flex items-center gap-1 text-[11px] th-text-faint hover:th-text underline"
          >
            <Download size={11} />
            {t("exportCsv")}
          </button>
        </div>
      </div>

      {diagnostics.warnings.length > 0 && (
        <ul className="text-[10px] text-amber-400 space-y-0.5">
          {diagnostics.warnings.map((w) => (
            <li key={w.code}>{w.message}</li>
          ))}
        </ul>
      )}

      {!showTable ? (
        <div className="flex-1 min-h-[160px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartPoints}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {hasBands && (
                <Area
                  dataKey="upper_95"
                  stroke="none"
                  fill="#3b82f6"
                  fillOpacity={0.08}
                  name={t("confidence95")}
                  isAnimationActive={false}
                />
              )}
              {hasBands && (
                <Area
                  dataKey="lower_95"
                  stroke="none"
                  fill="#0a0e1a"
                  fillOpacity={1}
                  name={t("confidence95")}
                  legendType="none"
                  isAnimationActive={false}
                />
              )}
              {hasBands && (
                <Area
                  dataKey="upper_80"
                  stroke="none"
                  fill="#3b82f6"
                  fillOpacity={0.18}
                  name={t("confidence80")}
                  isAnimationActive={false}
                />
              )}
              {hasBands && (
                <Area
                  dataKey="lower_80"
                  stroke="none"
                  fill="#0a0e1a"
                  fillOpacity={1}
                  legendType="none"
                  name={t("confidence80")}
                  isAnimationActive={false}
                />
              )}
              <Line
                type="monotone"
                dataKey="history"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                name={t("historyLabel")}
                connectNulls={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="forecast"
                stroke="#a78bfa"
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
                name={t("forecastLabel")}
                connectNulls={false}
                isAnimationActive={false}
              />
              {splitDate && (
                <ReferenceLine x={splitDate} stroke="var(--border)" strokeDasharray="2 2" />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex-1 overflow-auto rounded-lg border th-border">
          <table className="w-full text-xs">
            <caption className="sr-only">{title || t("forecastLabel")}</caption>
            <thead>
              <tr className="th-bg-surface border-b th-border">
                <th scope="col" className="text-left px-2 py-1 th-text-secondary">{t("dateColumn")}</th>
                <th scope="col" className="text-left px-2 py-1 th-text-secondary">{t("valueColumn")}</th>
                {hasBands && (
                  <>
                    <th scope="col" className="text-left px-2 py-1 th-text-secondary">{t("lowerBound")} 80%</th>
                    <th scope="col" className="text-left px-2 py-1 th-text-secondary">{t("upperBound")} 80%</th>
                    <th scope="col" className="text-left px-2 py-1 th-text-secondary">{t("lowerBound")} 95%</th>
                    <th scope="col" className="text-left px-2 py-1 th-text-secondary">{t("upperBound")} 95%</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {(current.forecast || []).map((f) => (
                <tr key={f.date} className="border-b th-border">
                  <td className="px-2 py-1 th-text">{f.date}</td>
                  <td className="px-2 py-1 th-text font-mono">{f.value}</td>
                  {hasBands && (
                    <>
                      <td className="px-2 py-1 th-text-faint font-mono">{f.lower_80}</td>
                      <td className="px-2 py-1 th-text-faint font-mono">{f.upper_80}</td>
                      <td className="px-2 py-1 th-text-faint font-mono">{f.lower_95}</td>
                      <td className="px-2 py-1 th-text-faint font-mono">{f.upper_95}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
