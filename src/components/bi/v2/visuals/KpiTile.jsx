"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { resolveColor } from "../format";

/**
 * KPI: the value takes the colour of its status (good / warn / bad), the rest
 * stays quiet. The server sends display strings; nothing is recomputed here.
 */
// "981 unités" -> ["981", "unités"]; "19,1 k unités" -> ["19,1 k", "unités"]; "100,0 %" stays whole.
export function splitUnit(formatted) {
  const m = /^([+\u2212-]?[\d\s\u00a0\u202f,.]*\d(?:[\u00a0 ]?(?:k|M|%))?)[\s\u00a0]+(?![kM](?:\s|$))([A-Za-z\u00c0-\u00ff].*)$/.exec(String(formatted ?? ""));
  return m ? [m[1], m[2]] : [String(formatted ?? ""), ""];
}

export default function KpiTile({ result }) {
  const kpi = result?.value;
  if (!kpi) return null;
  const color = kpi.status ? resolveColor(kpi.status) : "var(--text-primary)";
  const delta = kpi.delta;
  const DeltaIcon = delta == null || delta === 0 ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="flex h-full min-h-0 flex-col justify-center gap-1" data-testid="kpi-tile">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <span
          data-testid="kpi-value"
          data-status={kpi.status || "none"}
          className="bi-v2-num flex max-w-full flex-wrap items-baseline gap-x-1.5 text-[clamp(1.1rem,13cqw,1.7rem)] font-bold leading-none tracking-tight"
          style={{ color }}
        >
          <span className="whitespace-nowrap">{splitUnit(kpi.formatted)[0]}</span>
          {splitUnit(kpi.formatted)[1] && (
            <span className="text-[clamp(0.7rem,4.5cqw,0.875rem)] font-medium opacity-80">{splitUnit(kpi.formatted)[1]}</span>
          )}
        </span>
        {kpi.delta_formatted && (
          <span
            className="bi-v2-num inline-flex items-center gap-0.5 text-xs font-medium th-text-muted"
          >
            <DeltaIcon size={12} aria-hidden="true" />
            {kpi.delta_formatted}
          </span>
        )}
      </div>
      {(kpi.secondary || kpi.target_label) && (
        <div className="flex flex-wrap items-center gap-x-2 text-[11px] leading-snug th-text-faint">
          {kpi.secondary && <span className="bi-v2-num">{kpi.secondary}</span>}
          {kpi.secondary && kpi.target_label && <span aria-hidden="true">·</span>}
          {kpi.target_label && <span>{kpi.target_label}</span>}
        </div>
      )}
    </div>
  );
}
