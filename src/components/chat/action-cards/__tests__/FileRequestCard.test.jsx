import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/lib/api", () => ({
  uploadFileChunked: vi.fn(),
}));

import FileRequestCard from "../FileRequestCard";
import { uploadFileChunked } from "@/lib/api";

function makeCard(overrides = {}) {
  return {
    id: "card_1",
    kind: "file_request",
    status: "pending",
    data: {
      purpose: "Invoice scan for reimbursement",
      accept: "application/pdf,image/*",
    },
    ...overrides,
  };
}

describe("FileRequestCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders purpose and a file input with the correct accept attribute", () => {
    render(<FileRequestCard card={makeCard()} onRespond={vi.fn()} />);
    expect(
      screen.getByText("Invoice scan for reimbursement"),
    ).toBeInTheDocument();
    const input = screen.getByTestId("file-request-input");
    expect(input).toHaveAttribute("accept", "application/pdf,image/*");
  });

  it("uploads the selected file and calls onRespond with file metadata", async () => {
    uploadFileChunked.mockResolvedValue({
      filename: "invoice.pdf",
      path: "/api/files/123",
      size: 4242,
    });
    const onRespond = vi.fn();
    render(<FileRequestCard card={makeCard()} onRespond={onRespond} agentId="agent42" />);

    const file = new File(["dummy"], "invoice.pdf", {
      type: "application/pdf",
    });
    const input = screen.getByTestId("file-request-input");
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(onRespond).toHaveBeenCalled());
    const [response, opts] = onRespond.mock.calls[0];
    expect(response).toEqual({
      filename: "invoice.pdf",
      path: "/api/files/123",
      size: 4242,
    });
    expect(opts).toMatchObject({
      followupText: "[File uploaded]: invoice.pdf",
    });
  });

  it("rejects files that do not match the accept pattern", () => {
    const onRespond = vi.fn();
    render(
      <FileRequestCard
        card={makeCard({ data: { purpose: "PDF only", accept: ".pdf" } })}
        onRespond={onRespond}
        agentId="agent42"
      />,
    );
    const input = screen.getByTestId("file-request-input");
    const file = new File(["x"], "malware.exe", { type: "application/x-msdownload" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onRespond).not.toHaveBeenCalled();
    expect(screen.getByText(/invalid file type/i)).toBeInTheDocument();
  });

  it("rejects oversized files", () => {
    const onRespond = vi.fn();
    render(
      <FileRequestCard
        card={makeCard({ data: { purpose: "small", accept: "image/*", max_size_mb: 1 } })}
        onRespond={onRespond}
      />,
    );
    const file = new File([new ArrayBuffer(2 * 1024 * 1024)], "photo.png", {
      type: "image/png",
    });
    const input = screen.getByTestId("file-request-input");
    fireEvent.change(input, { target: { files: [file] } });
    expect(onRespond).not.toHaveBeenCalled();
    expect(screen.getByText(/too large|exceed/i)).toBeInTheDocument();
  });

  it("has a Cancel button that calls onRespond('declined') with no followup", () => {
    const onRespond = vi.fn();
    render(<FileRequestCard card={makeCard()} onRespond={onRespond} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onRespond).toHaveBeenCalledWith("declined", { sendFollowup: false });
  });

  it("shows a Replace button when status=done", () => {
    const card = makeCard({
      status: "done",
      response: { filename: "invoice.pdf", path: "/api/files/123", size: 4242 },
    });
    render(<FileRequestCard card={card} onRespond={vi.fn()} />);
    expect(screen.getByText(/invoice\.pdf/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /replace/i })).toBeInTheDocument();
  });
});
