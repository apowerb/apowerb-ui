/**
 * Chart design tokens — palette, formatters, and helpers shared by every
 * chart in the app. Concentrating these here means a colour change
 * (e.g. "make NON_CONFORME amber, not red") is a one-line edit, and the
 * fix automatically propagates to every BarChart, LineChart, PieChart
 * and DonutChart rendered through ChartRenderer.
 *
 * Conventions:
 *   - STATUS_COLORS: semantic — colour conveys meaning. Use these when
 *     the X-axis value, pie slice, or series name carries a known
 *     status (OK / failed / pending). Lookup goes through resolveColor()
 *     which tolerates compound names ("ars_ok", "count_ok", "ok_count").
 *   - CATEGORICAL_PALETTE: neutral — colour is just decoration to
 *     distinguish series. Picked by index when no semantic mapping
 *     applies.
 *
 * Adding a new status:
 *   1. Add the key + hex in STATUS_COLORS below.
 *   2. Add aliases to STATUS_ALIASES if it appears in compound column
 *      names (e.g. ``ok`` is aliased to ``OK`` so ``ok_count`` resolves).
 *   3. Make sure the colour passes WCAG AA against the dark dashboard
 *      background (#0a0e1a-ish). Tailwind 500-level colours all do.
 */

// ---------------------------------------------------------------------------
// Palettes
// ---------------------------------------------------------------------------

/**
 * Semantic colours — keyed by canonical status string. Lookup goes
 * through resolveColor() which also tries aliases (see STATUS_ALIASES)
 * and compound series names (``ok_count`` → OK).
 */
export const STATUS_COLORS = Object.freeze({
  // Chaine de rapprochement de commandes : statut global d'une commande.
  OK: "#10b981",                   // emerald-500
  NON_CONFORME: "#f59e0b",         // amber-500
  NEEDS_HUMAN_REVIEW: "#3b82f6",   // blue-500
  ORDER_NOT_FOUND: "#6b7280",      // gray-500
  en_attente: "#a78bfa",           // violet-400

  // Type d'ecart releve sur une ligne de commande.
  PRICE_MISMATCH: "#ef4444",       // red-500
  QTY_MISMATCH: "#f59e0b",         // amber-500
  DATE_MISMATCH: "#f97316",        // orange-500
  LINE_MISSING_ON_AR: "#a78bfa",   // violet-400
  LINE_NOT_IN_PO: "#14b8a6",       // teal-500

  // Generic boolean / health
  success: "#10b981",
  warning: "#f59e0b",
  error: "#ef4444",                // red-500
  info: "#3b82f6",
  neutral: "#6b7280",

  // Yes / No, Done / Pending — common in spreadsheet imports
  yes: "#10b981",
  Yes: "#10b981",
  oui: "#10b981",
  Oui: "#10b981",
  true: "#10b981",
  True: "#10b981",
  no: "#ef4444",
  No: "#ef4444",
  non: "#ef4444",
  Non: "#ef4444",
  false: "#ef4444",
  False: "#ef4444",
});

/**
 * Aliases — short tokens that appear inside compound series / column
 * names. ``ok_count``, ``count_ok``, ``ars_ok``, ``nb_ok`` all resolve
 * to the same emerald colour through STATUS_COLORS.OK. Order matters
 * only for collisions; here we keep the canonical form first.
 *
 * The token is matched as a *whole word* inside the column name
 * (split on underscores / hyphens / camelCase). So ``broker_count`` is
 * NOT mistakenly mapped to ``ok`` — only ``ok``, ``count_ok``,
 * ``ars_ok``, ``ok_total`` etc.
 */
