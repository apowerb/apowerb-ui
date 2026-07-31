"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "use-intl";
import {
  Shield,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Search,
  Filter,
  Clock,
  Bot,
  Eye,
  RefreshCw,
} from "lucide-react";
import { listAllSessions, getSessionTrace } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import TraceTimeline from "./supervision/TraceTimeline";
import { formatDateTime } from "@/lib/datetime";

const SESSIONS_PER_PAGE = 10;

export default function SupervisionDashboard({ initialSearch = "" }) {
  const t = useTranslations("SupervisionDashboard");
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterAgent, setFilterAgent] = useState("");
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [expandedSessionId, setExpandedSessionId] = useState(null);
  const [traceData, setTraceData] = useState(null);
  const [loadingTrace, setLoadingTrace] = useState(false);
  const [page, setPage] = useState(0);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listAllSessions();
      setSessions(data?.sessions || []);
    } catch (err) {
      console.error("[Supervision] Failed to fetch sessions:", err);
      setError(err.message);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const distinctAgents = [
    ...new Set(sessions.map((s) => s.agent_name).filter(Boolean)),
  ].sort();

  const filteredSessions = sessions.filter((s) => {
    if (filterAgent && s.agent_name !== filterAgent) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchId = s.id?.toLowerCase().includes(term);
      const matchAgent = s.agent_name?.toLowerCase().includes(term);
      const matchFolder = s.agent_folder?.toLowerCase().includes(term);
      if (!matchId && !matchAgent && !matchFolder) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredSessions.length / SESSIONS_PER_PAGE);
  const paginatedSessions = filteredSessions.slice(
    page * SESSIONS_PER_PAGE,
    (page + 1) * SESSIONS_PER_PAGE
  );

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [filterAgent, searchTerm]);

  const handleInspect = useCallback(
    async (session) => {
      if (expandedSessionId === session.id) {
        setExpandedSessionId(null);
        setTraceData(null);
        return;
      }

      setExpandedSessionId(session.id);
      setTraceData(null);
      setLoadingTrace(true);

      try {
        const agentName = session.agent_name || session.app_name;
        const userId = session.user_id || user?.email || "user";
        const trace = await getSessionTrace(agentName, userId, session.id);
        setTraceData(trace);
      } catch (err) {
        console.error("[Supervision] Failed to fetch trace:", err);
        setTraceData({ error: err.message });
      } finally {
        setLoadingTrace(false);
      }
    },
    [expandedSessionId, user]
  );

  const formatDate = (ts) => {
    if (!ts) return "-";
    // ADK timestamps are unix seconds (float); normalise to ms before passing to helper
    const value = typeof ts === "number" ? (ts > 1e12 ? ts : ts * 1000) : ts;
    return formatDateTime(value);
  };

  const truncateId = (id) => {
    if (!id) return "-";
    if (id.length <= 16) return id;
    return id.slice(0, 8) + "..." + id.slice(-6);
  };

  return (
    <div className="h-full flex flex-col th-bg-body overflow-hidden">
      {/* Header */}
      <header className="shrink-0 p-6 bg-linear-to-r from-brand/20 to-brand-secondary/20 border-b th-border backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-linear-to-br from-brand to-brand-secondary rounded-2xl shadow-lg">
            <Shield size={32} className="text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-black th-text tracking-tight">
              {t("pageTitle")}
            </h1>
            <p className="th-text-secondary text-sm font-medium mt-1">
              {t("pageSubtitle")}
            </p>
          </div>
          <button
            onClick={fetchSessions}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 th-bg-surface hover:th-bg-surface-hover th-text-secondary hover:th-text rounded-xl border th-border text-sm font-semibold transition-all disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            {t("refreshLabel")}
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-50 max-w-sm">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 th-text-ghost"
              />
              <input
                type="text"
                placeholder={t("searchPlaceholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 th-bg-surface border th-border rounded-xl text-sm th-text placeholder-th-text-ghost focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/30 transition-all"
              />
            </div>

            {/* Agent Filter */}
            <div className="relative">
              <Filter
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 th-text-ghost"
              />
              <select
                value={filterAgent}
                onChange={(e) => setFilterAgent(e.target.value)}
                className="appearance-none pl-8 pr-8 py-2 th-bg-surface border th-border rounded-xl text-sm th-text-secondary focus:outline-none focus:border-brand/50 transition-all cursor-pointer"
              >
                <option value="" className="th-bg-elevated">
                  {t("allAgentsOption")}
                </option>
                {distinctAgents.map((name) => (
                  <option key={name} value={name} className="th-bg-elevated">
                    {name}
                  </option>
                ))}
              </select>
            </div>

            {/* Count */}
            <span className="text-xs th-text-ghost ml-auto">
              {t("sessionsCount", { count: filteredSessions.length })}
            </span>
          </div>

          {/* Error state */}
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              {t("failedLoadSessions", { error })}
            </div>
          )}

          {/* Loading state */}
          {loading ? (
            <div className="glass-card p-12 rounded-2xl text-center border border-dashed th-border">
              <Loader2
                size={48}
                className="mx-auto mb-4 text-brand animate-spin"
              />
              <h3 className="text-xl font-bold th-text mb-2">
                {t("loadingSessionsTitle")}
              </h3>
              <p className="th-text-secondary text-sm">
                {t("fetchingSessionsText")}
              </p>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="glass-card p-12 rounded-2xl text-center border border-dashed th-border">
              <Bot size={48} className="mx-auto mb-4 th-text-ghost" />
              <h3 className="text-xl font-bold th-text mb-2">
                {t("noSessionsFoundTitle")}
              </h3>
              <p className="th-text-secondary text-sm">
                {sessions.length === 0
                  ? t("runAgentsHint")
                  : t("noMatchFiltersHint")}
              </p>
            </div>
          ) : (
            <div className="glass-card rounded-xl border th-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b th-border th-bg-surface">
                      <th className="text-left p-3 th-text-secondary font-semibold">
                        {t("sessionIdHeader")}
                      </th>
                      <th className="text-left p-3 th-text-secondary font-semibold">
                        {t("agentHeader")}
                      </th>
                      <th className="text-left p-3 th-text-secondary font-semibold">
                        {t("userHeader")}
                      </th>
                      <th className="text-left p-3 th-text-secondary font-semibold">
                        {t("createdHeader")}
                      </th>
                      <th className="text-left p-3 th-text-secondary font-semibold">
                        {t("lastUpdatedHeader")}
                      </th>
                      <th className="text-left p-3 th-text-secondary font-semibold">
                        {t("actionsHeader")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedSessions.map((session) => (
                      <SessionRow
                        key={`${session.app_name}-${session.id}`}
                        session={session}
                        isExpanded={expandedSessionId === session.id}
                        traceData={
                          expandedSessionId === session.id ? traceData : null
                        }
                        loadingTrace={
                          expandedSessionId === session.id && loadingTrace
                        }
                        onInspect={handleInspect}
                        formatDate={formatDate}
                        truncateId={truncateId}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {filteredSessions.length > SESSIONS_PER_PAGE && (
                <div className="flex items-center justify-between px-4 py-3 border-t th-border">
                  <span className="text-xs th-text-ghost">
                    {t("paginationRange", {
                      start: page * SESSIONS_PER_PAGE + 1,
                      end: Math.min(
                        (page + 1) * SESSIONS_PER_PAGE,
                        filteredSessions.length
                      ),
                      total: filteredSessions.length,
                    })}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="p-1.5 rounded-lg th-text-muted hover:th-text hover:th-bg-surface-hover transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      // Show pages around current page
                      let pageNum;
                      if (totalPages <= 7) {
                        pageNum = i;
                      } else if (page < 4) {
                        pageNum = i;
                      } else if (page > totalPages - 5) {
                        pageNum = totalPages - 7 + i;
                      } else {
                        pageNum = page - 3 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPage(pageNum)}
                          className={`min-w-7 h-7 rounded-lg text-xs font-semibold transition-colors ${
                            pageNum === page
                              ? "bg-brand/30 text-brand border border-brand/30"
                              : "th-text-muted hover:th-text hover:th-bg-surface-hover"
                          }`}
                        >
                          {pageNum + 1}
                        </button>
                      );
                    })}
                    <button
                      onClick={() =>
                        setPage((p) => Math.min(totalPages - 1, p + 1))
                      }
                      disabled={page >= totalPages - 1}
                      className="p-1.5 rounded-lg th-text-muted hover:th-text hover:th-bg-surface-hover transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SessionRow({
  session,
  isExpanded,
  traceData,
  loadingTrace,
  onInspect,
  formatDate,
  truncateId,
}) {
  const t = useTranslations("SupervisionDashboard");
  return (
    <>
      <tr
        className="border-b border-transparent hover:th-bg-surface transition-colors cursor-pointer"
        onClick={() => onInspect(session)}
      >
        <td className="p-3 th-text-secondary font-mono text-xs">
          <span className="inline-flex items-center gap-1.5">
            {isExpanded ? (
              <ChevronDown size={12} className="th-text-ghost" />
            ) : (
              <ChevronRight size={12} className="th-text-ghost" />
            )}
            <span title={session.id}>{truncateId(session.id)}</span>
          </span>
        </td>
        <td className="p-3 th-text-secondary text-xs truncate max-w-37.5">
          <span
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-brand/10 text-brand border border-brand/20"
            title={`${session.agent_name} (${session.agent_folder})`}
          >
            <Bot size={10} />
            {session.agent_name || session.app_name || "-"}
          </span>
        </td>
        <td className="p-3 th-text-muted text-xs truncate max-w-37.5">
          {session.user_id || "-"}
        </td>
        <td className="p-3 th-text-muted text-xs">
          <span className="inline-flex items-center gap-1">
            <Clock size={10} className="th-text-ghost" />
            {formatDate(session.create_time)}
          </span>
        </td>
        <td className="p-3 th-text-muted text-xs">
          <span className="inline-flex items-center gap-1">
            <Clock size={10} className="th-text-ghost" />
            {formatDate(session.update_time)}
          </span>
        </td>
        <td className="p-3" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onInspect(session)}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
              isExpanded
                ? "bg-brand/20 text-brand border-brand/30"
                : "th-bg-surface hover:th-bg-surface-hover th-text-ghost hover:th-text-secondary th-border"
            }`}
            title={t("inspectTraceTooltip")}
          >
            <Eye size={12} />
            {t("inspectButtonLabel")}
          </button>
        </td>
      </tr>

      {isExpanded && (
        <tr>
          <td colSpan={6} className="p-0">
            <div className="th-bg-surface border-b th-border">
              {loadingTrace ? (
                <div className="flex items-center gap-2 th-text-muted text-xs p-4">
                  <Loader2 size={14} className="animate-spin" />
                  {t("loadingTraceDataText")}
                </div>
              ) : traceData?.error ? (
                <div className="p-4 text-red-400/80 text-xs">
                  {t("failedLoadTrace", { error: traceData.error })}
                </div>
              ) : traceData ? (
                <TraceTimeline trace={traceData} />
              ) : (
                <div className="p-4 th-text-ghost text-xs">
                  {t("noTraceDataText")}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
