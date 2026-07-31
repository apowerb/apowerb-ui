import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AgentUpgradeCard from "../AgentUpgradeCard";

function makeCard(overrides = {}) {
  return {
    id: "card_1",
    kind: "agent_upgrade",
    status: "pending",
    data: {
      capability: "Web browsing",
      reason: "To answer questions about recent events",
      skill_id: "web_browse",
    },
    ...overrides,
  };
}

describe("AgentUpgradeCard", () => {
  it("renders capability and reason", () => {
    render(<AgentUpgradeCard card={makeCard()} onRespond={vi.fn()} />);
    expect(screen.getByText("Web browsing")).toBeInTheDocument();
    expect(
      screen.getByText("To answer questions about recent events"),
    ).toBeInTheDocument();
  });

  it("calls onRespond('accepted') when Enable is clicked", () => {
    const onRespond = vi.fn();
    render(<AgentUpgradeCard card={makeCard()} onRespond={onRespond} />);
    fireEvent.click(screen.getByRole("button", { name: /enable/i }));
    expect(onRespond).toHaveBeenCalledWith("accepted");
  });

  it("renders a Cancel button (unified copy) and fires sendFollowup=false", () => {
    const onRespond = vi.fn();
    render(<AgentUpgradeCard card={makeCard()} onRespond={onRespond} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onRespond).toHaveBeenCalledWith("skipped", { sendFollowup: false });
  });
});
