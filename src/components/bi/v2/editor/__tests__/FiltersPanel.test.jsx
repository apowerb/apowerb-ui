import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { makeDashboard, makeData } from "./fixtures";
import FiltersPanel from "../FiltersPanel";

describe("FiltersPanel", () => {
  it("creates a filter with upsert_filter", () => {
    const apply = vi.fn().mockResolvedValue({});
    render(<FiltersPanel editor={{ dashboard: makeDashboard(), data: makeData(), apply, error: null }} />);
    fireEvent.click(screen.getByRole("button", { name: "Add a filter" }));
    const form = screen.getByRole("group", { name: "Add a filter" });
    fireEvent.change(within(form).getByLabelText("Field"), { target: { value: "region" } });
    fireEvent.click(within(form).getByRole("button", { name: "Add a filter" }));
    expect(apply.mock.calls[0][0]).toEqual([
      { op: "upsert_filter", filter: { id: "region", label: "region", field: "region", type: "select", default: null } },
    ]);
  });

  it("removes a filter and reorders with remove + upsert of the tail", () => {
    const apply = vi.fn().mockResolvedValue({});
    const filters = [
      { id: "a", label: "A", field: "region", type: "select" },
      { id: "b", label: "B", field: "semaine", type: "relative_period", presets: ["13w"] },
    ];
    render(<FiltersPanel editor={{ dashboard: makeDashboard({ filters }), data: makeData(), apply, error: null }} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove B" }));
    expect(apply.mock.calls[0][0]).toEqual([{ op: "remove_filter", id: "b" }]);
    fireEvent.click(screen.getByRole("button", { name: "Move A down" }));
    expect(apply.mock.calls[1][0].map((o) => `${o.op}:${o.id || o.filter.id}`)).toEqual([
      "remove_filter:b", "remove_filter:a", "upsert_filter:b", "upsert_filter:a",
    ]);
  });
});
