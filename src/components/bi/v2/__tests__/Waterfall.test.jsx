import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { buildWaterfallBars } from "../visuals/Waterfall";
import Waterfall from "../visuals/Waterfall";


vi.mock("recharts", async (orig) => (await import("./testUtils")).sizedRecharts(orig));

describe("buildWaterfallBars", () => {
  it("uses the server base and builds labelled, coloured bars", () => {
    const bars = buildWaterfallBars([
      { label: "Initial", value: 100, base: 0, kind: "start" },
      { label: "Entrées", value: 381200, base: 100, kind: "increase" },
      { label: "Sorties", value: -50000, base: 331300, kind: "decrease" },
      { label: "Final", value: 331300, base: 0, kind: "end", color: "accent" },
    ]);
    expect(bars.map((b) => [b.base, b.height])).toEqual([
      [0, 100],
      [100, 381200],
      [331300, 50000],
      [0, 331300],
    ]);
    expect(bars[1].text).toBe("+381,2 k");
    expect(bars[2].text).toBe("−50 k");
    expect(bars[1].color).toBe("var(--v2-good)");
    expect(bars[2].color).toBe("var(--v2-bad)");
    expect(bars[3].color).toBe("var(--v2-accent)");
  });

  it("labels bars in English when the dashboard locale is en", () => {
    const bars = buildWaterfallBars(
      [
        { label: "In", value: 15300, base: 0, kind: "increase" },
        { label: "Out", value: -2400000, base: 0, kind: "decrease" },
      ],
      "en",
    );
    expect(bars.map((b) => b.text)).toEqual(["+15.3k", "\u22122.4M"]);
  });

  it("falls back to a running total when the base is missing", () => {
    const bars = buildWaterfallBars([
      { label: "a", value: 100, kind: "start" },
      { label: "b", value: 40, kind: "increase" },
      { label: "c", value: 30, kind: "decrease" },
      { label: "d", kind: "end" },
    ]);
    expect(bars.map((b) => b.base)).toEqual([0, 100, 110, 0]);
    expect(bars[3].height).toBe(110);
  });

  it("keeps the sign of negative start/end totals", () => {
    const bars = buildWaterfallBars([
      { label: "Début", value: -500, kind: "start" },
      { label: "Entrées", value: 200, kind: "increase" },
      { label: "Fin", value: -300, kind: "end" },
    ]);
    expect(bars[0].height).toBe(-500);
    expect(bars[0].range).toEqual([-500, 0]);
    expect(bars[0].text).toBe("\u2212500");
    expect(bars[1].range).toEqual([-500, -300]);
    expect(bars[2].range).toEqual([-300, 0]);
    expect(bars[2].text).toBe("\u2212300");
  });

  it("renders an svg chart", () => {
    const { container } = render(
      <Waterfall result={{ rows: [{ label: "a", value: 10, base: 0, kind: "start" }, { label: "b", value: 5, base: 10, kind: "increase" }] }} />,
    );
    expect(container.querySelector("svg.recharts-surface")).not.toBeNull();
  });
});
