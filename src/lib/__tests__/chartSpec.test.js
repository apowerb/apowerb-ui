import { describe, it, expect } from "vitest";
import { parseChartSpec, toSlices, toStat, formatNumber, MAX_ROWS } from "../chartSpec";

describe("parseChartSpec", () => {
  it("normalises rows with an explicit x and series list", () => {
    const spec = parseChartSpec(
      JSON.stringify({
        type: "bar",
        title: "Orders",
        x: "month",
        series: ["orders", "returns"],
        unit: "€",
        data: [
          { month: "Jan", orders: 10, returns: "2" },
          { month: "Feb", orders: 15, returns: 1 },
        ],
      }),
    );
    expect(spec.ok).toBe(true);
    expect(spec).toMatchObject({ type: "bar", title: "Orders", xKey: "month", unit: "€" });
    expect(spec.series.map((s) => s.key)).toEqual(["orders", "returns"]);
    expect(spec.rows[0]).toEqual({ month: "Jan", orders: 10, returns: 2 });
  });

  it("infers x and numeric series when they are not declared", () => {
    const spec = parseChartSpec({ type: "line", data: [{ day: "Mon", visits: 5, note: "x" }, { day: "Tue", visits: 7 }] });
    expect(spec.xKey).toBe("day");
    expect(spec.series.map((s) => s.key)).toEqual(["visits"]);
    expect(spec.series[0].label).toBe("Visits");
  });

  it("accepts key/value pairs, label/value arrays and point tuples", () => {
    const pairs = parseChartSpec({ data: { Jan: 1, Feb: 2 } });
    expect(pairs.rows).toEqual([{ label: "Jan", value: 1 }, { label: "Feb", value: 2 }]);
    const arrays = parseChartSpec({ labels: ["a", "b"], values: [3, 4] });
    expect(arrays.rows[1]).toEqual({ label: "b", value: 4 });
    const multi = parseChartSpec({ labels: ["a"], series: { x: [1], y: [2] } });
    expect(multi.series.map((s) => s.key)).toEqual(["x", "y"]);
    const tuples = parseChartSpec({ type: "pie", data: [["red", 5], ["blue", 7]] });
    expect(toSlices(tuples)).toEqual([{ name: "red", value: 5 }, { name: "blue", value: 7 }]);
  });

  it("rejects what it cannot draw, with a reason", () => {
    expect(parseChartSpec("not json")).toEqual({ ok: false, reason: "invalid_json" });
    expect(parseChartSpec("[1,2]")).toEqual({ ok: false, reason: "not_an_object" });
    expect(parseChartSpec({ type: "radar", data: { a: 1 } })).toEqual({ ok: false, reason: "unknown_type" });
    expect(parseChartSpec({ type: "bar" })).toEqual({ ok: false, reason: "no_data" });
    expect(parseChartSpec({ data: [{ label: "a", note: "text only" }] })).toEqual({ ok: false, reason: "no_values" });
  });

  it("caps the row count and reports it", () => {
    const data = Array.from({ length: MAX_ROWS + 50 }, (_, i) => ({ x: String(i), v: i }));
    const spec = parseChartSpec({ data });
    expect(spec.rows).toHaveLength(MAX_ROWS);
    expect(spec.truncated).toBe(true);
  });

  it("parses French-style numbers", () => {
    const spec = parseChartSpec({ data: { a: "1 234,5", b: "12" } });
    expect(spec.rows[0].value).toBe(1234.5);
  });
});

describe("toStat / formatNumber", () => {
  it("builds a headline with a delta against the next row", () => {
    const spec = parseChartSpec({ type: "stat", x: "period", series: ["revenue"], data: [{ period: "Q3", revenue: 120 }, { period: "Q2", revenue: 100 }] });
    expect(toStat(spec)).toEqual({ label: "Q3", value: 120, delta: 20 });
    expect(toStat({ ok: false })).toBeNull();
  });

  it("formats numbers compactly with an optional unit", () => {
    expect(formatNumber(1234)).toBe("1234");
    expect(formatNumber(12345)).toBe("12.3k");
    expect(formatNumber(2_500_000, "€")).toBe("2.5M €");
    expect(formatNumber(3.14159)).toBe("3.14");
    expect(formatNumber(null)).toBe("—");
  });
});
