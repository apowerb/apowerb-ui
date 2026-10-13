// Pure helpers of the dashboard v2 editor (no React).
import {
  Gauge,
  BarChart3,
  BarChartHorizontal,
  LineChart,
  AreaChart,
  PieChart,
  Table2,
  Type,
  NotebookText,
  Layers,
  ArrowLeftRight,
  Footprints,
  TrendingUp,
} from "lucide-react";

export const BLOCK_TYPES = [
  { type: "kpi", icon: Gauge },
  { type: "combo", icon: Layers },
  { type: "bar", icon: BarChart3 },
  { type: "hbar", icon: BarChartHorizontal },
  { type: "diverging_bar", icon: ArrowLeftRight },
  { type: "line", icon: LineChart },
  { type: "area", icon: AreaChart },
  { type: "pie", icon: PieChart },
  { type: "waterfall", icon: Footprints },
  { type: "forecast", icon: TrendingUp },
  { type: "table", icon: Table2 },
  { type: "text", icon: Type },
  { type: "note", icon: NotebookText },
];

export const CHART_TYPES = ["combo", "bar", "hbar", "line", "area", "pie", "diverging_bar"];
export const MEASURE_FORMATS = ["number", "integer", "compact", "percent", "decimal1", "decimal2", "weeks"];
export const SEMANTIC_COLORS = {
  good: "#10b981",
  warn: "#f59e0b",
  bad: "#ef4444",
  muted: "#6b7280",
  accent: "#3b82f6",
};
export const SWATCHES = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#6b7280"];
export const PERIOD_PRESETS = ["13w", "26w", "52w", "3m", "12m", "all"];
export const SQL_FUNCTIONS = ["SUM", "AVG", "MIN", "MAX", "COUNT", "NULLIF"];
export const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function newId() {
  try {
    return globalThis.crypto.randomUUID();
  } catch {
    return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  }
}

