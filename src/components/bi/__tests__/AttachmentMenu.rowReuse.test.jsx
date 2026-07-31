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

// Regression guard — live bug 2026-06-01. The BI DataTable renders rows with
// key={index}, so on sort/pagination React reuses the same AttachmentMenu
// instance and only swaps its webhookLogId prop. The component cached the
// previously-fetched filename, so a click requested
// /logs/4657/attachments/1080.pdf — log 4657's id (CF101270) carrying log
// 5046's filename — and the serve endpoint 404'd ("Pièce jointe inaccessible").
// Fix: AttachmentMenu must drop its cache when webhookLogId changes.
describe("AttachmentMenu — row reuse / webhookLogId change", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("open", vi.fn());
    fetchWebhookLogAttachmentObjectUrl.mockResolvedValue("blob:mock-url");
    if (!URL.revokeObjectURL) URL.revokeObjectURL = vi.fn();
    getWebhookLog.mockImplementation((id) =>
      Promise.resolve(
        id === 5046
          ? { log: { id: 5046, attachments: [{ filename: "1080.pdf", path: "/p/1080.pdf", content_type: "application/pdf", size: 1000 }] } }
          : { log: { id: 4657, attachments: [{ filename: "3SC.pdf", path: "/p/3SC.pdf", content_type: "application/pdf", size: 2000 }] } }
      )
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not reuse a stale filename after the row's webhookLogId changes", async () => {
    const { rerender } = render(<AttachmentMenu webhookLogId={5046} />);
    fireEvent.click(screen.getByRole("button", { name: /view attachment/i }));
    await waitFor(() =>
      expect(fetchWebhookLogAttachmentObjectUrl).toHaveBeenCalledWith(5046, "1080.pdf")
    );

    // Same instance, new row (e.g. after a sort) -> now CF101270 / log 4657.
    rerender(<AttachmentMenu webhookLogId={4657} />);
    fireEvent.click(screen.getByRole("button", { name: /view attachment/i }));

    await waitFor(() =>
      expect(fetchWebhookLogAttachmentObjectUrl).toHaveBeenLastCalledWith(4657, "3SC.pdf")
    );
    // The stale filename must never be requested against the new log id.
    expect(fetchWebhookLogAttachmentObjectUrl).not.toHaveBeenCalledWith(4657, "1080.pdf");
  });
});
