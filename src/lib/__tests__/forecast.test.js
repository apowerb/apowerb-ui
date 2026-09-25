import { describe, it, expect } from "vitest";
import {
  detectDateColumn,
  detectTargetColumn,
  detectFrequency,
  defaultHorizon,
  buildDiagnostics,
  reliabilityBadge,
  proofFacts,
  toChartSeries,
  forecastToCsv,
  contextWindow,
  periodEnd,
  mergeContext,
  removeEvent,
  removeScenario,
  describeRanges,
  withScenario,
} from "../forecast";

describe("detectDateColumn", () => {
  it("picks the column typed date", () => {
    const cols = [
      { name: "store", type: "string" },
      { name: "date", type: "date" },
      { name: "sales", type: "float" },
    ];
    expect(detectDateColumn(cols)).toBe("date");
  });

  it("falls back to a column whose name looks like a date when no type matches", () => {
    const cols = [
      { name: "order_date", type: "string" },
      { name: "sales", type: "float" },
    ];
    expect(detectDateColumn(cols)).toBe("order_date");
  });

  it("returns null when nothing looks like a date", () => {
    const cols = [{ name: "sales", type: "float" }, { name: "store", type: "string" }];
    expect(detectDateColumn(cols)).toBeNull();
  });
});

describe("detectTargetColumn", () => {
  it("picks the first numeric column that isn't the date column", () => {
    const cols = [
      { name: "date", type: "date" },
      { name: "store", type: "string" },
      { name: "sales", type: "float" },
      { name: "units", type: "int" },
    ];
    expect(detectTargetColumn(cols, "date")).toBe("sales");
  });

  it("returns null when there is no numeric column", () => {
    const cols = [{ name: "date", type: "date" }, { name: "store", type: "string" }];
    expect(detectTargetColumn(cols, "date")).toBeNull();
  });
});

describe("detectFrequency", () => {
  it("detects a monthly series from sample rows (approx)", () => {
    const rows = [
      { date: "2024-01-01" },
      { date: "2024-02-01" },
      { date: "2024-03-01" },
      { date: "2024-04-01" },
    ];
    expect(detectFrequency(rows, "date")).toEqual({ frequency: "month", approx: true });
  });

  it("detects a daily series", () => {
    const rows = [{ date: "2024-01-01" }, { date: "2024-01-02" }, { date: "2024-01-03" }];
    expect(detectFrequency(rows, "date")).toEqual({ frequency: "day", approx: true });
  });

  it("detects a monthly series when several groups share each date (long format)", () => {
    const rows = ["2024-01-01", "2024-02-01", "2024-03-01", "2024-04-01"].flatMap((date) => [
      { date, store: "A" },
      { date, store: "B" },
    ]);
    expect(detectFrequency(rows, "date")).toEqual({ frequency: "month", approx: true });
  });

  it("returns null frequency with too few points", () => {
    const rows = [{ date: "2024-01-01" }];
    expect(detectFrequency(rows, "date")).toEqual({ frequency: null, approx: true });
  });
});

describe("defaultHorizon", () => {
  it("suggests 12 for monthly data", () => {
    expect(defaultHorizon("month")).toBe(12);
  });
  it("suggests 30 for daily data", () => {
    expect(defaultHorizon("day")).toBe(30);
  });
  it("suggests 8 for weekly data", () => {
    expect(defaultHorizon("week")).toBe(8);
  });
  it("suggests 4 for quarterly data", () => {
    expect(defaultHorizon("quarter")).toBe(4);
  });
  it("suggests 3 for yearly data", () => {
    expect(defaultHorizon("year")).toBe(3);
  });
  it("falls back to 12 when frequency is unknown", () => {
    expect(defaultHorizon(null)).toBe(12);
  });
});

