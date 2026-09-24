"use client";

import { useEffect, useMemo, useRef } from "react";
import { useTranslations } from "use-intl";
import {
  detectDateColumn,
  detectFrequency,
  detectTargetColumn,
  defaultHorizon,
  buildDiagnostics,
} from "@/lib/forecast";

const MODELS = ["prophet", "auto", "arima", "ets", "snaive", "naive"];

/**
 * Assistant de configuration du widget « Prévision », affiché à l'étape 3
 * du wizard d'ajout de graphique quand `vizType === "forecast"`.
 *
 * Pré-remplit date/cible par heuristique (colonne typée date, première
 * colonne numérique), calcule un horizon par défaut selon la fréquence
 * détectée sur l'échantillon, et affiche un diagnostic avant calcul :
 * nombre de points, avertissements (historique court, valeurs invalides).
 *
 * `sampleRows` est un échantillon (aperçu du wizard, pas la série
 * complète) : la fréquence et les diagnostics affichés ici sont donc
 * approximatifs — le calcul réel se fait après création, sur toutes les
 * lignes, côté ForecastChart.
 */
export default function ForecastConfigStep({ columns, sampleRows, totalRows, value, onChange }) {
  const t = useTranslations("ForecastConfigStep");
  const safeColumns = useMemo(() => columns || [], [columns]);
  const safeRows = useMemo(() => sampleRows || [], [sampleRows]);
  const initialized = useRef(false);

  const detectedFrequency = useMemo(() => {
    const dateVar = value.dateVar || detectDateColumn(safeColumns);
    return detectFrequency(safeRows, dateVar).frequency;
  }, [safeRows, value.dateVar, safeColumns]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const dateVar = value.dateVar || detectDateColumn(safeColumns);
    const targetVar = value.targetVar || detectTargetColumn(safeColumns, dateVar);
    const freq = detectFrequency(safeRows, dateVar).frequency;
    onChange({
      dateVar: dateVar || "",
      targetVar: targetVar || "",
      groupVar: value.groupVar || "",
      horizon: value.horizon || defaultHorizon(freq),
      models: value.models && value.models.length > 0 ? value.models : ["prophet"],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const diagnostics = useMemo(
    () =>
      buildDiagnostics({
        rows: safeRows,
        dateColumn: value.dateVar,
        targetColumn: value.targetVar,
        horizon: value.horizon,
        totalRows,
      }),
    [safeRows, value.dateVar, value.targetVar, value.horizon, totalRows],
  );

  const groupOptions = safeColumns.filter(
    (c) => c.name !== value.dateVar && c.name !== value.targetVar,
  );

  const modelExplanations = {
    prophet: t("modelProphetExplanation"),
    auto: t("modelAutoExplanation"),
    arima: t("modelArimaExplanation"),
    ets: t("modelEtsExplanation"),
    snaive: t("modelSnaiveExplanation"),
    naive: t("modelNaiveExplanation"),
  };

  const selectedModel = value.models?.[0] || "prophet";

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="forecast-date-column" className="block text-sm font-medium th-text mb-1.5">
          {t("dateColumnLabel")}
        </label>
        <select
          id="forecast-date-column"
          value={value.dateVar || ""}
          onChange={(e) => onChange({ ...value, dateVar: e.target.value })}
          className="glass-input w-full px-4 py-2.5 rounded-lg"
        >
          <option value="">{t("selectPlaceholder")}</option>
          {safeColumns.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name} ({c.type})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="forecast-target-column" className="block text-sm font-medium th-text mb-1.5">
          {t("targetColumnLabel")}
        </label>
        <select
          id="forecast-target-column"
          value={value.targetVar || ""}
          onChange={(e) => onChange({ ...value, targetVar: e.target.value })}
          className="glass-input w-full px-4 py-2.5 rounded-lg"
        >
          <option value="">{t("selectPlaceholder")}</option>
          {safeColumns.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name} ({c.type})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="forecast-group-column" className="block text-sm font-medium th-text mb-1.5">
          {t("groupColumnLabel")}
        </label>
        <select
          id="forecast-group-column"
          value={value.groupVar || ""}
          onChange={(e) => onChange({ ...value, groupVar: e.target.value })}
          className="glass-input w-full px-4 py-2.5 rounded-lg"
        >
          <option value="">{t("groupNone")}</option>
          {groupOptions.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
        <p className="text-xs th-text-faint mt-1">{t("groupHint")}</p>
      </div>

      <div>
        <label htmlFor="forecast-horizon" className="block text-sm font-medium th-text mb-1.5">
          {t("horizonLabel")} {detectedFrequency && `(${t("detectedFrequency")}: ${detectedFrequency})`}
        </label>
        <input
          id="forecast-horizon"
          type="number"
          min={1}
          value={value.horizon || ""}
          onChange={(e) => onChange({ ...value, horizon: Number(e.target.value) })}
          className="glass-input w-full px-4 py-2.5 rounded-lg"
        />
      </div>

      <div>
        <label className="block text-sm font-medium th-text mb-1.5">{t("modelLabel")}</label>
        <div className="flex flex-wrap gap-2">
          {MODELS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onChange({ ...value, models: [m] })}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                selectedModel === m
                  ? "border-blue-500 bg-blue-500/10 text-blue-400"
                  : "th-border th-bg-surface th-text-secondary hover:th-border-hover"
              }`}
            >
              {t(`model_${m}`)}
            </button>
          ))}
        </div>
        <p className="text-xs th-text-faint mt-1">{modelExplanations[selectedModel]}</p>
      </div>

      <div className="p-3 rounded-lg border th-border bg-white/[0.02]">
        <p className="text-xs th-text-secondary">
          {diagnostics.partial
            ? t("partialSample", { sample: safeRows.length, total: totalRows })
            : t("pointCount", { count: diagnostics.pointCount })}
        </p>
        {diagnostics.warnings.length > 0 ? (
          <ul className="mt-1 space-y-1">
            {diagnostics.warnings.map((w) => (
              <li key={w.code} className="text-xs text-amber-400">
                {w.message}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-emerald-400 mt-1">{t("noWarnings")}</p>
        )}
      </div>
    </div>
  );
}
