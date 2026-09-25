import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ForecastChart, { ForecastTooltip } from "../ForecastChart";

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

  it("shows an actionable error with a business-facing field label on 400", async () => {
    const err = new Error("Colonne 'dat' absente ; colonnes disponibles : date, sales");
    err.status = 400;
    err.errors = [{ field: "date_var", message: "Colonne 'dat' absente ; colonnes disponibles : date, sales" }];
    postForecast.mockRejectedValue(err);

    render(<ForecastChart rows={rows} config={config} title="Sales" />);

    expect(await screen.findByText("The forecast could not be computed")).toBeInTheDocument();
    expect(screen.getByText(/colonne 'dat' absente/i)).toBeInTheDocument();
    // The raw contract field (date_var) is translated to a business label
    // ("Date column") — never shown verbatim to the end user.
    expect(screen.getByText(/Date column/)).toBeInTheDocument();
    expect(screen.queryByText(/date_var/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("does not show an 'edit configuration' button when onEditConfig is not provided", async () => {
    const err = new Error("boom");
    err.status = 400;
    err.errors = [{ field: "date_var", message: "boom" }];
    postForecast.mockRejectedValue(err);

    render(<ForecastChart rows={rows} config={config} title="Sales" />);

    await screen.findByText("The forecast could not be computed");
    expect(screen.queryByRole("button", { name: /edit configuration/i })).not.toBeInTheDocument();
  });

  it("calls onEditConfig when the edit-configuration button is clicked", async () => {
    const err = new Error("boom");
    err.status = 400;
    err.errors = [{ field: "target_var", message: "boom" }];
    postForecast.mockRejectedValue(err);
    const onEditConfig = vi.fn();

    render(<ForecastChart rows={rows} config={config} title="Sales" onEditConfig={onEditConfig} />);

    const editBtn = await screen.findByRole("button", { name: /edit configuration/i });
    fireEvent.click(editBtn);
    expect(onEditConfig).toHaveBeenCalledTimes(1);
  });

  it("retries the forecast call when 'Retry' is clicked after an error", async () => {
    const err = new Error("Service unavailable");
    err.status = 503;
    err.errors = [{ field: null, message: "Service unavailable" }];
    postForecast.mockRejectedValueOnce(err).mockResolvedValueOnce(successResponse);

    render(<ForecastChart rows={rows} config={config} title="Sales" />);

    const retryBtn = await screen.findByRole("button", { name: /retry/i });
    expect(postForecast).toHaveBeenCalledTimes(1);
    fireEvent.click(retryBtn);

    expect(await screen.findByText("Reliable")).toBeInTheDocument();
    expect(postForecast).toHaveBeenCalledTimes(2);
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

  it("builds the reliability badge explanation from next-intl with the mape percentage as a parameter", async () => {
    postForecast.mockResolvedValue(successResponse);
    render(<ForecastChart rows={rows} config={config} title="Sales" />);

    const badge = await screen.findByText("Reliable");
    // mape: 0.08 → 8%, injected via the {pct} ICU parameter.
    expect(badge.closest("span")).toHaveAttribute(
      "title",
      expect.stringContaining("8%"),
    );
    expect(badge.closest("span")).toHaveAttribute(
      "title",
      expect.stringContaining("naive baseline"),
    );
  });

  it("shows the backtest proof: tested points, gain over the naive method and calibrated band coverage", async () => {
    const withProof = {
      ...successResponse,
      series: [
        {
          ...successResponse.series[0],
          metrics: { mape: 0.08, mase: 0.6, holdout_points: 14 },
          baseline: { model: "snaive", metrics: { mape: 0.12, mase: 0.8 } },
          calibration: {
            method: "split-conformal",
            points: 14,
            levels: {
              80: { calibrated: true, pooled: false, factor: 1.2, raw_coverage: 0.71, calibrated_coverage: 0.79 },
              95: { calibrated: true, pooled: true, factor: 1.1, raw_coverage: 0.9, calibrated_coverage: 0.93 },
            },
          },
        },
      ],
    };
    postForecast.mockResolvedValue(withProof);
    render(<ForecastChart rows={rows} config={config} title="Sales" />);

    const proof = await screen.findByTestId("forecast-proof");
    expect(proof).toHaveTextContent(
      "Tested on 14 past points · 25% less error than the naive method · 80% band (calibrated): 79% of actual values inside",
    );
  });

  it("keeps a partial proof without the calibration field (R engine)", async () => {
    const rEngine = {
      ...successResponse,
      series: [
        {
          ...successResponse.series[0],
          metrics: { mape: 0.08, mase: 1.1, holdout_points: 6 },
          baseline: { model: "snaive", metrics: { mape: 0.12, mase: 1.0 } },
          beats_baseline: false,
        },
      ],
    };
    postForecast.mockResolvedValue(rEngine);
    render(<ForecastChart rows={rows} config={config} title="Sales" />);

    const proof = await screen.findByTestId("forecast-proof");
    expect(proof).toHaveTextContent("Tested on 6 past points · no better than the naive method");
    expect(proof).not.toHaveTextContent("band");
  });

  it("shows no proof line when the response carries no backtest facts", async () => {
    postForecast.mockResolvedValue({
      ...successResponse,
      series: [{ ...successResponse.series[0], metrics: {}, baseline: { metrics: {} } }],
    });
    render(<ForecastChart rows={rows} config={config} title="Sales" />);

    await screen.findByText("Reliable");
    expect(screen.queryByTestId("forecast-proof")).toBeNull();
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

describe("ForecastChart — dedupe & error layout", () => {
  it("does not re-POST when rows/config are re-created with the same content on re-render (dedupe)", async () => {
    postForecast.mockResolvedValue(successResponse);

    function Wrapper({ n }) {
      // New array/object identity every render, same content — mirrors
      // ChartRenderer's `chartData.rows || []` / `chartData.config || {}`
      // which are recomputed (fresh references) on every parent re-render.
      const freshRows = rows.map((r) => ({ ...r }));
      const freshConfig = { ...config };
      return <ForecastChart rows={freshRows} config={freshConfig} title={`Sales ${n}`} />;
    }

    const { rerender } = render(<Wrapper n={1} />);
    await screen.findByText("Reliable");
    expect(postForecast).toHaveBeenCalledTimes(1);

    rerender(<Wrapper n={2} />);
    rerender(<Wrapper n={3} />);
    await screen.findByText("Reliable");

    expect(postForecast).toHaveBeenCalledTimes(1);
  });

  it("shows the error state anchored at the top of the widget, not vertically centered", async () => {
    const err = new Error("Service unavailable");
    err.status = 503;
    err.errors = [{ field: null, message: "Service unavailable" }];
    postForecast.mockRejectedValue(err);

    render(<ForecastChart rows={rows} config={config} title="Sales" />);

    const title = await screen.findByText("The forecast could not be computed");
    const errorContainer = title.parentElement;
    expect(errorContainer.className).not.toMatch(/\bjustify-center\b/);
    expect(errorContainer.className).toMatch(/\bjustify-start\b/);
  });
});

describe("ForecastTooltip", () => {
  it("uses the translated series names and prints an interval as low – high", () => {
    render(
      <ForecastTooltip
        active
        label="2024-04-01"
        payload={[
          { name: "95% interval", dataKey: (d) => [d.lower_95, d.upper_95], value: [110, 150], color: "#3b82f6" },
          { name: "Actual", dataKey: "history", value: null, color: "#3b82f6" },
          { name: "Forecast", dataKey: "forecast", value: 130, color: "#a78bfa" },
        ]}
      />,
    );
    expect(screen.getByText("95% interval")).toBeInTheDocument();
    expect(screen.getByText(/110\s*–\s*150/)).toBeInTheDocument();
    expect(screen.getByText("Forecast")).toBeInTheDocument();
    // No empty "Actual" row on a forecast-only point, no raw dataKey leak.
    expect(screen.queryByText("Actual")).not.toBeInTheDocument();
    expect(screen.queryByText(/History|lower_95|=>/)).not.toBeInTheDocument();
  });
});

describe("ForecastChart — validation error (422)", () => {
  it("names the field and its limit instead of the raw validation message", async () => {
    const err = new Error("Input should be less than or equal to 366");
    err.status = 422;
    err.errors = [{ field: "horizon", message: "Input should be less than or equal to 366", type: "less_than_equal", limit: 366 }];
    postForecast.mockRejectedValue(err);

    render(<ForecastChart rows={rows} config={config} title="Sales" />);

    expect(await screen.findByText("The forecast could not be computed")).toBeInTheDocument();
    expect(screen.getByText(/Field: Horizon/)).toBeInTheDocument();
    expect(screen.getByText(/at most 366/i)).toBeInTheDocument();
    expect(screen.queryByText(/Input should be/)).not.toBeInTheDocument();
  });
});
