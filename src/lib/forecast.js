/**
 * Logique pure du widget "Prévision" — heuristiques de colonnes,
 * diagnostic client (approximatif, sur un échantillon), transformation
 * de la réponse th2forecast en points de graphique, badge de fiabilité
 * et export CSV. Aucune dépendance React ni réseau : testable en isolation.
 */

const DATE_TYPES = new Set(["date", "datetime", "timestamp"]);
const NUMERIC_TYPES = new Set(["int", "integer", "float", "double", "decimal", "number"]);
const DATE_NAME_HINTS = /(date|day|month|period|time|jour|mois|periode)/i;

export function detectDateColumn(columns) {
  if (!Array.isArray(columns) || columns.length === 0) return null;
  const byType = columns.find((c) => DATE_TYPES.has((c.type || "").toLowerCase()));
  if (byType) return byType.name;
  const byName = columns.find((c) => DATE_NAME_HINTS.test(c.name || ""));
  return byName ? byName.name : null;
}

export function detectTargetColumn(columns, dateColumn) {
  if (!Array.isArray(columns) || columns.length === 0) return null;
  const candidate = columns.find(
    (c) => c.name !== dateColumn && NUMERIC_TYPES.has((c.type || "").toLowerCase()),
  );
  return candidate ? candidate.name : null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function classifyGapDays(days) {
  if (days <= 1.5) return "day";
  if (days <= 9) return "week";
  if (days <= 45) return "month";
  if (days <= 135) return "quarter";
  return "year";
}

export function detectFrequency(rows, dateColumn) {
  if (!Array.isArray(rows) || rows.length < 2 || !dateColumn) {
    return { frequency: null, approx: true };
  }
  const dates = rows
    .map((r) => new Date(r[dateColumn]))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a - b);
  if (dates.length < 2) return { frequency: null, approx: true };

  const gaps = [];
  for (let i = 1; i < dates.length; i++) {
    gaps.push((dates[i] - dates[i - 1]) / DAY_MS);
  }
  const medianGap = gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)];
  return { frequency: classifyGapDays(medianGap), approx: true };
}

const DEFAULT_HORIZONS = {
  day: 30,
  week: 8,
  month: 12,
  quarter: 4,
  year: 3,
};

export function defaultHorizon(frequency) {
  return DEFAULT_HORIZONS[frequency] || 12;
}

const MIN_POINTS_FOR_HORIZON_FACTOR = 2;

export function buildDiagnostics({ rows, dateColumn, targetColumn, horizon }) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const warnings = [];

  if (safeRows.length === 0) {
    warnings.push({
      code: "empty",
      message: "Aucune ligne de données disponible pour cette source.",
    });
    return { pointCount: 0, warnings };
  }

  if (horizon && safeRows.length < horizon * MIN_POINTS_FOR_HORIZON_FACTOR) {
    warnings.push({
      code: "short_history",
      message: `Historique court (${safeRows.length} points) pour un horizon de ${horizon} : la prévision sera peu fiable au-delà des premières périodes.`,
    });
  }

  if (dateColumn) {
    const invalidDates = safeRows.filter((r) => Number.isNaN(new Date(r[dateColumn]).getTime())).length;
    if (invalidDates > 0) {
      warnings.push({
        code: "invalid_dates",
        message: `${invalidDates} ligne(s) avec une date illisible dans la colonne "${dateColumn}".`,
      });
    }
  }

  if (targetColumn) {
    const nonNumeric = safeRows.filter((r) => {
      const v = r[targetColumn];
      return v !== null && v !== undefined && v !== "" && Number.isNaN(Number(v));
    }).length;
    if (nonNumeric > 0) {
      warnings.push({
        code: "non_numeric_values",
        message: `${nonNumeric} valeur(s) non numérique(s) dans la colonne cible "${targetColumn}".`,
      });
    }
  }

  return { pointCount: safeRows.length, warnings };
}

const RELIABILITY_LABELS = {
  good: "Fiable",
  fair: "À prendre avec précaution",
  poor: "Peu fiable",
  unknown: "Fiabilité inconnue",
};

// Ne construit plus de texte : le libellé et l'explication du badge
// passent par next-intl (fr/en, avec {pct} en paramètre ICU) côté
// ForecastChart. Cette fonction ne renvoie que les données brutes.
export function reliabilityBadge(series) {
  const level = series?.reliability && RELIABILITY_LABELS[series.reliability] ? series.reliability : "unknown";
  const mape = typeof series?.metrics?.mape === "number" ? series.metrics.mape : null;
  const beatsBaseline = typeof series?.beats_baseline === "boolean" ? series.beats_baseline : null;
  return { level, mape, beatsBaseline };
}

export function toChartSeries(series) {
  if (!series || (!series.history && !series.forecast)) return [];
  const history = Array.isArray(series.history) ? series.history : [];
  const forecast = Array.isArray(series.forecast) ? series.forecast : [];

  const points = history.map((h) => ({
    date: h.date,
    history: h.value,
    forecast: null,
  }));

  // Duplicate the last history point as the first forecast point so the
  // dotted forecast line starts exactly where the solid history line ends —
  // otherwise recharts draws a visible gap between the two series. Do the
  // same for the confidence bounds, collapsed to a zero-width band (lower
  // === upper === last real value): the range-area then tapers in from a
  // single point instead of jumping straight to the first forecast point's
  // already-wide interval.
  if (points.length > 0 && forecast.length > 0) {
    const last = points[points.length - 1];
    last.forecast = last.history;
    const firstForecast = forecast[0];
    if (firstForecast.lower_80 !== undefined) {
      last.lower_80 = last.history;
      last.upper_80 = last.history;
    }
    if (firstForecast.lower_95 !== undefined) {
      last.lower_95 = last.history;
      last.upper_95 = last.history;
    }
  }

  forecast.forEach((f) => {
    points.push({
      date: f.date,
      history: null,
      forecast: f.value,
      lower_80: f.lower_80 ?? null,
      upper_80: f.upper_80 ?? null,
      lower_95: f.lower_95 ?? null,
      upper_95: f.upper_95 ?? null,
    });
  });

  return points;
}

export function forecastToCsv(series) {
  const forecast = Array.isArray(series?.forecast) ? series.forecast : [];
  if (forecast.length === 0) return "date,value\n";
  const hasBounds = forecast.some((f) => f.lower_80 !== undefined);
  const header = hasBounds
    ? "date,value,lower_80,upper_80,lower_95,upper_95"
    : "date,value";
  const lines = forecast.map((f) =>
    hasBounds
      ? [f.date, f.value, f.lower_80, f.upper_80, f.lower_95, f.upper_95].join(",")
      : [f.date, f.value].join(","),
  );
  return [header, ...lines].join("\n") + "\n";
}
