import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CreditCard } from "lucide-react";
import ActionCardShell from "../ActionCardShell";

function makeCard(overrides = {}) {
  return {
    id: "card_1",
    kind: "payment",
    status: "pending",
    data: {},
    ariaLabel: "Pay now",
    ...overrides,
  };
}

describe("ActionCardShell", () => {
  it("renders title and children", () => {
    render(
      <ActionCardShell card={makeCard()} icon={<CreditCard size={16} />} title="Pay now">
        <p>body content</p>
      </ActionCardShell>,
    );
    expect(screen.getByText("Pay now")).toBeInTheDocument();
    expect(screen.getByText("body content")).toBeInTheDocument();
  });

  it("applies role=group with the aria-label", () => {
    render(
      <ActionCardShell card={makeCard()} icon={<CreditCard size={16} />} title="Pay now">
        <p>body</p>
      </ActionCardShell>,
    );
    const group = screen.getByRole("group", { name: "Pay now" });
    expect(group).toBeInTheDocument();
  });

  it("falls back to the title for aria-label when ariaLabel is absent", () => {
    render(
      <ActionCardShell
        card={makeCard({ ariaLabel: undefined })}
        icon={<CreditCard size={16} />}
        title="Payment"
      >
        <p>body</p>
      </ActionCardShell>,
    );
    expect(screen.getByRole("group", { name: "Payment" })).toBeInTheDocument();
  });

  it("renders actions passed via the actions prop", () => {
    render(
      <ActionCardShell
        card={makeCard()}
        icon={<CreditCard size={16} />}
        title="Pay now"
        actions={<button type="button">Go</button>}
      >
        <p>body</p>
      </ActionCardShell>,
    );
    expect(screen.getByRole("button", { name: "Go" })).toBeInTheDocument();
  });

  it("renders error block with a provided errorMessage when status=error", () => {
    render(
      <ActionCardShell
        card={makeCard({ status: "error" })}
        icon={<CreditCard size={16} />}
        title="Pay now"
        errorMessage="Boom"
      >
        <p>body</p>
      </ActionCardShell>,
    );
    expect(screen.getByText("Boom")).toBeInTheDocument();
  });

  it("falls back to 'Action failed' when status=error but no errorMessage", () => {
    render(
      <ActionCardShell
        card={makeCard({ status: "error" })}
        icon={<CreditCard size={16} />}
        title="Pay now"
      >
        <p>body</p>
      </ActionCardShell>,
    );
    expect(screen.getByText(/action failed/i)).toBeInTheDocument();
  });

  it("does not render error block when status is not error", () => {
    render(
      <ActionCardShell
        card={makeCard({ status: "done" })}
        icon={<CreditCard size={16} />}
        title="Pay now"
        errorMessage="Should not appear"
      >
        <p>body</p>
      </ActionCardShell>,
    );
    expect(screen.queryByText("Should not appear")).not.toBeInTheDocument();
  });
});
