import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import LaunchEmailCampaignModal from "../LaunchEmailCampaignModal";
import { ToastProvider } from "../../Toast";

vi.mock("@/lib/api", () => ({
  launchCampaign: vi.fn(),
  getCampaignStatus: vi.fn(),
}));

import { launchCampaign, getCampaignStatus } from "@/lib/api";

const renderModal = (overrides = {}) => {
  const props = {
    open: true,
    onClose: vi.fn(),
    itemPath: "/drive/root:/Reports/Sales.xlsx",
    dashboardId: "dash-1",
    availableColumns: ["firstname", "Email", "company"],
    previewRow: {
      firstname: "Alice",
      Email: "alice@example.com",
      company: "Acme",
    },
    sheetName: "Sheet1",
    ...overrides,
  };
  return {
    props,
    ...render(
      <ToastProvider>
        <LaunchEmailCampaignModal {...props} />
      </ToastProvider>,
    ),
  };
};

function fillSubjectBody(subjectValue, bodyValue) {
  fireEvent.change(screen.getByLabelText(/subject/i), {
    target: { value: subjectValue },
  });
  fireEvent.change(screen.getByLabelText(/body/i), {
    target: { value: bodyValue },
  });
}

describe("LaunchEmailCampaignModal", () => {
  beforeEach(() => {
    launchCampaign.mockReset();
    getCampaignStatus.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders title, subject, body and disabled launch button", () => {
    renderModal();
    expect(
      screen.getByRole("heading", { name: /launch email campaign/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/subject/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/body/i)).toBeInTheDocument();
    const launchBtn = screen.getByRole("button", { name: /launch campaign/i });
    expect(launchBtn).toBeDisabled();
  });

  it("enables launch button when subject and body are filled", () => {
    renderModal();
    fillSubjectBody(
      "Hello {{firstname}}",
      "Hi {{firstname}}, welcome to {{company}}.",
    );
    const launchBtn = screen.getByRole("button", { name: /launch campaign/i });
    expect(launchBtn).not.toBeDisabled();
  });

  it("substitutes {{col}} in preview using previewRow values", () => {
    renderModal();
    fillSubjectBody(
      "Hello {{firstname}}!",
      "Dear {{firstname}} from {{company}}.",
    );

    const preview = screen.getByTestId("campaign-preview");
    expect(preview.textContent).toContain("Hello Alice!");
    expect(preview.textContent).toContain("Dear Alice from Acme.");
  });

  it("substitutes missing variables with empty string (not raw {{col}})", () => {
    renderModal({
      previewRow: { firstname: "Alice" },
      availableColumns: ["firstname", "missing"],
    });
    fillSubjectBody("Hi {{firstname}} {{missing}}!", "Body {{missing}}");

    const preview = screen.getByTestId("campaign-preview");
    expect(preview.textContent).toContain("Hi Alice !");
    expect(preview.textContent).not.toContain("{{missing}}");
  });

  it("clicking launch posts payload and switches to progress view", async () => {
    launchCampaign.mockResolvedValue({
      campaign_id: "camp-123",
      status: "queued",
      total_contacts: 10,
    });
    getCampaignStatus.mockResolvedValue({
      total: 10,
      sent: 0,
      failed: 0,
      pending: 10,
      done: false,
      errors: [],
    });

    renderModal();
    fillSubjectBody("Hello {{firstname}}", "Body for {{firstname}}");
    fireEvent.click(screen.getByRole("button", { name: /launch campaign/i }));

    await waitFor(() => {
      expect(launchCampaign).toHaveBeenCalledTimes(1);
    });
    const payload = launchCampaign.mock.calls[0][0];
    expect(payload).toMatchObject({
      item_path: "/drive/root:/Reports/Sales.xlsx",
      subject: "Hello {{firstname}}",
      body: "Body for {{firstname}}",
      email_column: "Email",
      sheet_name: "Sheet1",
      dashboard_id: "dash-1",
    });

    await waitFor(() => {
      expect(screen.getByTestId("campaign-progress")).toBeInTheDocument();
    });
  });
});
