import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import ChartEmbedCard from "../ChartEmbedCard";

vi.mock("@/components/bi/ChartRenderer", () => ({
  default: ({ chartId }) => (
    <div data-testid="chart-renderer" data-chart-id={chartId} />
  ),
}));

// Charts are user-sent to a dashboard via this API (no auto-embed); the card
// also fetches the chart's real title by id.
import { sendChartToDashboard, getChart } from "@/lib/api";
vi.mock("@/lib/api", () => ({
  sendChartToDashboard: vi.fn(),
  getChart: vi.fn(() => Promise.resolve({})),
}));

// The card scopes the send to the active conversation.
vi.mock("@/contexts/ChatContext", () => ({
  useActiveSessionId: () => "sess_abc",
}));

function makeCard(overrides = {}) {
  return {
    id: "card_1",
    kind: "chart_embed",
    status: "pending",
    data: { chart_id: "chart_42", title: "Monthly Revenue" },
    ...overrides,
  };
}

describe("ChartEmbedCard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the chart inline via ChartRenderer with the chart id", () => {
    render(<ChartEmbedCard card={makeCard()} />);
    expect(screen.getByTestId("chart-renderer")).toHaveAttribute(
      "data-chart-id",
      "chart_42",
    );
  });

  it("renders the content title (not the raw chart id)", () => {
    render(<ChartEmbedCard card={makeCard()} />);
    expect(screen.getByText("Monthly Revenue")).toBeInTheDocument();
  });

  it("fetches the chart's real title by id when the card has none", async () => {
    getChart.mockResolvedValue({ id: "chart_42", title: "Colis par département" });
    render(<ChartEmbedCard card={makeCard({ data: { chart_id: "chart_42" } })} />);
    await waitFor(() =>
      expect(screen.getByText("Colis par département")).toBeInTheDocument(),
    );
    expect(getChart).toHaveBeenCalledWith("chart_42");
  });

  it("does not auto-add to a dashboard: shows a send button, no open link yet", () => {
    render(<ChartEmbedCard card={makeCard()} />);
    expect(
      screen.getByRole("button", { name: /dashboard/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /open dashboard/i }),
    ).not.toBeInTheDocument();
  });

  it("sends the chart on click then shows an 'Open dashboard' link to /bi/{id}", async () => {
    sendChartToDashboard.mockResolvedValue({ dashboard_id: "dash_99" });
    render(<ChartEmbedCard card={makeCard()} />);
    fireEvent.click(screen.getByRole("button", { name: /dashboard/i }));
    await waitFor(() => {
      const link = screen.getByRole("link", { name: /open dashboard/i });
      expect(link).toHaveAttribute("href", "/bi/dash_99");
    });
    expect(sendChartToDashboard).toHaveBeenCalledWith("chart_42", "sess_abc");
  });

  it("shows an error when sending fails", async () => {
    sendChartToDashboard.mockRejectedValue(new Error("boom"));
    render(<ChartEmbedCard card={makeCard()} />);
    fireEvent.click(screen.getByRole("button", { name: /dashboard/i }));
    await waitFor(() =>
      expect(screen.getByText(/failed to send/i)).toBeInTheDocument(),
    );
  });

  it("shows a visible error and no ChartRenderer when chart_id is missing", () => {
    render(<ChartEmbedCard card={makeCard({ data: { title: "X" } })} />);
    expect(screen.queryByTestId("chart-renderer")).not.toBeInTheDocument();
    expect(
      screen.getByText(/unavailable|missing chart id/i),
    ).toBeInTheDocument();
  });
});
