import { describe, it, expect, vi } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import TableVisual from "../visuals/TableVisual";
import { Ctx } from "./testUtils";

const visual = {
  type: "table",
  x: "famille",
  columns: [
    { key: "famille", label: "Famille" },
    { key: "ventes", label: "Ventes", format: "integer" },
    { key: "taux_service", label: "Service", format: "percent" },
  ],
  click_filters: { famille: "famille" },
};
const rows = [
  { famille: "Cartons", ventes: 1200, taux_service: 1, _status_taux_service: "good" },
  { famille: "Palettes", ventes: 500, taux_service: 0.9, _status_taux_service: "bad", _highlight: true },
  { famille: "Calage", ventes: 800, taux_service: 0.97, _status_taux_service: "warn" },
  { famille: "Toutes", ventes: 2500, taux_service: 0.97, _total: true },
];

const bodyRows = () => within(screen.getAllByRole("rowgroup")[1]).getAllByRole("row");

describe("TableVisual", () => {
  it("clicking a row applies the click filter; the total row clears it", () => {
    const crossFilter = vi.fn();
    const setFilter = vi.fn();
    render(
      <Ctx value={{ crossFilter, setFilter }}>
        <TableVisual visual={visual} result={{ rows }} />
      </Ctx>,
    );
    fireEvent.click(screen.getByText("Calage"));
    expect(crossFilter).toHaveBeenCalledWith("famille", "Calage");
    fireEvent.click(screen.getByText("Toutes"));
    expect(setFilter).toHaveBeenCalledWith("famille", null);
  });

  it("is operable from the keyboard", () => {
    const crossFilter = vi.fn();
    render(
      <Ctx value={{ crossFilter }}>
        <TableVisual visual={visual} result={{ rows }} />
      </Ctx>,
    );
    const row = screen.getByText("Cartons").closest("tr");
    expect(row).toHaveAttribute("tabindex", "0");
    fireEvent.keyDown(row, { key: "Enter" });
    expect(crossFilter).toHaveBeenCalledWith("famille", "Cartons");
  });

  it("highlights the _highlight row and the selected filter value", () => {
    render(
      <Ctx value={{ values: { famille: "Calage", periode: "26w" } }}>
        <TableVisual visual={visual} result={{ rows }} />
      </Ctx>,
    );
    expect(screen.getByText("Palettes").closest("tr")).toHaveAttribute("data-highlight", "true");
    expect(screen.getByText("Calage").closest("tr")).toHaveAttribute("data-highlight", "true");
    expect(screen.getByText("Cartons").closest("tr")).not.toHaveAttribute("data-highlight");
  });

  it("colours cells by _status_<col> and formats numbers in French", () => {
    render(
      <Ctx>
        <TableVisual visual={visual} result={{ rows }} />
      </Ctx>,
    );
    const cell = screen.getByText(/^90\s%$/);
    expect(cell.style.color).toBe("var(--v2-bad)");
    expect(screen.getByText(/^1\s200$/)).toBeInTheDocument();
  });

  it("sorts by column and pins the total row in the foot", () => {
    render(
      <Ctx>
        <TableVisual visual={visual} result={{ rows }} />
      </Ctx>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ventes" }));
    expect(bodyRows().map((r) => within(r).getAllByRole("cell")[0].textContent)).toEqual(["Cartons", "Calage", "Palettes"]);
    fireEvent.click(screen.getByRole("button", { name: "Ventes" }));
    expect(bodyRows().map((r) => within(r).getAllByRole("cell")[0].textContent)).toEqual(["Palettes", "Calage", "Cartons"]);
    const foot = screen.getAllByRole("rowgroup")[2];
    expect(within(foot).getByText("Toutes")).toBeInTheDocument();
  });

  it("is not interactive without click_filters", () => {
    render(
      <Ctx>
        <TableVisual visual={{ ...visual, click_filters: {} }} result={{ rows }} />
      </Ctx>,
    );
    expect(screen.getByText("Cartons").closest("tr")).not.toHaveAttribute("tabindex");
  });
});
