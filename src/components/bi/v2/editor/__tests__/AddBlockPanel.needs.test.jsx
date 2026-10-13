import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { makeDashboard } from "./fixtures";
import AddBlockPanel from "../AddBlockPanel";

function setup(fields, rowCount = 50) {
  const dashboard = makeDashboard();
  dashboard.sources = [{ ...dashboard.sources[0], measures: [] }];
  const data = fields ? { sources: { ventes: { row_count: rowCount, fields } } } : null;
  render(<AddBlockPanel editor={{ dashboard, data, apply: vi.fn().mockResolvedValue({}), onSelect: vi.fn() }} />);
}

const date = { name: "jour", type: "date", role: "date" };
const cat = { name: "famille", type: "string", role: "dimension" };
const num = { name: "ventes", type: "number", role: "measure" };

describe("AddBlockPanel offers the blocks the data allows", () => {
  it("disables time blocks without a date and says what is missing", () => {
    setup([cat, num]);
    const line = screen.getByRole("button", { name: /^Line/ });
    expect(line).toBeDisabled();
    expect(line).toHaveTextContent("Needs a date column");
    expect(screen.getByRole("button", { name: /^Bars/ })).toBeEnabled();
  });

  it("disables number blocks without a number column", () => {
    setup([date, cat]);
    expect(screen.getByRole("button", { name: /^KPI/ })).toHaveTextContent("Needs a number column");
    expect(screen.getByRole("button", { name: /^KPI/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Table/ })).toBeEnabled();
  });

  it("asks for at least 10 rows before a forecast", () => {
    setup([date, num], 6);
    const fc = screen.getByRole("button", { name: /^Forecast/ });
    expect(fc).toBeDisabled();
    expect(fc).toHaveTextContent("Needs at least 10 rows");
  });

  it("enables everything with a date, a category and a number", () => {
    setup([date, cat, num]);
    for (const name of [/^Line/, /^Pie/, /^KPI/, /^Forecast/, /^Waterfall/]) expect(screen.getByRole("button", { name })).toBeEnabled();
  });

  it("keeps blocks enabled while the source fields are not known yet", () => {
    setup(null);
    expect(screen.getByRole("button", { name: /^Line/ })).toBeEnabled();
  });
});
