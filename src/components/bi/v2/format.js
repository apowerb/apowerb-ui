/**
 * Formatting helpers shared by the v2 visuals.
 *
 * The server sends display strings for KPIs; everything else (axes, labels,
 * table cells of numeric columns) is formatted here, in the dashboard language
 * (`locale`: "en", anything else is French).
 */

import { CATEGORICAL_PALETTE } from "@/lib/chart-tokens";

const SEMANTIC = ["good", "warn", "bad", "muted", "accent"];

// #hex, rgb()/rgba()/hsl()/hsla() with plain numeric arguments, var(--name).
const SAFE_COLOR =
  /^(?:#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|(?:rgb|hsl)a?\(\s*[\d.%\s,/deg-]+\)|var\(--[\w-]+\))$/i;

/** "good" → "var(--v2-good)"; "#hex", "rgb(...)", "hsl(...)", "var(--x)" pass through; anything else → fallback. */
export function resolveColor(color, fallback = "var(--v2-accent)") {
  if (!color || typeof color !== "string") return fallback;
  const c = color.trim();
  if (SEMANTIC.includes(c)) return `var(--v2-${c})`;
  if (SAFE_COLOR.test(c)) return c;
  return fallback;
}

/** Series colour: explicit, else the theme series palette by index. */
export function seriesColor(color, index = 0) {
  if (color) return resolveColor(color);
  const themed = [
    "var(--v2-accent)",
    "var(--v2-series-2)",
    "var(--v2-series-3)",
    "var(--v2-series-4)",
  ];
  return themed[index] || CATEGORICAL_PALETTE[index % CATEGORICAL_PALETTE.length];
}

/** Dashboard locale ("fr" | "en" | null, null being French) → Intl locale. */
export function intlLocale(locale) {
  return locale === "en" ? "en-US" : "fr-FR";
}

const numberFormats = new Map();

function numberFormat(locale, maximumFractionDigits) {
  const key = `${intlLocale(locale)}:${maximumFractionDigits}`;
  if (!numberFormats.has(key)) {
    numberFormats.set(key, new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits }));
  }
  return numberFormats.get(key);
}

/** 42 → "42 %" (fr, non-breaking space) / "42%" (en). */
export function withPercent(text, locale) {
  return `${text}${locale === "en" ? "" : " "}%`;
}

/** fr: 381200 → "381,2 k", 1500000 → "1,5 M" ; en: "381.2k", "1.5M", "2.4B" ; 42 → "42". */
export function compact(value, locale) {
  const n = Number(value);
  if (value == null || value === "" || !Number.isFinite(n)) return "";
  const abs = Math.abs(n);
  const one = numberFormat(locale, 1);
  if (locale === "en") {
    if (abs >= 1e9) return `${one.format(n / 1e9)}B`;
    if (abs >= 1e6) return `${one.format(n / 1e6)}M`;
    if (abs >= 1e3) return `${one.format(n / 1e3)}k`;
    return one.format(n);
  }
  if (abs >= 1e6) return `${one.format(n / 1e6)} M`;
  if (abs >= 1e3) return `${one.format(n / 1e3)} k`;
  return one.format(n);
}

/** Signed variant for waterfall labels: "+381,2 k" / "−12 k" (true minus). */
export function signedCompact(value, locale) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  const body = compact(Math.abs(n), locale);
  if (n > 0) return `+${body}`;
  if (n < 0) return `−${body}`;
  return body;
}