/** snake_case identifier matching the backend IDENT pattern. */
export function slugify(text) {
  let s = String(text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (/^[0-9]/.test(s)) s = `m_${s}`;
  return s.slice(0, 63);
}

export const IDENT_RE = /^[a-z_][a-z0-9_]{0,62}$/;

export function uniqueIdent(base, taken) {
  const root = slugify(base) || "item";
  if (!taken.includes(root)) return root;
  for (let i = 2; i < 1000; i += 1) {
    const cand = `${root}_${i}`.slice(0, 63);
    if (!taken.includes(cand)) return cand;
  }
  return root;
}

export const getComponent = (dashboard, id) =>
  (dashboard?.components || []).find((c) => c.id === id) || null;

export const getSource = (dashboard, name) =>
  (dashboard?.sources || []).find((s) => s.name === name) || null;

export const sourceMeasures = (dashboard, name) => getSource(dashboard, name)?.measures || [];

/** Fields of a source: server-computed metadata first, declared overrides next. */
export function sourceFields(dashboard, data, name) {
  const served = data?.sources?.[name]?.fields;
  if (Array.isArray(served) && served.length) return served;
  return getSource(dashboard, name)?.fields || [];
}

export const isDateField = (f) => f.type === "date" || f.role === "date";
export const isNumberField = (f) => f.type === "number" || f.role === "measure";
export const isDimensionField = (f) =>
  isDateField(f) || f.role === "dimension" || (!f.role && f.type !== "number");

export function allFields(dashboard, data) {
  const out = [];
  const seen = new Set();
  for (const s of dashboard?.sources || []) {
    for (const f of sourceFields(dashboard, data, s.name)) {
      if (!seen.has(f.name)) {
        seen.add(f.name);
        out.push({ ...f, source: s.name });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** Normalise an API error (FastAPI 422 detail, {errors:[…]}, plain message). */
export function parsePatchError(err) {
  const items = [];
  const detail = err?.detail;
  const push = (it) => {
    if (typeof it === "string") items.push({ path: [], message: it });
    else if (it && typeof it === "object") {
      const message = it.msg || it.message || it.error || JSON.stringify(it);
      const path = Array.isArray(it.loc) ? it.loc : Array.isArray(it.path) ? it.path : [];
      items.push({ path: path.map(String), message });
    }
  };
  if (Array.isArray(detail)) detail.forEach(push);
  else if (detail && Array.isArray(detail.errors)) detail.errors.forEach(push);
  else if (detail && typeof detail === "object" && detail.message) push(detail.message);
  const message = items.length
    ? items.map((i) => i.message).join(" ; ")
    : err?.message || "Error";
  return { message, items, status: err?.status ?? null };
}

/** Message attached to a given field name (explicit field or last path segment). */
export function fieldError(error, name) {
  if (!error) return null;
  if (error.field === name) return error.message;
  const hit = (error.items || []).find((i) => i.path[i.path.length - 1] === name);
  return hit ? hit.message : null;
}

// ---------------------------------------------------------------------------
// Inverse operations (undo)
// ---------------------------------------------------------------------------

const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

/**
 * Inverse of `ops` computed from the dashboard *before* they are applied.
 * Applying the returned ops (already in reverse order) restores that state.
 * Returns null when an op cannot be inverted (the entry is then not undoable).
 */
export function inverseOps(prev, ops) {
  const inv = [];
  for (const op of ops) {
    switch (op.op) {
      case "add_visual":
        if (!op.component_id) return null;
        inv.push({ op: "remove_component", component_id: op.component_id });
        break;
      case "update_visual": {
        const c = getComponent(prev, op.component_id);
        if (!c?.visual) return null;
        const changes = {};
        for (const k of Object.keys(op.changes)) changes[k] = k in c.visual ? clone(c.visual[k]) : null;
        inv.push({ op: "update_visual", component_id: op.component_id, changes });
        break;
      }
      case "remove_component": {
        const c = getComponent(prev, op.component_id);
        if (!c?.visual) return null;
        inv.push({
          op: "add_visual",
          visual: clone(c.visual),
          position: c.position ? clone(c.position) : null,
          component_id: c.id,
        });
        break;
      }
      case "move_component": {
        const c = getComponent(prev, op.component_id);
        if (!c?.position) return null;
        inv.push({ op: "move_component", component_id: c.id, position: clone(c.position) });
        break;
      }
      case "upsert_source": {
        const before = getSource(prev, op.source.name);
        inv.push(
          before
            ? { op: "upsert_source", source: clone(before) }
            : { op: "remove_source", name: op.source.name },
        );
        break;
      }
      case "remove_source": {
        const before = getSource(prev, op.name);
        if (!before) return null;
        inv.push({ op: "upsert_source", source: clone(before) });
        break;
      }
      case "upsert_measure": {
        const before = sourceMeasures(prev, op.source).find((m) => m.name === op.measure.name);
        inv.push(
          before
            ? { op: "upsert_measure", source: op.source, measure: clone(before) }
            : { op: "remove_measure", source: op.source, name: op.measure.name },
        );
        break;
      }
      case "remove_measure": {
        const before = sourceMeasures(prev, op.source).find((m) => m.name === op.name);
        if (!before) return null;
        inv.push({ op: "upsert_measure", source: op.source, measure: clone(before) });
        break;
      }
      case "upsert_filter": {
        const before = (prev.filters || []).find((f) => f.id === op.filter.id);
        inv.push(
          before
            ? { op: "upsert_filter", filter: clone(before) }
            : { op: "remove_filter", id: op.filter.id },
        );
        break;
      }
      case "remove_filter": {
        const before = (prev.filters || []).find((f) => f.id === op.id);
        if (!before) return null;
        inv.push({ op: "upsert_filter", filter: clone(before) });
        break;
      }
      case "set_title":
        inv.push({ op: "set_title", title: prev.title, description: prev.description ?? null });
        break;
      default:
        return null;
    }
  }
  return inv.reverse();
}

// ---------------------------------------------------------------------------
// Visual defaults
// ---------------------------------------------------------------------------

const markFor = (type) => (type === "line" ? "line" : type === "area" ? "area" : "bar");

/** Measures usable as series/columns of a source: declared measures. */
function pickSeriesKeys(dashboard, data, sourceName) {
  const ms = sourceMeasures(dashboard, sourceName);
  if (ms.length) return ms.map((m) => m.name);
  return sourceFields(dashboard, data, sourceName)
    .filter(isNumberField)
    .map((f) => f.name);
}

/**
 * A new visual of `type`, pre-filled from the first source: first date (or
 * dimension) on x, first measure as the series.
 */
/** Forecast settings guessed from a source: its first date and first number. */
export function forecastDefaults(fields) {
  return {
    date_var: fields.find(isDateField)?.name ?? null,
    target_var: fields.find((f) => !isDateField(f) && isNumberField(f))?.name ?? null,
    group_var: null,
    horizon: 12,
  };
}

/** Forecast settings moved to another source: keeps the fields it has, guesses the others. */
export function forecastForSource(current, fields) {
  const has = (k) => !!k && fields.some((f) => f.name === k);
  const guess = forecastDefaults(fields);
  return {
    ...(current || {}),
    date_var: has(current?.date_var) ? current.date_var : guess.date_var,
    target_var: has(current?.target_var) ? current.target_var : guess.target_var,
    group_var: has(current?.group_var) ? current.group_var : null,
  };
}

/** `sourceName`: the dashboard source to build on (default: the first one). */
export function defaultVisual(type, dashboard, data, labels = {}, sourceName = null) {
  if (type === "note") return { type: "note", title: labels.noteTitle || null, text: labels.noteText || "" };
  const src = (sourceName && getSource(dashboard, sourceName)) || (dashboard?.sources || [])[0];
  if (!src) return null;
  const fields = sourceFields(dashboard, data, src.name);
  const date = fields.find(isDateField);
  const dim = fields.find((f) => !isDateField(f) && isDimensionField(f));
  const keys = pickSeriesKeys(dashboard, data, src.name);
  const m = sourceMeasures(dashboard, src.name);
  const labelOf = (k) => m.find((x) => x.name === k)?.label || k;
  const base = { type, source: src.name };

  switch (type) {
    case "kpi":
      return { ...base, title: keys[0] ? labelOf(keys[0]) : null, kpi: keys[0] ? { measure: keys[0], compare: "previous_period" } : null };
    case "combo":
      return {
        ...base,
        title: keys[0] ? labelOf(keys[0]) : null,
        x: (date || dim)?.name ?? null,
        series: [
          ...(keys[0] ? [{ key: keys[0], mark: "bar", axis: "left" }] : []),
          ...(keys[1] ? [{ key: keys[1], mark: "line", axis: "right" }] : []),
        ],
      };
    case "bar":
    case "hbar":
    case "diverging_bar":
    case "line":
    case "area":
    case "pie":
      return {
        ...base,
        title: keys[0] ? labelOf(keys[0]) : null,
        x: ((type === "line" || type === "area" ? date || dim : dim || date))?.name ?? null,
        series: keys[0] ? [{ key: keys[0], mark: markFor(type), axis: "left" }] : [],
        ...(type === "hbar" || type === "pie" ? { sort: "value_desc", top_n: type === "pie" ? 8 : 10 } : {}),
      };
    case "forecast":
      return { ...base, title: labels.forecastTitle || null, forecast: forecastDefaults(fields) };
    case "waterfall": {
      const ks = keys.slice(0, 4);
      return {
        ...base,
        title: null,
        steps: ks.map((k, i) => ({
          label: labelOf(k),
          measure: k,
          kind: i === 0 ? "start" : i === ks.length - 1 ? "end" : "increase",
        })),
      };
    }
    case "table":
      return {
        ...base,
        title: null,
        x: (dim || date)?.name ?? null,
        columns: [
          ...((dim || date) ? [{ key: (dim || date).name }] : []),
          ...keys.slice(0, 4).map((k) => ({ key: k })),
        ],
      };
    case "text":
      return {
        ...base,
        title: null,
        text: keys[0] ? `${labelOf(keys[0])} : {{${keys[0]}|${m.find((x) => x.name === keys[0])?.format || "number"}}}` : "",
      };
    default:
      return null;
  }
}

/**
 * Changes to merge when switching a visual to `type`, keeping compatible
 * source/x/series and seeding what the new type requires.
 */
export function typeChangeChanges(visual, type, dashboard, data) {
  const changes = { type };
  const src = visual.source || (dashboard?.sources || [])[0]?.name || null;
  const keys = src ? pickSeriesKeys(dashboard, data, src) : [];
  const fields = src ? sourceFields(dashboard, data, src) : [];
  if (src && !visual.source && type !== "note") changes.source = src;

  if (CHART_TYPES.includes(type)) {
    let series = visual.series || [];
    if (!series.length && visual.kpi?.measure) series = [{ key: visual.kpi.measure, mark: markFor(type), axis: "left" }];
    if (!series.length && keys[0]) series = [{ key: keys[0], mark: markFor(type), axis: "left" }];
    if (type !== "combo" && type !== "pie") series = series.map((s) => ({ ...s, mark: markFor(type) }));
    changes.series = series;
    if (!visual.x) {
      const x = type === "line" || type === "area" ? fields.find(isDateField) || fields.find(isDimensionField) : fields.find((f) => !isDateField(f) && isDimensionField(f)) || fields.find(isDateField);
      if (x) changes.x = x.name;
    }
  } else if (type === "kpi" && !visual.kpi) {
    const measure = visual.series?.[0]?.key || keys[0];
    if (measure) changes.kpi = { measure, compare: "previous_period" };
  } else if (type === "table" && !(visual.columns || []).length) {
    const cols = [];
    if (visual.x) cols.push({ key: visual.x });
    (visual.series || []).forEach((s) => cols.push({ key: s.key }));
    if (!cols.length) keys.slice(0, 4).forEach((k) => cols.push({ key: k }));
    changes.columns = cols;
  } else if (type === "forecast" && !visual.forecast) {
    changes.forecast = forecastDefaults(fields);
  } else if (type === "waterfall" && !(visual.steps || []).length) {
    const ks = (visual.series || []).map((s) => s.key);
    const use = (ks.length ? ks : keys).slice(0, 4);
    changes.steps = use.map((k, i) => ({ label: k, measure: k, kind: i === 0 ? "start" : i === use.length - 1 ? "end" : "increase" }));
  }
  return changes;
}

/** Insert `token` into `text` at `pos` (end when pos is null). */
export function insertAt(text, token, pos) {
  const s = text || "";
  const p = pos == null ? s.length : Math.max(0, Math.min(pos, s.length));
  return { text: s.slice(0, p) + token + s.slice(p), caret: p + token.length };
}

/** Word under the caret, for formula auto-completion. */
export function wordAt(text, caret) {
  const s = text || "";
  let start = caret;
  while (start > 0 && /[A-Za-z0-9_]/.test(s[start - 1])) start -= 1;
  return { word: s.slice(start, caret), start, end: caret };
}

export function moveItem(list, from, to) {
  if (to < 0 || to >= list.length || from === to) return list;
  const next = list.slice();
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it);
  return next;
}