describe("buildDiagnostics", () => {
  it("warns when history is short relative to the horizon", () => {
    const rows = [{ date: "2024-01-01", sales: 10 }, { date: "2024-02-01", sales: 12 }];
    const result = buildDiagnostics({ rows, dateColumn: "date", targetColumn: "sales", horizon: 12 });
    expect(result.pointCount).toBe(2);
    expect(result.warnings.some((w) => w.code === "short_history")).toBe(true);
  });

  it("warns on non-numeric target values", () => {
    const rows = [
      { date: "2024-01-01", sales: 10 },
      { date: "2024-02-01", sales: "n/a" },
      { date: "2024-03-01", sales: 12 },
    ];
    const result = buildDiagnostics({ rows, dateColumn: "date", targetColumn: "sales", horizon: 3 });
    expect(result.warnings.some((w) => w.code === "non_numeric_values")).toBe(true);
  });

  it("does not warn when history is ample and clean", () => {
    const rows = Array.from({ length: 24 }, (_, i) => ({
      date: `2024-${String((i % 12) + 1).padStart(2, "0")}-01`,
      sales: 10 + i,
    }));
    const result = buildDiagnostics({ rows, dateColumn: "date", targetColumn: "sales", horizon: 6 });
    expect(result.warnings).toEqual([]);
  });

  it("warns when no rows at all", () => {
    const result = buildDiagnostics({ rows: [], dateColumn: "date", targetColumn: "sales", horizon: 12 });
    expect(result.warnings.some((w) => w.code === "empty")).toBe(true);
    expect(result.pointCount).toBe(0);
  });
});

// reliabilityBadge() ne construit plus de texte : les libellés et
// l'explication passent désormais par next-intl (fr/en) côté ForecastChart,
// avec {pct} en paramètre ICU. La fonction ne renvoie que les données brutes.
describe("reliabilityBadge", () => {
  it("labels a good, baseline-beating series as reliable and exposes its raw metrics", () => {
    const series = {
      reliability: "good",
      beats_baseline: true,
      metrics: { mape: 0.08 },
    };
    const badge = reliabilityBadge(series);
    expect(badge.level).toBe("good");
    expect(badge.mape).toBe(0.08);
    expect(badge.beatsBaseline).toBe(true);
  });

  it("labels a fair series as 'to use with caution'", () => {
    const badge = reliabilityBadge({ reliability: "fair", beats_baseline: true, metrics: { mape: 0.22 } });
    expect(badge.level).toBe("fair");
  });

  it("labels a poor series as unreliable", () => {
    const badge = reliabilityBadge({ reliability: "poor", beats_baseline: false, metrics: { mape: 0.5 } });
    expect(badge.level).toBe("poor");
  });

  it("falls back to unknown when reliability is missing", () => {
    const badge = reliabilityBadge({ metrics: {} });
    expect(badge.level).toBe("unknown");
    expect(badge.mape).toBeNull();
    expect(badge.beatsBaseline).toBeNull();
  });
});

describe("proofFacts", () => {
  const calibrated = {
    metrics: { mase: 0.6, holdout_points: 14 },
    baseline: { model: "snaive", metrics: { mase: 0.8 } },
    calibration: {
      method: "split-conformal",
      points: 14,
      levels: {
        95: { calibrated: true, pooled: true, factor: 1.1, raw_coverage: 0.9, calibrated_coverage: 0.93 },
        80: { calibrated: true, pooled: false, factor: 1.2, raw_coverage: 0.71, calibrated_coverage: 0.79 },
      },
    },
  };

  it("reports tested points, error reduction versus the naive baseline and the narrowest band coverage", () => {
    expect(proofFacts(calibrated)).toEqual({
      points: 14,
      gainPct: 25,
      coverage: { level: 80, pct: 79, calibrated: true },
    });
  });

  it("uses the raw coverage when the band could not be calibrated", () => {
    const levels = { 80: { calibrated: false, pooled: false, factor: null, raw_coverage: 0.64, calibrated_coverage: null } };
    expect(proofFacts({ ...calibrated, calibration: { ...calibrated.calibration, levels } }).coverage).toEqual({
      level: 80,
      pct: 64,
      calibrated: false,
    });
  });

  it("reports a negative gain when the model does worse than the baseline", () => {
    expect(proofFacts({ ...calibrated, metrics: { mase: 1.2, holdout_points: 6 } }).gainPct).toBe(-50);
  });

  it("degrades to what the R engine returns: no calibration, no coverage", () => {
    const r = { metrics: { mape: 0.1, mase: 0.9, holdout_points: 6 }, baseline: { metrics: { mase: 1.0 } } };
    expect(proofFacts(r)).toEqual({ points: 6, gainPct: 10, coverage: null });
    expect(proofFacts({ metrics: {}, baseline: { metrics: {} } })).toEqual({ points: null, gainPct: null, coverage: null });
    expect(proofFacts(undefined)).toEqual({ points: null, gainPct: null, coverage: null });
  });
});

