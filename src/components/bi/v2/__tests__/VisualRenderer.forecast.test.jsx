import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import VisualRenderer from "../VisualRenderer";
import { Ctx } from "./testUtils";

const seen = [];
vi.mock("@/components/bi/ForecastChart", () => ({
  default: (props) => {
    seen.push(props);
    return <div data-testid="forecast-chart">forecast</div>;
  },
}));

describe("VisualRenderer forecast", () => {
  it("feeds the source rows and the forecast settings to the forecast chart", () => {
    const rows = [
      { mois: "2026-01-01", qte: 10 },
      { mois: "2026-02-01", qte: 12 },
    ];
    const forecast = { date_var: "mois", target_var: "qte", group_var: null, horizon: 6 };
    render(
      <Ctx value={{ data: { components: { c1: { type: "forecast", rows } } }, loading: false }}>
        <VisualRenderer component={{ id: "c1", component_type: "visual", visual: { type: "forecast", title: "Prévision", source: "stock", forecast } }} />
      </Ctx>,
    );
    expect(screen.getByTestId("forecast-chart")).toBeTruthy();
    expect(screen.queryByTestId("v2-raw-rows")).toBeNull();
    const props = seen.at(-1);
    expect(props.rows).toBe(rows);
    expect(props.config).toMatchObject(forecast);
    expect(props.chartId).toBeUndefined();
  });
});
