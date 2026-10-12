import { vi } from "vitest";
import DashboardDataContext from "../DashboardDataContext";

/** recharts' ResponsiveContainer measures 0x0 in jsdom: give it a size. */
export async function sizedRecharts(importOriginal) {
  const React = await import("react");
  const actual = await importOriginal();
  return {
    ...actual,
    ResponsiveContainer: ({ children }) =>
      React.cloneElement(React.Children.only(children), { width: 640, height: 320 }),
  };
}

export const FILTERS = [
  { id: "famille", label: "Famille", field: "famille", type: "select", default: null },
  { id: "periode", label: "Période", field: "semaine", type: "relative_period", default: "26w", presets: ["13w", "26w", "52w", "all"] },
];

export function Ctx({ value = {}, children }) {
  const base = {
    dashboard: { id: "d1", filters: FILTERS },
    specFilters: FILTERS,
    values: { famille: null, periode: "26w" },
    crossed: new Set(),
    data: null,
    error: null,
    fetching: false,
    loading: false,
    readOnly: false,
    setFilter: vi.fn(),
    resetFilters: vi.fn(),
    crossFilter: vi.fn(),
    refresh: vi.fn(),
  };
  return (
    <DashboardDataContext.Provider value={{ ...base, ...value }}>{children}</DashboardDataContext.Provider>
  );
}
