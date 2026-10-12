import { describe, it, expect } from "vitest";
import { compactFr, resolveColor, shortDate, signedCompactFr, splitNumbers, formatByKind } from "../format";

describe("format helpers", () => {
  it("compacts numbers in French (k, M)", () => {
    expect(compactFr(381200)).toBe("381,2 k");
    expect(compactFr(1500000)).toBe("1,5 M");
    expect(compactFr(42)).toBe("42");
    expect(signedCompactFr(381200)).toBe("+381,2 k");
    expect(signedCompactFr(-12000)).toBe("−12 k");
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
});
