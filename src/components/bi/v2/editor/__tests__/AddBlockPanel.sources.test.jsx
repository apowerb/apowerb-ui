import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { makeDashboard, makeData } from "./fixtures";
import AddBlockPanel from "../AddBlockPanel";

const stock = { name: "stock", label: "Stock", kind: "connector", source_type: "database", connection_config_id: 1, query: "SELECT * FROM stock", transforms: [], fields: [], measures: [] };
const stockData = {
  row_count: 24,
  fields: [
    { name: "mois", type: "date", role: "date" },
    { name: "site", type: "string", role: "dimension" },
    { name: "qte", type: "number", role: "measure" },
  ],
};

function setup() {
  const dashboard = makeDashboard();
  dashboard.sources = [...dashboard.sources, stock];
  const data = makeData();
  data.sources.stock = stockData;
  const apply = vi.fn().mockResolvedValue({});
  render(<AddBlockPanel editor={{ dashboard, data, apply, onSelect: vi.fn() }} />);
  return apply;
}

describe("AddBlockPanel with several sources", () => {
  it("builds the block on the chosen dashboard source", () => {
    const apply = setup();
    fireEvent.change(screen.getByLabelText("Data"), { target: { value: "stock" } });
    fireEvent.click(screen.getByRole("button", { name: /^Line/ }));
    expect(apply.mock.calls[0][0][0].visual).toMatchObject({ type: "line", source: "stock", x: "mois" });
  });

  it("pre-fills a forecast block from the source date and first number", () => {
    const apply = setup();
    fireEvent.change(screen.getByLabelText("Data"), { target: { value: "stock" } });
    fireEvent.click(screen.getByRole("button", { name: /^Forecast/ }));
    expect(apply.mock.calls[0][0][0].visual).toMatchObject({
      type: "forecast",
      source: "stock",
      forecast: { date_var: "mois", target_var: "qte", group_var: null, horizon: 12 },
    });
  });
});
