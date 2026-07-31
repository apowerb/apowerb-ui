import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AttachmentMenu from "../AttachmentMenu";

vi.mock("@/lib/api", () => ({
  getWebhookLog: vi.fn(),
  fetchWebhookLogAttachmentObjectUrl: vi.fn(),
}));

const toastSpy = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };
vi.mock("../../Toast", () => ({ useToast: () => toastSpy }));

import { getWebhookLog, fetchWebhookLogAttachmentObjectUrl } from "@/lib/api";

const ONE_ATTACHMENT = [{ filename: "facture.pdf", path: "/uploads/3/facture.pdf", content_type: "application/pdf", size: 42000 }];
const TWO_ATTACHMENTS = [
  { filename: "facture.pdf", path: "/uploads/3/facture.pdf", content_type: "application/pdf", size: 42000 },
  { filename: "bon commande.pdf", path: "/uploads/3/bon commande.pdf", content_type: "application/pdf", size: 18000 },
];

describe("AttachmentMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("open", vi.fn());
    // Default: the auth'd attachment fetch succeeds and yields a blob URL.
    fetchWebhookLogAttachmentObjectUrl.mockResolvedValue("blob:mock-url");
    // jsdom doesn't implement revokeObjectURL; the component schedules it.
    if (!URL.revokeObjectURL) URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders disabled button when webhookLogId is null", () => {
    render(<AttachmentMenu webhookLogId={null} />);
    const btn = screen.getByRole("button", { name: /view attachment/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("title", expect.stringMatching(/earlier/i));
  });

  it("does NOT fetch on render", () => {
    render(<AttachmentMenu webhookLogId={42} />);
    expect(getWebhookLog).not.toHaveBeenCalled();
  });

  it("fetches attachments on first click only", async () => {
    getWebhookLog.mockResolvedValue({ log: { id: 42, attachments: ONE_ATTACHMENT } });
    render(<AttachmentMenu webhookLogId={42} />);
    const btn = screen.getByRole("button", { name: /view attachment/i });
    fireEvent.click(btn);
    await waitFor(() => expect(getWebhookLog).toHaveBeenCalledTimes(1));
    fireEvent.click(btn);
    // Second click should NOT trigger another fetch (cache hit)
    expect(getWebhookLog).toHaveBeenCalledTimes(1);
  });

  it("single attachment is fetched WITH auth and opened as a blob URL", async () => {
    getWebhookLog.mockResolvedValue({ log: { id: 42, attachments: ONE_ATTACHMENT } });
    render(<AttachmentMenu webhookLogId={42} />);
    fireEvent.click(screen.getByRole("button", { name: /view attachment/i }));
    await waitFor(() => expect(window.open).toHaveBeenCalledTimes(1));
    // The auth'd helper is what carries the Bearer token (window.open can't).
    expect(fetchWebhookLogAttachmentObjectUrl).toHaveBeenCalledWith(42, "facture.pdf");
    // We open the blob object URL, never the raw API path.
    expect(window.open).toHaveBeenCalledWith("blob:mock-url", "_blank", "noopener");
    await waitFor(() => expect(toastSpy.success).toHaveBeenCalledWith("Attachment opened"));
  });

  it("a failing attachment fetch (e.g. 401) shows error and does not crash", async () => {
    // This is the regression guard for the original bug: window.open went
    // straight to the Bearer-protected API and got "Not authenticated".
    getWebhookLog.mockResolvedValue({ log: { id: 42, attachments: ONE_ATTACHMENT } });
    fetchWebhookLogAttachmentObjectUrl.mockRejectedValueOnce(new Error("HTTP 401"));
    render(<AttachmentMenu webhookLogId={42} />);
    const btn = screen.getByRole("button", { name: /view attachment/i });
    fireEvent.click(btn);
    await waitFor(() => expect(btn).toHaveAttribute("title", expect.stringMatching(/unreachable/i)));
    expect(window.open).not.toHaveBeenCalled();
    expect(toastSpy.error).toHaveBeenCalledWith("Could not access the attachment");
  });

  it("multiple attachments renders dropdown items", async () => {
    getWebhookLog.mockResolvedValue({ log: { id: 99, attachments: TWO_ATTACHMENTS } });
    render(<AttachmentMenu webhookLogId={99} />);
    fireEvent.click(screen.getByRole("button", { name: /view attachment/i }));
    await waitFor(() => {
      expect(screen.getByText("facture.pdf")).toBeInTheDocument();
      expect(screen.getByText("bon commande.pdf")).toBeInTheDocument();
    });
    expect(window.open).not.toHaveBeenCalled();
  });

  it("error from API shows tooltip / button does not crash", async () => {
    getWebhookLog.mockRejectedValue(new Error("404 Not Found"));
    render(<AttachmentMenu webhookLogId={7} />);
    const btn = screen.getByRole("button", { name: /view attachment/i });
    fireEvent.click(btn);
    await waitFor(() => {
      // Button is still there, not crashed
      expect(screen.getByRole("button", { name: /view attachment/i })).toBeInTheDocument();
    });
    // Title attribute shows error indication
    expect(btn).toHaveAttribute("title", expect.stringMatching(/unreachable/i));
    expect(window.open).not.toHaveBeenCalled();
  });

  it("passes the raw filename (incl. spaces) to the auth'd helper", async () => {
    // Encoding is now the helper's job (it builds the URL); the component
    // hands over the raw filename untouched.
    const spaceFile = [{ filename: "bon commande.pdf", path: "/uploads/3/bon commande.pdf", content_type: "application/pdf", size: 5000 }];
    getWebhookLog.mockResolvedValue({ log: { id: 5, attachments: spaceFile } });
    render(<AttachmentMenu webhookLogId={5} />);
    fireEvent.click(screen.getByRole("button", { name: /view attachment/i }));
    await waitFor(() => expect(window.open).toHaveBeenCalledTimes(1));
    expect(fetchWebhookLogAttachmentObjectUrl).toHaveBeenCalledWith(5, "bon commande.pdf");
  });

  it("clicking a dropdown item fetches that PJ with auth and opens the blob", async () => {
    getWebhookLog.mockResolvedValue({ log: { id: 99, attachments: TWO_ATTACHMENTS } });
    render(<AttachmentMenu webhookLogId={99} />);
    fireEvent.click(screen.getByRole("button", { name: /view attachment/i }));
    await waitFor(() => screen.getByText("facture.pdf"));
    fireEvent.click(screen.getByText("facture.pdf"));
    await waitFor(() => expect(window.open).toHaveBeenCalledTimes(1));
    expect(fetchWebhookLogAttachmentObjectUrl).toHaveBeenCalledWith(99, "facture.pdf");
    expect(window.open).toHaveBeenCalledWith("blob:mock-url", "_blank", "noopener");
  });

  it("clicking outside the dropdown closes it", async () => {
    getWebhookLog.mockResolvedValue({ log: { id: 99, attachments: TWO_ATTACHMENTS } });
    render(<AttachmentMenu webhookLogId={99} />);
    fireEvent.click(screen.getByRole("button", { name: /view attachment/i }));
    await waitFor(() => screen.getByText("facture.pdf"));
    // Simulate mousedown outside
    fireEvent.mouseDown(document.body);
    await waitFor(() => {
      expect(screen.queryByText("facture.pdf")).not.toBeInTheDocument();
    });
  });
it("empty attachments after fetch disables button with No attachment tooltip", async () => {
    // Backfilled rows or pre-PR-188 logs return success with 0 attachments.
    // The button must grey out so a second click does nothing surprising.
    const { getWebhookLog } = await import("@/lib/api");
    vi.mocked(getWebhookLog).mockResolvedValueOnce({ log: { attachments: [] } });
    render(<AttachmentMenu webhookLogId={1234} />);
    fireEvent.click(screen.getByRole("button", { name: /view attachment/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /view attachment/i })).toBeDisabled());
    const btn = await screen.findByRole("button", { name: /view attachment/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("title", expect.stringContaining("No attachment available for this AR"));
    expect(window.open).not.toHaveBeenCalled();
  });
});
