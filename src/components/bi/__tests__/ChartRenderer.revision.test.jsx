import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import ChartRenderer from "../ChartRenderer";

vi.mock("@/lib/api", () => ({
  getChartData: vi.fn(),
  getPublicChartData: vi.fn(),
}));

vi.mock("../ForecastChart", () => ({
  default: vi.fn(({ config }) => <div data-testid="forecast-chart-mock">horizon:{config.horizon}</div>),
}));

import { getChartData } from "@/lib/api";

/**
 * Régression du 24/09 (parcours réel) : après « Enregistrer » dans
 * EditChartModal, le widget gardait l'ancienne configuration jusqu'au
 * rechargement de la page, car ChartRenderer ne relisait les données
 * que si chartId ou les filtres changeaient.
 */
describe("ChartRenderer — revision", () => {
  it("refetches and shows the saved configuration when revision changes", async () => {
    getChartData.mockReset();
    let saved = { horizon: 12 };
    getChartData.mockImplementation(async () => ({
      title: "Ventes", chart_type: "forecast", rows: [{ d: 1 }], config: saved, source: {},
    }));

    const { rerender } = render(<ChartRenderer chartId="chart-1" revision={0} />);
    await waitFor(() => expect(screen.getByText("horizon:12")).toBeInTheDocument());

    saved = { horizon: 6 };
    rerender(<ChartRenderer chartId="chart-1" revision={1} />);
    await waitFor(() => expect(screen.getByText("horizon:6")).toBeInTheDocument());
  });
});