const STATUS_ALIASES = Object.freeze({
  ok: "OK",
  conforme: "OK",
  conformes: "OK",
  non_conforme: "NON_CONFORME",
  nonconforme: "NON_CONFORME",
  nonconformes: "NON_CONFORME",
  nc: "NON_CONFORME",
  ko: "NON_CONFORME",
  review: "NEEDS_HUMAN_REVIEW",
  needs_review: "NEEDS_HUMAN_REVIEW",
  pending: "en_attente",
  attente: "en_attente",
  notfound: "ORDER_NOT_FOUND",
  not_found: "ORDER_NOT_FOUND",
  missing: "ORDER_NOT_FOUND",
  non_rapproche: "ORDER_NOT_FOUND",
  non_rapproches: "ORDER_NOT_FOUND",
  rapproche: "ORDER_NOT_FOUND",
  price: "PRICE_MISMATCH",
  qty: "QTY_MISMATCH",
  quantity: "QTY_MISMATCH",
  date: "DATE_MISMATCH",
  ecart_prix: "PRICE_MISMATCH",
  ecart_qte: "QTY_MISMATCH",
  ecart_date: "DATE_MISMATCH",
  ligne_absente_erp: "ORDER_NOT_FOUND",
  ligne_absente_ar: "ORDER_NOT_FOUND",
});

/**
 * Categorical fallback — used when the column / value has no semantic
 * mapping. Ordered to give pleasant left-to-right gradients on stacked
 * bars while staying accessible on dark backgrounds.
 */
export const CATEGORICAL_PALETTE = Object.freeze([
  "#3b82f6", // blue-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#6366f1", // indigo-500
  "#8b5cf6", // violet-500
  "#06b6d4", // cyan-500
  "#84cc16", // lime-500
  "#14b8a6", // teal-500
]);

/** Neutral fallback when even the categorical palette runs out. */
const NEUTRAL_FALLBACK = "#6b7280";

// ---------------------------------------------------------------------------
// Colour resolution
// ---------------------------------------------------------------------------

/** Tokenise a column / value name so we can match it against STATUS_ALIASES.
 *  ``ok_count`` → [ok, count]
 *  ``nb_ars_non_conforme`` → [nb, ars, non, conforme] AND the joined
 *  forms [nb_ars, ars_non_conforme, non_conforme] so multi-word
 *  aliases still match. */
function tokenize(name) {
  if (name == null) return [];
  const raw = String(name)
    .replace(/([a-z])([A-Z])/g, "$1 $2") // split camelCase
    .toLowerCase()
    .split(/[\s_\-./]+/)
    .filter(Boolean);
  const out = new Set(raw);
  // 2-grams as joined snake_case so "non_conforme" matches.
  for (let i = 0; i + 1 < raw.length; i++) {
    out.add(`${raw[i]}_${raw[i + 1]}`);
  }
  return Array.from(out);
}

/**
 * Resolve a colour for any chart value or series name.
 *
 * Lookup order:
 *   1. STATUS_COLORS by exact key (statuts metier, yes/no, etc.).
 *   2. STATUS_COLORS via STATUS_ALIASES on the lowercased exact value
 *      (handles e.g. "ok" → "OK").
 *   3. STATUS_COLORS via STATUS_ALIASES on any token of the
 *      compound name (handles "ok_count", "ars_non_conforme", …).
 *   4. CATEGORICAL_PALETTE by index modulo (when no semantic match).
 *   5. NEUTRAL_FALLBACK (shouldn't reach this — palette is wide enough).
 *
 * @param {string|number|null|undefined} value  — value or series name
 * @param {number} fallbackIdx  — index in the categorical palette
 */
export function colorForCategory(value, fallbackIdx = 0) {
  if (value != null) {
    // Exact key match (covers "OK", "NON_CONFORME", "yes", …).
    if (STATUS_COLORS[value]) return STATUS_COLORS[value];

    const s = String(value).trim();

    // Lowercased exact alias (covers "ok" → "OK").
    const lowerKey = STATUS_ALIASES[s.toLowerCase()];
    if (lowerKey && STATUS_COLORS[lowerKey]) return STATUS_COLORS[lowerKey];

    // Compound name (covers "ok_count", "non_conforme_count", …).
    // We walk the longest aliases first so "non_conforme" beats "non"
    // when both are present.
    const tokens = tokenize(s);
    const aliases = Object.keys(STATUS_ALIASES).sort(
      (a, b) => b.length - a.length,
    );
    for (const alias of aliases) {
      if (tokens.includes(alias)) {
        const canonical = STATUS_ALIASES[alias];
        if (STATUS_COLORS[canonical]) return STATUS_COLORS[canonical];
      }
    }
  }

  const idx = Number.isInteger(fallbackIdx) && fallbackIdx >= 0 ? fallbackIdx : 0;
  return CATEGORICAL_PALETTE[idx % CATEGORICAL_PALETTE.length] || NEUTRAL_FALLBACK;
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

/**
 * Detect whether *raw* looks like an ISO-ish date and format it to a
 * compact French human form. Falls back to the raw value on parse
 * failure so a column called "type" containing "2026-truc" never gets
 * mangled into NaN.
 */
const ISO_DATE_RX = /^\d{4}-\d{2}-\d{2}(?:T|$)/;

export function formatChartLabel(value) {
  if (value == null) return "—";
  const s = String(value);
  if (ISO_DATE_RX.test(s)) {
    // Normalise un datetime UTC naif (sans offset) en ajoutant Z, puis affiche
    // en heure de Paris (coherent avec src/lib/datetime.js).
    const hasOffset = /Z$|[+-]\d{2}:\d{2}$/.test(s);
    const d = new Date(s.includes("T") && !hasOffset ? s + "Z" : s);
    if (!Number.isNaN(d.getTime())) {
      return new Intl.DateTimeFormat("fr-FR", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "Europe/Paris",
      }).format(d);
    }
  }
  return s;
}

