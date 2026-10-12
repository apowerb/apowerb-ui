import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/lib/api", () => ({
  getPublicDashboard: vi.fn(),
}));

vi.mock("../ChartRenderer", () => ({
  default: () => <div>chart</div>,
}));

import { getPublicDashboard } from "@/lib/api";
import PublicDashboardView from "../PublicDashboardView";

const originalWidth = window.innerWidth;

function dashboard() {
  return {
    title: "Prévision emballage",
    visibility: "private",
    components: [
      {
        id: "chart",
        component_type: "chart",
        chart: { chart_id: "c1", title_override: "Courbe" },
        position: { row: 2, col: 0, width: 12, height: 6 },
      },
      {
        id: "peak",
        component_type: "key_value",
        key_value: { label: "Pic prévu", value: "Semaine du 12/01/2026" },
        position: { row: 0, col: 9, width: 3, height: 2 },
      },
      {
        id: "total",
        component_type: "key_value",
        key_value: { label: "Total prévu", value: "180 438" },
        position: { row: 0, col: 0, width: 3, height: 2 },
      },
    ],
  };
}

async function renderAt(width) {
  window.innerWidth = width;
  getPublicDashboard.mockResolvedValue(dashboard());
  const view = render(<PublicDashboardView slug="prevision-emballage" />);
  await screen.findAllByText("Pic prévu");
  return view;
}

function tile(title) {
  return screen.getByRole("heading", { name: title }).closest("[style]");
}

describe("PublicDashboardView grid on narrow screens", () => {
  afterEach(() => {
    window.innerWidth = originalWidth;
  });

  it("keeps the 12-column layout on a wide screen", async () => {
    await renderAt(1280);
    expect(tile("Pic prévu").style.gridColumn).toBe("10 / span 3");
  });

  // At 670px the 3/12 KPI tiles were ~140px wide and their values overflowed.
  it("puts two KPI tiles per row on a tablet-sized screen", async () => {
    const { container } = await renderAt(670);
    expect(tile("Pic prévu").style.gridColumn).toBe("span 1");
    expect(tile("Courbe").style.gridColumn).toBe("span 2");
    const titles = [...container.querySelectorAll("h3")].map((h) => h.textContent);
    expect(titles).toEqual(["Total prévu", "Pic prévu", "Courbe"]);
  });

  it("stacks everything in one column on a phone", async () => {
    await renderAt(375);
    expect(tile("Pic prévu").style.gridColumn).toBe("span 1");
    expect(tile("Courbe").style.gridColumn).toBe("span 1");
  });
});
