import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const getDashboardData = vi.fn();
const getPublicDashboardData = vi.fn();
vi.mock("@/lib/api", () => ({
  getDashboardData: (...a) => getDashboardData(...a),
  getPublicDashboardData: (...a) => getPublicDashboardData(...a),
}));

import {
  DashboardDataProvider,
  useDashboardData,
  parseFiltersFromSearch,
  serializeFilters,
} from "../DashboardDataContext";
import { FILTERS } from "./testUtils";

const dashboard = { id: "d1", filters: FILTERS, components: [] };
const wrapper = ({ children }) => (
  <DashboardDataProvider dashboard={dashboard}>{children}</DashboardDataProvider>
);
const respond = (label) => ({ dashboard_id: "d1", filters: {}, filter_options: {}, sources: {}, components: { a: { type: "text", text: label } } });

beforeEach(() => {
  vi.useFakeTimers();
  getDashboardData.mockReset();
  getPublicDashboardData.mockReset();
  getDashboardData.mockImplementation(async (_id, body) => respond(JSON.stringify(body.filters)));
  window.history.replaceState({}, "", "/bi/d1");
});
afterEach(() => {
  vi.useRealTimers();
});

const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });
const advance = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

describe("URL <-> filters", () => {
  it("parses and serialises typed values, omitting defaults", () => {
    const parsed = parseFiltersFromSearch("?f_famille=Cartons&f_periode=13w&other=1", FILTERS);
    expect(parsed).toEqual({ famille: "Cartons", periode: "13w" });
    expect(serializeFilters({ famille: "Cartons", periode: "26w" }, FILTERS, "")).toBe("f_famille=Cartons");
    // an explicit "all" on a filter whose default is not null survives the round trip
    const qs = serializeFilters({ famille: null, periode: null }, FILTERS, "x=1");
    expect(qs).toBe("x=1&f_periode=");
    expect(parseFiltersFromSearch(qs, FILTERS).periode).toBeNull();
  });

  it("seeds the state from the URL and sends it in the first request", async () => {
    window.history.replaceState({}, "", "/bi/d1?f_famille=Cartons&f_periode=13w");
    const { result } = renderHook(() => useDashboardData(), { wrapper });
    expect(result.current.values).toEqual({ famille: "Cartons", periode: "13w" });
    await flush();
    expect(getDashboardData).toHaveBeenCalledTimes(1);
    expect(getDashboardData.mock.calls[0][0]).toBe("d1");
    expect(getDashboardData.mock.calls[0][1]).toEqual({ filters: { famille: "Cartons", periode: "13w" } });
    expect(result.current.data.components.a.type).toBe("text");
  });

  it("writes non-default filters back to the URL and removes them on reset", async () => {
    const { result } = renderHook(() => useDashboardData(), { wrapper });
    await flush();
    expect(window.location.search).toBe("");
    act(() => result.current.setFilter("famille", "Palettes"));
    act(() => result.current.setFilter("periode", "52w"));
    expect(window.location.search).toBe("?f_famille=Palettes&f_periode=52w");
    act(() => result.current.resetFilters());
    expect(window.location.search).toBe("");
    expect(result.current.values).toEqual({ famille: null, periode: "26w" });
  });
});

describe("crossFilter", () => {
  it("selects a value, and a second click on the same value clears it", async () => {
    const { result } = renderHook(() => useDashboardData(), { wrapper });
    await flush();
    act(() => result.current.crossFilter("famille", "Calage"));
    expect(result.current.values.famille).toBe("Calage");
    expect(result.current.crossed.has("famille")).toBe(true);
    act(() => result.current.crossFilter("famille", "Palettes"));
    expect(result.current.values.famille).toBe("Palettes");
    act(() => result.current.crossFilter("famille", "Palettes"));
    expect(result.current.values.famille).toBeNull();
    expect(result.current.crossed.has("famille")).toBe(false);
  });

  it("a filter set from a control is not shown as a cross-filter chip", async () => {
    const { result } = renderHook(() => useDashboardData(), { wrapper });
    await flush();
    act(() => result.current.crossFilter("famille", "Calage"));
    act(() => result.current.setFilter("famille", "Cartons"));
    expect(result.current.crossed.has("famille")).toBe(false);
  });
});