describe("toChartSeries", () => {
  it("merges history and forecast into one array, flagging the split and confidence bands", () => {
    const series = {
      history: [{ date: "2024-01-01", value: 100 }, { date: "2024-02-01", value: 110 }],
      forecast: [
        { date: "2024-03-01", value: 120, lower_80: 110, upper_80: 130, lower_95: 100, upper_95: 140 },
      ],
    };
    const points = toChartSeries(series);
    expect(points).toHaveLength(3);
    expect(points[0]).toMatchObject({ date: "2024-01-01", history: 100, forecast: null });
    expect(points[1]).toMatchObject({ date: "2024-02-01", history: 110 });
    // The last history point is duplicated as the first forecast point so the
    // dotted line connects visually to the solid one — no gap in the chart.
    expect(points[2]).toMatchObject({
      date: "2024-03-01",
      history: null,
      forecast: 120,
      lower_80: 110,
      upper_80: 130,
      lower_95: 100,
      upper_95: 140,
    });
  });

  it("returns an empty array when series is missing", () => {
    expect(toChartSeries(null)).toEqual([]);
  });

  it("gives the confidence bands a zero-width start at the last real point, so there is no gap", () => {
    const series = {
      history: [{ date: "2024-01-01", value: 100 }, { date: "2024-02-01", value: 110 }],
      forecast: [
        { date: "2024-03-01", value: 120, lower_80: 110, upper_80: 130, lower_95: 100, upper_95: 140 },
      ],
    };
    const points = toChartSeries(series);
    // The junction point (last history point) must carry the SAME bound
    // values on both sides (lower === upper === last history value):
    // a band of width zero, so recharts' range-area tapers in smoothly
    // from a single point instead of jumping straight to the first
    // forecast point's already-wide interval.
    expect(points[1]).toMatchObject({
      date: "2024-02-01",
      lower_80: 110,
      upper_80: 110,
      lower_95: 110,
      upper_95: 110,
    });
  });
});

describe("forecastToCsv", () => {
  it("exports forecast rows with bounds as CSV", () => {
    const series = {
      forecast: [
        { date: "2024-03-01", value: 120, lower_80: 110, upper_80: 130, lower_95: 100, upper_95: 140 },
      ],
    };
    const csv = forecastToCsv(series);
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe("date,value,lower_80,upper_80,lower_95,upper_95");
    expect(lines[1]).toBe("2024-03-01,120,110,130,100,140");
  });

  it("returns just the header when there is no forecast", () => {
    const csv = forecastToCsv({ forecast: [] });
    expect(csv.trim()).toBe("date,value");
  });
});

describe("buildDiagnostics with several groups", () => {
  it("counts history points per series, not rows", () => {
    const rows = Array.from({ length: 12 }, (_, i) => `2024-${String(i + 1).padStart(2, "0")}-01`).flatMap((date) => [
      { date, sales: 1, store: "A" },
      { date, sales: 2, store: "B" },
    ]);
    const { pointCount, warnings } = buildDiagnostics({ rows, dateColumn: "date", targetColumn: "sales", horizon: 12 });
    expect(pointCount).toBe(12);
    expect(warnings.map((w) => w.code)).toContain("short_history");
  });
});

describe("buildDiagnostics on a partial preview sample", () => {
  const sample = [
    { date: "2024-01-01", sales: 100 },
    { date: "2024-02-01", sales: 110 },
    { date: "2024-03-01", sales: 120 },
  ];

  it("does not claim a short history when the sample is only part of the data", () => {
    const d = buildDiagnostics({ rows: sample, dateColumn: "date", targetColumn: "sales", horizon: 12, totalRows: 72 });
    expect(d.partial).toBe(true);
    expect(d.warnings.map((w) => w.code)).not.toContain("short_history");
  });

  it("still warns about a short history when the sample is the whole data", () => {
    const d = buildDiagnostics({ rows: sample, dateColumn: "date", targetColumn: "sales", horizon: 12, totalRows: 3 });
    expect(d.partial).toBe(false);
    expect(d.warnings.map((w) => w.code)).toContain("short_history");
  });
});

