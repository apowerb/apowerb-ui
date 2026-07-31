import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import NewExcelCampaignWizard from "../NewExcelCampaignWizard";
import { ToastProvider } from "../../Toast";

vi.mock("@/lib/api", () => ({
  launchCampaign: vi.fn(),
  getCampaignStatus: vi.fn(),
  getOnedriveExcelPreview: vi.fn(),
}));

// Stub OneDriveFilePicker so we can drive the selection deterministically
// without hitting fetch in the picker itself.
vi.mock("../../bi/OneDriveFilePicker", () => ({
  __esModule: true,
  default: ({ onFileSelected, onCancel }) => (
    <div data-testid="onedrive-picker-stub">
      <button
        type="button"
        onClick={() =>
          onFileSelected({
            item_id: "item-1",
            item_path: "/drive/root:/Reports/Contacts.xlsx",
            filename: "Contacts.xlsx",
          })
        }
      >
        stub-pick-file
      </button>
      <button type="button" onClick={onCancel}>
        stub-cancel
      </button>
    </div>
  ),
}));

import {
  getOnedriveExcelPreview,
  launchCampaign,
  getCampaignStatus,
} from "@/lib/api";

const PREVIEW_FIXTURE = {
  columns: ["firstname", "Email", "company", "country"],
  rows: [
    {
      firstname: "Alice",
      Email: "alice@example.com",
      company: "Acme",
      country: "FR",
    },
    {
      firstname: "Bob",
      Email: "bob@example.com",
      company: "BetaCorp",
      country: "US",
    },
    {
      firstname: "Carol",
      Email: "carol@example.com",
      company: "Gamma",
      country: "DE",
    },
    {
      firstname: "Dan",
      Email: "dan@example.com",
      company: "Delta",
      country: "UK",
    },
    {
      firstname: "Eve",
      Email: "eve@example.com",
      company: "Epsilon",
      country: "ES",
    },
  ],
};

const renderWizard = (overrides = {}) => {
  const props = {
    open: true,
    onClose: vi.fn(),
    ...overrides,
  };
  return {
    props,
    ...render(
      <ToastProvider>
        <NewExcelCampaignWizard {...props} />
      </ToastProvider>,
    ),
  };
};

describe("NewExcelCampaignWizard", () => {
  beforeEach(() => {
    getOnedriveExcelPreview.mockReset();
    launchCampaign.mockReset();
    getCampaignStatus.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders step 1 with the Choose title and the Browse OneDrive action", () => {
    renderWizard();
    expect(
      screen.getByRole("heading", { name: /choose the excel file/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /browse onedrive/i }),
    ).toBeInTheDocument();
  });

  it("after picking a file, step 2 loads the preview, auto-selects Email column and shows rows", async () => {
    getOnedriveExcelPreview.mockResolvedValue(PREVIEW_FIXTURE);
    renderWizard();

    // Open the picker and simulate a pick
    fireEvent.click(screen.getByRole("button", { name: /browse onedrive/i }));
    fireEvent.click(screen.getByText("stub-pick-file"));

    await waitFor(() => {
      expect(getOnedriveExcelPreview).toHaveBeenCalledWith(
        "/drive/root:/Reports/Contacts.xlsx",
        expect.any(Object),
      );
    });

    // Filename is echoed
    expect(screen.getByText(/Contacts\.xlsx/)).toBeInTheDocument();

    // "Email" auto-selected on the recipient column selector
    const selector = await screen.findByLabelText(
      /which column holds the recipient email/i,
    );
    expect(selector).toHaveValue("Email");

    // The preview table shows sample values
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByText("BetaCorp")).toBeInTheDocument();
  });

  it("clicking Next on step 2 mounts the LaunchEmailCampaignModal with the right props", async () => {
    getOnedriveExcelPreview.mockResolvedValue(PREVIEW_FIXTURE);
    renderWizard();

    fireEvent.click(screen.getByRole("button", { name: /browse onedrive/i }));
    fireEvent.click(screen.getByText("stub-pick-file"));

    await screen.findByLabelText(
      /which column holds the recipient email/i,
    );

    const nextBtn = screen.getByRole("button", { name: /^next$/i });
    expect(nextBtn).not.toBeDisabled();
    fireEvent.click(nextBtn);

    // LaunchEmailCampaignModal owns this heading
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /launch email campaign/i }),
      ).toBeInTheDocument();
    });
  });
});
