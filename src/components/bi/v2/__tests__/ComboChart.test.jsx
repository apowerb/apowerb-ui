import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import ComboChart from "../visuals/ComboChart";
import { Ctx } from "./testUtils";

vi.mock("recharts", async (orig) => (await import("./testUtils")).sizedRecharts(orig));

const rows = Array.from({ length: 6 }, (_, i) => ({
  semaine: `2026-0${i + 1}-06`,
  stock: 100 + i * 10,
  prev: 90 + i * 8,
  appro: 20 + i,
  secu: 50,
}));
const visual = {
  type: "combo",
  x: "semaine",
  series: [
    { key: "stock", mark: "area", color: "good" },
    { key: "prev", mark: "line" },
    { key: "appro", mark: "bar" },
    { key: "secu", mark: "line", dash: true, color: "warn" },
  ],
};

const draw = (v = visual) =>
  render(
    <Ctx>
      <ComboChart visual={v} result={{ rows, reference_lines: [] }} />
    </Ctx>,
  );

describe("ComboChart", () => {
  it("draws the area series with a gradient fill under the curve", () => {
    const { container } = draw();
    expect(container.querySelector(".recharts-area-area")).not.toBeNull();
    expect(container.querySelector(".recharts-area-curve")).not.toBeNull();
    expect(container.querySelector("linearGradient")).not.toBeNull();
    const fill = container.querySelector(".recharts-area-area")?.getAttribute("fill") || "";
    expect(fill).toMatch(/^url\(#v2g-/);
  });

  it("draws the forecast line, the thin bars and the dashed safety line", () => {
    const { container } = draw();
    expect(container.querySelectorAll(".recharts-line-curve").length).toBe(2);
    expect(container.querySelectorAll(".recharts-bar-rectangle").length).toBe(rows.length);
    const dashed = [...container.querySelectorAll(".recharts-line-curve")].filter((n) => n.getAttribute("stroke-dasharray"));
    expect(dashed.length).toBe(1);
  });

  it("shows a compact legend for several series", () => {
    const { container } = draw();
    expect(container.querySelectorAll(".recharts-legend-item").length).toBe(4);
  });

  it("fades bars to 0.55 under curves, keeps bar-only charts opaque", () => {
    const { container, unmount } = draw();
    const op = (c) => [...c.querySelectorAll(".recharts-bar-rectangle path")].map((n) => n.getAttribute("fill-opacity"));
    expect(new Set(op(container))).toEqual(new Set(["0.55"]));
    unmount();
    const bars = draw({ type: "combo", x: "semaine", series: [{ key: "appro", mark: "bar" }] });
    expect(new Set(op(bars.container))).toEqual(new Set(["1"]));
  });

  it("paints bars before the area and the lines", () => {
    const { container } = draw();
    const order = [...container.querySelectorAll(".recharts-bar, .recharts-area, .recharts-line")].map((n) =>
      n.getAttribute("class").match(/recharts-(bar|area|line)\b/)[1],
    );
    expect(order.indexOf("bar")).toBeLessThan(order.indexOf("area"));
    expect(order.indexOf("area")).toBeLessThan(order.indexOf("line"));
  });
});
