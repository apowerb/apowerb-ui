import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { makeDashboard, makeData } from "./fixtures";
import AddBlockPanel from "../AddBlockPanel";

describe("AddBlockPanel", () => {
  it("adds a line block pre-filled from the first source and selects it", async () => {
    const apply = vi.fn().mockResolvedValue({});
    const onSelect = vi.fn();
    render(<AddBlockPanel editor={{ dashboard: makeDashboard(), data: makeData(), apply, onSelect }} />);
    fireEvent.click(screen.getByRole("button", { name: /^Line/ }));
    const op = apply.mock.calls[0][0][0];
    expect(op.op).toBe("add_visual");
    expect(op.visual).toMatchObject({ type: "line", source: "ventes", x: "semaine", series: [{ key: "ca", mark: "line" }] });
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(op.component_id));
  });

  it("pre-fills a KPI with the first measure", () => {
    const apply = vi.fn().mockResolvedValue(null);
    render(<AddBlockPanel editor={{ dashboard: makeDashboard(), data: makeData(), apply, onSelect: vi.fn() }} />);
    fireEvent.click(screen.getByRole("button", { name: /^KPI/ }));
    expect(apply.mock.calls[0][0][0].visual).toMatchObject({ type: "kpi", source: "ventes", kpi: { measure: "ca" } });
  });

  it("disables data blocks without a source but keeps the callout", () => {
    const apply = vi.fn().mockResolvedValue({});
    const onNeedSource = vi.fn();
    render(<AddBlockPanel editor={{ dashboard: makeDashboard({ sources: [] }), data: null, apply, onSelect: vi.fn() }} onNeedSource={onNeedSource} />);
    expect(screen.getByRole("button", { name: /^Bars/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Callout/ })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Go to Data" }));
    expect(onNeedSource).toHaveBeenCalled();
  });
});
