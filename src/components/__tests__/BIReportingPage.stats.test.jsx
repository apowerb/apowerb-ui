/**
 * The BI screen's chart count must not include charts made inside a chat.
 *
 * Reported from the app on 2026-09-14: "128 Charts" for someone who had
 * built about ten. The agent persists a chart for every chart it shows in a
 * conversation, and the count took them all. The server now splits them
 * (chart_count = BI, chat_chart_count = chat); the screen shows both, apart.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("use-intl", () => ({ useTranslations: () => (k) => k }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { email: "x@y.fr" } }) }));
vi.mock("./Toast", () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));
vi.mock("@/components/Toast", () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));
vi.mock("@/lib/api", () => ({
  listDashboards: vi.fn(async () => []),
  listSharedDashboards: vi.fn(async () => []),
  listCharts: vi.fn(async () => ({ items: [] })),
  getBiStats: vi.fn(),
  createDashboard: vi.fn(),
  deleteDashboard: vi.fn(),
  updateDashboard: vi.fn(),
}));

const { getBiStats } = await import("@/lib/api");
const BIReportingPage = (await import("../BIReportingPage")).default;

const valueFor = (label) => screen.getByText(label).previousElementSibling?.textContent;

describe("BIReportingPage stats", () => {
  beforeEach(() => getBiStats.mockReset());

  it("counts BI charts and shows chat charts apart", async () => {
    getBiStats.mockResolvedValue({ dashboard_count: 3, chart_count: 9, chat_chart_count: 119 });

    render(<BIReportingPage />);

    await waitFor(() => expect(screen.getByText("chatChartsStatLabel")).toBeTruthy());
    expect(valueFor("chartsStatLabel")).toBe("9");
    expect(valueFor("chatChartsStatLabel")).toBe("119");
  });

  it("shows no chat counter when the server does not split them yet", async () => {
    getBiStats.mockResolvedValue({ dashboard_count: 3, chart_count: 128 });

    render(<BIReportingPage />);

    await waitFor(() => expect(valueFor("chartsStatLabel")).toBe("128"));
    expect(screen.queryByText("chatChartsStatLabel")).toBeNull();
  });
});
