import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import KpiTile from "../visuals/KpiTile";

vi.mock("recharts", async (orig) => (await import("./testUtils")).sizedRecharts(orig));

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

describe("KpiTile sparkline and badge", () => {
  const spark = [3, 4, 2, 5, 6, 5, 7];

  it("renders the sparkline when the server sends spark", () => {
    const { container } = render(<KpiTile result={value("good", { spark })} />);
    expect(screen.getByTestId("kpi-spark")).toBeInTheDocument();
    expect(container.querySelector("svg.recharts-surface")).not.toBeNull();
  });

  it("renders no sparkline without spark, with null, or with a single point", () => {
    for (const s of [undefined, null, [], [1]]) {
      const { unmount } = render(<KpiTile result={value("good", { spark: s })} />);
      expect(screen.queryByTestId("kpi-spark")).toBeNull();
      unmount();
    }
  });

  it("draws a flat series without crashing", () => {
    render(<KpiTile result={value("good", { spark: [1, 1, 1, 1] })} />);
    expect(screen.getByTestId("kpi-spark")).toBeInTheDocument();
  });

  it("keeps the value on one line with the unit beside it", () => {
    render(<KpiTile result={value("good", { formatted: "19,1 k unités" })} />);
    const el = screen.getByTestId("kpi-value");
    expect(el.className).toContain("whitespace-nowrap");
    expect(el.className).not.toContain("flex-wrap");
    expect(el).toHaveTextContent("19,1 kunités");
    expect(screen.getByText("unités").className).toContain("whitespace-nowrap");
  });

  it("colours the delta badge by sign", () => {
    const { rerender } = render(<KpiTile result={value("good", { delta: 0.05, delta_formatted: "+5 %" })} />);
    expect(screen.getByTestId("kpi-delta").dataset.tone).toBe("good");
    expect(screen.getByTestId("kpi-delta").style.color).toBe("var(--v2-good)");
    rerender(<KpiTile result={value("good", { delta: -0.05, delta_formatted: "-5 %" })} />);
    expect(screen.getByTestId("kpi-delta").dataset.tone).toBe("bad");
    rerender(<KpiTile result={value("good", { delta: 0, delta_formatted: "0 %" })} />);
    expect(screen.getByTestId("kpi-delta").dataset.tone).toBe("muted");
  });

  it("shows no badge without delta_formatted", () => {
    render(<KpiTile result={value("good")} />);
    expect(screen.queryByTestId("kpi-delta")).toBeNull();
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
