"use client";

import { useEffect, useRef } from "react";
import { useDashboardData } from "./DashboardDataContext";
import VisualFrame from "./VisualFrame";
import AreaVisual from "./visuals/AreaVisual";
import BarVisual from "./visuals/BarVisual";
import ComboChart from "./visuals/ComboChart";
import DivergingBar from "./visuals/DivergingBar";
import ForecastVisual from "./visuals/ForecastVisual";
import KpiTile from "./visuals/KpiTile";
import LineVisual from "./visuals/LineVisual";
import NoteBlock from "./visuals/NoteBlock";
import PieVisual from "./visuals/PieVisual";
import TableVisual from "./visuals/TableVisual";
import TextBlock from "./visuals/TextBlock";
import Waterfall from "./visuals/Waterfall";

/** Last-resort view of a type this UI does not know: the raw rows, as a table. */
function RawRows({ result }) {
  const rows = result?.rows || [];
  if (rows.length === 0) {
    return <div className="text-xs th-text-faint">—</div>;
  }
  const cols = Object.keys(rows[0]).filter((k) => !k.startsWith("_"));
  return (
    <div className="h-full overflow-auto" data-testid="v2-raw-rows">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b th-border">
            {cols.map((c) => (
              <th key={c} className="px-2 py-1 text-left font-semibold th-text-muted">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b th-border-secondary">
              {cols.map((c) => (
                <td key={c} className="bi-v2-num px-2 py-1 th-text-secondary">
                  {r[c] == null ? "—" : String(r[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const BODIES = {
  kpi: KpiTile,
  combo: ComboChart,
  bar: BarVisual,
  hbar: (props) => <BarVisual {...props} horizontal />,
  line: LineVisual,
  area: AreaVisual,
  pie: PieVisual,
  diverging_bar: DivergingBar,
  waterfall: Waterfall,
  forecast: ForecastVisual,
  table: TableVisual,
  text: TextBlock,
  note: NoteBlock,
};

/**
 * Reports the outer height a block needs (content + `extra` px of card chrome),
 * so text blocks and short tables fit their content instead of the spec height.
 */
function MeasuredBox({ id, extra = 0, scroll = false, children }) {
  const { reportHeight } = useDashboardData();
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !reportHeight || typeof ResizeObserver === "undefined") return undefined;
    const content = () => (scroll ? el.firstElementChild?.scrollHeight || 0 : el.offsetHeight);
    const report = () => reportHeight(id, content() + extra);
    const ro = new ResizeObserver(report);
    ro.observe(el);
    if (scroll && el.firstElementChild?.firstElementChild) ro.observe(el.firstElementChild.firstElementChild);
    report();
    return () => ro.disconnect();
  }, [id, extra, scroll, reportHeight]);
  return (
    <div ref={ref} className={scroll ? "h-full min-h-0" : undefined}>
      {children}
    </div>
  );
}

/**
 * Renders one `visual` component of a v2 dashboard from the shared data
 * response. Never throws: an unknown type shows its rows, a failed visual shows
 * its error, a visual not yet computed shows a skeleton.
 */
export default function VisualRenderer({ component }) {
  const { data, loading, error: requestError } = useDashboardData();
  const visual = component?.visual || {};
  const result = data?.components?.[component?.id];
  const type = visual.type || result?.type;
  const Body = BODIES[type] || RawRows;

  const error = result?.error || (!result && requestError ? requestError.message || String(requestError) : null);
  const waiting = !result && !error && (loading || !data);

  return (
    <VisualFrame
      title={visual.title}
      subtitle={visual.subtitle}
      meta={type === "note" ? null : result?.meta}
      loading={waiting}
      error={error}
      compact={type === "kpi"}
      dense={type === "text"}
    >
      {result ? (
        type === "text" ? (
          <MeasuredBox id={component.id} extra={10}>
            <Body visual={visual} result={result} />
          </MeasuredBox>
        ) : type === "table" ? (
          <MeasuredBox id={component.id} scroll extra={26 + 8 + (visual.title ? 22 : 0) + (visual.subtitle ? 16 : 0)}>
            <Body visual={visual} result={result} />
          </MeasuredBox>
        ) : (
          <Body visual={visual} result={result} />
        )
      ) : null}
    </VisualFrame>
  );
}
