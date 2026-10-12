import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FilterBar from "../FilterBar";
import { Ctx } from "./testUtils";

const data = { filter_options: { famille: ["Cartons", "Palettes"] }, filters: { famille: { value: "Palettes", label: "Palettes" } } };

describe("FilterBar", () => {
  it("changes a select filter and a period preset", () => {
    const setFilter = vi.fn();
    render(
      <Ctx value={{ data, setFilter }}>
        <FilterBar />
      </Ctx>,
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Famille" }), { target: { value: "Palettes" } });
    expect(setFilter).toHaveBeenCalledWith("famille", "Palettes");
    fireEvent.click(screen.getByRole("radio", { name: "Last 13 weeks" }));
    expect(setFilter).toHaveBeenCalledWith("periode", "13w");
    expect(screen.getByRole("radio", { name: "Last 26 weeks" })).toHaveAttribute("aria-checked", "true");
  });

  it("lists cross-filter chips that can be removed, and resets", () => {
    const setFilter = vi.fn();
    const resetFilters = vi.fn();
    render(
      <Ctx value={{ data, setFilter, resetFilters, values: { famille: "Palettes", periode: "26w" }, crossed: new Set(["famille"]) }}>
        <FilterBar />
      </Ctx>,
    );
    const chip = screen.getByTestId("v2-filter-chip");
    expect(chip).toHaveTextContent("Palettes");
    fireEvent.click(screen.getByRole("button", { name: "Remove filter Famille" }));
    expect(setFilter).toHaveBeenCalledWith("famille", null);
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(resetFilters).toHaveBeenCalled();
  });

  it("disables Reset when nothing differs from the defaults", () => {
    render(
      <Ctx value={{ data }}>
        <FilterBar />
      </Ctx>,
    );
    expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled();
  });

  it("offers a Retry button when the data request failed", () => {
    const refresh = vi.fn();
    render(
      <Ctx value={{ data, error: new Error("boom"), refresh }}>
        <FilterBar />
      </Ctx>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("boom");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refresh).toHaveBeenCalled();
  });
});
