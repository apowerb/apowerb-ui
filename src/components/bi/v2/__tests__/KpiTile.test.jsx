import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import KpiTile from "../visuals/KpiTile";

const value = (status, extra = {}) => ({
  value: { value: 0.973, formatted: "97,3 %", status, delta: null, delta_formatted: null, secondary: null, target_label: null, ...extra },
});

describe("KpiTile", () => {
  it.each([
    ["good", "var(--v2-good)"],
    ["warn", "var(--v2-warn)"],
    ["bad", "var(--v2-bad)"],
  ])("colours the value by status %s", (status, color) => {
    render(<KpiTile result={value(status)} />);
    const el = screen.getByTestId("kpi-value");
    expect(el).toHaveTextContent("97,3 %");
    expect(el.dataset.status).toBe(status);
    expect(el.style.color).toBe(color);
  });

  it("keeps the neutral colour without a status", () => {
    render(<KpiTile result={value(null)} />);
    expect(screen.getByTestId("kpi-value").style.color).toBe("var(--text-primary)");
  });

  it("shows delta, secondary text and target", () => {
    render(
      <KpiTile
        result={value("good", { delta: 0.032, delta_formatted: "+3,2 %", secondary: "12 non servis", target_label: "cible ≥ 98 %" })}
      />,
    );
    expect(screen.getByText("+3,2 %")).toBeInTheDocument();
    expect(screen.getByText("12 non servis")).toBeInTheDocument();
    expect(screen.getByText("cible ≥ 98 %")).toBeInTheDocument();
  });
});

describe("splitUnit", () => {
  it("separates a trailing unit from the figure", async () => {
    const { splitUnit } = await import("../visuals/KpiTile");
    expect(splitUnit("981 unités")).toEqual(["981", "unités"]);
    expect(splitUnit("19,1 k unités")).toEqual(["19,1 k", "unités"]);
    expect(splitUnit("1,1 sem.")).toEqual(["1,1", "sem."]);
    expect(splitUnit("100,0 %")).toEqual(["100,0 %", ""]);
    expect(splitUnit("—")).toEqual(["—", ""]);
  });
});
