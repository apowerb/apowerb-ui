import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import ConfirmDestructiveCard from "../ConfirmDestructiveCard";

function makeCard(overrides = {}) {
  return {
    id: "card_1",
    kind: "confirm_destructive",
    status: "pending",
    data: {
      action: "Delete workspace",
      impact: "All data will be permanently lost.",
      item: "acme-corp",
    },
    ...overrides,
  };
}

describe("ConfirmDestructiveCard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders action, impact and item", () => {
    render(<ConfirmDestructiveCard card={makeCard()} onRespond={vi.fn()} />);
    expect(screen.getByText("Delete workspace")).toBeInTheDocument();
    expect(
      screen.getByText("All data will be permanently lost."),
    ).toBeInTheDocument();
    expect(screen.getByText(/acme-corp/)).toBeInTheDocument();
  });

  it("disables Confirm during the 3-second countdown", () => {
    render(<ConfirmDestructiveCard card={makeCard()} onRespond={vi.fn()} />);
    const confirm = screen.getByRole("button", { name: /confirm/i });
    expect(confirm).toBeDisabled();
    // Label includes the countdown
    expect(confirm).toHaveTextContent(/Confirm \(\d\)/);
  });

  it("enables Confirm after the countdown expires", () => {
    render(<ConfirmDestructiveCard card={makeCard()} onRespond={vi.fn()} />);
    // Advance one second at a time so React has a chance to re-run the effect
    for (let i = 0; i < 4; i += 1) {
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    }
    const confirm = screen.getByRole("button", { name: /^confirm$/i });
    expect(confirm).not.toBeDisabled();
    expect(confirm).toHaveTextContent(/^Confirm$/);
  });

  it("calls onRespond('confirmed') when Confirm is clicked post-countdown", () => {
    const onRespond = vi.fn();
    render(<ConfirmDestructiveCard card={makeCard()} onRespond={onRespond} />);
    for (let i = 0; i < 4; i += 1) {
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    }
    fireEvent.click(screen.getByRole("button", { name: /^confirm$/i }));
    expect(onRespond).toHaveBeenCalledWith("confirmed");
  });

  it("calls onRespond with sendFollowup=false when Cancel is clicked", () => {
    const onRespond = vi.fn();
    render(<ConfirmDestructiveCard card={makeCard()} onRespond={onRespond} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onRespond).toHaveBeenCalledWith("cancelled", { sendFollowup: false });
  });

  it("requires typing DELETE for danger_level=high", () => {
    const onRespond = vi.fn();
    render(
      <ConfirmDestructiveCard
        card={makeCard({ data: { action: "Delete", impact: "Gone", item: "x", danger_level: "high" } })}
        onRespond={onRespond}
      />,
    );
    for (let i = 0; i < 4; i += 1) {
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    }
    const confirm = screen.getByRole("button", { name: /^confirm$/i });
    expect(confirm).toBeDisabled();
    const input = screen.getByPlaceholderText(/DELETE/i);
    fireEvent.change(input, { target: { value: "DELETE" } });
    expect(confirm).not.toBeDisabled();
  });
});