/** Format a raw number according to a MeasureSpec / ColumnSpec format name. */
export function formatByKind(value, kind, locale) {
  if (value == null || value === "") return "—";
  if (typeof value === "string" && Number.isNaN(Number(value))) return value;
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  switch (kind) {
    case "integer":
      return numberFormat(locale, 0).format(n);
    case "compact":
      return compact(n, locale);
    case "percent":
      return withPercent(numberFormat(locale, 1).format(n * 100), locale);
    case "decimal1":
      return numberFormat(locale, 1).format(n);
    case "decimal2":
      return numberFormat(locale, 2).format(n);
    case "weeks":
      return `${numberFormat(locale, 1).format(n)}${locale === "en" ? " wk" : " sem."}`;
    default:
      return numberFormat(locale, 2).format(n);
  }
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/;

/** "2026-07-14" → "14 juil." (en: "Jul 14") ; anything else is returned as a string. */
export function shortDate(value, locale) {
  if (value == null) return "";
  const m = typeof value === "string" ? ISO_DATE.exec(value) : null;
  if (!m) return String(value);
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(d);
}

export function isIsoDate(value) {
  return typeof value === "string" && ISO_DATE.test(value);
}

/** Axis tick formatter for an x dimension: dates short, text untouched. */
export function xTick(value, locale) {
  if (isIsoDate(value)) return shortDate(value, locale);
  const month = typeof value === "string" ? /^(\d{4})-(\d{2})$/.exec(value) : null;
  if (month) {
    return new Intl.DateTimeFormat(intlLocale(locale), { month: "short", year: "2-digit", timeZone: "UTC" }).format(
      new Date(Date.UTC(Number(month[1]), Number(month[2]) - 1, 1)),
    );
  }
  return String(value ?? "");
}

// A number with optional sign, thousand separators / decimal mark of the
// language and a unit suffix (fr: % k M, en: % k M B). The lookbehind keeps
// digits glued to a letter ("S26", "pré-2024") out of the match.
function numberRegExp(group, decimal, units) {
  const unit = `(?:[\u00a0\u202f ]?(?:${units}))?`;
  return new RegExp(
    [
      // grouped thousands: 1 234 567,89 / 1,234,567.89 + optional unit
      String.raw`(?<![\p{L}\d]-?)[+−-]?\d{1,3}(?:${group}\d{3})+(?:${decimal}\d+)?${unit}`,
      // plain number: 26, 99,8 %, 12 k
      String.raw`(?<![\p{L}\d]-?)[+−-]?\d+(?:${decimal}\d+)?${unit}`,
    ].join("|"),
    "gu",
  );
}

const NUMBER_RE = {
  fr: numberRegExp("[\\u00a0\\u202f ]", ",", String.raw`%|k\b|M\b`),
  en: numberRegExp(",", String.raw`\.`, String.raw`%|k\b|M\b|B\b`),
};

/**
 * Split a plain sentence into [{text, bold}] so numbers and percentages can be
 * emphasised. Never alters the characters, only the segmentation.
 */
export function splitNumbers(text, locale) {
  const src = String(text ?? "");
  const parts = [];
  let last = 0;
  for (const m of src.matchAll(NUMBER_RE[locale === "en" ? "en" : "fr"])) {
    if (m.index > last) parts.push({ text: src.slice(last, m.index), bold: false });
    parts.push({ text: m[0], bold: true });
    last = m.index + m[0].length;
  }
  if (last < src.length) parts.push({ text: src.slice(last), bold: false });
  return parts;
}

/** Resolve a colour for a row's series: `_color_<key>` wins over the default. */
export function rowColor(row, key, fallback) {
  const c = row?.[`_color_${key}`];
  return c ? resolveColor(c, fallback) : fallback;
}

/** Precise display for tooltips, labels and cells: 8911 -> "8 911", 0.372 (percent) -> "37,2 %". */
export function formatFull(value, kind, locale) {
  if (value == null || value === "") return "\u2014";
  if (typeof value === "string" && Number.isNaN(Number(value))) return value;
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  if (kind === "percent" || kind === "weeks" || kind === "integer" || kind === "decimal1" || kind === "decimal2") {
    return formatByKind(n, kind, locale);
  }
  return numberFormat(locale, Math.abs(n) >= 100 ? 0 : 1).format(n);
}

/** Axis tick: percent measures read "5 %", everything else is compact. */
export function tickByKind(kind, locale) {
  if (kind === "percent") return (v) => withPercent(numberFormat(locale, 0).format(Number(v) * 100), locale);
  return (v) => compact(v, locale);
}

/** "2025-12-22" -> "22 d\u00e9c. 2025" (tooltip titles). */
export function longDate(value, locale) {
  const m = typeof value === "string" ? ISO_DATE.exec(value) : null;
  if (!m) return String(value ?? "");
  return new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))),
  );
}
