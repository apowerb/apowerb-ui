import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import ChartRenderer from "../ChartRenderer";

vi.mock("@/lib/api", () => ({
  getChartData: vi.fn(),
  getPublicChartData: vi.fn(),
}));

vi.mock("../ForecastChart", () => ({
  default: vi.fn(({ title }) => <div data-testid="forecast-chart-mock">forecast:{title}</div>),
}));

import { getChartData } from "@/lib/api";
import ForecastChart from "../ForecastChart";

/**
 * Régression du 24/09 : le patch initial insérait le branchement
 * chart_type === "forecast" à l'intérieur du bloc chart_type === "stat"
 * (mauvaise ancre de substitution) — le widget forecast ne se déclenchait
 * jamais et retombait silencieusement sur le rendu bar chart par défaut.
 * Seul le parcours Playwright l'avait révélé ; ce test verrouille le
 * dispatch au niveau du composant.
 */
describe("ChartRenderer — forecast dispatch", () => {
  it("renders ForecastChart (not the default bar fallback) when chart_type is 'forecast'", async () => {
    getChartData.mockResolvedValue({
      title: "Ventes",
      chart_type: "forecast",
      rows: [{ date: "2024-01-01", sales: 100 }],
      config: { date_var: "date", target_var: "sales", horizon: 3 },
      source: {},
    });

    render(<ChartRenderer chartId="chart-1" />);

    await waitFor(() => expect(screen.getByTestId("forecast-chart-mock")).toBeInTheDocument());
    expect(screen.getByText("forecast:Ventes")).toBeInTheDocument();

    const props = ForecastChart.mock.calls.at(-1)[0];
    expect(props.rows).toEqual([{ date: "2024-01-01", sales: 100 }]);
    expect(props.config).toMatchObject({ date_var: "date", target_var: "sales" });
  });

  it("does NOT render ForecastChart for a plain bar chart_type", async () => {
    getChartData.mockResolvedValue({
      title: "Ventes",
      chart_type: "bar",
      rows: [{ label: "A", value: 1 }],
      config: {},
      source: {},
    });

    const { container } = render(<ChartRenderer chartId="chart-2" />);

    await waitFor(() => expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument());
    expect(screen.queryByTestId("forecast-chart-mock")).not.toBeInTheDocument();
  });
});
