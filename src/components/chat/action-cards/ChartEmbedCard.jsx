"use client";

import { useEffect, useState } from "react";
import { BarChart3, ExternalLink, LayoutDashboard, Loader2 } from "lucide-react";
import { STATUS_STYLES } from "./statusStyles";
import ChartRenderer from "@/components/bi/ChartRenderer";
import { getChart, sendChartToDashboard } from "@/lib/api";
import { useActiveSessionId } from "@/contexts/ChatContext";

const LOCAL_STATUS_STYLES = {
  ...STATUS_STYLES,
  pending: "border-cyan-500/30 bg-cyan-500/5",
};

export default function ChartEmbedCard({ card }) {
  // Charts are NOT auto-added to a dashboard — the user decides. So the card
  // shows a "Send to dashboard" button; once sent, it turns into an
  // "Open dashboard" link to the dashboard that now holds the chart.
  const [dashboardId, setDashboardId] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  // The action card only carries the tool-call ARGS (chart_id, and a title only
  // if the agent passed one), never the chart's stored title. Fetch the real
  // title by chart_id so the card shows the content (e.g. "Colis par
  // département") instead of the generic "Graphique" fallback.
  const [fetchedTitle, setFetchedTitle] = useState(null);
  // Scope the send to THIS conversation's dashboard (null outside a chat).
  const sessionId = useActiveSessionId();
  const chartId = card?.data?.chart_id;

  useEffect(() => {
    if (!chartId) return;
    let cancelled = false;
    getChart(chartId)
      .then((c) => {
        if (!cancelled && c?.title) setFetchedTitle(c.title);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [chartId]);

  if (!card) return null;
  const { data = {}, status } = card;
  const label = data.title || fetchedTitle || "Graphique";
  const border = LOCAL_STATUS_STYLES[status] || LOCAL_STATUS_STYLES.pending;

  const handleSend = async () => {
    if (!chartId || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await sendChartToDashboard(chartId, sessionId);
      if (res?.dashboard_id) {
        setDashboardId(res.dashboard_id);
      } else {
        setError("Failed to send");
      }
    } catch (e) {
      setError("Failed to send");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      role="group"
      aria-label={card.ariaLabel || `Chart embed: ${label}`}
      className={`my-3 rounded-xl border overflow-hidden ${border}`}
    >
      <div className="flex items-center gap-3 px-3 py-2.5 border-b th-border-secondary">
        <span className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30">
          <BarChart3 size={16} className="text-cyan-300" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold th-text truncate">{label}</p>
          {error && <p className="text-[11px] text-red-400">{error}</p>}
        </div>
        {dashboardId ? (
          <a
            href={`/bi/${dashboardId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-300 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-cyan-500"
          >
            <ExternalLink size={12} />
            Open dashboard
          </a>
        ) : (
          <button
            type="button"
            onClick={handleSend}
            disabled={!chartId || sending}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-300 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-cyan-500 ${
              !chartId || sending ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            {sending ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <LayoutDashboard size={12} />
            )}
            {sending ? "Adding…" : "Add to dashboard"}
          </button>
        )}
      </div>
      <div className="th-bg-surface">
        {chartId ? (
          <div className="h-72 w-full px-2 py-2">
            <ChartRenderer chartId={chartId} />
          </div>
        ) : (
          <p className="px-3 py-6 text-center text-[11px] text-red-400 italic">
            Chart unavailable — missing chart id.
          </p>
        )}
      </div>
    </div>
  );
}
