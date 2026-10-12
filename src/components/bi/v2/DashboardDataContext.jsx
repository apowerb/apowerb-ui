"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getDashboardData, getPublicDashboardData } from "@/lib/api";

/**
 * Filter state + computed data of a v2 dashboard.
 *
 * - One state per filter id, seeded from the spec defaults then from the URL
 *   (`?f_famille=Cartons&f_periode=26w`), and written back to the URL so a
 *   link reproduces the view.
 * - One call to the data endpoint per filter state (debounced, previous request
 *   aborted). The last response stays on screen while the next one loads.
 */

const DEBOUNCE_MS = 150;
const PARAM_PREFIX = "f_";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_PRESETS = ["13w", "26w", "52w", "all"];

const DashboardDataContext = createContext(null);

export function useDashboardData() {
  const ctx = useContext(DashboardDataContext);
  if (!ctx) {
    throw new Error("useDashboardData must be used inside <DashboardDataProvider>");
  }
  return ctx;
}

/** Same as useDashboardData, but null outside a provider (v1 dashboards). */
export function useOptionalDashboardData() {
  return useContext(DashboardDataContext);
}

function defaultsOf(filters) {
  const out = {};
  for (const f of filters || []) out[f.id] = f.default ?? null;
  return out;
}

function sameValue(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** URL query → filter values (only known filter ids, typed per filter). */
export function parseFiltersFromSearch(search, filters) {
  const params = new URLSearchParams(search || "");
  const out = {};
  for (const f of filters || []) {
    const key = `${PARAM_PREFIX}${f.id}`;
    if (!params.has(key)) continue;
    if (f.type === "multi") {
      const all = params.getAll(key).filter((v) => v !== "");
      out[f.id] = all.length ? all : null;
    } else if (f.type === "date_range") {
      const [from, to] = (params.get(key) || "").split("..");
      // a malformed date would make the data request fail (422): drop it
      const okFrom = from && ISO_DATE.test(from) ? from : null;
      const okTo = to && ISO_DATE.test(to) ? to : null;
      out[f.id] = okFrom || okTo ? { from: okFrom, to: okTo } : null;
    } else if (f.type === "relative_period") {
      const v = params.get(key);
      if (v === "") out[f.id] = null;
      else if (v && (f.presets?.length ? f.presets : DEFAULT_PRESETS).includes(v)) out[f.id] = v;
      // unknown preset: keep the spec default
    } else {
      const v = params.get(key);
      out[f.id] = v === "" ? null : v;
    }
  }
  return out;
}

/** Filter values → query string, omitting values equal to the spec default. */
export function serializeFilters(values, filters, baseSearch = "") {
  const params = new URLSearchParams(baseSearch || "");
  for (const f of filters || []) {
    params.delete(`${PARAM_PREFIX}${f.id}`);
    const v = values[f.id] ?? null;
    if (sameValue(v, f.default ?? null)) continue;
    const key = `${PARAM_PREFIX}${f.id}`;
    if (v == null) params.set(key, "");
    else if (Array.isArray(v)) v.forEach((item) => params.append(key, String(item)));
    else if (typeof v === "object") params.set(key, `${v.from ?? ""}..${v.to ?? ""}`);
    else params.set(key, String(v));
  }
  return params.toString();
}

function initialValues(filters, search) {
  return { ...defaultsOf(filters), ...parseFiltersFromSearch(search, filters) };
}

/** Another dashboard (id or public slug) starts from a clean state. */
export function DashboardDataProvider(props) {
  return <Provider key={props.publicSlug ?? props.dashboard?.id ?? "none"} {...props} />;
}

function Provider({ dashboard, publicSlug = null, onContentHeight, children }) {
  const dashboardId = dashboard?.id;
  const specFilters = useMemo(() => dashboard?.filters || [], [dashboard?.filters]);

  const [values, setValues] = useState(() =>
    initialValues(
      specFilters,
      typeof window !== "undefined" ? window.location.search : "",
    ),
  );
  // Filters changed by a click inside a visual (shown as removable chips).
  const [crossed, setCrossed] = useState(() => new Set());
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [fetching, setFetching] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);
  const dataRef = useRef(null);
  const valuesRef = useRef(values);
  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  // A new filter list (spec edited) keeps the values still valid and seeds the
  // rest. Adjusted during render (React's "derive state from props" pattern).
  const [seenFilters, setSeenFilters] = useState(specFilters);
  if (seenFilters !== specFilters) {
    setSeenFilters(specFilters);
    const next = defaultsOf(specFilters);
    for (const f of specFilters) if (f.id in values) next[f.id] = values[f.id];
    if (!sameValue(values, next)) setValues(next);
    const ids = new Set(specFilters.map((f) => f.id));
    if ([...crossed].some((id) => !ids.has(id))) setCrossed(new Set([...crossed].filter((id) => ids.has(id))));
  }

  // State → URL (replaceState: no navigation, no re-render of the route).
  useEffect(() => {
    if (typeof window === "undefined" || specFilters.length === 0) return;
    const url = new URL(window.location.href);
    const qs = serializeFilters(values, specFilters, url.search);
    const next = `${url.pathname}${qs ? `?${qs}` : ""}${url.hash}`;
    if (next !== `${url.pathname}${url.search}${url.hash}`) {
      window.history.replaceState(window.history.state, "", next);
    }
  }, [values, specFilters]);

  // Browser back/forward: the URL is the source of truth for the filters.
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onPop = () => {
      const next = initialValues(specFilters, window.location.search);
      setValues((prev) => (sameValue(prev, next) ? prev : next));
      setCrossed(new Set());
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [specFilters]);

  const filtersKey = JSON.stringify(values);
  // Any change of the dashboard content except block positions recomputes the data.
  const specKey = useMemo(
    () =>
      JSON.stringify([
        dashboard?.sources,
        dashboard?.filters,
        (dashboard?.components || []).map((c) => [c.id, c.visual]),
      ]),
    [dashboard?.sources, dashboard?.filters, dashboard?.components],
  );

  useEffect(() => {
    if (!dashboardId && !publicSlug) return undefined;
    const controller = new AbortController();
    // The first load is immediate; later ones wait for the user to stop clicking.
    const delay = dataRef.current ? DEBOUNCE_MS : 0;
    const timer = setTimeout(async () => {
      setFetching(true);
      try {
        const body = { filters: valuesRef.current };
        const opts = { signal: controller.signal };
        const res = publicSlug
          ? await getPublicDashboardData(publicSlug, body, opts)
          : await getDashboardData(dashboardId, body, opts);
        if (controller.signal.aborted) return;
        dataRef.current = res;
        setData(res);
        setError(null);
        setFetching(false);
      } catch (err) {
        if (controller.signal.aborted || err?.name === "AbortError") return;
        setError(err);
        setFetching(false);
      }
    }, delay);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // `filtersKey` stands for the filter values (read through the ref).
  }, [dashboardId, publicSlug, filtersKey, specKey, refreshToken]);

  const setFilter = useCallback((id, value) => {
    setValues((prev) => (sameValue(prev[id], value) ? prev : { ...prev, [id]: value ?? null }));
    setCrossed((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const resetFilters = useCallback(() => {
    setValues(defaultsOf(specFilters));
    setCrossed(new Set());
  }, [specFilters]);

  // Click on a mark / row: select the value, or clear it when it is already the
  // selected one.
  const crossFilter = useCallback(
    (id, value) => {
      const spec = specFilters.find((f) => f.id === id);
      if (!spec) return;
      const current = valuesRef.current[id] ?? null;
      const isSame = Array.isArray(current)
        ? current.length === 1 && String(current[0]) === String(value)
        : current != null && String(current) === String(value);
      const next = isSame || value == null ? null : spec.type === "multi" ? [value] : value;
      setValues((prev) => ({ ...prev, [id]: next }));
      setCrossed((prev) => {
        const set = new Set(prev);
        if (next == null) set.delete(id);
        else set.add(id);
        return set;
      });
    },
    [specFilters],
  );

  const refresh = useCallback(() => setRefreshToken((n) => n + 1), []);

  const value = useMemo(
    () => ({
      dashboard,
      specFilters,
      values,
      crossed,
      data,
      error,
      fetching,
      loading: data == null && !error,
      readOnly: Boolean(publicSlug),
      setFilter,
      resetFilters,
      crossFilter,
      refresh,
      reportHeight: onContentHeight,
    }),
    [
      dashboard,
      specFilters,
      values,
      crossed,
      data,
      error,
      fetching,
      publicSlug,
      setFilter,
      resetFilters,
      crossFilter,
      refresh,
      onContentHeight,
    ],
  );

  return <DashboardDataContext.Provider value={value}>{children}</DashboardDataContext.Provider>;
}

export default DashboardDataContext;
