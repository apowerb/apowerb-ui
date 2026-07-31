import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import WebhookAttachment from "../WebhookAttachment";

vi.mock("@/lib/api", () => ({
  fetchWebhookLogAttachmentObjectUrl: vi.fn(),
}));

const toastSpy = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };
vi.mock("../Toast", () => ({ useToast: () => toastSpy }));

import { fetchWebhookLogAttachmentObjectUrl } from "@/lib/api";

const PDF = { filename: "facture.pdf", content_type: "application/pdf", size: 42000 };

describe("WebhookAttachment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("open", vi.fn());
    fetchWebhookLogAttachmentObjectUrl.mockResolvedValue("blob:mock-url");
    if (!URL.revokeObjectURL) URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("renders the filename and does NOT fetch on render (lazy)", () => {
    render(<WebhookAttachment logId={42} att={PDF} />);
    expect(screen.getByText("facture.pdf")).toBeInTheDocument();
    expect(fetchWebhookLogAttachmentObjectUrl).not.toHaveBeenCalled();
  });

  it("on click, fetches WITH auth, opens the blob URL and toasts success", async () => {
    render(<WebhookAttachment logId={42} att={PDF} />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(window.open).toHaveBeenCalledTimes(1));
    expect(fetchWebhookLogAttachmentObjectUrl).toHaveBeenCalledWith(42, "facture.pdf");
    expect(window.open).toHaveBeenCalledWith("blob:mock-url", "_blank", "noopener");
    await waitFor(() => expect(toastSpy.success).toHaveBeenCalledWith("Attachment opened"));
    expect(toastSpy.error).not.toHaveBeenCalled();
  });

  it("passes the raw filename (incl. spaces) to the auth'd helper", async () => {
    const spaced = { filename: "bon commande.pdf", content_type: "application/pdf", size: 5000 };
    render(<WebhookAttachment logId={5} att={spaced} />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(window.open).toHaveBeenCalledTimes(1));
    expect(fetchWebhookLogAttachmentObjectUrl).toHaveBeenCalledWith(5, "bon commande.pdf");
  });

  it("a failing fetch (e.g. 401) toasts an error and does NOT open a tab", async () => {
    fetchWebhookLogAttachmentObjectUrl.mockRejectedValueOnce(new Error("HTTP 401"));
    render(<WebhookAttachment logId={42} att={PDF} />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(toastSpy.error).toHaveBeenCalledWith("Attachment unavailable"));
    expect(window.open).not.toHaveBeenCalled();
    expect(toastSpy.success).not.toHaveBeenCalled();
  });
});
