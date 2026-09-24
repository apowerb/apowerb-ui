import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ForecastConfigStep from "../ForecastConfigStep";

const columns = [
  { name: "store", type: "string" },
  { name: "date", type: "date" },
  { name: "sales", type: "float" },
];

const sampleRows = [
  { store: "Paris", date: "2024-01-01", sales: 100 },
  { store: "Paris", date: "2024-02-01", sales: 110 },
  { store: "Paris", date: "2024-03-01", sales: 120 },
];

describe("ForecastConfigStep", () => {
  it("pre-fills date and target columns by heuristic and reports them via onChange", () => {
    const onChange = vi.fn();
    render(<ForecastConfigStep columns={columns} sampleRows={sampleRows} value={{}} onChange={onChange} />);

    const lastCall = onChange.mock.calls.at(-1)[0];
    expect(lastCall.dateVar).toBe("date");
    expect(lastCall.targetVar).toBe("sales");
    expect(lastCall.horizon).toBeGreaterThan(0);
  });

  it("shows the point count and a short-history warning when the horizon exceeds the data", () => {
    render(
      <ForecastConfigStep
        columns={columns}
        sampleRows={sampleRows}
        value={{ dateVar: "date", targetVar: "sales", horizon: 24 }}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText(/3 data points/i)).toBeInTheDocument();
    // Diagnostic messages come straight from lib/forecast.js (untranslated,
    // same rationale as the backend's own French error strings) — always French.
    expect(screen.getByText(/historique court/i)).toBeInTheDocument();
  });

  it("lets the user switch the model and explains the choice", () => {
    const onChange = vi.fn();
    render(
      <ForecastConfigStep
        columns={columns}
        sampleRows={sampleRows}
        value={{ dateVar: "date", targetVar: "sales", horizon: 3, models: ["prophet"] }}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /automatic/i }));
    const lastCall = onChange.mock.calls.at(-1)[0];
    expect(lastCall.models).toEqual(["auto"]);
  });

  it("explains the currently selected model", () => {
    render(
      <ForecastConfigStep
        columns={columns}
        sampleRows={sampleRows}
        value={{ dateVar: "date", targetVar: "sales", horizon: 3, models: ["auto"] }}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText(/beats a naive baseline/i)).toBeInTheDocument();
  });

  it("offers a group-by column selector distinct from date and target", () => {
    render(
      <ForecastConfigStep
        columns={columns}
        sampleRows={sampleRows}
        value={{ dateVar: "date", targetVar: "sales" }}
        onChange={() => {}}
      />,
    );
    const groupSelect = screen.getByRole("combobox", { name: /group by/i });
    const optionNames = Array.from(groupSelect.options).map((o) => o.value);
    expect(optionNames).toContain("store");
    expect(optionNames).not.toContain("date");
    expect(optionNames).not.toContain("sales");
  });

  it("associates the date and target selects with their visible labels for screen readers", () => {
    render(
      <ForecastConfigStep
        columns={columns}
        sampleRows={sampleRows}
        value={{ dateVar: "date", targetVar: "sales" }}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole("combobox", { name: /date column/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /target column/i })).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: /horizon/i })).toBeInTheDocument();
  });
});

describe("ForecastConfigStep on a partial preview", () => {
  it("says the history is checked at computation instead of flagging a short history", () => {
    render(
      <ForecastConfigStep
        columns={columns}
        sampleRows={sampleRows}
        totalRows={72}
        value={{ dateVar: "date", targetVar: "sales", horizon: 12 }}
        onChange={() => {}}
      />,
    );
    expect(screen.queryByText(/historique court/i)).not.toBeInTheDocument();
    expect(screen.getByText(/3 of 72 rows/i)).toBeInTheDocument();
  });
});
