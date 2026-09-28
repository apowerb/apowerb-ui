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

function distinctTimes(rows, dateColumn) {
  const times = new Set(
    rows.map((r) => new Date(r[dateColumn]).getTime()).filter((t) => !Number.isNaN(t)),
  );
  return [...times].sort((a, b) => a - b);
}

export function detectFrequency(rows, dateColumn) {
  if (!Array.isArray(rows) || rows.length < 2 || !dateColumn) {
    return { frequency: null, approx: true };
  }
  // Several series in long format share each date: gaps are measured
  // between distinct dates, otherwise they are 0 and the series looks daily.
  const dates = distinctTimes(rows, dateColumn);
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

// `totalRows` : nombre de lignes de la source complète quand `rows` n'en est
// qu'un aperçu. Sur un aperçu partiel, la longueur d'historique n'est pas
// mesurable : pas d'avertissement « historique court » (ForecastChart le
// recalcule sur toutes les lignes au moment du calcul).
export function buildDiagnostics({ rows, dateColumn, targetColumn, horizon, totalRows }) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const warnings = [];

  if (safeRows.length === 0) {
    warnings.push({
      code: "empty",
      message: "Aucune ligne de données disponible pour cette source.",
    });
    return { pointCount: 0, partial: false, warnings };
  }

  const partial = Number.isFinite(totalRows) && totalRows > safeRows.length;

  // History length of one series: distinct dates, not rows (grouped data).
  const pointCount = dateColumn ? distinctTimes(safeRows, dateColumn).length || safeRows.length : safeRows.length;

  if (!partial && horizon && pointCount < horizon * MIN_POINTS_FOR_HORIZON_FACTOR) {
    warnings.push({
      code: "short_history",
      message: `Historique court (${pointCount} points) pour un horizon de ${horizon} : la prévision sera peu fiable au-delà des premières périodes.`,
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

  return { pointCount, partial, warnings };
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

const isNumber = (x) => typeof x === "number" && Number.isFinite(x);

// Preuve mesurée au backtest : points testés, gain d'erreur (MASE) sur la
// référence naïve, et couverture de la bande la plus étroite. Le champ
// `calibration` n'existe qu'avec le moteur Python : sans lui, pas de couverture.
export function proofFacts(series) {
  const points = isNumber(series?.metrics?.holdout_points) ? series.metrics.holdout_points : null;
  const mase = series?.metrics?.mase;
  const baseMase = series?.baseline?.metrics?.mase;
  const gainPct = isNumber(mase) && isNumber(baseMase) && baseMase > 0 ? Math.round((1 - mase / baseMase) * 100) : null;

  const levels = series?.calibration?.levels || {};
  const narrowest = Object.keys(levels)
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b)[0];
  const band = narrowest === undefined ? null : levels[narrowest];
  let coverage = null;
  if (band && band.calibrated && isNumber(band.calibrated_coverage)) {
    coverage = { level: narrowest, pct: Math.round(band.calibrated_coverage * 100), calibrated: true };
  } else if (band && isNumber(band.raw_coverage)) {
    coverage = { level: narrowest, pct: Math.round(band.raw_coverage * 100), calibrated: false };
  }
  return { points, gainPct, coverage };
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

// --- Contexte (événements datés) et scénarios « et si » -------------------

const PERIOD_MONTHS = { month: 1, quarter: 3, year: 12 };

// Dernier jour de la période qui commence à `iso` (th2forecast date chaque
// période par son premier jour) : un mois daté 2025-12-01 va jusqu'au 31.
export function periodEnd(iso, frequency) {
  const [y, m, d] = iso.split("-").map(Number);
  if (frequency === "week") return new Date(Date.UTC(y, m - 1, d + 6)).toISOString().slice(0, 10);
  const months = PERIOD_MONTHS[frequency];
  if (!months) return iso;
  return new Date(Date.UTC(y, m - 1 + months, 0)).toISOString().slice(0, 10);
}

// Fenêtre envoyée à l'interprétation du contexte : du premier jour d'historique
// au dernier jour de la dernière période prévue, toutes séries confondues. Sans
// fréquence ni dates (réponse vide), pas d'interprétation possible.
export function contextWindow(response) {
  const series = Array.isArray(response?.series) ? response.series : [];
  const history = series.flatMap((s) => (s.history || []).map((h) => h.date)).sort();
  const forecast = series.flatMap((s) => (s.forecast || []).map((f) => f.date)).sort();
  if (!response?.frequency || history.length === 0 || forecast.length === 0) return null;
  const freq = response.frequency;
  return {
    history_start: history[0],
    history_end: periodEnd(history[history.length - 1], freq),
    horizon_end: periodEnd(forecast[forecast.length - 1], freq),
    frequency: freq,
    groups: series.map((s) => s.group).filter((g) => g != null).map(String),
  };
}

const EMPTY_CONTEXT = { events: [], scenarios: [] };

function byStart(a, b) {
  return a.start.localeCompare(b.start) || a.end.localeCompare(b.end);
}

// Ajoute la proposition relue au contexte appliqué. Un événement déjà connu
// reçoit les plages en plus ; un scénario du même nom est remplacé. Un
// scénario qui fixe ses événements futurs (`events`) reçoit aussi les
// nouveaux faits : il ne retirait que ce qu'il nommait.
export function mergeContext(current, proposal) {
  const base = current || EMPTY_CONTEXT;
  const events = new Map(base.events.map((e) => [e.name, e]));
  const added = [];
  for (const e of proposal?.events || []) {
    const prev = events.get(e.name);
    const ranges = new Map([...(prev?.ranges || []), ...e.ranges].map((r) => [`${r.start}/${r.end}`, r]));
    const merged = { ...prev, ...e, ranges: [...ranges.values()].sort(byStart) };
    events.set(e.name, merged);
    added.push(merged);
  }
  const scenarios = new Map(
    base.scenarios.map((s) => {
      if (!Array.isArray(s.events)) return [s.name, s];
      const kept = new Map(s.events.map((e) => [e.name, e]));
      for (const e of added) kept.set(e.name, e);
      return [s.name, { ...s, events: [...kept.values()] }];
    }),
  );
  for (const s of proposal?.scenarios || []) scenarios.set(s.name, s);
  return { events: [...events.values()], scenarios: [...scenarios.values()] };
}

export function removeEvent(context, name) {
  const base = context || EMPTY_CONTEXT;
  return {
    events: base.events.filter((e) => e.name !== name),
    scenarios: base.scenarios.map((s) =>
      Array.isArray(s.events) ? { ...s, events: s.events.filter((e) => e.name !== name) } : s,
    ),
  };
}

export function removeScenario(context, name) {
  const base = context || EMPTY_CONTEXT;
  return { events: base.events, scenarios: base.scenarios.filter((s) => s.name !== name) };
}

// Plages lisibles : « 2025-08-01 → 2025-08-15 », au plus `max` puis « +N ».
export function describeRanges(ranges, max = 3) {
  const list = Array.isArray(ranges) ? ranges : [];
  const shown = list.slice(0, max).map((r) => (r.start === r.end ? r.start : `${r.start} → ${r.end}`));
  return list.length > max ? `${shown.join(", ")} +${list.length - max}` : shown.join(", ");
}

// Ajoute aux points du graphique la courbe d'un scénario (`scenario`), partant
// du dernier point réel comme la prévision de base.
export function withScenario(points, scenario) {
  if (!scenario || !Array.isArray(scenario.forecast)) return points;
  const byDate = new Map(scenario.forecast.map((f) => [f.date, f.value]));
  return points.map((p) =>
    p.forecast == null ? p : { ...p, scenario: p.history != null ? p.history : (byDate.get(p.date) ?? null) },
  );
}
