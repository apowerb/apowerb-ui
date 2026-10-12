/**
 * Formatting helpers shared by the v2 visuals.
 *
 * The server sends display strings for KPIs; everything else (axes, labels,
 * table cells of numeric columns) is formatted here, always in French.
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

const FR_INT = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const FR_1 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const FR_2 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

/** 381200 → "381,2 k" ; 1500000 → "1,5 M" ; 42 → "42". */
export function compactFr(value) {
  const n = Number(value);
  if (value == null || value === "" || !Number.isFinite(n)) return "";
  const abs = Math.abs(n);
  if (abs >= 1e6) return `${FR_1.format(n / 1e6)} M`;
  if (abs >= 1e3) return `${FR_1.format(n / 1e3)} k`;
  return FR_1.format(n);
}

/** Signed variant for waterfall labels: "+381,2 k" / "−12 k" (true minus). */
export function signedCompactFr(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  const body = compactFr(Math.abs(n));
  if (n > 0) return `+${body}`;
  if (n < 0) return `−${body}`;
  return body;
}

/** Format a raw number according to a MeasureSpec / ColumnSpec format name. */
export function formatByKind(value, kind) {
  if (value == null || value === "") return "—";
  if (typeof value === "string" && Number.isNaN(Number(value))) return value;
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  switch (kind) {
    case "integer":
      return FR_INT.format(n);
    case "compact":
      return compactFr(n);
    case "percent":
      return `${FR_1.format(n * 100)} %`;
    case "decimal1":
      return FR_1.format(n);
    case "decimal2":
      return FR_2.format(n);
    case "weeks":
      return `${FR_1.format(n)} sem.`;
    default:
      return FR_2.format(n);
  }
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/;

/** "2026-07-14" → "14 juil." ; anything else is returned as a string. */
export function shortDate(value) {
  if (value == null) return "";
  const m = typeof value === "string" ? ISO_DATE.exec(value) : null;
  if (!m) return String(value);
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(d);
}

export function isIsoDate(value) {
  return typeof value === "string" && ISO_DATE.test(value);
}

/** Axis tick formatter for an x dimension: dates short, text untouched. */
export function xTick(value) {
  if (isIsoDate(value)) return shortDate(value);
  const month = typeof value === "string" ? /^(\d{4})-(\d{2})$/.exec(value) : null;
  if (month) {
    return new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit", timeZone: "UTC" }).format(
      new Date(Date.UTC(Number(month[1]), Number(month[2]) - 1, 1)),
    );
  }
  return String(value ?? "");
}

// A number with optional sign, French thousand separators / decimal comma and
// a unit suffix (% k M). The lookbehind keeps digits glued to a letter ("S26",
// "pré-2024") out of the match.
const NUMBER_RE = new RegExp(
  [
    // grouped thousands: 1 234 567,89 (space, nbsp or narrow nbsp) + optional unit
    String.raw`(?<![\p{L}\d]-?)[+−-]?\d{1,3}(?:[   ]\d{3})+(?:,\d+)?(?:[   ]?(?:%|k\b|M\b))?`,
    // plain number: 26, 99,8 %, 12 k
    String.raw`(?<![\p{L}\d]-?)[+−-]?\d+(?:,\d+)?(?:[   ]?(?:%|k\b|M\b))?`,
  ].join("|"),
  "gu",
);

/**
 * Split a plain sentence into [{text, bold}] so numbers and percentages can be
 * emphasised. Never alters the characters, only the segmentation.
 */
export function splitNumbers(text) {
  const src = String(text ?? "");
  const parts = [];
  let last = 0;
  for (const m of src.matchAll(NUMBER_RE)) {
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

const FR_FULL_BIG = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const FR_FULL_SMALL = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

/** Precise display for tooltips, labels and cells: 8911 -> "8 911", 0.372 (percent) -> "37,2 %". */
export function formatFull(value, kind) {
  if (value == null || value === "") return "\u2014";
  if (typeof value === "string" && Number.isNaN(Number(value))) return value;
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  if (kind === "percent" || kind === "weeks" || kind === "integer" || kind === "decimal1" || kind === "decimal2") {
    return formatByKind(n, kind);
  }
  return (Math.abs(n) >= 100 ? FR_FULL_BIG : FR_FULL_SMALL).format(n);
}

/** Axis tick: percent measures read "5 %", everything else is compact. */
export function tickByKind(kind) {
  if (kind === "percent") return (v) => `${FR_INT.format(Number(v) * 100)}${String.fromCharCode(160)}%`;
  return compactFr;
}

/** "2025-12-22" -> "22 d\u00e9c. 2025" (tooltip titles). */
export function longDate(value) {
  const m = typeof value === "string" ? ISO_DATE.exec(value) : null;
  if (!m) return String(value ?? "");
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))),
  );
}
