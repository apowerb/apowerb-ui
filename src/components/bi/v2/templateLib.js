export const columnName = (c) => (typeof c === "string" ? c : c?.name);

/** Dataset column types as the preview reports them, folded to date / number / string. */
export function normalizeType(raw) {
  const t = String(raw ?? "").toLowerCase();
  if (!t) return null;
  if (/date|time/.test(t)) return "date";
  if (/^(u?int|float|double|decimal|number|numeric|real)/.test(t)) return "number";
  if (/^(str|text|object|char|varchar|category)/.test(t)) return "string";
  return null;
}

/** The actual type (folded) when it is known and differs from the expected one. */
export function typeMismatch(expected, actualRaw) {
  const actual = normalizeType(actualRaw);
  return actual && expected && actual !== expected ? actual : null;
}

export function filterByName(items, query, getName) {
  const q = String(query ?? "").trim().toLowerCase();
  if (!q) return items;
  return items.filter((x) => String(getName(x) ?? "").toLowerCase().includes(q));
}

function indexByLowerName(names) {
  const byLower = new Map();
  for (const name of names) {
    const k = name.trim().toLowerCase();
    if (!byLower.has(k)) byLower.set(k, name);
  }
  return byLower;
}

/** Default-named dataset column for each template column (case-insensitive). */
export function autoMap(templateColumns, datasetColumns) {
  const byLower = indexByLowerName(datasetColumns);
  const out = {};
  for (const c of templateColumns) {
    const hit = c.default ? byLower.get(String(c.default).trim().toLowerCase()) : undefined;
    out[c.key] = hit ?? null;
  }
  return out;
}

/** Source requirements: the column already in use, then a name match on the key or label. */
export function prefillMapping(requirements, datasetColumns) {
  const byLower = indexByLowerName(datasetColumns);
  const find = (v) => (v ? byLower.get(String(v).trim().toLowerCase()) : undefined);
  const out = {};
  for (const c of requirements) {
    out[c.key] = find(c.current) ?? find(c.key) ?? find(c.label) ?? null;
  }
  return out;
}

export function isNewerVersion(latest, current) {
  return Number.isFinite(latest) && Number.isFinite(current) && latest > current;
}

export function paramError(p, raw) {
  const s = String(raw ?? "").trim();
  if (!/^-?\d+$/.test(s)) return true;
  const n = Number(s);
  return (p.min != null && n < p.min) || (p.max != null && n > p.max);
}

export function submitErrors(err, fallback) {
  const list = err?.detail?.errors;
  if (Array.isArray(list) && list.length) return list.map(String);
  return [err?.message || fallback];
}

export function mappingBody(columns, mapping) {
  return Object.fromEntries(columns.map((c) => [c.key, mapping[c.key] || null]));
}

export function paramsBody(params, values) {
  return Object.fromEntries((params || []).map((p) => [p.key, Number(String(values[p.key]).trim())]));
}
