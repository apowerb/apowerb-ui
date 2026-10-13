/** Values accepted by the reshaping and period filters (mirror of the core spec). */
export const TIME_GRAINS = ["hour", "day", "week", "month", "quarter", "year"];
export const AGGREGATIONS = ["sum", "avg", "min", "max", "count"];
/** Custom relative period: 1 to 999 days, weeks, months or years. */
export const PERIOD_RE = /^([1-9]\d{0,2})([dwmy])$/;
export const PERIOD_UNITS = ["d", "w", "m", "y"];
export const isPeriodValue = (v) => v === "all" || v === "ytd" || v === "mtd" || PERIOD_RE.test(v || "");
