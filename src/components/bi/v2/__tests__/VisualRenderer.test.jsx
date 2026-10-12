import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import VisualRenderer from "../VisualRenderer";
import { Ctx } from "./testUtils";

vi.mock("recharts", async (orig) => (await import("./testUtils")).sizedRecharts(orig));

const meta = { source: "stock", measures: [{ name: "ventes", label: "Ventes", expr: "SUM(ventes)", provenance: ["real"] }], filters_applied: {}, ignored_filters: [], row_count: 10, provenance: ["real"] };
const weekRows = [
  { semaine: "2026-07-06", ventes: 100, prevision: 90, stock_fin: 300, _color_ventes: "good" },
  { semaine: "2026-07-13", ventes: 120, prevision: 110, stock_fin: 280 },
];
const famRows = [
  { famille: "Cartons", v: 5, "_color_v": "good" },
  { famille: "Palettes", v: -3, "_color_v": "bad" },
];

const CASES = {
  kpi: [{ type: "kpi" }, { type: "kpi", value: { value: 1, formatted: "1", status: "good" }, meta }],
  combo: [
    { type: "combo", x: "semaine", series: [{ key: "ventes", mark: "bar" }, { key: "prevision", mark: "line", dash: true }, { key: "stock_fin", mark: "line", axis: "right" }] },
    { type: "combo", rows: weekRows, reference_lines: [{ value: 100, label: "cible", color: "warn", dash: true }], meta },
  ],
  bar: [{ type: "bar", x: "famille", series: [{ key: "v" }] }, { type: "bar", rows: famRows, reference_lines: [{ value: 2 }], meta }],
  hbar: [{ type: "hbar", x: "famille", series: [{ key: "v" }] }, { type: "hbar", rows: famRows, meta }],
  line: [{ type: "line", x: "semaine", series: [{ key: "ventes" }] }, { type: "line", rows: weekRows, meta }],
  area: [{ type: "area", x: "semaine", series: [{ key: "ventes" }] }, { type: "area", rows: weekRows, meta }],
  pie: [{ type: "pie" }, { type: "pie", rows: [{ x: "A", value: 3 }, { x: "B", value: 7 }], meta }],
  diverging_bar: [{ type: "diverging_bar", x: "famille", series: [{ key: "v" }] }, { type: "diverging_bar", rows: famRows, meta }],
  waterfall: [{ type: "waterfall" }, { type: "waterfall", rows: [{ label: "a", value: 10, base: 0, kind: "start" }, { label: "b", value: 4, base: 10, kind: "increase" }], meta }],
  table: [{ type: "table", x: "famille", columns: [{ key: "famille" }, { key: "v" }] }, { type: "table", rows: famRows, meta }],
  text: [{ type: "text" }, { type: "text", text: "Ventes de 12 k et 98 % de service." }],
  note: [{ type: "note" }, { type: "note", text: "- un **point**\n- `code`", badges: ["real", "simulated", "forecast"] }],
};

function renderType(type, visual, result) {
  return render(
    <Ctx value={{ data: { components: { c1: result } }, loading: false }}>
      <VisualRenderer component={{ id: "c1", component_type: "visual", visual: { title: `T-${type}`, source: "stock", ...visual } }} />
    </Ctx>,
  );
}

describe("VisualRenderer", () => {
  for (const [type, [visual, result]] of Object.entries(CASES)) {
    it(`renders ${type} without crashing`, () => {
      const { container } = renderType(type, visual, { reference_lines: [], meta: {}, ...result, type });
      expect(screen.getByRole("region", { name: `T-${type}` })).toBeInTheDocument();
      expect(container.querySelector("[role=alert]")).toBeNull();
    });
  }

  it("draws svg for chart types", () => {
    for (const type of ["combo", "bar", "hbar", "line", "area", "pie", "diverging_bar"]) {
      const [visual, result] = CASES[type];
      const { container, unmount } = renderType(type, visual, { reference_lines: [], meta: {}, ...result, type });
      expect(container.querySelector("svg.recharts-surface"), type).not.toBeNull();
      unmount();
    }
  });

  it("an unknown type falls back to the raw rows table", () => {
    renderType(
      "gauge",
      { type: "gauge" },
      { type: "gauge", rows: [{ a: 1, b: "x" }, { a: 2, b: "y" }], meta },
    );
    const raw = screen.getByTestId("v2-raw-rows");
    expect(raw).toHaveTextContent("a");
    expect(raw).toHaveTextContent("y");
  });

  it("shows a skeleton while the first response is pending", () => {
    render(
      <Ctx value={{ data: null, loading: true }}>
        <VisualRenderer component={{ id: "c1", visual: { type: "kpi", title: "K" } }} />
      </Ctx>,
    );
    expect(screen.getByTestId("v2-skeleton")).toBeInTheDocument();
  });

  it("shows a readable error for a failed component", () => {
    renderType("bar", { type: "bar" }, { type: "bar", error: "Unknown measure 'x'", meta: {} });
    expect(screen.getByRole("alert")).toHaveTextContent("Unknown measure 'x'");
  });

  it("bolds figures in text blocks and renders the note markdown and badges", () => {
    const { unmount } = renderType("text", { type: "text" }, { type: "text", text: "Ventes de 12 k et 98 % de service." });
    expect(screen.getByText("12 k").tagName).toBe("STRONG");
    expect(screen.getByText("98 %").tagName).toBe("STRONG");
    unmount();
    const { container } = renderType("note", { type: "note" }, { type: "note", text: "- un **point**\n- `code`", badges: ["real", "simulated", "forecast"] });
    expect(container.querySelectorAll("li")).toHaveLength(2);
    expect(screen.getByText("point").tagName).toBe("STRONG");
    expect(screen.getByText("code").tagName).toBe("CODE");
    expect(container.querySelectorAll("[data-provenance]")).toHaveLength(3);
  });

  it("offers the Sources popover with the measure formula and filters", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    renderType("kpi", { type: "kpi", title: "Ventes" }, {
      type: "kpi",
      value: { value: 1, formatted: "1 k", status: "good" },
      meta: { ...meta, filters_applied: { periode: "26w" }, ignored_filters: ["famille"] },
    });
    await userEvent.click(screen.getByRole("button", { name: "Sources" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("SUM(ventes)");
    expect(dialog).toHaveTextContent("periode");
    expect(dialog).toHaveTextContent("famille");
    expect(dialog).toHaveTextContent("stock");
  });
});
