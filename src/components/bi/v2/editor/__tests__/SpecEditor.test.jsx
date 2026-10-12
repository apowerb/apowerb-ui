import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { makeDashboard, makeData } from "./fixtures";

vi.mock("@/lib/api", () => ({
  patchDashboardSpec: vi.fn(),
  listBiDatasets: vi.fn().mockResolvedValue({ datasets: [] }),
}));

import { patchDashboardSpec } from "@/lib/api";
import SpecEditor, { SpecEditor as Named } from "../SpecEditor";
import { useSpecEditor } from "../useSpecEditor";
import { renderHook } from "@testing-library/react";

const flush = async (ms = 450) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

function setup(props = {}) {
  const onDashboardChange = vi.fn();
  const dashboard = makeDashboard();
  const utils = render(
    <SpecEditor dashboard={dashboard} data={makeData()} selectedComponentId="c1" onSelectComponent={vi.fn()} onDashboardChange={onDashboardChange} {...props} />,
  );
  return { ...utils, onDashboardChange, dashboard };
}

describe("SpecEditor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("exports the component both as default and named", () => {
    expect(Named).toBe(SpecEditor);
  });

  it("sends update_visual after the title debounce and reports the returned dashboard", async () => {
    const updated = makeDashboard({ title: "Pilotage" });
    patchDashboardSpec.mockResolvedValue(updated);
    const { onDashboardChange } = setup();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Nouveau titre" } });
    await flush(200);
    expect(patchDashboardSpec).not.toHaveBeenCalled();
    await flush(300);
    expect(patchDashboardSpec).toHaveBeenCalledTimes(1);
    expect(patchDashboardSpec).toHaveBeenCalledWith("d1", {
      ops: [{ op: "update_visual", component_id: "c1", changes: { title: "Nouveau titre" } }],
      dry_run: false,
    });
    expect(onDashboardChange).toHaveBeenCalledWith(updated);
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
  });

  it("undo sends the inverse op restoring the previous title; redo replays", async () => {
    patchDashboardSpec.mockResolvedValue(makeDashboard());
    setup();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Autre" } });
    await flush();
    expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    });
    await flush(0);
    expect(patchDashboardSpec).toHaveBeenLastCalledWith("d1", {
      ops: [{ op: "update_visual", component_id: "c1", changes: { title: "CA par semaine" } }],
      dry_run: false,
    });
    expect(screen.getByRole("button", { name: "Redo" })).toBeEnabled();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Redo" }));
    });
    await flush(0);
    expect(patchDashboardSpec).toHaveBeenLastCalledWith("d1", {
      ops: [{ op: "update_visual", component_id: "c1", changes: { title: "Autre" } }],
      dry_run: false,
    });
  });

  it("shows a 422 error in clear next to the faulty field and in the banner", async () => {
    const err = Object.assign(new Error("HTTP 422"), {
      status: 422,
      detail: { errors: [{ loc: ["visual", "title"], msg: "title is too long" }] },
    });
    patchDashboardSpec.mockRejectedValue(err);
    setup();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "x".repeat(500) } });
    await flush();
    expect(screen.getAllByText("title is too long").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("status")).toHaveTextContent("Error");
    expect(screen.getByLabelText("Title")).toHaveAttribute("aria-invalid", "true");
  });

  it("lists the blocks when nothing is selected and edits the dashboard title", async () => {
    patchDashboardSpec.mockResolvedValue(makeDashboard());
    const onSelect = vi.fn();
    setup({ selectedComponentId: null, onSelectComponent: onSelect });
    fireEvent.click(screen.getByRole("button", { name: "CA par semaine" }));
    expect(onSelect).toHaveBeenCalledWith("c1");
    fireEvent.change(screen.getByLabelText("Dashboard title"), { target: { value: "Vue" } });
    await flush();
    expect(patchDashboardSpec.mock.calls[0][1].ops[0]).toMatchObject({ op: "set_title", title: "Vue" });
  });

  it("collapses and reopens", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Collapse the editor" }));
    expect(screen.queryByRole("tablist")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open the editor" }));
    expect(screen.getByRole("tablist")).toBeInTheDocument();
  });

  it("records a move_component in the history and undoes it with the previous position", async () => {
    const moved = { row: 2, col: 3, width: 4, height: 5 };
    patchDashboardSpec.mockResolvedValue(makeDashboard());
    const { result } = renderHook(() => useSpecEditor({ dashboard: makeDashboard(), onDashboardChange: vi.fn() }));
    await act(async () => {
      await result.current.apply([{ op: "move_component", component_id: "c1", position: moved }]);
    });
    await act(async () => {
      await result.current.undo();
    });
    expect(patchDashboardSpec).toHaveBeenLastCalledWith("d1", {
      ops: [{ op: "move_component", component_id: "c1", position: { row: 0, col: 0, width: 6, height: 4 } }],
      dry_run: false,
    });
  });
});
