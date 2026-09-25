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
import { Loader2, Download, Table2, Info, AlertTriangle } from "lucide-react";
import { postForecast } from "@/lib/api";
import { buildDiagnostics, forecastToCsv, proofFacts, reliabilityBadge, toChartSeries } from "@/lib/forecast";
import { formatChartLabel, formatChartValue } from "@/lib/chart-tokens";

const RELIABILITY_TONE = {
  good: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  fair: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  poor: "bg-red-500/10 text-red-400 border-red-500/20",
  unknown: "bg-gray-500/10 th-text-faint border-gray-500/20",
};

// Traduit le champ technique renvoyé par th2forecast (date_var, target_var…)
// en libellé métier ; les champs sans correspondance restent affichés tels
// quels plutôt que de masquer l'information.
const FIELD_LABEL_KEYS = {
  date_var: "fieldLabelDateVar",
  target_var: "fieldLabelTargetVar",
  group_var: "fieldLabelGroupVar",
  horizon: "fieldLabelHorizon",
  frequency: "fieldLabelFrequency",
  confidence_levels: "fieldLabelConfidenceLevels",
  models: "fieldLabelModels",
  data: "fieldLabelData",
};

// Bornes des erreurs de validation (422 du cœur) traduites en phrase métier ;
// les autres types gardent le message renvoyé tel quel.
const LIMIT_MESSAGE_KEYS = {
  less_than_equal: "errorMaxValue",
  greater_than_equal: "errorMinValue",
};

/**
 * Infobulle du graphique de prévision. ChartTooltip humanise le `dataKey`
 * (nom de colonne SQL) : ici les zones d'intervalle ont un `dataKey`
 * fonction et une valeur [bas, haut], d'où un libellé illisible. On affiche
 * donc le `name` déjà traduit de chaque série, l'intervalle en « bas – haut »,
 * et on saute les séries sans valeur à cette date (Réel sur un point prévu).
 */
