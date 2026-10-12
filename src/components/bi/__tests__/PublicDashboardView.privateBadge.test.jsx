import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/lib/api", () => ({
  getPublicDashboard: vi.fn(),
}));

import { getPublicDashboard } from "@/lib/api";
import PublicDashboardView from "../PublicDashboardView";

describe("PublicDashboardView visibility badge", () => {
  // A private dashboard used to crash the whole page with "Illegal
  // constructor": the badge icon `Lock` was never imported, so it resolved to
  // the browser's global Web Locks `Lock` class.
  it("renders a private dashboard without crashing", async () => {
    getPublicDashboard.mockResolvedValue({
      title: "Prévision emballage",
      visibility: "private",
      components: [],
    });

    render(<PublicDashboardView slug="prevision-emballage" />);

    expect(await screen.findByText("Prévision emballage")).toBeInTheDocument();
  });
});
