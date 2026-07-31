import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AddChartWizard from "../AddChartWizard";
import { ToastProvider } from "../../Toast";

vi.mock("@/lib/api", () => ({
  uploadBiCsv: vi.fn(),
  listBiDatasets: vi.fn(() => Promise.resolve([])),
  previewBiDataset: vi.fn(),
  listBiDbConfigs: vi.fn(() => Promise.resolve([])),
  createChart: vi.fn(),
  addDashboardComponent: vi.fn(),
  previewOnedriveSpreadsheet: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { email: "tester@example.com" } }),
}));

vi.mock("../OneDriveFilePicker", () => ({
  default: ({ onFileSelected }) => (
    <button
      type="button"
      onClick={() =>
        onFileSelected({
          item_id: "file_42",
          item_path: "Reports/Sales.xlsx",
          filename: "Sales.xlsx",
        })
      }
    >
      mock-pick-file
    </button>
  ),
}));

vi.mock("../AgentSourcePicker", () => ({
  default: () => <div>mock-agent-picker</div>,
}));

import { previewOnedriveSpreadsheet } from "@/lib/api";

const renderWizard = () =>
  render(
    <ToastProvider>
      <AddChartWizard
        dashboardId="dash-1"
        componentCount={0}
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />
    </ToastProvider>,
  );

describe("AddChartWizard — OneDrive Spreadsheet preview", () => {
  beforeEach(() => {
    previewOnedriveSpreadsheet.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("calls previewOnedriveSpreadsheet with item_path/item_id when reaching the preview step", async () => {
    previewOnedriveSpreadsheet.mockResolvedValue({
      columns: [{ name: "email", type: "string" }],
      row_count: 3,
      sample_rows: [{ email: "a@x.io" }],
      sheet_name: "Sheet1",
    });

    renderWizard();

    fireEvent.click(screen.getByRole("button", { name: /onedrive/i }));
    fireEvent.click(await screen.findByRole("button", { name: /mock-pick-file/i }));

    await waitFor(() => {
      expect(previewOnedriveSpreadsheet).toHaveBeenCalledTimes(1);
    });
    expect(previewOnedriveSpreadsheet).toHaveBeenCalledWith({
      itemPath: "Reports/Sales.xlsx",
      itemId: "file_42",
      sheetName: null,
    });
  });

  it("renders the preview table with column headers and sample rows on success", async () => {
    previewOnedriveSpreadsheet.mockResolvedValue({
      columns: [
        { name: "email", type: "string" },
        { name: "age", type: "integer" },
      ],
      row_count: 42,
      sample_rows: [
        { email: "a@x.io", age: 20 },
        { email: "b@x.io", age: 30 },
      ],
      sheet_name: "Sheet1",
    });

    renderWizard();

    fireEvent.click(screen.getByRole("button", { name: /onedrive/i }));
    fireEvent.click(await screen.findByRole("button", { name: /mock-pick-file/i }));

    expect(await screen.findByText("a@x.io")).toBeInTheDocument();
    expect(screen.getByText("b@x.io")).toBeInTheDocument();
    expect(screen.getByText(/42 rows/i)).toBeInTheDocument();
  });

  it("shows an explicit error banner on 401 suggesting /integrations", async () => {
    const err = new Error("Integration missing");
    err.status = 401;
    previewOnedriveSpreadsheet.mockRejectedValue(err);

    renderWizard();

    fireEvent.click(screen.getByRole("button", { name: /onedrive/i }));
    fireEvent.click(await screen.findByRole("button", { name: /mock-pick-file/i }));

    expect(
      await screen.findByText(/OneDrive not connected/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /integrations/i })).toBeInTheDocument();
  });

  it("shows a 'file not found' error on 404", async () => {
    const err = new Error("not found");
    err.status = 404;
    previewOnedriveSpreadsheet.mockRejectedValue(err);

    renderWizard();

    fireEvent.click(screen.getByRole("button", { name: /onedrive/i }));
    fireEvent.click(await screen.findByRole("button", { name: /mock-pick-file/i }));

    expect(await screen.findByText(/file not found/i)).toBeInTheDocument();
  });

  it("shows an 'unsupported format' error on 415", async () => {
    const err = new Error("unsupported");
    err.status = 415;
    previewOnedriveSpreadsheet.mockRejectedValue(err);

    renderWizard();

    fireEvent.click(screen.getByRole("button", { name: /onedrive/i }));
    fireEvent.click(await screen.findByRole("button", { name: /mock-pick-file/i }));

    expect(
      await screen.findByText(/unsupported|format not supported/i),
    ).toBeInTheDocument();
  });
});
