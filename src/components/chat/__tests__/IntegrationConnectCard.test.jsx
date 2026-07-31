import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import IntegrationConnectCard from "../IntegrationConnectCard";

describe("IntegrationConnectCard", () => {
  const baseRequest = {
    id: "intreq_123",
    provider: "google_drive",
    reason: "We need access to your Drive to search for files.",
    status: "pending",
  };

  it("renders provider label and reason for pending state", () => {
    render(<IntegrationConnectCard request={baseRequest} onConnect={vi.fn()} />);
    expect(screen.getByText("Google Drive")).toBeInTheDocument();
    expect(screen.getByText(baseRequest.reason)).toBeInTheDocument();
  });

  it("shows a Connect button when status is pending", () => {
    render(<IntegrationConnectCard request={baseRequest} onConnect={vi.fn()} />);
    expect(screen.getByRole("button", { name: /connect/i })).toBeInTheDocument();
  });

  it("calls onConnect with request id when Connect button is clicked", () => {
    const onConnect = vi.fn();
    render(<IntegrationConnectCard request={baseRequest} onConnect={onConnect} />);
    fireEvent.click(screen.getByRole("button", { name: /connect/i }));
    expect(onConnect).toHaveBeenCalledWith("intreq_123");
  });

  it("shows spinner text when status is connecting", () => {
    const request = { ...baseRequest, status: "connecting" };
    render(<IntegrationConnectCard request={request} onConnect={vi.fn()} />);
    expect(screen.getByText(/connecting/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^connect$/i })).not.toBeInTheDocument();
  });

  it("shows connected state with checkmark text", () => {
    const request = { ...baseRequest, status: "connected" };
    render(<IntegrationConnectCard request={request} onConnect={vi.fn()} />);
    expect(screen.getByText(/connected/i)).toBeInTheDocument();
  });

  it("shows error state with Retry button when status is failed", () => {
    const request = { ...baseRequest, status: "failed" };
    render(<IntegrationConnectCard request={request} onConnect={vi.fn()} />);
    expect(screen.getByText(/failed/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("calls onConnect when Retry is clicked in failed state", () => {
    const onConnect = vi.fn();
    const request = { ...baseRequest, status: "failed" };
    render(<IntegrationConnectCard request={request} onConnect={onConnect} />);
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onConnect).toHaveBeenCalledWith("intreq_123");
  });

  it("handles unknown provider gracefully", () => {
    const request = { ...baseRequest, provider: "unknown_service" };
    render(<IntegrationConnectCard request={request} onConnect={vi.fn()} />);
    expect(screen.getByText("unknown_service")).toBeInTheDocument();
  });
});
