import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/lib/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("use-intl", () => ({ useTranslations: () => (k) => k }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { email: "x@y.fr" } }) }));
vi.mock("@/components/Toast", () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));
vi.mock("@/components/bi/v2/TemplateWizard", () => ({
  default: ({ onClose }) => (
    <div role="dialog">
      wizard
      <button onClick={onClose}>close-wizard</button>
    </div>
  ),
}));
vi.mock("@/lib/api", () => ({
  listDashboards: vi.fn(async () => []),
  listSharedDashboards: vi.fn(async () => []),
  listCharts: vi.fn(async () => ({ items: [] })),
  getBiStats: vi.fn(async () => ({})),
  createDashboard: vi.fn(),
  deleteDashboard: vi.fn(),
  updateDashboard: vi.fn(),
}));

const BIReportingPage = (await import("../BIReportingPage")).default;

describe("BIReportingPage template entry", () => {
  it("opens the template wizard from its own button and closes it", async () => {
    render(<BIReportingPage />);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /fromTemplateButton/ }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByText("close-wizard"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
