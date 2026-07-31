import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FollowupCard from "../FollowupCard";

function makeCard(overrides = {}) {
  return {
    id: "card_1",
    kind: "followup",
    status: "pending",
    data: {
      when_iso: "2099-05-01T10:00:00Z",
      recap: "Follow up on contract review",
      calendar_link: "https://calendar.google.com/event?id=abc",
    },
    ...overrides,
  };
}

describe("FollowupCard", () => {
  it("renders recap and a formatted date", () => {
    render(<FollowupCard card={makeCard()} onRespond={vi.fn()} />);
    expect(screen.getByText("Follow up on contract review")).toBeInTheDocument();
    expect(screen.getByText(/2099/)).toBeInTheDocument();
  });

  it("renders Add to Calendar link when calendar_link is a trusted domain", () => {
    render(<FollowupCard card={makeCard()} onRespond={vi.fn()} />);
    const link = screen.getByRole("link", { name: /calendar/i });
    expect(link).toHaveAttribute("href", "https://calendar.google.com/event?id=abc");
  });

  it("omits the calendar link when the domain is untrusted", () => {
    const card = makeCard({
      data: {
        when_iso: "2099-05-01T10:00:00Z",
        recap: "Follow up",
        calendar_link: "https://phishing.com/cal",
      },
    });
    render(<FollowupCard card={card} onRespond={vi.fn()} />);
    expect(screen.queryByRole("link", { name: /calendar/i })).toBeNull();
  });

  it("always exposes a 'Got it' button", () => {
    render(<FollowupCard card={makeCard()} onRespond={vi.fn()} />);
    expect(screen.getByRole("button", { name: /got it/i })).toBeInTheDocument();
  });

  it("calls onRespond('acknowledged', {sendFollowup:false}) when Got it is clicked", () => {
    const onRespond = vi.fn();
    render(<FollowupCard card={makeCard()} onRespond={onRespond} />);
    fireEvent.click(screen.getByRole("button", { name: /got it/i }));
    expect(onRespond).toHaveBeenCalledWith("acknowledged", { sendFollowup: false });
  });

  it("shows a Past badge when the date is in the past", () => {
    const card = makeCard({
      data: {
        when_iso: "2000-01-01T10:00:00Z",
        recap: "Old",
      },
    });
    render(<FollowupCard card={card} onRespond={vi.fn()} />);
    expect(screen.getByText(/past/i)).toBeInTheDocument();
  });
});
