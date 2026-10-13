import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { makeDashboard } from "./fixtures";
import VisualInspector from "../VisualInspector";

describe("VisualInspector type change on a source without measures", () => {
  it("creates the measure a KPI needs when a chart becomes a KPI", () => {
    const dashboard = makeDashboard();
    dashboard.sources = [{ ...dashboard.sources[0], measures: [] }];
    dashboard.components = [{ id: "c1", component_type: "visual", visual: { type: "bar", source: "ventes", x: "semaine", series: [{ key: "prevu_total", mark: "bar", axis: "left" }] } }];
    const data = { sources: { ventes: { fields: [{ name: "semaine", type: "date", role: "date" }, { name: "prevu_total", type: "number", role: "measure" }] } } };
    const apply = vi.fn().mockResolvedValue({});
    render(<VisualInspector editor={{ dashboard, data, apply, error: null, onSelect: vi.fn() }} componentId="c1" />);
    fireEvent.click(screen.getByRole("button", { name: "KPI" }));
    const ops = apply.mock.calls[0][0];
    expect(ops[0]).toMatchObject({ op: "upsert_measure", source: "ventes", measure: { name: "prevu_total", expr: "SUM(prevu_total)" } });
    expect(ops[1]).toMatchObject({ op: "update_visual", component_id: "c1", changes: { type: "kpi", kpi: { measure: "prevu_total" } } });
  });
});