export function ForecastTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;
  const entries = payload.filter((e) => e.value != null);
  if (entries.length === 0) return null;

  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs shadow-xl"
      style={{ borderColor: "var(--border)", background: "var(--bg-elevated)", color: "var(--foreground)" }}
      role="tooltip"
    >
      {label != null && <div className="font-semibold mb-1.5">{formatChartLabel(label)}</div>}
      <div className="flex flex-col gap-1">
        {entries.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-block h-2 w-2 rounded-full flex-shrink-0"
              style={{ background: entry.color || entry.fill }}
            />
            <span style={{ color: "var(--text-secondary)" }}>{entry.name}</span>
            <span className="font-mono font-semibold ml-auto">
              {Array.isArray(entry.value)
                ? `${formatChartValue(entry.value[0])} – ${formatChartValue(entry.value[1])}`
                : formatChartValue(entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

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
 * `onEditConfig` : optionnel, ouvre l'édition du widget (bouton affiché
 * uniquement à l'état d'erreur si ce handler est fourni).
 */
export default function ForecastChart({ rows, config, title, onEditConfig }) {
  const t = useTranslations("ForecastChart");
  const [status, setStatus] = useState("idle"); // idle|loading|success|error
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(0);
  const [showTable, setShowTable] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const abortRef = useRef(null);

  const safeRows = useMemo(() => (Array.isArray(rows) ? rows : []), [rows]);

  // ChartRenderer recomputes `chartData.rows || []` / `chartData.config ||
  // {}` on every one of its own re-renders (no memoisation there), so
  // `rows`/`config` get a fresh object identity even when their content is
  // unchanged. Keying the fetch effect on those identities re-triggered
  // POST /v1/jobs 2-3 times for a single widget display. Derive a stable,
  // content-based key from the rows and the config fields actually sent to
  // th2forecast, and key the effect on that instead — a real content change
  // still refetches, a same-content re-render no longer does.
  const requestKey = useMemo(() => {
    if (safeRows.length === 0) return null;
    return JSON.stringify({
      rows: safeRows,
      date_var: config.date_var,
      target_var: config.target_var,
      group_var: config.group_var || null,
      horizon: config.horizon,
      frequency: config.frequency || null,
      models: config.models || ["prophet"],
      confidence_levels: config.confidence_levels || [0.8, 0.95],
    });
  }, [
    safeRows,
    config.date_var,
    config.target_var,
    config.group_var,
    config.horizon,
    config.frequency,
    config.models,
    config.confidence_levels,
  ]);

  useEffect(() => {
    // No historical rows: nothing to compute. The empty-state render below
    // never reads `status`, so no state update is needed here.
    if (requestKey === null) return;
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
    // safeRows/config n'ont pas besoin de figurer ici : requestKey est leur
    // dérivé stable et couvre déjà tout changement de contenu pertinent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, retryToken]);

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
    const fieldKey = firstError?.field ? FIELD_LABEL_KEYS[firstError.field] : null;
    const fieldLabel = fieldKey ? t(fieldKey) : firstError?.field;
    const limitKey = firstError?.limit != null ? LIMIT_MESSAGE_KEYS[firstError.type] : null;
    const message = limitKey ? t(limitKey, { limit: firstError.limit }) : error.message;
    return (
      <div className="flex flex-col items-center justify-start h-full gap-2 px-4 pt-4 text-center">
        <AlertTriangle size={28} className="text-red-400" aria-hidden="true" />
        <p className="text-sm font-medium th-text">{t("errorTitle")}</p>
        <p className="text-xs text-red-400 break-words max-w-full select-text">{message}</p>
        {fieldLabel && (
          <p className="text-[11px] th-text-faint">{t("errorFieldLabel", { field: fieldLabel })}</p>
        )}
        <div className="flex items-center gap-2 mt-1">
          {onEditConfig && (
            <button
              type="button"
              onClick={onEditConfig}
              className="text-[11px] px-2.5 py-1 rounded border th-border th-text-secondary hover:th-text"
            >
              {t("editConfig")}
            </button>
          )}
          <button
            type="button"
            onClick={() => setRetryToken((n) => n + 1)}
            className="text-[11px] px-2.5 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20"
          >
            {t("retry")}
          </button>
        </div>
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
  // L'explication du badge (mesure de fiabilité) passe par next-intl :
  // reliabilityBadge() ne renvoie plus que des données brutes (mape,
  // beatsBaseline), le texte fr/en avec son paramètre {pct} vit ici.
  const explanationParts = [];
  if (typeof badge.mape === "number") {
    explanationParts.push(t("reliabilityMape", { pct: Math.round(badge.mape * 100) }));
  }
  if (badge.beatsBaseline === true) {
    explanationParts.push(t("reliabilityBeatsBaseline"));
  } else if (badge.beatsBaseline === false) {
    explanationParts.push(t("reliabilityDoesNotBeatBaseline"));
  }
  const badgeExplanation =
    explanationParts.length > 0 ? explanationParts.join(" ") : t("reliabilityUnknownExplanation");
  const proof = proofFacts(current);
  const proofParts = [];
  if (proof.points !== null) proofParts.push(t("proofTested", { count: proof.points }));
  if (proof.gainPct !== null) {
    proofParts.push(proof.gainPct > 0 ? t("proofGain", { pct: proof.gainPct }) : t("proofNoGain"));
  }
  if (proof.coverage) {
    proofParts.push(
      t(proof.coverage.calibrated ? "proofCoverageCalibrated" : "proofCoverage", {
        level: proof.coverage.level,
        pct: proof.coverage.pct,
      }),
    );
  }
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
            title={badgeExplanation}
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

      {proofParts.length > 0 && (
        <p data-testid="forecast-proof" title={t("proofTitle")} className="text-[11px] th-text-faint">
          {proofParts.join(" · ")}
        </p>
      )}

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
              <Tooltip content={<ForecastTooltip />} />
              <Legend verticalAlign="top" height={24} wrapperStyle={{ fontSize: 10 }} />
              {hasBands && (
                // Recharts "range area": a dataKey returning [low, high]
                // fills exactly between the two bounds — no stacking trick,
                // no background-colour mask that would only work on one
                // theme. See https://recharts.org/en-US/examples/AreaChartFillByValue
                <Area
                  dataKey={(d) => (d.lower_95 != null ? [d.lower_95, d.upper_95] : null)}
                  stroke="none"
                  fill="#3b82f6"
                  fillOpacity={0.1}
                  name={t("confidence95")}
                  isAnimationActive={false}
                />
              )}
              {hasBands && (
                <Area
                  dataKey={(d) => (d.lower_80 != null ? [d.lower_80, d.upper_80] : null)}
                  stroke="none"
                  fill="#3b82f6"
                  fillOpacity={0.22}
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
