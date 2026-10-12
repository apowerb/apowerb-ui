import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MeasureEditor from "../MeasureEditor";

const fields = [{ name: "ventes", type: "number" }, { name: "demande", type: "number" }];

function setup(dryRun, extra = {}) {
  const editor = { dashboard: { id: "d1" }, data: null, apply: vi.fn().mockResolvedValue({}), dryRun, error: null, ...extra };
  const onClose = vi.fn();
  render(<MeasureEditor editor={editor} sourceName="ventes" measure={null} fields={fields} onClose={onClose} />);
  return { editor, onClose };
}

describe("MeasureEditor", () => {
  beforeEach(() => vi.clearAllMocks());

  it("derives the snake_case name from the label until the name is edited", () => {
    setup(vi.fn());
    fireEvent.change(screen.getByLabelText("Label"), { target: { value: "Taux de service (%)" } });
    expect(screen.getByLabelText("Name")).toHaveValue("taux_de_service");
  });

  it("shows the computed value from the dry run", async () => {
    const dryRun = vi.fn().mockResolvedValue({ data: { components: { preview_measure: { value: { value: 0.982, formatted: "98,2 %" } } } } });
    setup(dryRun);
    fireEvent.change(screen.getByLabelText("Label"), { target: { value: "Taux" } });
    fireEvent.change(screen.getByLabelText("SQL formula"), { target: { value: "SUM(ventes)" } });
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    await waitFor(() => expect(screen.getByTestId("measure-preview")).toHaveTextContent("98,2 %"));
    const ops = dryRun.mock.calls[0][0];
    expect(ops[0]).toMatchObject({ op: "upsert_measure", source: "ventes", measure: { name: "taux", expr: "SUM(ventes)" } });
    expect(ops[1].visual.kpi.measure).toBe("taux");
  });

  it("shows the error of a failing formula (component error and request error)", async () => {
    const dryRun = vi
      .fn()
      .mockResolvedValueOnce({ data: { components: { preview_measure: { error: "Binder Error: column foo not found" } } } })
      .mockRejectedValueOnce(Object.assign(new Error("expr must be an aggregate"), {}));
    setup(dryRun);
    fireEvent.change(screen.getByLabelText("Label"), { target: { value: "Bad" } });
    fireEvent.change(screen.getByLabelText("SQL formula"), { target: { value: "foo" } });
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    await waitFor(() => expect(screen.getByTestId("measure-preview-error")).toHaveTextContent("Binder Error"));
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    await waitFor(() => expect(screen.getByTestId("measure-preview-error")).toHaveTextContent("expr must be an aggregate"));
  });

  it("completes field names and functions with the keyboard", () => {
    setup(vi.fn());
    const area = screen.getByLabelText("SQL formula");
    fireEvent.change(area, { target: { value: "SUM(ven", selectionStart: 7 } });
    area.setSelectionRange(7, 7);
    fireEvent.change(area, { target: { value: "SUM(ven" } });
    expect(screen.getByRole("option", { name: /ventes/ })).toBeInTheDocument();
    fireEvent.keyDown(area, { key: "Enter" });
    expect(area).toHaveValue("SUM(ventes");
  });

  it("saves with upsert_measure and closes", async () => {
    const { editor, onClose } = setup(vi.fn());
    fireEvent.change(screen.getByLabelText("Label"), { target: { value: "Marge" } });
    fireEvent.change(screen.getByLabelText("SQL formula"), { target: { value: "SUM(ventes)" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(editor.apply.mock.calls[0][0]).toEqual([
      { op: "upsert_measure", source: "ventes", measure: { name: "marge", label: "Marge", expr: "SUM(ventes)", format: "number" } },
    ]);
  });
});
