import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StatCard from "../StatCard";

// The forecast dashboard showed "3,9 %" as the value and "3.9%" as the trend
// right below it: the value went through the locale, the trend did not.
const local = (n) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

describe("StatCard number formatting", () => {
  it("formats the trend value like the main value", () => {
    render(
      <StatCard
        value={1234.5}
        label="Écart"
        trend={{ direction: "up", sentiment: "neutral", value: 1234.5, is_percentage: true }}
      />
    );
    expect(screen.getByText(`${local(1234.5)}%`)).toBeInTheDocument();
  });

  it("keeps an explicit plus sign on a signed value", () => {
    render(<StatCard value="+3.9" unit="%" label="Écart vs même période N-1" />);
    expect(screen.getByText(`+${local(3.9)}`)).toBeInTheDocument();
  });
});