/**
 * Reformat known SCREAMING_SNAKE statuses for axis ticks and legends —
 * "NON_CONFORME" → "Non conformes", "PRICE_MISMATCH" → "Prix",
 * "ORDER_NOT_FOUND" → "Commande absente". Anything else falls through
 * to formatChartLabel so dates still get the French short form.
 *
 * Use this on XAxis tickFormatter for categorical statuses so the chart
 * is readable without a tooltip.
 */
const AXIS_LABEL_MAP = Object.freeze({
  OK: "OK",
  NON_CONFORME: "Non conformes",
  NEEDS_HUMAN_REVIEW: "À revoir",
  ORDER_NOT_FOUND: "Commande absente",
  en_attente: "En attente",
  PRICE_MISMATCH: "Prix",
  QTY_MISMATCH: "Quantité",
  DATE_MISMATCH: "Date",
  LINE_MISSING_ON_AR: "Ligne absente AR",
  LINE_NOT_IN_PO: "Ligne hors PO",
});

export function humanizeAxisLabel(value) {
  if (value == null) return "—";
  const s = String(value);
  if (AXIS_LABEL_MAP[s]) return AXIS_LABEL_MAP[s];
  return formatChartLabel(value);
}

/**
 * Tooltip / legend column name humaniser. Turns snake_case backend
 * column names into readable French phrases. Falls back to a Title
 * Cased version of the column name with underscores stripped.
 *
 * The dictionary is intentionally short — extend it as new analytics
 * views surface new columns. Anything not listed degrades gracefully.
 */
const HUMAN_COLUMN_NAMES = {
  nb_ars: "ARs traités",
  ars_total: "Total ARs",
  ars_ok: "ARs OK",
  ars_non_conforme: "ARs non conformes",
  ars_needs_review: "ARs à revoir",
  ok_count: "OK",
  non_conforme_count: "Non conformes",
  needs_review_count: "À revoir",
  order_not_found_count: "Commande absente",
  count: "Compte",
  total: "Total",
  date: "Date",
  day: "Jour",
  jour: "Jour",
  statut: "Statut",
  status: "Statut",
  fournisseur: "Fournisseur",
  fournisseurnom: "Fournisseur",
  supplier: "Fournisseur",
  numerocommande: "N° commande",
  commanditaire: "Commanditaire",
  anciennete: "Ancienneté",
  statutglobal: "Statut",
  typeecart: "Type d'écart",
  nb_anomalies: "Anomalies",
  cycle_time_seconds: "Temps de cycle (s)",
  cycle_time_minutes: "Temps de cycle (min)",
  cycle_time_hours: "Temps de cycle (h)",
  cycle_time_days: "Temps de cycle (j)",
  avg_cycle_time: "Temps moyen",
  median_cycle_time: "Temps médian",
  // Statuts canoniques (FR, migration du 2026-05-13)
  conforme: "Conforme",
  non_conforme: "Non conforme",
  non_rapproche: "Non rapproché",
  conformes: "Conformes",
  non_conformes: "Non conformes",
  non_rapproches: "Non rapprochés",
  nb_conforme: "Conformes",
  nb_non_conforme: "Non conformes",
  nb_non_rapproche: "Non rapprochés",
  // Types d'ecart canoniques (FR)
  ecart_prix: "Écart prix",
  ecart_qte: "Écart quantité",
  ecart_date: "Écart date",
  ligne_absente_erp: "Ligne absente (ERP)",
  ligne_absente_ar: "Ligne absente (AR)",
  nb_ecart_prix: "Écarts prix",
  nb_ecart_qte: "Écarts quantité",
  nb_ecart_date: "Écarts date",
  nb_ligne_absente_erp: "Lignes absentes ERP",
  nb_ligne_absente_ar: "Lignes absentes AR",
};

