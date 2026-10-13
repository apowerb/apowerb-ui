import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { makeDashboard } from "./fixtures";
import AddBlockPanel from "../AddBlockPanel";
import { measuresFor } from "../lib";

// A source added from the UI: fields served by the core, no measure declared.
const fields = [
  { name: "semaine", type: "date", role: "date" },
  { name: "famille", type: "string", role: "dimension" },
  { name: "prevu_total", type: "number", role: "measure" },
  { name: "Ventes N-1", type: "number", role: "measure" },
];

function setup() {
  const dashboard = makeDashboard();
  dashboard.sources = [{ ...dashboard.sources[0], measures: [] }];
  const data = { sources: { ventes: { row_count: 8, fields } } };
  const apply = vi.fn().mockResolvedValue({});
  render(<AddBlockPanel editor={{ dashboard, data, apply, onSelect: vi.fn() }} />);
  return apply;
}

const sum = (name, label, expr) => ({ op: "upsert_measure", source: "ventes", measure: { name, label, expr, format: "number" } });

describe("blocks that need measures on a source without any", () => {
  it("creates the KPI measure from the first number column", () => {
    const apply = setup();
    fireEvent.click(screen.getByRole("button", { name: /^KPI/ }));
    const ops = apply.mock.calls[0][0];
    expect(ops[0]).toEqual(sum("prevu_total", "prevu_total", "SUM(prevu_total)"));
    expect(ops.at(-1)).toMatchObject({ op: "add_visual", visual: { type: "kpi", kpi: { measure: "prevu_total" } } });
  });

  it("creates one measure per waterfall step, quoting a column that is not an identifier", () => {
    const apply = setup();
    fireEvent.click(screen.getByRole("button", { name: /^Waterfall/ }));
    const ops = apply.mock.calls[0][0];
    expect(ops.slice(0, 2)).toEqual([sum("prevu_total", "prevu_total", "SUM(prevu_total)"), sum("ventes_n_1", "Ventes N-1", 'SUM("Ventes N-1")')]);
    expect(ops.at(-1).visual.steps.map((s) => s.measure)).toEqual(["prevu_total", "ventes_n_1"]);
  });

  it("points the summary sentence at a measure", () => {
    const apply = setup();
    fireEvent.click(screen.getByRole("button", { name: /^Summary sentence/ }));
    const ops = apply.mock.calls[0][0];
    expect(ops[0]).toEqual(sum("prevu_total", "prevu_total", "SUM(prevu_total)"));
    expect(ops.at(-1).visual.text).toContain("{{prevu_total|number}}");
  });

  it("leaves a chart on raw columns and declared measures alone", () => {
    const dashboard = makeDashboard();
    const visual = { type: "kpi", source: "ventes", kpi: { measure: "ca" } };
    expect(measuresFor(visual, dashboard, null)).toEqual({ visual, ops: [] });
    const apply = setup();
    fireEvent.click(screen.getByRole("button", { name: /^Bars/ }));
    expect(apply.mock.calls[0][0]).toHaveLength(1);
  });
});
