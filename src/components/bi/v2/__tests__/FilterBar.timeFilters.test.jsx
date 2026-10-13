import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FilterBar from "../FilterBar";
import { parseFiltersFromSearch } from "../DashboardDataContext";
import { Ctx } from "./testUtils";

const GRAIN = { id: "grain", label: "Regroupement", field: "semaine", type: "time_grain", default: null };
const AGG = { id: "agg", label: "Calcul", field: "ventes", type: "aggregation", default: null };
const PERIOD = { id: "periode", label: "Période", field: "semaine", type: "relative_period", default: "ytd", presets: ["7d", "1y", "ytd", "mtd", "all"] };

function setup(values = {}, filters = [GRAIN, AGG, PERIOD]) {
  const setFilter = vi.fn();
  render(
    <Ctx value={{ specFilters: filters, values: { grain: null, agg: null, periode: "ytd", ...values }, setFilter }}>
      <FilterBar />
    </Ctx>,
  );
  return setFilter;
}

describe("FilterBar time grain, aggregation and periods", () => {
  it("picks a time grain, or raw dates", () => {
    const setFilter = setup({ grain: "week" });
    const select = screen.getByRole("combobox", { name: "Regroupement" });
    expect(select).toHaveValue("week");
    expect(screen.getByRole("option", { name: "By month" })).toBeInTheDocument();
    fireEvent.change(select, { target: { value: "month" } });
    expect(setFilter).toHaveBeenCalledWith("grain", "month");
    fireEvent.change(select, { target: { value: "" } });
    expect(setFilter).toHaveBeenLastCalledWith("grain", null);
  });

  it("picks the aggregation function, sum by default", () => {
    const setFilter = setup();
    const select = screen.getByRole("combobox", { name: "Calcul" });
    expect(select).toHaveValue("sum");
    fireEvent.change(select, { target: { value: "avg" } });
    expect(setFilter).toHaveBeenCalledWith("agg", "avg");
  });

  it("labels day, year and to-date presets", () => {
    setup();
    expect(screen.getByRole("radio", { name: "Last 7 days" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Last year" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Year to date" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Month to date" })).toBeInTheDocument();
  });

  it("sets a custom period", () => {
    const setFilter = setup();
    fireEvent.click(screen.getByRole("radio", { name: "Custom period" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Number of units" }), { target: { value: "45" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Unit" }), { target: { value: "d" } });
    expect(setFilter).toHaveBeenLastCalledWith("periode", "45d");
  });

  it("shows a custom value that is not a preset", () => {
    setup({ periode: "18m" });
    expect(screen.getByRole("radio", { name: "Custom period" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("spinbutton", { name: "Number of units" })).toHaveValue(18);
    expect(screen.getByRole("combobox", { name: "Unit" })).toHaveValue("m");
  });
});

describe("parseFiltersFromSearch for the new filters", () => {
  it("keeps valid grains, functions and custom periods only", () => {
    const filters = [GRAIN, AGG, PERIOD];
    expect(parseFiltersFromSearch("f_grain=month&f_agg=max&f_periode=45d", filters)).toEqual({ grain: "month", agg: "max", periode: "45d" });
    expect(parseFiltersFromSearch("f_grain=decade&f_agg=median&f_periode=7q", filters)).toEqual({});
  });
});
