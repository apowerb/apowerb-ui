"use client";

import ForecastChart from "@/components/bi/ForecastChart";

/**
 * Forecast block of a v2 dashboard: the engine runs on the rows of the
 * visual's source (date, value and group columns served by the core). Without
 * a chart id there is no real-value tracking, and nothing is saved from here.
 */
export default function ForecastVisual({ visual, result }) {
  return (
    <div className="h-full min-h-0 overflow-auto">
      <ForecastChart rows={result?.rows || []} config={visual.forecast || {}} title={visual.title} />
    </div>
  );
}