describe("contextWindow", () => {
  it("spans every series from the first history date to the last forecast date", () => {
    const response = {
      frequency: "day",
      series: [
        { group: "Lyon", history: [{ date: "2025-01-02" }, { date: "2025-03-01" }], forecast: [{ date: "2025-03-10" }] },
        { group: "Paris", history: [{ date: "2025-01-01" }, { date: "2025-03-01" }], forecast: [{ date: "2025-03-31" }] },
      ],
    };
    expect(contextWindow(response)).toEqual({
      history_start: "2025-01-01",
      history_end: "2025-03-01",
      horizon_end: "2025-03-31",
      frequency: "day",
      groups: ["Lyon", "Paris"],
    });
  });

  it("ends history and horizon on the last day of their period", () => {
    const response = {
      frequency: "month",
      series: [{ group: null, history: [{ date: "2023-01-01" }, { date: "2025-12-01" }], forecast: [{ date: "2026-12-01" }] }],
    };
    expect(contextWindow(response)).toMatchObject({
      history_start: "2023-01-01",
      history_end: "2025-12-31",
      horizon_end: "2026-12-31",
      groups: [],
    });
    expect(periodEnd("2024-02-01", "month")).toBe("2024-02-29");
    expect(periodEnd("2025-10-01", "quarter")).toBe("2025-12-31");
    expect(periodEnd("2025-12-29", "week")).toBe("2026-01-04");
    expect(periodEnd("2025-01-01", "year")).toBe("2025-12-31");
    expect(periodEnd("2025-03-05", "day")).toBe("2025-03-05");
  });

  it("is null without dates or frequency", () => {
    expect(contextWindow({ frequency: "day", series: [] })).toBeNull();
    expect(contextWindow({ series: [{ history: [{ date: "2025-01-01" }], forecast: [{ date: "2025-01-02" }] }] })).toBeNull();
  });
});

describe("mergeContext / removeEvent / removeScenario", () => {
  const promo = { name: "promo", ranges: [{ start: "2025-02-01", end: "2025-02-01" }] };
  const closed = { name: "fermeture", ranges: [{ start: "2025-08-01", end: "2025-08-15" }] };

  it("adds new ranges to a known event and replaces a scenario of the same name", () => {
    const current = { events: [promo], scenarios: [{ name: "Sans promo", events: [] }] };
    const more = { name: "promo", ranges: [{ start: "2025-01-04", end: "2025-01-04" }, promo.ranges[0]] };
    const next = mergeContext(current, { events: [more], scenarios: [{ name: "Sans promo", events: [], adjustments: [] }] });
    expect(next.events).toEqual([{ name: "promo", ranges: [{ start: "2025-01-04", end: "2025-01-04" }, promo.ranges[0]] }]);
    expect(next.scenarios).toEqual([{ name: "Sans promo", events: [], adjustments: [] }]);
  });

  it("keeps a new fact in a scenario that fixed its future events", () => {
    const current = { events: [promo], scenarios: [{ name: "Sans promo", events: [] }] };
    const next = mergeContext(current, { events: [closed], scenarios: [] });
    expect(next.scenarios).toEqual([{ name: "Sans promo", events: [closed] }]);
  });

  it("removes an event everywhere, and a scenario alone", () => {
    const ctx = { events: [promo, closed], scenarios: [{ name: "Sans promo", events: [closed] }, { name: "Noël", adjustments: [] }] };
    expect(removeEvent(ctx, "fermeture")).toEqual({
      events: [promo],
      scenarios: [{ name: "Sans promo", events: [] }, { name: "Noël", adjustments: [] }],
    });
    expect(removeScenario(ctx, "Noël").scenarios).toEqual([{ name: "Sans promo", events: [closed] }]);
  });
});

describe("describeRanges", () => {
  it("shows single days, spans and the remainder", () => {
    const ranges = [
      { start: "2025-01-04", end: "2025-01-04" },
      { start: "2025-08-01", end: "2025-08-15" },
      { start: "2025-09-06", end: "2025-09-06" },
      { start: "2025-10-04", end: "2025-10-04" },
    ];
    expect(describeRanges(ranges)).toBe("2025-01-04, 2025-08-01 → 2025-08-15, 2025-09-06 +1");
  });
});

describe("withScenario", () => {
  it("starts the scenario line at the last real point and follows the scenario values", () => {
    const points = toChartSeries({
      history: [{ date: "2025-01-01", value: 10 }],
      forecast: [{ date: "2025-01-02", value: 12 }, { date: "2025-01-03", value: 13 }],
    });
    const out = withScenario(points, { forecast: [{ date: "2025-01-02", value: 8 }, { date: "2025-01-03", value: 9 }] });
    expect(out.map((p) => p.scenario)).toEqual([10, 8, 9]);
    expect(withScenario(points, null)).toBe(points);
  });
});
