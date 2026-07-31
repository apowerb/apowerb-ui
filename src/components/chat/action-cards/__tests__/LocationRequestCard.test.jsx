import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LocationRequestCard from "../LocationRequestCard";

function makeCard(overrides = {}) {
  return {
    id: "card_1",
    kind: "location_request",
    status: "pending",
    data: {
      reason: "To show weather near you",
      precision: "coarse",
    },
    ...overrides,
  };
}

describe("LocationRequestCard", () => {
  let originalGeolocation;
  let originalIsSecureContext;

  beforeEach(() => {
    originalGeolocation = global.navigator.geolocation;
    originalIsSecureContext = window.isSecureContext;
    Object.defineProperty(window, "isSecureContext", {
      value: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(global.navigator, "geolocation", {
      value: originalGeolocation,
      configurable: true,
    });
    Object.defineProperty(window, "isSecureContext", {
      value: originalIsSecureContext,
      configurable: true,
    });
  });

  it("renders the reason", () => {
    render(<LocationRequestCard card={makeCard()} onRespond={vi.fn()} />);
    expect(screen.getByText("To show weather near you")).toBeInTheDocument();
  });

  it("shows the agent name in the prompt when provided", () => {
    render(
      <LocationRequestCard
        card={makeCard()}
        onRespond={vi.fn()}
        agentName="Scout"
      />,
    );
    expect(screen.getByText(/Scout/)).toBeInTheDocument();
  });

  it("calls onRespond with coordinates when geolocation succeeds", async () => {
    const getCurrentPosition = vi.fn((success) =>
      success({
        coords: { latitude: 48.85, longitude: 2.35, accuracy: 10 },
      }),
    );
    Object.defineProperty(global.navigator, "geolocation", {
      value: { getCurrentPosition },
      configurable: true,
    });

    const onRespond = vi.fn();
    render(<LocationRequestCard card={makeCard()} onRespond={onRespond} />);
    fireEvent.click(screen.getByRole("button", { name: /share location/i }));

    await waitFor(() =>
      expect(onRespond).toHaveBeenCalledWith({
        lat: 48.85,
        lng: 2.35,
        accuracy: 10,
      }),
    );
  });

  it("distinguishes permission denied from unavailable", async () => {
    const getCurrentPosition = vi.fn((_success, error) =>
      error({ code: 1, PERMISSION_DENIED: 1, message: "Denied" }),
    );
    Object.defineProperty(global.navigator, "geolocation", {
      value: { getCurrentPosition },
      configurable: true,
    });

    const onRespond = vi.fn();
    render(<LocationRequestCard card={makeCard()} onRespond={onRespond} />);
    fireEvent.click(screen.getByRole("button", { name: /share location/i }));

    await waitFor(() =>
      expect(onRespond).toHaveBeenCalledWith(
        "denied_permission",
        expect.objectContaining({ status: "error", sendFollowup: true }),
      ),
    );
  });

  it("uses 'unavailable' response for non-permission errors", async () => {
    const getCurrentPosition = vi.fn((_success, error) =>
      error({ code: 2, PERMISSION_DENIED: 1, message: "Timeout" }),
    );
    Object.defineProperty(global.navigator, "geolocation", {
      value: { getCurrentPosition },
      configurable: true,
    });

    const onRespond = vi.fn();
    render(<LocationRequestCard card={makeCard()} onRespond={onRespond} />);
    fireEvent.click(screen.getByRole("button", { name: /share location/i }));

    await waitFor(() =>
      expect(onRespond).toHaveBeenCalledWith(
        "unavailable",
        expect.objectContaining({ status: "error" }),
      ),
    );
  });

  it("calls onRespond with 'denied' and sendFollowup=false when the user clicks Cancel", () => {
    const onRespond = vi.fn();
    render(<LocationRequestCard card={makeCard()} onRespond={onRespond} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onRespond).toHaveBeenCalledWith("denied", { sendFollowup: false });
  });

  it("disables Share location when navigator.geolocation is not present", () => {
    Object.defineProperty(global.navigator, "geolocation", {
      value: undefined,
      configurable: true,
    });
    render(<LocationRequestCard card={makeCard()} onRespond={vi.fn()} />);
    const btn = screen.getByRole("button", { name: /share location/i });
    expect(btn).toBeDisabled();
    expect(screen.getByText(/not available/i)).toBeInTheDocument();
  });
});