describe("fetching", () => {
  it("debounces bursts into one request and aborts the superseded one", async () => {
    let firstSignal;
    getDashboardData.mockImplementationOnce(async (_id, _b, opts) => {
      firstSignal = opts.signal;
      return respond("first");
    });
    const { result } = renderHook(() => useDashboardData(), { wrapper });
    await flush();
    expect(getDashboardData).toHaveBeenCalledTimes(1);

    // three changes inside the debounce window → a single extra request
    act(() => result.current.setFilter("famille", "Cartons"));
    await advance(50);
    act(() => result.current.setFilter("famille", "Calage"));
    await advance(50);
    act(() => result.current.setFilter("famille", "Palettes"));
    expect(getDashboardData).toHaveBeenCalledTimes(1);
    await advance(160);
    expect(getDashboardData).toHaveBeenCalledTimes(2);
    expect(getDashboardData.mock.calls[1][1].filters.famille).toBe("Palettes");
    expect(firstSignal.aborted).toBe(true);
  });

  it("keeps the previous response on screen while the next one loads", async () => {
    const { result } = renderHook(() => useDashboardData(), { wrapper });
    await flush();
    const first = result.current.data;
    let release;
    getDashboardData.mockImplementationOnce(
      () => new Promise((r) => { release = () => r(respond("second")); }),
    );
    act(() => result.current.setFilter("famille", "Cartons"));
    await advance(160);
    expect(result.current.fetching).toBe(true);
    expect(result.current.data).toBe(first);
    expect(result.current.loading).toBe(false);
    await act(async () => { release(); await vi.advanceTimersByTimeAsync(0); });
    expect(result.current.data.components.a.text).toBe("second");
    expect(result.current.fetching).toBe(false);
  });

  it("an aborted request never overwrites a newer response", async () => {
    let releaseSlow;
    getDashboardData.mockImplementationOnce(() => Promise.resolve(respond("initial")));
    const { result } = renderHook(() => useDashboardData(), { wrapper });
    await flush();
    getDashboardData.mockImplementationOnce(
      (_i, _b, opts) =>
        new Promise((r) => {
          releaseSlow = () => r(respond("stale"));
          opts.signal.addEventListener("abort", () => {});
        }),
    );
    act(() => result.current.setFilter("famille", "Cartons"));
    await advance(160);
    getDashboardData.mockImplementationOnce(async () => respond("fresh"));
    act(() => result.current.setFilter("famille", "Calage"));
    await advance(160);
    await act(async () => { releaseSlow(); await vi.advanceTimersByTimeAsync(0); });
    expect(result.current.data.components.a.text).toBe("fresh");
  });

  it("uses the public endpoint when a slug is given", async () => {
    getPublicDashboardData.mockResolvedValue(respond("public"));
    const pub = ({ children }) => (
      <DashboardDataProvider dashboard={dashboard} publicSlug="demo">{children}</DashboardDataProvider>
    );
    const { result } = renderHook(() => useDashboardData(), { wrapper: pub });
    await flush();
    expect(getPublicDashboardData).toHaveBeenCalledTimes(1);
    expect(getPublicDashboardData.mock.calls[0][0]).toBe("demo");
    expect(getDashboardData).not.toHaveBeenCalled();
    expect(result.current.readOnly).toBe(true);
  });

  it("surfaces a request error without discarding earlier data", async () => {
    const { result } = renderHook(() => useDashboardData(), { wrapper });
    await flush();
    getDashboardData.mockRejectedValueOnce(new Error("boom"));
    act(() => result.current.setFilter("famille", "Cartons"));
    await advance(160);
    expect(result.current.error.message).toBe("boom");
    expect(result.current.data).not.toBeNull();
  });
});

describe("robustness", () => {
  it("falls back to the default when the URL carries an unknown preset or a bad date", () => {
    const filters = [...FILTERS, { id: "d", type: "date_range", default: null }];
    const parsed = parseFiltersFromSearch("?f_periode=999x&f_d=nope..2025-01-02", filters);
    expect(parsed.periode).toBeUndefined();
    expect(parsed.d).toEqual({ from: null, to: "2025-01-02" });
  });

  it("starts from a clean state when the dashboard changes", async () => {
    let current = { id: "d1", filters: FILTERS, components: [] };
    const { result, rerender } = renderHook(() => useDashboardData(), {
      wrapper: ({ children }) => <DashboardDataProvider dashboard={current}>{children}</DashboardDataProvider>,
    });
    await flush();
    act(() => result.current.crossFilter("famille", "Cartons"));
    expect(result.current.values.famille).toBe("Cartons");
    expect(result.current.crossed.has("famille")).toBe(true);
    current = { id: "d2", filters: FILTERS, components: [] };
    window.history.replaceState({}, "", "/bi/d2"); // navigation to the other dashboard
    rerender();
    expect(result.current.values.famille).toBeNull();
    expect(result.current.crossed.size).toBe(0);
    expect(result.current.data).toBeNull();
    await flush();
    expect(getDashboardData).toHaveBeenLastCalledWith("d2", expect.anything(), expect.anything());
  });

  it("drops cross-filters of filters that disappeared from the spec", async () => {
    let current = { id: "d1", filters: FILTERS, components: [] };
    const { result, rerender } = renderHook(() => useDashboardData(), {
      wrapper: ({ children }) => <DashboardDataProvider dashboard={current}>{children}</DashboardDataProvider>,
    });
    await flush();
    act(() => result.current.crossFilter("famille", "Cartons"));
    current = { ...current, filters: [FILTERS[1]] };
    rerender();
    expect(result.current.crossed.size).toBe(0);
    expect(result.current.values).toEqual({ periode: "26w" });
  });

  it("follows the browser back button (popstate)", async () => {
    const { result } = renderHook(() => useDashboardData(), { wrapper });
    await flush();
    act(() => result.current.setFilter("famille", "Cartons"));
    expect(window.location.search).toContain("f_famille=Cartons");
    act(() => {
      window.history.replaceState({}, "", "/bi/d1?f_famille=Bravo");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(result.current.values.famille).toBe("Bravo");
  });
});
