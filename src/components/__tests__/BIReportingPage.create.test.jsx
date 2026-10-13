import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const push = vi.fn();
vi.mock("@/lib/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("use-intl", () => ({ useTranslations: () => (k) => k }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { email: "x@y.fr" } }) }));
vi.mock("@/components/Toast", () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));
vi.mock("@/components/bi/v2/TemplateWizard", () => ({ default: () => null }));
// The real picker drives uploads and connectors; here it hands back one pick.
vi.mock("@/components/bi/v2/editor/SourcePicker", () => ({
  default: ({ onPick }) => (
    <button type="button" onClick={() => onPick({ type: "csv", file_id: "f-1", filename: "ventes.csv" })}>
      pick-ventes
    </button>
  ),
}));
vi.mock("@/lib/api", () => ({
  listDashboards: vi.fn(async () => []),
  listSharedDashboards: vi.fn(async () => []),
  listCharts: vi.fn(async () => ({ items: [] })),
  getBiStats: vi.fn(async () => ({})),
  createDashboard: vi.fn(async () => ({ id: "d-9" })),
  deleteDashboard: vi.fn(),
  updateDashboard: vi.fn(),
}));

const { createDashboard } = await import("@/lib/api");
const BIReportingPage = (await import("../BIReportingPage")).default;

async function openCreate() {
  render(<BIReportingPage />);
  fireEvent.click((await screen.findAllByRole("button", { name: /newDashboardButton/ }))[0]);
  fireEvent.change(screen.getByPlaceholderText("myDashboardPlaceholder"), { target: { value: "Stocks" } });
}

describe("BIReportingPage create with data", () => {
  it("cannot create a dashboard before choosing its data", async () => {
    await openCreate();
    expect(screen.getByRole("button", { name: "createButton" })).toBeDisabled();
  });

  it("sends the chosen sources so the dashboard is built on them", async () => {
    await openCreate();
    fireEvent.click(screen.getByRole("button", { name: "addDataButton" }));
    fireEvent.click(screen.getByRole("button", { name: "pick-ventes" }));
    expect(screen.getByText("ventes")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "createButton" }));
    await waitFor(() => expect(createDashboard).toHaveBeenCalled());
    expect(createDashboard.mock.calls[0][0]).toEqual({
      title: "Stocks",
      description: undefined,
      sources: [{ name: "ventes", label: "ventes", kind: "dataset", dataset_id: "f-1", transforms: [], fields: [], measures: [] }],
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/bi/d-9"));
  });

  it("removes a chosen source before creating", async () => {
    await openCreate();
    fireEvent.click(screen.getByRole("button", { name: "addDataButton" }));
    fireEvent.click(screen.getByRole("button", { name: "pick-ventes" }));
    fireEvent.click(screen.getByRole("button", { name: "removeSourceButton" }));
    expect(screen.queryByText("ventes")).toBeNull();
    expect(screen.getByRole("button", { name: "createButton" })).toBeDisabled();
  });
});
