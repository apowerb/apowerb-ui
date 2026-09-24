import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import EditChartModal from "../EditChartModal";
import { ToastProvider } from "../../Toast";

vi.mock("@/lib/api", () => ({
  updateChart: vi.fn(() => Promise.resolve({})),
  uploadBiCsv: vi.fn(),
  listBiDatasets: vi.fn(() => Promise.resolve([])),
  listBiDbConfigs: vi.fn(() => Promise.resolve([])),
  getChartData: vi.fn(() =>
    Promise.resolve({
      rows: [
        { date: "2024-01-01", sales: 100, store: "Paris" },
        { date: "2024-02-01", sales: 110, store: "Paris" },
      ],
    }),
  ),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { email: "tester@example.com" } }),
}));

vi.mock("../AgentSourcePicker", () => ({ default: () => <div>mock-agent-picker</div> }));
vi.mock("../OneDriveFilePicker", () => ({ default: () => <div>mock-onedrive-picker</div> }));

import { updateChart } from "@/lib/api";

const forecastChart = {
  id: "chart-forecast-1",
  name: "Ventes",
  title: "Ventes",
  chart_type: "forecast",
  organization_id: "example.com",
  refresh_interval: 0,
  config: {
    date_var: "date",
    target_var: "sales",
    group_var: null,
    horizon: 6,
    frequency: "month",
    models: ["prophet"],
    confidence_levels: [0.8, 0.95],
  },
  source: { source_type: "csv", query: "csv://ds-1.csv" },
};

const barChart = {
  id: "chart-bar-1",
  name: "Ventes",
  title: "Ventes",
  chart_type: "bar",
  organization_id: "example.com",
  refresh_interval: 0,
  config: {},
  source: { source_type: "csv", query: "csv://ds-1.csv" },
};

const renderModal = (chart) =>
  render(
    <ToastProvider>
      <EditChartModal chart={chart} onClose={vi.fn()} onSaved={vi.fn()} />
    </ToastProvider>,
  );

beforeEach(() => {
  updateChart.mockClear();
});

// getByDisplayValue() ne matche pas de façon fiable un <select> ici (constaté :
// .value et l'option .selected sont corrects côté DOM, mais la requête ne le
// trouve pas) — on lit donc les <select> directement, plus robuste.
function selectValues() {
  return Array.from(document.querySelectorAll("select")).map((s) => s.value);
}

describe("EditChartModal — forecast widget", () => {
  it("pre-selects the Forecast viz type and pre-fills the existing date/target columns", async () => {
    renderModal(forecastChart);
    await waitFor(() => expect(screen.getByText(/date column/i)).toBeInTheDocument());
    await waitFor(() => expect(selectValues()).toContain("date"));
    expect(selectValues()).toContain("sales");
  });

  it("lets a non-forecast chart be switched to Forecast and saves the th2forecast-shaped config", async () => {
    renderModal(barChart);
    fireEvent.click(screen.getByRole("button", { name: /forecast/i }));

    await waitFor(() => expect(screen.getByText(/date column/i)).toBeInTheDocument());

    const selects = screen.getAllByRole("combobox");
    const dateSelect = selects.find((s) => s.previousSibling?.textContent?.match(/date column/i)) || selects[0];
    fireEvent.change(dateSelect, { target: { value: "date" } });
    const targetSelect = selects.find((s) => s.previousSibling?.textContent?.match(/target column/i)) || selects[1];
    fireEvent.change(targetSelect, { target: { value: "sales" } });

    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(updateChart).toHaveBeenCalled());
    const [, payload] = updateChart.mock.calls[0];
    expect(payload.chart_type).toBe("forecast");
    expect(payload.config).toMatchObject({ date_var: "date", target_var: "sales" });
  });
});
