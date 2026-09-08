/**
 * ```chart fences — a tiny JSON spec an agent can emit in plain markdown and
 * the chat renders as a native, themed chart (no image, no iframe).
 *
 *   ```chart
 *   { "type": "bar", "title": "Orders per month",
 *     "x": "month", "series": ["orders", "returns"], "unit": "",
 *     "data": [ { "month": "Jan", "orders": 120, "returns": 8 }, … ] }
 *   ```
 *
 * Accepted shapes, normalised by `parseChartSpec`:
 *   - rows:    { data: [ {x, s1, s2…} ], x?, series? | y? }
 *   - pairs:   { data: { "Jan": 12, "Feb": 15 } }            → label/value rows
 *   - arrays:  { labels: [...], values: [...] } or { labels, series: {name: [...]} }
 *   - points:  { data: [[label, value], …] }
 *
 * Output: { ok: true, type, title, xKey, series: [{key,label}], rows, unit, stacked }
 *     or  { ok: false, reason }
 * Pure module; the component only draws what comes out of here.
 */

export const CHART_TYPES = ["bar", "line", "area", "pie", "donut", "stat"];
export const MAX_ROWS = 200;
export const MAX_SERIES = 8;

function toNumber(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(/[\s,]/g, (m) => (m === "," ? "." : "")));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function labelize(key) {
  return String(key)
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^\w/, (c) => c.toUpperCase());
}

function pickType(raw) {
  const t = String(raw?.type || raw?.chart_type || raw?.kind || "bar").toLowerCase();
  return CHART_TYPES.includes(t) ? t : null;
}

export function parseChartSpec(source) {
  let raw = source;
  if (typeof source === "string") {
    try {
      raw = JSON.parse(source);
    } catch {
      return { ok: false, reason: "invalid_json" };
    }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, reason: "not_an_object" };

  const type = pickType(raw);
  if (!type) return { ok: false, reason: "unknown_type" };
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const unit = typeof raw.unit === "string" ? raw.unit : "";
  const stacked = raw.stacked === true;

  let rows = [];
  let xKey = "label";
  let seriesKeys = [];

  const data = raw.data;
  if (Array.isArray(raw.labels) && raw.labels.length) {
    // { labels, values } or { labels, series: { name: [] } }
    const labels = raw.labels.map(String);
    const seriesObj =
      raw.series && !Array.isArray(raw.series) && typeof raw.series === "object"
        ? raw.series
        : Array.isArray(raw.values)
          ? { value: raw.values }
          : null;
    if (!seriesObj) return { ok: false, reason: "no_values" };
    seriesKeys = Object.keys(seriesObj);
    rows = labels.map((label, i) => {
      const row = { label };
      for (const k of seriesKeys) row[k] = toNumber(seriesObj[k]?.[i]);
      return row;
    });
  } else if (Array.isArray(data) && data.length && Array.isArray(data[0])) {
    // [[label, value], …]
    rows = data.map((pair) => ({ label: String(pair[0]), value: toNumber(pair[1]) }));
    seriesKeys = ["value"];
  } else if (Array.isArray(data) && data.length && typeof data[0] === "object") {
    rows = data.filter((r) => r && typeof r === "object");
    const keys = Object.keys(rows[0]);
    xKey =
      typeof raw.x === "string" && keys.includes(raw.x)
        ? raw.x
        : keys.find((k) => typeof rows[0][k] === "string") || keys[0];
    const requested = Array.isArray(raw.series)
      ? raw.series.filter((k) => typeof k === "string")
      : typeof raw.y === "string"
        ? [raw.y]
        : Array.isArray(raw.y)
          ? raw.y
          : null;
    seriesKeys = (requested && requested.length ? requested : keys.filter((k) => k !== xKey)).filter(
      (k) => rows.some((r) => toNumber(r[k]) !== null),
    );
    rows = rows.map((r) => {
      const out = { [xKey]: String(r[xKey] ?? "") };
      for (const k of seriesKeys) out[k] = toNumber(r[k]);
      return out;
    });
  } else if (data && typeof data === "object" && !Array.isArray(data)) {
    // { "Jan": 12, "Feb": 15 }
    rows = Object.entries(data).map(([label, v]) => ({ label, value: toNumber(v) }));
    seriesKeys = ["value"];
  } else {
    return { ok: false, reason: "no_data" };
  }

  if (!rows.length) return { ok: false, reason: "no_data" };
  if (!seriesKeys.length) return { ok: false, reason: "no_values" };
  if (rows.length > MAX_ROWS) rows = rows.slice(0, MAX_ROWS);
  if (seriesKeys.length > MAX_SERIES) seriesKeys = seriesKeys.slice(0, MAX_SERIES);

  const series = seriesKeys.map((key) => ({ key, label: labelize(key) }));
  return { ok: true, type, title, xKey, series, rows, unit, stacked, truncated: Array.isArray(data) && data.length > MAX_ROWS };
}

/** Rows for a pie/donut: the first series only, one slice per row. */
export function toSlices(spec) {
  if (!spec?.ok) return [];
  const key = spec.series[0]?.key;
  return spec.rows
    .map((r) => ({ name: String(r[spec.xKey]), value: r[key] ?? 0 }))
    .filter((s) => s.value !== null && s.value >= 0);
}

/** Headline number for the "stat" type: first value of the first series. */
export function toStat(spec) {
  if (!spec?.ok) return null;
  const key = spec.series[0]?.key;
  const row = spec.rows[0];
  if (!row || row[key] == null) return null;
  const prev = spec.rows[1]?.[key];
  const delta = typeof prev === "number" && prev !== 0 ? ((row[key] - prev) / Math.abs(prev)) * 100 : null;
  return { label: String(row[spec.xKey]), value: row[key], delta };
}

export function formatNumber(n, unit = "") {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  let s;
  if (abs >= 1e9) s = `${(n / 1e9).toFixed(1)}B`;
  else if (abs >= 1e6) s = `${(n / 1e6).toFixed(1)}M`;
  else if (abs >= 1e4) s = `${(n / 1e3).toFixed(1)}k`;
  else s = Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
  return unit ? `${s} ${unit}`.trim() : s;
}
