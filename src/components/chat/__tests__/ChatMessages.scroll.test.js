import { describe, it, expect } from "vitest";
import { isNearBottom } from "../ChatMessages";

// Pure decision used by the smart auto-scroll: follow the conversation only
// when the viewport is within `threshold` px of the bottom.
describe("isNearBottom", () => {
  it("is true within the threshold of the bottom", () => {
    expect(isNearBottom({ scrollHeight: 1000, scrollTop: 880, clientHeight: 120 })).toBe(true);
  });
  it("is true exactly at the threshold boundary", () => {
    expect(isNearBottom({ scrollHeight: 1000, scrollTop: 760, clientHeight: 120 })).toBe(true);
  });
  it("is false when scrolled up beyond the threshold", () => {
    expect(isNearBottom({ scrollHeight: 1000, scrollTop: 200, clientHeight: 120 })).toBe(false);
  });
  it("respects a custom threshold", () => {
    const m = { scrollHeight: 1000, scrollTop: 700, clientHeight: 120 }; // gap = 180
    expect(isNearBottom(m, 200)).toBe(true);
    expect(isNearBottom(m)).toBe(false);
  });
  it("defaults to true for a null element", () => {
    expect(isNearBottom(null)).toBe(true);
  });
});