export function humanizeColumnName(name) {
  if (!name) return "";
  const exact = HUMAN_COLUMN_NAMES[name];
  if (exact) return exact;
  // Try lowercased lookup for case-insensitive matches on DB columns
  // that may travel SCREAMING (StatutGlobal vs statutglobal).
  const lower = String(name).toLowerCase();
  if (HUMAN_COLUMN_NAMES[lower]) return HUMAN_COLUMN_NAMES[lower];
  // Generic fallback: snake_case → Title Case With Spaces.
  return String(name)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/**
 * Number formatter for chart values. Strips needless decimals on
 * integers, keeps 2 decimals on floats, groups thousands with French
 * non-breaking spaces (so "1 234" instead of "1234" or "1,234").
 */
const FR_NUMBER_FORMAT = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 2,
});

export function formatChartValue(value) {
  if (value == null) return "—";
  if (typeof value === "number" && Number.isFinite(value)) {
    return FR_NUMBER_FORMAT.format(value);
  }
  const num = Number(value);
  if (!Number.isNaN(num) && value !== "" && value !== null) {
    return FR_NUMBER_FORMAT.format(num);
  }
  return String(value);
}

// ---------------------------------------------------------------------------
// KPI tone resolution (StatCard)
// ---------------------------------------------------------------------------

/**
 * Resolve the tone of a StatCard from its numeric value + an optional
 * thresholds config. Lets the caller flip a Conformité KPI to orange
 * when it drops under a target without hard-coding the colour at the
 * call site.
 *
 * Usage:
 *   resolveTone(0.591, { warning: 0.8, danger: 0.5 })       → "warning"
 *   resolveTone(0.95,  { warning: 0.8, danger: 0.5 })       → "success"
 *   resolveTone(150,   { warning: 100, danger: 200, direction: "lower_is_better" }) → "warning"
 *
 * @param {number}  value    — numeric KPI value
 * @param {object}  cfg      — { warning, danger, direction? }
 *   - direction "higher_is_better" (default): danger < warning < value → success
 *   - direction "lower_is_better": value < warning < danger → success
 * @returns {"success"|"warning"|"danger"|"neutral"}
 */
export function resolveTone(value, cfg) {
  if (cfg == null) return "neutral";
  // null / undefined coerce to 0 via Number(); reject them up-front so a
  // missing KPI does not get mis-scored as "warning" against a positive
  // threshold.
  if (value == null || value === "") return "neutral";
  const v = Number(value);
  if (!Number.isFinite(v)) return "neutral";

  const { warning, danger, direction = "higher_is_better" } = cfg;
  if (warning == null && danger == null) return "neutral";

  if (direction === "lower_is_better") {
    if (danger != null && v >= danger) return "danger";
    if (warning != null && v >= warning) return "warning";
    return "success";
  }

  // higher_is_better (default)
  if (danger != null && v <= danger) return "danger";
  if (warning != null && v <= warning) return "warning";
  return "success";
}

// ---------------------------------------------------------------------------
// Chart-wide axis / grid defaults
// ---------------------------------------------------------------------------

/** Recharts axis props — consistent typography and subtle grid lines. */
export const AXIS_PROPS = Object.freeze({
  tick: { fill: "var(--text-secondary)", fontSize: 12 },
  axisLine: { stroke: "var(--border)" },
  tickLine: { stroke: "var(--border)" },
});

/** Subtle dashed grid that doesn't compete with the bars. */
export const GRID_PROPS = Object.freeze({
  strokeDasharray: "3 3",
  stroke: "var(--border)",
  vertical: false, // horizontal-only grid is calmer for bar / line charts
});
