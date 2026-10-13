import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { makeDashboard, makeData } from "./fixtures";
import FiltersPanel from "../FiltersPanel";

function openForm() {
  const apply = vi.fn().mockResolvedValue({});
  render(<FiltersPanel editor={{ dashboard: makeDashboard(), data: makeData(), apply, error: null }} />);
  fireEvent.click(screen.getByRole("button", { name: "Add a filter" }));
  return { apply, form: screen.getByRole("group", { name: "Add a filter" }) };
}

const fieldOptions = (form) => within(within(form).getByLabelText("Field")).getAllByRole("option").map((o) => o.value).filter(Boolean);

describe("FiltersPanel time grain and aggregation", () => {
  it("creates a time grain filter on a date field", () => {
    const { apply, form } = openForm();
    fireEvent.change(within(form).getByLabelText("Type"), { target: { value: "time_grain" } });
    expect(fieldOptions(form)).toEqual(["semaine"]);
    fireEvent.change(within(form).getByLabelText("Default value"), { target: { value: "month" } });
    fireEvent.click(within(form).getByRole("button", { name: "Add a filter" }));
    expect(apply.mock.calls[0][0][0].filter).toMatchObject({ field: "semaine", type: "time_grain", default: "month" });
  });

  it("creates an aggregation filter on a number field", () => {
    const { apply, form } = openForm();
    fireEvent.change(within(form).getByLabelText("Type"), { target: { value: "aggregation" } });
    expect(fieldOptions(form)).toEqual(["ca"]);
    fireEvent.change(within(form).getByLabelText("Default value"), { target: { value: "avg" } });
    fireEvent.click(within(form).getByRole("button", { name: "Add a filter" }));
    expect(apply.mock.calls[0][0][0].filter).toMatchObject({ field: "ca", type: "aggregation", default: "avg" });
  });

  it("offers the new period presets", () => {
    const { form } = openForm();
    fireEvent.change(within(form).getByLabelText("Type"), { target: { value: "relative_period" } });
    for (const name of ["7 days", "1 year", "Year to date", "Month to date"]) {
      expect(within(form).getByRole("checkbox", { name })).toBeInTheDocument();
    }
  });
});
