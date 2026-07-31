import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import StatCard from "../StatCard";

// Ops dashboard: KPI cards must reuse the same colours as the charts —
// conforme green / non_conforme amber / non_rapproche grey.
describe("StatCard tone → colour (status alignment)", () => {
  it("success tone = emerald (conforme green)", () => {
    const { container } = render(<StatCard value={73} label="Conformes" tone="success" />);
    expect(container.querySelector(".text-emerald-400")).not.toBeNull();
  });

  it("warning tone = amber (non_conforme orange)", () => {
    const { container } = render(<StatCard value={24} label="Non conformes" tone="warning" />);
    expect(container.querySelector(".text-amber-400")).not.toBeNull();
  });

  it("muted tone = grey (non_rapproche grey)", () => {
    const { container } = render(<StatCard value={9} label="Non rapprochés" tone="muted" />);
    expect(container.querySelector(".text-gray-400")).not.toBeNull();
  });

  it("thresholds STILL override tone — why the status KPIs must drop them", () => {
    // value 24, lower_is_better, danger:20 → danger (red) regardless of tone.
    const { container } = render(
      <StatCard
        value={24}
        label="Non conformes"
        tone="warning"
        thresholds={{ danger: 20, warning: 5, direction: "lower_is_better" }}
      />
    );
    expect(container.querySelector(".text-red-400")).not.toBeNull();
    expect(container.querySelector(".text-amber-400")).toBeNull();
  });
});
