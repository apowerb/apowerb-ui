import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import VisualFrame from "../VisualFrame";

const meta = { source: "stock", measures: [], filters_applied: {}, ignored_filters: [], row_count: 1, provenance: [] };

describe("VisualFrame source icon", () => {
  it("is hidden until hover or focus of the card, yet stays keyboard reachable", () => {
    render(
      <VisualFrame title="Stock" meta={meta}>
        <div>body</div>
      </VisualFrame>,
    );
    const wrapper = screen.getByTestId("v2-source-trigger");
    const cls = wrapper.className;
    expect(cls).toContain("opacity-0");
    expect(cls).toContain("group-hover/frame:opacity-100");
    expect(cls).toContain("group-focus-within/frame:opacity-100");
    expect(cls).toContain("focus-within:opacity-100");
    // opacity, not display/visibility: the button remains focusable
    expect(cls).not.toMatch(/\b(hidden|invisible)\b/);
    const button = wrapper.querySelector("button");
    expect(button).not.toBeNull();
    button.focus();
    expect(document.activeElement).toBe(button);
  });

  it("truncates a compact title to one line and keeps the full text in title", () => {
    render(
      <VisualFrame title="Un libellé de KPI vraiment trop long pour la carte" compact>
        <div>body</div>
      </VisualFrame>,
    );
    const h = screen.getByRole("heading");
    expect(h.className).toContain("truncate");
    expect(h).toHaveAttribute("title", "Un libellé de KPI vraiment trop long pour la carte");
  });
});
