import { describe, it, expect } from "vitest";
import {
  compact,
  formatByKind,
  formatFull,
  intlLocale,
  longDate,
  resolveColor,
  shortDate,
  signedCompact,
  splitNumbers,
  tickByKind,
  withPercent,
  xTick,
} from "../format";

describe("format helpers", () => {
  it("compacts numbers in French (k, M)", () => {
    expect(compact(381200)).toBe("381,2 k");
    expect(compact(1500000)).toBe("1,5 M");
    expect(compact(42)).toBe("42");
    expect(signedCompact(381200)).toBe("+381,2 k");
    expect(signedCompact(-12000)).toBe("−12 k");
  });

  it("shortens ISO dates and leaves other labels alone", () => {
    expect(shortDate("2026-07-14")).toBe("14 juil.");
    expect(shortDate("Cartons")).toBe("Cartons");
  });

  it("maps semantic colours to theme tokens and passes hex through", () => {
    expect(resolveColor("good")).toBe("var(--v2-good)");
    expect(resolveColor("#ff0000")).toBe("#ff0000");
    expect(resolveColor(null, "x")).toBe("x");
    expect(resolveColor("rgba(10, 20, 30, 0.5)")).toBe("rgba(10, 20, 30, 0.5)");
    expect(resolveColor("hsl(120 50% 40%)")).toBe("hsl(120 50% 40%)");
    expect(resolveColor("var(--v2-series-2)")).toBe("var(--v2-series-2)");
    // anything else (url(), expressions, injected declarations, unknown names) -> fallback
    expect(resolveColor("url(javascript:alert(1))", "x")).toBe("x");
    expect(resolveColor("red; background:url(x)", "x")).toBe("x");
    expect(resolveColor("rgb(0,0,0); color:red", "x")).toBe("x");
    expect(resolveColor("banana", "x")).toBe("x");
  });

  it("formats by measure format", () => {
    expect(formatByKind(0.973, "percent")).toBe("97,3 %");
    expect(formatByKind(3.44, "weeks")).toBe("3,4 sem.");
    expect(formatByKind(null, "integer")).toBe("—");
  });

  it("bolds figures and percentages without altering the text", () => {
    const text = "Les ventes atteignent 333,6 k avec 99,8 % de service sur 26 semaines (S26, pré-2024).";
    const parts = splitNumbers(text);
    expect(parts.map((p) => p.text).join("")).toBe(text);
    const bold = parts.filter((p) => p.bold).map((p) => p.text);
    expect(bold).toEqual(["333,6 k", "99,8 %", "26"]);
  });

  it("maps the dashboard locale to an Intl locale, French by default", () => {
    expect(intlLocale("en")).toBe("en-US");
    expect(intlLocale("fr")).toBe("fr-FR");
    expect(intlLocale(null)).toBe("fr-FR");
    expect(intlLocale(undefined)).toBe("fr-FR");
    expect(intlLocale("de")).toBe("fr-FR");
  });

  it("keeps the French output when the locale is fr or null", () => {
    for (const locale of ["fr", null]) {
      expect(compact(381200, locale)).toBe("381,2 k");
      expect(signedCompact(-12000, locale)).toBe("−12 k");
      expect(formatByKind(1234567, "integer", locale)).toBe(formatByKind(1234567, "integer"));
      expect(formatByKind(0.973, "percent", locale)).toBe("97,3 %");
      expect(formatFull(8911, null, locale)).toBe(formatFull(8911));
      expect(tickByKind("percent", locale)(0.05)).toBe("5 %");
      expect(longDate("2025-12-22", locale)).toBe("22 déc. 2025");
      expect(xTick("2026-07", locale)).toBe(xTick("2026-07"));
    }
  });

  it("compacts numbers like the server in English", () => {
    expect(compact(15300, "en")).toBe("15.3k");
    expect(compact(2400000000, "en")).toBe("2.4B");
    expect(compact(1500000, "en")).toBe("1.5M");
    expect(compact(42, "en")).toBe("42");
    expect(signedCompact(15300, "en")).toBe("+15.3k");
    expect(signedCompact(-12000, "en")).toBe("−12k");
  });

  it("formats measures with English separators and units", () => {
    expect(formatByKind(0.969, "percent", "en")).toBe("96.9%");
    expect(formatByKind(1234567, "integer", "en")).toBe("1,234,567");
    expect(formatByKind(3.44, "decimal1", "en")).toBe("3.4");
    expect(formatByKind(3.44, "weeks", "en")).toBe("3.4 wk");
    expect(formatFull(8911, null, "en")).toBe("8,911");
    expect(formatFull(0.372, "percent", "en")).toBe("37.2%");
    expect(tickByKind("percent", "en")(0.05)).toBe("5%");
    expect(tickByKind(null, "en")(15300)).toBe("15.3k");
  });

  it("sets the percent sign by language", () => {
    expect(withPercent(42, "en")).toBe("42%");
    expect(withPercent(42, "fr")).toBe("42 %");
    expect(withPercent(42, null)).toBe("42 %");
  });

  it("formats dates in English", () => {
    expect(shortDate("2026-07-14", "en")).toBe("Jul 14");
    expect(longDate("2025-12-22", "en")).toBe("Dec 22, 2025");
    expect(xTick("2026-07", "en")).toBe("Jul 26");
  });

  it("bolds English figures with decimal points and B/k/M units", () => {
    const text = "Sales reach 333.6k with 99.8% service over 26 weeks, 1,234.5 units and 2.4B (W26, pre-2024).";
    const parts = splitNumbers(text, "en");
    expect(parts.map((p) => p.text).join("")).toBe(text);
    expect(parts.filter((p) => p.bold).map((p) => p.text)).toEqual(["333.6k", "99.8%", "26", "1,234.5", "2.4B"]);
  });
});
