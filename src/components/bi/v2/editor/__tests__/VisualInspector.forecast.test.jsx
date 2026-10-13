import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { makeDashboard, makeData } from "./fixtures";
import VisualInspector from "../VisualInspector";

describe("VisualInspector forecast block", () => {
  it("picks the new source's date and number when the block changes source", () => {
    const dashboard = makeDashboard();
    dashboard.sources = [...dashboard.sources, { name: "stock", label: "Stock", kind: "dataset", dataset_id: "f2", transforms: [], fields: [], measures: [] }];
    dashboard.components = [
      {
        id: "c1",
        component_type: "visual",
        visual: { type: "forecast", source: "ventes", forecast: { date_var: "semaine", target_var: "ca", group_var: "region", horizon: 6 } },
      },
    ];
    const data = makeData();
    data.sources.stock = {
      row_count: 36,
      fields: [
        { name: "mois", type: "date", role: "date" },
        { name: "qte", type: "number", role: "measure" },
      ],
    };
    const apply = vi.fn().mockResolvedValue({});
    render(<VisualInspector editor={{ dashboard, data, apply, error: null, onSelect: vi.fn() }} componentId="c1" />);
    fireEvent.change(screen.getByLabelText("Source"), { target: { value: "stock" } });
    expect(apply.mock.calls[0][0][0].changes).toMatchObject({
      source: "stock",
      forecast: { date_var: "mois", target_var: "qte", group_var: null, horizon: 6 },
    });
  });
});
