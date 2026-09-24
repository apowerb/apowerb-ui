import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ForecastChart from "../ForecastChart";

vi.mock("@/lib/api", () => ({
  postForecast: vi.fn(),
}));

import { postForecast } from "@/lib/api";

const config = {
  date_var: "date",
  target_var: "sales",
  group_var: null,
  horizon: 3,
  frequency: null,
  models: ["prophet"],
  confidence_levels: [0.8, 0.95],
};

const rows = [
  { date: "2024-01-01", sales: 100 },
  { date: "2024-02-01", sales: 110 },
  { date: "2024-03-01", sales: 120 },
];

const successResponse = {
  status: "success",
  api_version: "1",
  frequency: "month",
  warnings: [],
  series: [
    {
      group: null,
      model: "prophet",
      history: [
        { date: "2024-01-01", value: 100 },
        { date: "2024-02-01", value: 110 },
        { date: "2024-03-01", value: 120 },
      ],
      forecast: [
        { date: "2024-04-01", value: 130, lower_80: 120, upper_80: 140, lower_95: 110, upper_95: 150 },
      ],
      metrics: { mape: 0.08, mase: 0.7 },
      baseline: { model: "snaive", metrics: { mape: 0.12 } },
      beats_baseline: true,
      reliability: "good",
      warnings: [],
    },
  ],
};

beforeEach(() => {
  postForecast.mockReset();
});

describe("ForecastChart", () => {
  it("shows a loading indicator with a cancel button while computing", async () => {
    let rejectFn;
    postForecast.mockReturnValue(
      new Promise((_, reject) => {
        rejectFn = reject;
      }),
    );
    render(<ForecastChart rows={rows} config={config} title="Sales" />);

    expect(screen.getByText(/computing the forecast/i)).toBeInTheDocument();
    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelBtn);

    const err = new Error("aborted");
    err.name = "AbortError";
    rejectFn(err);
    await waitFor(() => expect(screen.queryByText(/computing the forecast/i)).not.toBeInTheDocument());
  });

  it("renders the reliability badge and CSV export once the forecast succeeds", async () => {
    postForecast.mockResolvedValue(successResponse);
    render(<ForecastChart rows={rows} config={config} title="Sales" />);

    expect(await screen.findByText("Reliable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /export csv/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /table view/i })).toBeInTheDocument();
  });

  it("shows an actionable error with the offending field on 400", async () => {
    const err = new Error("Colonne 'dat' absente ; colonnes disponibles : date, sales");
    err.status = 400;
    err.errors = [{ field: "date_var", message: "Colonne 'dat' absente ; colonnes disponibles : date, sales" }];
    postForecast.mockRejectedValue(err);

    render(<ForecastChart rows={rows} config={config} title="Sales" />);

    expect(await screen.findByText(/colonne 'dat' absente/i)).toBeInTheDocument();
    expect(screen.getByText(/date_var/)).toBeInTheDocument();
  });

  it("shows a specific message when the forecast service is not configured (503)", async () => {
    const err = new Error("Service de prévision non configuré (TH2FORECAST_URL)");
    err.status = 503;
    err.errors = [{ field: null, message: "Service de prévision non configuré (TH2FORECAST_URL)" }];
    postForecast.mockRejectedValue(err);

    render(<ForecastChart rows={rows} config={config} title="Sales" />);

    expect(await screen.findByText(/service de prévision non configuré/i)).toBeInTheDocument();
  });

  it("shows an empty state and never calls the API when there is no historical data", () => {
    render(<ForecastChart rows={[]} config={config} title="Sales" />);
    expect(screen.getByText(/no data available/i)).toBeInTheDocument();
    expect(postForecast).not.toHaveBeenCalled();
  });

  it("offers a series selector when the response has more than one group", async () => {
    const multi = {
      ...successResponse,
      series: [
        { ...successResponse.series[0], group: "Paris" },
        { ...successResponse.series[0], group: "Lyon" },
      ],
    };
    postForecast.mockResolvedValue(multi);
    render(<ForecastChart rows={rows} config={{ ...config, group_var: "store" }} title="Sales" />);

    await screen.findByText("Reliable");
    expect(screen.getByRole("combobox", { name: /series/i })).toBeInTheDocument();
    expect(screen.getByText("Paris")).toBeInTheDocument();
    expect(screen.getByText("Lyon")).toBeInTheDocument();
  });
});
