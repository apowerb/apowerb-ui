import { describe, it, expect } from "vitest";
import { HUB_SORTERS, hubTime } from "@/components/hubBrowserUtils";

describe("hubTime", () => {
  it("parses the non-ISO hub timestamp format deterministically", () => {
    expect(hubTime("2026-06-30 09:34:00")).toBe(Date.UTC(2026, 5, 30, 9, 34, 0));
    expect(hubTime("2026-06-30T09:34:00")).toBe(Date.UTC(2026, 5, 30, 9, 34, 0));
  });
  it("returns 0 for empty/unparseable values (stable, no NaN)", () => {
    expect(hubTime("")).toBe(0);
    expect(hubTime(null)).toBe(0);
    expect(hubTime("not-a-date")).toBe(0);
  });
});

describe("HUB_SORTERS", () => {
  const agents = [
    { hub_name: "Zebra", published_at: "2026-01-01 00:00:00" },
    { hub_name: "alpha", published_at: "2026-06-30 09:34:00" },
    { hub_name: "Mid", published_at: "2026-03-15 12:00:00" },
  ];
  const names = (arr) => arr.map((a) => a.hub_name);
  it("name-asc is case-insensitive alphabetical", () => {
    expect(names([...agents].sort(HUB_SORTERS["name-asc"]))).toEqual(["alpha", "Mid", "Zebra"]);
  });
  it("name-desc reverses", () => {
    expect(names([...agents].sort(HUB_SORTERS["name-desc"]))).toEqual(["Zebra", "Mid", "alpha"]);
  });
  it("recent = newest published first", () => {
    expect(names([...agents].sort(HUB_SORTERS.recent))).toEqual(["alpha", "Mid", "Zebra"]);
  });
  it("oldest = oldest published first", () => {
    expect(names([...agents].sort(HUB_SORTERS.oldest))).toEqual(["Zebra", "Mid", "alpha"]);
  });
});
