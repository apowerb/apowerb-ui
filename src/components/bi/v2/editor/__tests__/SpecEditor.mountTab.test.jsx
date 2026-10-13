import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { makeDashboard, makeData } from "./fixtures";

vi.mock("@/lib/api", () => ({
  patchDashboardSpec: vi.fn(),
  listBiDatasets: vi.fn().mockResolvedValue({ datasets: [] }),
}));

import SpecEditor from "../SpecEditor";

describe("SpecEditor opened by New Chart", () => {
  it("starts on the Add tab when it mounts with that request", () => {
    render(
      <SpecEditor dashboard={makeDashboard()} data={makeData()} onSelectComponent={vi.fn()} onDashboardChange={vi.fn()} tabRequest={{ tab: "add", at: 1 }} />,
    );
    expect(screen.getByRole("tab", { name: /Add/ })).toHaveAttribute("aria-selected", "true");
  });
});
