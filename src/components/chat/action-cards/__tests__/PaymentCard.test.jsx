import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PaymentCard from "../PaymentCard";

function makeCard(overrides = {}) {
  return {
    id: "card_1",
    kind: "payment",
    status: "pending",
    data: {
      amount: 49.99,
      currency: "EUR",
      reason: "Monthly subscription",
      checkout_url: "https://checkout.stripe.com/c/pay/cs_test_abc",
    },
    ...overrides,
  };
}

describe("PaymentCard", () => {
  let warnSpy;
  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("renders formatted amount and reason", () => {
    render(<PaymentCard card={makeCard()} onRespond={vi.fn()} />);
    // Currency-formatted string should include 49.99 + EUR indicator (€ or EUR)
    expect(screen.getByText(/49[.,]99/)).toBeInTheDocument();
    expect(screen.getByText("Monthly subscription")).toBeInTheDocument();
  });

  it("shows a Pay now link for whitelisted Stripe URLs", () => {
    render(<PaymentCard card={makeCard()} onRespond={vi.fn()} />);
    const link = screen.getByRole("link", { name: /pay now/i });
    expect(link).toHaveAttribute("href", "https://checkout.stripe.com/c/pay/cs_test_abc");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("blocks non-Stripe URLs and shows an unsafe warning", () => {
    render(
      <PaymentCard
        card={makeCard({ data: { amount: 10, currency: "USD", checkout_url: "https://evil.com/pay" } })}
        onRespond={vi.fn()}
      />,
    );
    expect(screen.queryByRole("link", { name: /pay now/i })).toBeNull();
    expect(screen.getByText(/unsafe payment url/i)).toBeInTheDocument();
  });

  it("blocks javascript: URLs", () => {
    render(
      <PaymentCard
        card={makeCard({ data: { amount: 10, currency: "USD", checkout_url: "javascript:alert(1)" } })}
        onRespond={vi.fn()}
      />,
    );
    expect(screen.queryByRole("link", { name: /pay now/i })).toBeNull();
    expect(screen.getByText(/unsafe payment url/i)).toBeInTheDocument();
  });

  it("keeps card pending after clicking Pay now (does not mark as paid)", () => {
    const onRespond = vi.fn();
    render(<PaymentCard card={makeCard()} onRespond={onRespond} />);
    fireEvent.click(screen.getByRole("link", { name: /pay now/i }));
    expect(onRespond).toHaveBeenCalledWith(
      "checkout_opened",
      expect.objectContaining({ sendFollowup: false, status: "pending" }),
    );
  });

  it("shows a Paid badge when status is done", () => {
    render(
      <PaymentCard
        card={makeCard({ status: "done", response: "paid" })}
        onRespond={vi.fn()}
      />,
    );
    expect(screen.getByText(/paid/i)).toBeInTheDocument();
  });
});
