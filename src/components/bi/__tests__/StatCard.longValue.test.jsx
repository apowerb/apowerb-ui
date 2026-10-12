import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StatCard from "../StatCard";

// "Semaine du 12/01/2026" at the big KPI size ran out of the tile.
describe("StatCard long values", () => {
  it("shrinks and wraps a long text value", () => {
    render(<StatCard value="Semaine du 12/01/2026" label="Pic prévu" />);
    const value = screen.getByText("Semaine du 12/01/2026");
    expect(value.className).toContain("text-xl");
    expect(value.className).toContain("break-words");
  });

  it("keeps the big size for a short value", () => {
    render(<StatCard value="4 / 5" label="Séries fiables" />);
    expect(screen.getByText("4 / 5").className).toContain("text-3xl");
  });
});
