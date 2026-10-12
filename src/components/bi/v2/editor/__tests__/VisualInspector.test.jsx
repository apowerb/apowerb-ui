import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { makeDashboard, makeData, makeVisual } from "./fixtures";
import VisualInspector from "../VisualInspector";

function setup({ dashboard = makeDashboard(), apply = vi.fn().mockResolvedValue({}) } = {}) {
  const onSelect = vi.fn();
  const editor = { dashboard, data: makeData(), apply, error: null, onSelect };
  render(<VisualInspector editor={editor} componentId="c1" />);
  return { apply, onSelect };
}

describe("VisualInspector", () => {
  beforeEach(() => vi.clearAllMocks());

  it("changes the block type and keeps the compatible series with the right mark", () => {
    const { apply } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Line" }));
    const op = apply.mock.calls[0][0][0];
    expect(op).toMatchObject({ op: "update_visual", component_id: "c1" });
    expect(op.changes.type).toBe("line");
    expect(op.changes.series).toEqual([expect.objectContaining({ key: "ca", mark: "line" })]);
  });

  it("adds a series with the first measure not yet used", () => {
    const { apply } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Add a series" }));
    const changes = apply.mock.calls[0][0][0].changes;
    expect(changes.series.map((s) => s.key)).toEqual(["ca", "marge"]);
  });

  it("enables click filters with the filter matching the x field", () => {
    const dashboard = makeDashboard({ filters: [{ id: "sem", label: "Semaine", field: "semaine", type: "select" }] });
    const { apply } = setup({ dashboard });
    fireEvent.click(screen.getByLabelText("A click filters the dashboard"));
    expect(apply.mock.calls[0][0]).toEqual([
      { op: "update_visual", component_id: "c1", changes: { click_filters: { sem: "semaine" } } },
    ]);
  });

  it("proposes to create the filter when none matches x", () => {
    const { apply } = setup();
    fireEvent.click(screen.getByRole("button", { name: /Create a “semaine” filter/ }));
    const ops = apply.mock.calls[0][0];
    expect(ops[0]).toMatchObject({ op: "upsert_filter", filter: { id: "semaine", field: "semaine", type: "select" } });
    expect(ops[1].changes).toEqual({ click_filters: { semaine: "semaine" } });
  });

  it("duplicates with add_visual of the same spec and selects the copy", async () => {
    const { apply, onSelect } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));
    await Promise.resolve();
    const op = apply.mock.calls[0][0][0];
    expect(op.op).toBe("add_visual");
    expect(op.visual).toMatchObject({ type: "bar", source: "ventes", x: "semaine" });
    await vi.waitFor(() => expect(onSelect).toHaveBeenCalledWith(op.component_id));
  });

  it("deletes only after the inline confirmation", async () => {
    const { apply, onSelect } = setup();
    fireEvent.click(screen.getByRole("button", { name: /^Delete/ }));
    expect(apply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(apply.mock.calls[0][0]).toEqual([{ op: "remove_component", component_id: "c1" }]);
    await vi.waitFor(() => expect(onSelect).toHaveBeenCalledWith(null));
  });

  it("renders the KPI section with a measure picker", () => {
    const dashboard = makeDashboard();
    dashboard.components[0].visual = makeVisual({ type: "kpi", x: null, series: [], kpi: { measure: "ca" } });
    const { apply } = setup({ dashboard });
    fireEvent.change(screen.getByLabelText("Comparison"), { target: { value: "previous_period" } });
    expect(apply.mock.calls[0][0][0].changes.kpi).toEqual({ measure: "ca", compare: "previous_period" });
  });
});
