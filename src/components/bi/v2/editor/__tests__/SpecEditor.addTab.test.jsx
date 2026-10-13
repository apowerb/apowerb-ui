import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { makeDashboard, makeData } from "./fixtures";

vi.mock("@/lib/api", () => ({
  patchDashboardSpec: vi.fn(),
  listBiDatasets: vi.fn().mockResolvedValue({ datasets: [] }),
}));

import SpecEditor from "../SpecEditor";

describe("SpecEditor tab request", () => {
  it("opens the Add tab when the screen asks for it (New Chart on a v2 dashboard)", () => {
    const props = { dashboard: makeDashboard(), data: makeData(), onSelectComponent: vi.fn(), onDashboardChange: vi.fn() };
    const { rerender } = render(<SpecEditor {...props} />);
    expect(screen.getByRole("tab", { name: /Block/ })).toHaveAttribute("aria-selected", "true");
    rerender(<SpecEditor {...props} tabRequest={{ tab: "add", at: 1 }} />);
    expect(screen.getByRole("tab", { name: /Add/ })).toHaveAttribute("aria-selected", "true");
  });
});
