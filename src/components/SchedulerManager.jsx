"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "use-intl";
import {
  Calendar,
  Play,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Users,
  Zap,
  StopCircle,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  FileText,
  RotateCw,
  Eye,
  Search,
  ArrowUpDown,
  Activity,
  Hash,
  Bot,
  Wrench,
  Database,
  Shield,
  Mail,
  Copy,
  Check,
} from "lucide-react";
import ScheduleRunModal from "./ScheduleRunModal";
import {
  listAgents,
  listPipelineSchedules,
  listScheduleRuns,
  scheduleAgentRun,
  updatePipelineSchedule,
  cancelPipelineRun,
  getPipelineRun,
  getPipelineRunLogs,
  runAgentNow,
} from "@/lib/api";
import { useToast } from "./Toast";
import EmptyState from "./EmptyState";
import { SkeletonList } from "./Skeleton";
import { formatDateTime, formatDate as formatDateParis, toDate } from "@/lib/datetime";

const POLL_INTERVAL_MS = 3000;

const STATUS_CONFIG = {
  initial: { icon: Clock, color: "text-gray-400", bg: "bg-gray-500/20", labelKey: "statusInitial" },
  running: { icon: Loader2, color: "text-purple-400", bg: "bg-purple-500/20", labelKey: "statusRunning", animate: true },
  completed: { icon: CheckCircle2, color: "text-blue-400", bg: "bg-blue-500/20", labelKey: "statusCompleted" },
  failed: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/20", labelKey: "statusFailed" },
  cancelled: { icon: AlertCircle, color: "text-gray-400", bg: "bg-gray-500/20", labelKey: "statusCancelled" },
};

// Colour per log level for the per-run execution log panel.
const LOG_LEVEL_COLOR = {
  CRITICAL: "text-red-400",
  ERROR: "text-red-400",
  WARNING: "text-amber-400",
  INFO: "text-blue-400",
  DEBUG: "text-gray-400",
};

// Small clipboard button: copies a string or (pretty-printed) object, and
// briefly flips to a check. Used on the run Input/Output panels.
function CopyButton({ value, title }) {
  const t = useTranslations("SchedulerManager");
  const resolvedTitle = title ?? t("copy");
  const [copied, setCopied] = useState(false);
  const handleCopy = async (e) => {
    e.stopPropagation();
    const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable (insecure context) — no-op */
    }
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      title={resolvedTitle}
      className="th-text-muted hover:th-text transition-colors shrink-0"
    >
      {copied ? <Check size={12} className="text-blue-400" /> : <Copy size={12} />}
    </button>
  );
}

const FILTER_OPTIONS = [
  { key: "all", labelKey: "filterAll" },
  { key: "active", labelKey: "filterScheduled" },
  { key: "no_trigger", labelKey: "filterNoSchedule" },
];

const TABS = [
  { key: "agents", labelKey: "tabAgents", icon: Users },
  { key: "schedules", labelKey: "tabSchedules", icon: Calendar },
  { key: "runs", labelKey: "tabRuns", icon: Clock },
];

const TYPE_BADGES = {
  base: { color: "text-blue-400", bg: "bg-blue-500/15", border: "border-blue-500/25" },
  sequential: { color: "text-purple-400", bg: "bg-purple-500/15", border: "border-purple-500/25" },
  parallel: { color: "text-blue-400", bg: "bg-blue-500/15", border: "border-blue-500/25" },
  loop: { color: "text-purple-400", bg: "bg-purple-500/15", border: "border-purple-500/25" },
  router: { color: "text-purple-400", bg: "bg-purple-500/15", border: "border-purple-500/25" },
};

function timeAgo(dateStr, t) {
  if (!dateStr) return "-";
  // toDate() normalises naive backend timestamps (no offset) as UTC — a raw
  // `new Date(dateStr)` would read them as browser-local time, throwing the
  // "Xm/Xh ago" off by the Europe/Paris UTC offset.
  const date = toDate(dateStr);
  if (!date) return "-";
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return t("justNow");
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return t("minutesAgo", { count: diffMin });
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return t("hoursAgo", { count: diffH });
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return t("daysAgo", { count: diffD });
  return formatDateParis(dateStr);
}

function StatusBadge({ status }) {
  const t = useTranslations("SchedulerManager");
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.initial;
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.color}`}>
      <Icon size={12} className={config.animate ? "animate-spin" : ""} />
      {t(config.labelKey)}
    </span>
  );
}

function StatsBar({ stats }) {
  const t = useTranslations("SchedulerManager");
  const cards = [
    { label: t("totalAgents"), value: stats.totalAgents, icon: Hash, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
    { label: t("activeSchedules"), value: stats.activeSchedules, icon: Zap, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
    { label: t("runningNow"), value: stats.runningNow, icon: Activity, color: "text-purple-400", bg: "bg-purple-400/10", border: "border-purple-400/20" },
    { label: t("completedToday"), value: stats.completedToday, icon: CheckCircle2, color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/20" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className={`${card.bg} ${card.border} border rounded-xl p-4 flex items-center gap-3`}>
            <div className={`p-2 rounded-lg ${card.bg}`}>
              <Icon size={20} className={card.color} />
            </div>
            <div>
              <p className="text-2xl font-black th-text">{card.value}</p>
              <p className="text-xs th-text-muted">{card.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SortableHeader({ label, sortKey, currentSortKey, ascending, onSort }) {
  const isActive = sortKey === currentSortKey;
  return (
    <th
      className="text-left p-3 th-text-secondary font-semibold cursor-pointer hover:th-text transition-colors select-none"
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown size={12} className={isActive ? "text-blue-400" : "th-text-ghost"} />
      </span>
    </th>
  );
}

function AgentTableRow({ agent, expanded, onToggle, onRunNow, onSchedule, runCount }) {
  const t = useTranslations("SchedulerManager");
  const hasActiveSchedule = agent.schedule && agent.schedule.status === "active";
  return (
    <tr
      className={`border-b th-border transition-colors cursor-pointer ${
        expanded ? "bg-blue-500/6 border-blue-500/20" : "hover:th-bg-surface"
      }`}
      onClick={onToggle}
    >
      <td className="p-3">
        <div className="flex items-center gap-2">
          <div className={`shrink-0 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}>
            <ChevronRight size={14} className="th-text-muted" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="th-text text-sm font-medium truncate max-w-45" title={agent.agent_name}>
                {agent.agent_name}
              </span>
              {runCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-blue-500/20 text-blue-400 font-bold tabular-nums">
                  {runCount}
                </span>
              )}
            </div>
            {agent.agent_description && (
              <span className="th-text-muted text-xs truncate block max-w-50" title={agent.agent_description}>
                {agent.agent_description}
              </span>
            )}
          </div>
        </div>
      </td>
      <td className="p-3 th-text-secondary font-mono text-xs">
        {agent.agent_id}
      </td>
      <td className="p-3 th-text-muted text-xs truncate max-w-37.5" title={agent.agent_model}>
        {agent.agent_model || t("defaultModel")}
      </td>
      <td className="p-3">
        {agent.schedule ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400">
            <Calendar size={10} />
            {agent.schedule.schedule_interval || t("statusActive")}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-500/20 text-gray-400">
            {t("filterNoSchedule")}
          </span>
        )}
      </td>
      <td className="p-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onRunNow(agent)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 border border-blue-500/20 transition-all"
          >
            <Play size={12} />
            {t("runNow")}
          </button>
          {!hasActiveSchedule && (
            <button
              onClick={() => onSchedule(agent)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 border border-blue-500/20 transition-all"
            >
              <Calendar size={12} />
              {t("schedule")}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function parseSubAgents(subs) {
  if (Array.isArray(subs)) return subs;
  if (typeof subs === "string" && subs.startsWith("[")) {
    try { return JSON.parse(subs.replace(/'/g, '"')); } catch { return []; }
  }
  return [];
}

export default function SchedulerManager() {
  const t = useTranslations("SchedulerManager");
  const toast = useToast();
  const [agents, setAgents] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [recentRuns, setRecentRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [preselectedAgent, setPreselectedAgent] = useState(null);
  const [cancellingRunId, setCancellingRunId] = useState(null);
  const [expandedRunId, setExpandedRunId] = useState(null);
  const [runDetails, setRunDetails] = useState(null);
  const [runLogs, setRunLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [loadingRunId, setLoadingRunId] = useState(null);
  const [runsPage, setRunsPage] = useState(0);
  const [prefilledMessage, setPrefilledMessage] = useState("");
  const [runNowMode, setRunNowMode] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== "undefined") {
      const h = window.location.hash.replace("#", "");
      return TABS.some((tab) => tab.key === h) ? h : "agents";
    }
    return "agents";
  });
  const AGENTS_PER_PAGE = 10;
  const RUNS_PER_PAGE = 10;
  const pollRef = useRef(null);

  // Agent search, filter, sort
  const [agentSearch, setAgentSearch] = useState("");
  const [agentFilter, setAgentFilter] = useState("all");
  const [agentsPage, setAgentsPage] = useState(0);
  const [agentSortKey, setAgentSortKey] = useState("name");
  const [agentSortAsc, setAgentSortAsc] = useState(true);
  const [expandedAgentId, setExpandedAgentId] = useState(null);

  // Schedules tab: expanded schedule
  const [expandedScheduleId, setExpandedScheduleId] = useState(null);

  const hasActiveRuns = useCallback(
    () => recentRuns.some((r) => r.status === "initial" || r.status === "running"),
    [recentRuns]
  );

  const fetchRuns = useCallback(async (schedulesList) => {
    if (!schedulesList || schedulesList.length === 0) return;
    try {
      const allRunArrays = await Promise.all(
        schedulesList.map((s) =>
          listScheduleRuns("agents", s.id)
            .then((runs) => runs.map((r) => ({ ...r, _scheduleName: s.name, _scheduleId: s.id })))
            .catch(() => [])
        )
      );
      const runMap = new Map();
      allRunArrays.flat().forEach((run) => {
        if (!runMap.has(run.id)) runMap.set(run.id, run);
      });
      const allRuns = Array.from(runMap.values())
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 50);
      setRecentRuns(allRuns);
    } catch {
      // Silently fail on poll errors
    }
  }, []);

  // Auto-poll when there are active runs
  useEffect(() => {
    if (!hasActiveRuns() || schedules.length === 0) {
      if (pollRef.current) {
        clearTimeout(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    const poll = () => {
      pollRef.current = setTimeout(async () => {
        await fetchRuns(schedules);
        poll();
      }, POLL_INTERVAL_MS);
    };

    poll();

    return () => {
      if (pollRef.current) {
        clearTimeout(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [hasActiveRuns, schedules, fetchRuns]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [agentsList, schedulesList] = await Promise.all([
        listAgents(),
        listPipelineSchedules("agents").catch(() => []),
      ]);
      const normalizedAgents = Array.isArray(agentsList) ? agentsList : [];
      setAgents(normalizedAgents);
      const normalizedSchedules = Array.isArray(schedulesList) ? schedulesList : [];
      setSchedules(normalizedSchedules);

      await fetchRuns(normalizedSchedules);
    } catch (err) {
      console.error("Failed to fetch scheduler data:", err);
      toast.error(t("loadSchedulerDataFailed", { message: err.message }));
    } finally {
      setLoading(false);
    }
  }, [fetchRuns, toast, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Silent refresh (no loading spinner) — used after mutations
  const refreshData = async () => {
    try {
      const [agentsList, schedulesList] = await Promise.all([
        listAgents(),
        listPipelineSchedules("agents").catch(() => []),
      ]);
      const normalizedAgents = Array.isArray(agentsList) ? agentsList : [];
      setAgents(normalizedAgents);
      const normalizedSchedules = Array.isArray(schedulesList) ? schedulesList : [];
      setSchedules(normalizedSchedules);
      await fetchRuns(normalizedSchedules);
    } catch {
      // Silent — don't toast on background refresh
    }
  };

  const handleScheduleRun = async (data) => {
    try {
      const result = await scheduleAgentRun(data);
      if (result.trigger_created) {
        toast.success(t("scheduleCreated", { agentId: data.agent_id, interval: result.schedule_interval }));
      } else {
        toast.success(t("scheduleUpdated", { agentId: data.agent_id, interval: result.schedule_interval }));
      }
      await refreshData();
      return result;
    } catch (err) {
      toast.error(t("scheduleRunFailed", { message: err.message }));
      throw err;
    }
  };

  const handleRunNow = async (data) => {
    try {
      const result = await runAgentNow({
        agent_id: data.agent_id,
        user_id: data.user_id,
        message: data.new_message?.parts?.[0]?.text || "Run agent",
      });
      toast.success(t("agentTriggered", { agentName: data.agent_name, runId: result.run_id }));
      await refreshData();
      return result;
    } catch (err) {
      toast.error(t("runAgentFailed", { message: err.message }));
      throw err;
    }
  };

  const handleToggleScheduleStatus = async (schedule) => {
    const newStatus = schedule.status === "active" ? "inactive" : "active";
    try {
      await updatePipelineSchedule("agents", schedule.id, { status: newStatus });
      const name = resolveAgentName(schedule.name);
      if (newStatus === "active") {
        toast.success(t("scheduleActivatedFor", { name }));
      } else {
        toast.success(t("scheduleStoppedFor", { name }));
      }
      await refreshData();
    } catch (err) {
      toast.error(t("updateScheduleFailed", { message: err.message }));
    }
  };

  const handleCancelRun = async (runId) => {
    setCancellingRunId(runId);
    try {
      await cancelPipelineRun(runId);
      toast.success(t("runCancelled", { runId }));
      await fetchRuns(schedules);
    } catch (err) {
      toast.error(t("cancelRunFailed", { message: err.message }));
    } finally {
      setCancellingRunId(null);
    }
  };

  const handleRetryRun = async (run) => {
    const agentName = resolveAgentName(run._scheduleName);
    const agent = agents.find(
      (a) => a.agent_name === agentName || String(a.agent_id) === run._scheduleName,
    );
    if (agent) {
      setPreselectedAgent(agent);
    } else {
      setPreselectedAgent({ agent_name: agentName || run._scheduleName });
    }
    try {
      const details = await getPipelineRun(run.id);
      const msg = details?.variables?.message || "";
      setPrefilledMessage(msg);
    } catch {
      setPrefilledMessage("");
    }
    setRunNowMode(false);
    setShowModal(true);
  };

  const handleToggleRunDetails = async (runId) => {
    if (expandedRunId === runId) {
      setExpandedRunId(null);
      setRunDetails(null);
      setRunLogs([]);
      return;
    }
    setExpandedRunId(runId);
    setLoadingRunId(runId);
    setLoadingLogs(true);
    setRunLogs([]);
    try {
      // Details and the structured execution log load together; a run with no
      // log (e.g. under Mage, or a run predating log capture) degrades to [].
      const [details, logs] = await Promise.all([
        getPipelineRun(runId),
        getPipelineRunLogs(runId).catch(() => []),
      ]);
      setRunDetails(details);
      setRunLogs(Array.isArray(logs) ? logs : []);
    } catch {
      setRunDetails(null);
    } finally {
      setLoadingRunId(null);
      setLoadingLogs(false);
    }
  };

  // Map agents to their schedule info
  const agentsWithSchedules = agents.map((agent) => {
    const schedule = schedules.find(
      (s) => s.name === agent.agent_name || s.name === String(agent.agent_id),
    );
    return { ...agent, schedule };
  });

  // Lookup: schedule name -> agent display name
  const resolveAgentName = useCallback(
    (scheduleName) => {
      if (!scheduleName) return null;
      const agent = agents.find(
        (a) => a.agent_name === scheduleName || String(a.agent_id) === scheduleName,
      );
      return agent ? agent.agent_name : scheduleName;
    },
    [agents],
  );

  // Get runs for a specific agent
  const getAgentRuns = useCallback(
    (agent) =>
      recentRuns.filter(
        (r) =>
          r._scheduleName === agent.agent_name ||
          r._scheduleName === String(agent.agent_id),
      ),
    [recentRuns],
  );

  // Get runs for a specific schedule
  const getScheduleRuns = useCallback(
    (schedule) =>
      recentRuns.filter((r) => r._scheduleId === schedule.id),
    [recentRuns],
  );

  // Agent filtering & sorting
  const filteredAgents = agentsWithSchedules.filter((agent) => {
    if (agentFilter === "active" && !agent.schedule) return false;
    if (agentFilter === "no_trigger" && agent.schedule) return false;
    if (agentSearch) {
      const term = agentSearch.toLowerCase();
      const matchName = agent.agent_name?.toLowerCase().includes(term);
      const matchId = String(agent.agent_id)?.toLowerCase().includes(term);
      const matchModel = agent.agent_model?.toLowerCase().includes(term);
      if (!matchName && !matchId && !matchModel) return false;
    }
    return true;
  });

  const sortedAgents = [...filteredAgents].sort((a, b) => {
    let cmp = 0;
    switch (agentSortKey) {
      case "name": cmp = (a.agent_name || "").localeCompare(b.agent_name || ""); break;
      case "id": cmp = String(a.agent_id).localeCompare(String(b.agent_id)); break;
      case "model": cmp = (a.agent_model || "").localeCompare(b.agent_model || ""); break;
      case "status": cmp = (a.schedule ? 0 : 1) - (b.schedule ? 0 : 1); break;
      default: cmp = 0;
    }
    return agentSortAsc ? cmp : -cmp;
  });

  // Reset page when search/filter changes
  useEffect(() => { setAgentsPage(0); }, [agentSearch, agentFilter]);

  const totalAgentPages = Math.ceil(sortedAgents.length / AGENTS_PER_PAGE);
  const paginatedAgents = sortedAgents.slice(agentsPage * AGENTS_PER_PAGE, (agentsPage + 1) * AGENTS_PER_PAGE);

  const handleAgentSort = (key) => {
    if (agentSortKey === key) {
      setAgentSortAsc(!agentSortAsc);
    } else {
      setAgentSortKey(key);
      setAgentSortAsc(true);
    }
    setAgentsPage(0);
  };

  // Stats
  const activeSchedulesCount = schedules.filter((s) => s.status === "active").length;
  const runningCount = recentRuns.filter((r) => r.status === "running" || r.status === "initial").length;
  const stats = {
    totalAgents: agents.length,
    activeSchedules: activeSchedulesCount,
    runningNow: runningCount,
    completedToday: recentRuns.filter((r) => {
      if (r.status !== "completed" || !r.completed_at) return false;
      const today = new Date();
      const completed = new Date(r.completed_at);
      return completed.toDateString() === today.toDateString();
    }).length,
  };

  // Tab badge counts
  const tabBadges = {
    agents: agents.length,
    schedules: activeSchedulesCount,
    runs: runningCount,
  };

  // Render run details panel (reused in agent expansion, schedules expansion, and global runs)
  const renderRunDetails = () => {
    if (!runDetails) return <p className="th-text-muted text-xs">{t("noDetailsAvailable")}</p>;
    // Secrets stay redacted in both the rendered panel and the copied text.
    const redactedVars = runDetails.variables
      ? Object.fromEntries(
          Object.entries(runDetails.variables).map(([k, v]) =>
            /token|secret|password|key|jwt/i.test(k) ? [k, "***"] : [k, v]
          )
        )
      : {};
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="th-text-muted">{t("pipelineLabel")}</span>
            <p className="th-text font-mono">{runDetails.pipeline_uuid || "-"}</p>
          </div>
          <div>
            <span className="th-text-muted">{t("scheduleIdLabel")}</span>
            <p className="th-text font-mono">{runDetails.pipeline_schedule_id || "-"}</p>
          </div>
          <div>
            <span className="th-text-muted">{t("startedLabel")}</span>
            <p className="th-text">{runDetails.started_at ? formatDateTime(runDetails.started_at) : "-"}</p>
          </div>
          <div>
            <span className="th-text-muted">{t("executionDateLabel")}</span>
            <p className="th-text">{runDetails.execution_date ? formatDateTime(runDetails.execution_date) : "-"}</p>
          </div>
        </div>
        {runDetails.variables && Object.keys(runDetails.variables).length > 0 && (
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="th-text-muted text-xs">{t("inputVariablesLabel")}</span>
              <CopyButton value={redactedVars} title={t("copyInput")} />
            </div>
            <pre className="mt-1 p-3 bg-black/30 rounded-lg text-xs th-text-secondary font-mono overflow-x-auto max-h-40 custom-scrollbar">
              {JSON.stringify(redactedVars, null, 2)}
            </pre>
          </div>
        )}
        {runDetails.result != null && (
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="th-text-muted text-xs">{t("outputResponseLabel")}</span>
              <CopyButton value={runDetails.result} title={t("copyOutput")} />
            </div>
            <pre className="mt-1 p-3 bg-black/30 rounded-lg text-xs th-text-secondary font-mono overflow-x-auto max-h-64 custom-scrollbar">
              {typeof runDetails.result === "string"
                ? runDetails.result
                : JSON.stringify(runDetails.result, null, 2)}
            </pre>
          </div>
        )}
        {runDetails.block_runs && runDetails.block_runs.length > 0 && (
          <div>
            <span className="th-text-muted text-xs">{t("blockRunsLabel")}</span>
            {runDetails.block_runs.map((block, idx) => (
              <div key={idx} className="mt-1 p-3 bg-black/30 rounded-lg text-xs space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="th-text-secondary font-mono">{block.block_uuid}</span>
                  <div className="flex items-center gap-2">
                    {block.attempts > 1 && (
                      <span className="text-amber-400" title={t("retriesTitle")}>
                        {t("triesCount", { count: block.attempts })}
                      </span>
                    )}
                    <StatusBadge status={block.status} />
                  </div>
                </div>
                {block.error && (
                  <p className="text-red-400 break-all">{block.error}</p>
                )}
                {(block.output ?? block.metrics) != null && (
                  <div>
                    <div className="flex items-center justify-end">
                      <CopyButton
                        value={block.output ?? block.metrics}
                        title={t("copyBlockOutput")}
                      />
                    </div>
                    <pre className="th-text-muted font-mono overflow-x-auto max-h-48 custom-scrollbar">
                      {typeof (block.output ?? block.metrics) === "string"
                        ? (block.output ?? block.metrics)
                        : JSON.stringify(block.output ?? block.metrics, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {/* Structured, step-by-step execution log (th2etl). Empty under Mage or
            for runs that predate log capture. */}
        <div>
          <span className="th-text-muted text-xs">{t("executionLogLabel")}</span>
          {loadingLogs ? (
            <p className="mt-1 th-text-muted text-xs">{t("loadingLog")}</p>
          ) : runLogs.length === 0 ? (
            <p className="mt-1 th-text-muted text-xs">{t("noLogForRun")}</p>
          ) : (
            <div className="mt-1 p-3 bg-black/30 rounded-lg text-xs font-mono space-y-0.5 max-h-64 overflow-y-auto custom-scrollbar">
              {runLogs.map((entry) => (
                <div key={entry.id} className="flex gap-2">
                  <span className="th-text-muted shrink-0">{formatDateTime(entry.ts)}</span>
                  <span
                    className={`shrink-0 font-semibold ${LOG_LEVEL_COLOR[entry.level] || "th-text-muted"}`}
                  >
                    {entry.level}
                  </span>
                  <span className="th-text-secondary break-all">{entry.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render run action buttons
  const renderRunActions = (run) => (
    <div className="flex items-center gap-1">
      {(run.status === "initial" || run.status === "running") && (
        <button
          onClick={(e) => { e.stopPropagation(); handleCancelRun(run.id); }}
          disabled={cancellingRunId === run.id}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all disabled:opacity-50"
        >
          {cancellingRunId === run.id ? <Loader2 size={10} className="animate-spin" /> : <StopCircle size={10} />}
          {t("cancelAction")}
        </button>
      )}
      {(run.status === "failed" || run.status === "cancelled") && (
        <button
          onClick={(e) => { e.stopPropagation(); handleRetryRun(run); }}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-purple-400/10 hover:bg-purple-400/20 text-purple-400 border border-purple-400/20 transition-all"
        >
          <RotateCw size={10} /> {t("retryAction")}
        </button>
      )}
      {run.status === "completed" && (
        <button
          onClick={(e) => { e.stopPropagation(); handleRetryRun(run); }}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 transition-all"
        >
          <RotateCw size={10} /> {t("rerunAction")}
        </button>
      )}
    </div>
  );

  // Render a runs sub-table (used in agent expansion and schedule expansion)
  const renderRunsSubTable = (runs, maxRows = 5, colSpan = 5) => {
    if (runs.length === 0) {
      return (
        <div className="text-center py-5 rounded-lg border border-dashed th-border">
          <Clock size={20} className="mx-auto mb-1.5 th-text-ghost" />
          <p className="th-text-faint text-xs">{t("noRunsYet")}</p>
        </div>
      );
    }
    return (
      <div className="rounded-lg border th-border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="th-bg-surface th-text-muted">
              <th className="text-left p-2.5 font-semibold">{t("colRunId")}</th>
              <th className="text-left p-2.5 font-semibold">{t("colStatus")}</th>
              <th className="text-left p-2.5 font-semibold">{t("colCreated")}</th>
              <th className="text-left p-2.5 font-semibold">{t("colCompleted")}</th>
              <th className="text-left p-2.5 font-semibold">{t("colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {runs.slice(0, maxRows).map((run) => (
              <React.Fragment key={run.id}>
                <tr
                  className="border-t th-border hover:th-bg-surface/50 cursor-pointer transition-colors"
                  onClick={() => handleToggleRunDetails(run.id)}
                >
                  <td className="p-2.5 th-text-secondary font-mono">
                    <span className="inline-flex items-center gap-1">
                      {expandedRunId === run.id ? (
                        <ChevronDown size={10} className="th-text-muted" />
                      ) : (
                        <ChevronRight size={10} className="th-text-muted" />
                      )}
                      {run.id}
                    </span>
                  </td>
                  <td className="p-2.5"><StatusBadge status={run.status} /></td>
                  <td className="p-2.5 th-text-muted" title={run.created_at ? formatDateTime(run.created_at) : ""}>
                    {timeAgo(run.created_at, t)}
                  </td>
                  <td className="p-2.5 th-text-muted" title={run.completed_at ? formatDateTime(run.completed_at) : ""}>
                    {run.completed_at ? timeAgo(run.completed_at, t) : "-"}
                  </td>
                  <td className="p-2.5" onClick={(e) => e.stopPropagation()}>
                    {renderRunActions(run)}
                  </td>
                </tr>
                {expandedRunId === run.id && (
                  <tr>
                    <td colSpan={5} className="p-0">
                      <div className="bg-black/20 border-b th-border p-4">
                        {loadingRunId === run.id ? (
                          <div className="flex items-center gap-2 th-text-muted text-xs">
                            <Loader2 size={12} className="animate-spin" />
                            {t("loadingRunDetails")}
                          </div>
                        ) : (
                          renderRunDetails()
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        {runs.length > maxRows && (
          <div className="px-3 py-2 border-t th-border text-center">
            <span className="text-[11px] th-text-muted">
              {t("moreRunsHint", { count: runs.length - maxRows })}
            </span>
          </div>
        )}
      </div>
    );
  };

  // ---- TAB CONTENT RENDERERS ----

  const renderAgentsTab = () => (
    <div>
      {/* Search + Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="relative flex-1 min-w-50 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 th-text-faint" />
          <input
            type="text"
            placeholder={t("searchAgentsPlaceholder")}
            value={agentSearch}
            onChange={(e) => setAgentSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 th-bg-surface border th-border rounded-xl text-sm th-text placeholder-[var(--text-faint)] focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-all"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setAgentFilter(opt.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                agentFilter === opt.key
                  ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                  : "th-bg-surface th-text-muted th-border hover:bg-white/10 hover:th-text-secondary"
              }`}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
        <span className="text-xs th-text-faint ml-auto">
          {t("agentCount", { count: sortedAgents.length })}
          {totalAgentPages > 1 && ` ${t("pageIndicator", { current: agentsPage + 1, total: totalAgentPages })}`}
        </span>
      </div>

      {/* Agent Table */}
      <div className="glass-card rounded-xl border th-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b th-border th-bg-surface">
                <SortableHeader label={t("colAgent")} sortKey="name" currentSortKey={agentSortKey} ascending={agentSortAsc} onSort={handleAgentSort} />
                <SortableHeader label={t("colId")} sortKey="id" currentSortKey={agentSortKey} ascending={agentSortAsc} onSort={handleAgentSort} />
                <SortableHeader label={t("colModel")} sortKey="model" currentSortKey={agentSortKey} ascending={agentSortAsc} onSort={handleAgentSort} />
                <SortableHeader label={t("colSchedule")} sortKey="status" currentSortKey={agentSortKey} ascending={agentSortAsc} onSort={handleAgentSort} />
                <th className="text-left p-3 th-text-secondary font-semibold">{t("colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {sortedAgents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center">
                    <Calendar size={36} className="mx-auto mb-3 th-text-ghost" />
                    <p className="th-text-faint text-sm">
                      {agentsWithSchedules.length === 0
                        ? t("noAgentsConfigured")
                        : t("noAgentsMatchFilters")}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedAgents.map((agent) => {
                  const isExpanded = expandedAgentId === agent.agent_id;
                  const agentRuns = getAgentRuns(agent);
                  const subAgents = parseSubAgents(agent.sub_agents);
                  const typeBadge = TYPE_BADGES[agent.agent_type?.toLowerCase()] || TYPE_BADGES.base;

                  return (
                    <React.Fragment key={agent.agent_id}>
                      <AgentTableRow
                        agent={agent}
                        expanded={isExpanded}
                        onToggle={() => setExpandedAgentId(isExpanded ? null : agent.agent_id)}
                        onRunNow={(a) => {
                          setPreselectedAgent(a);
                          setPrefilledMessage("");
                          setRunNowMode(true);
                          setShowModal(true);
                        }}
                        onSchedule={(a) => {
                          setPreselectedAgent(a);
                          setPrefilledMessage("");
                          setRunNowMode(false);
                          setShowModal(true);
                        }}
                        runCount={agentRuns.length}
                      />
                      {isExpanded && (
                        <tr>
                          <td colSpan={5} className="p-0">
                            <div className="bg-linear-to-b from-blue-500/4 to-transparent border-b border-blue-500/10">
                              {/* Agent Metadata */}
                              <div className="px-5 pt-4 pb-3">
                                {agent.agent_description && (
                                  <p className="th-text-muted text-sm mb-3">{agent.agent_description}</p>
                                )}
                                <div className="flex flex-wrap gap-2">
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${typeBadge.bg} ${typeBadge.color} border ${typeBadge.border}`}>
                                    <Bot size={11} /> {agent.agent_type || "base"}
                                  </span>
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold th-bg-surface th-text-muted border th-border">
                                    <Activity size={11} /> {agent.agent_model || t("defaultModel")}
                                  </span>
                                  {agent.agent_tools && agent.agent_tools.length > 0 && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-purple-400/10 text-purple-400 border border-purple-400/20">
                                      <Wrench size={11} /> {t("toolsCount", { count: agent.agent_tools.length })}
                                    </span>
                                  )}
                                  {subAgents.length > 0 && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                      <Users size={11} /> {t("subAgentsCount", { count: subAgents.length })}
                                    </span>
                                  )}
                                  {agent.memory_enabled && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-400/10 text-blue-400 border border-blue-400/20">
                                      <Database size={11} /> {t("memoryBadge")}
                                    </span>
                                  )}
                                  {agent.guardrails_config && Object.keys(agent.guardrails_config).length > 0 && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                      <Shield size={11} /> {t("guardrailsBadge")}
                                    </span>
                                  )}
                                  {agent.schedule && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                      <Zap size={11} /> {t("scheduleBadge", { id: agent.schedule.id })}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Agent Runs */}
                              <div className="px-5 pb-4">
                                <h4 className="text-xs font-semibold th-text-muted mb-2 flex items-center gap-1.5">
                                  <Clock size={12} />
                                  {t("runsHeading", { count: agentRuns.length })}
                                </h4>
                                {renderRunsSubTable(agentRuns, 5)}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {/* Agent Pagination */}
        {totalAgentPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t th-border">
            <span className="text-xs th-text-muted">
              {t("paginationRange", { start: agentsPage * AGENTS_PER_PAGE + 1, end: Math.min((agentsPage + 1) * AGENTS_PER_PAGE, sortedAgents.length), total: sortedAgents.length })}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setAgentsPage((p) => Math.max(0, p - 1))}
                disabled={agentsPage === 0}
                className="p-1.5 rounded-lg th-text-muted hover:th-text hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: totalAgentPages }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setAgentsPage(i)}
                  className={`min-w-7 h-7 rounded-lg text-xs font-semibold transition-colors ${
                    i === agentsPage
                      ? "bg-blue-500/30 text-blue-400 border border-blue-500/30"
                      : "th-text-muted hover:th-text hover:bg-white/10"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                onClick={() => setAgentsPage((p) => Math.min(totalAgentPages - 1, p + 1))}
                disabled={agentsPage >= totalAgentPages - 1}
                className="p-1.5 rounded-lg th-text-muted hover:th-text hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderSchedulesTab = () => {
    if (schedules.length === 0) {
      return (
        <div className="glass-card p-8 rounded-2xl text-center border border-dashed th-border">
          <Calendar size={36} className="mx-auto mb-3 th-text-faint" />
          <h3 className="text-lg font-bold th-text mb-1">
            {t("noActiveSchedules")}
          </h3>
          <p className="th-text-muted text-sm">
            {t("scheduleAgentHint")}
          </p>
        </div>
      );
    }

    return (
      <div className="glass-card rounded-xl border th-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b th-border th-bg-surface">
                <th className="text-left p-3 th-text-secondary font-semibold">{t("colAgent")}</th>
                <th className="text-left p-3 th-text-secondary font-semibold">{t("colInterval")}</th>
                <th className="text-left p-3 th-text-secondary font-semibold">{t("colStatus")}</th>
                <th className="text-left p-3 th-text-secondary font-semibold">{t("colStartTime")}</th>
                <th className="text-left p-3 th-text-secondary font-semibold">{t("colCreated")}</th>
                <th className="text-left p-3 th-text-secondary font-semibold">{t("colRuns")}</th>
                <th className="text-left p-3 th-text-secondary font-semibold">{t("colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((schedule) => {
                const isExpanded = expandedScheduleId === schedule.id;
                const scheduleRuns = getScheduleRuns(schedule);
                const isActive = schedule.status === "active";

                return (
                  <React.Fragment key={schedule.id}>
                    <tr
                      className={`border-b th-border transition-colors cursor-pointer ${
                        isExpanded ? "bg-blue-500/6 border-blue-500/20" : "hover:th-bg-surface"
                      }`}
                      onClick={() => setExpandedScheduleId(isExpanded ? null : schedule.id)}
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className={`shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}>
                            <ChevronRight size={14} className="th-text-muted" />
                          </div>
                          <span className="th-text text-sm font-medium truncate max-w-50" title={resolveAgentName(schedule.name)}>
                            {resolveAgentName(schedule.name) || "-"}
                          </span>
                        </div>
                      </td>
                      <td className="p-3 th-text-secondary text-xs font-mono">
                        {schedule.schedule_interval || "-"}
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                          isActive
                            ? "bg-blue-500/20 text-blue-400"
                            : "bg-gray-500/20 text-gray-400"
                        }`}>
                          {isActive ? <Zap size={10} /> : <Clock size={10} />}
                          {isActive ? t("statusActive") : t("statusInactive")}
                        </span>
                      </td>
                      <td className="p-3 th-text-muted text-xs">
                        {schedule.start_time ? formatDateTime(schedule.start_time) : "-"}
                      </td>
                      <td className="p-3 th-text-muted text-xs">
                        {timeAgo(schedule.created_at, t)}
                      </td>
                      <td className="p-3">
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-blue-500/20 text-blue-400 font-bold tabular-nums">
                          {scheduleRuns.length}
                        </span>
                      </td>
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          {schedule.status === "active" ? (
                            <button
                              onClick={() => handleToggleScheduleStatus(schedule)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 transition-all"
                            >
                              <StopCircle size={12} />
                              {t("stopAction")}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleToggleScheduleStatus(schedule)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 border border-blue-500/20 transition-all"
                            >
                              <Play size={12} />
                              {t("activateAction")}
                            </button>
                          )}
                          <button
                            onClick={() => {
                              const agent = agents.find(
                                (a) => a.agent_name === schedule.name || String(a.agent_id) === schedule.name
                              );
                              if (agent) {
                                const agentWithSchedule = { ...agent, schedule };
                                setPreselectedAgent(agentWithSchedule);
                              } else {
                                setPreselectedAgent({ agent_name: schedule.name, schedule });
                              }
                              setPrefilledMessage("");
                              setRunNowMode(false);
                              setShowModal(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 border border-blue-500/20 transition-all"
                          >
                            <Calendar size={12} />
                            {t("editAction")}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={7} className="p-0">
                          <div className="bg-linear-to-b from-blue-500/4 to-transparent border-b border-blue-500/10 px-5 py-4">
                            <h4 className="text-xs font-semibold th-text-muted mb-2 flex items-center gap-1.5">
                              <Clock size={12} />
                              {t("runsHeading", { count: scheduleRuns.length })}
                            </h4>
                            {renderRunsSubTable(scheduleRuns, 5, 7)}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderRunsTab = () => {
    if (recentRuns.length === 0) {
      return (
        <div className="glass-card p-8 rounded-2xl text-center border border-dashed th-border">
          <Clock size={36} className="mx-auto mb-3 th-text-faint" />
          <h3 className="text-lg font-bold th-text mb-1">
            {t("noRecentRuns")}
          </h3>
          <p className="th-text-secondary text-sm">
            {t("scheduleRunHint")}
          </p>
        </div>
      );
    }

    return (
      <div>
        {hasActiveRuns() && (
          <div className="mb-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400">
              <Loader2 size={10} className="animate-spin" />
              {t("liveBadge")}
            </span>
          </div>
        )}
        <div className="glass-card rounded-xl border th-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b th-border th-bg-surface">
                  <th className="text-left p-3 th-text-secondary font-semibold">{t("colRunId")}</th>
                  <th className="text-left p-3 th-text-secondary font-semibold">{t("colAgent")}</th>
                  <th className="text-left p-3 th-text-secondary font-semibold">{t("colStatus")}</th>
                  <th className="text-left p-3 th-text-secondary font-semibold">{t("colCreated")}</th>
                  <th className="text-left p-3 th-text-secondary font-semibold">{t("colCompleted")}</th>
                  <th className="text-left p-3 th-text-secondary font-semibold">{t("colActions")}</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.slice(runsPage * RUNS_PER_PAGE, (runsPage + 1) * RUNS_PER_PAGE).map((run) => (
                  <React.Fragment key={run.id}>
                    <tr
                      className="border-b th-border hover:th-bg-surface transition-colors cursor-pointer"
                      onClick={() => handleToggleRunDetails(run.id)}
                    >
                      <td className="p-3 th-text font-mono text-xs">
                        <span className="inline-flex items-center gap-1.5">
                          {expandedRunId === run.id ? (
                            <ChevronDown size={12} className="th-text-muted" />
                          ) : (
                            <ChevronRight size={12} className="th-text-muted" />
                          )}
                          {run.id}
                        </span>
                      </td>
                      <td className="p-3 th-text text-xs truncate max-w-37.5" title={resolveAgentName(run._scheduleName)}>
                        {resolveAgentName(run._scheduleName) || "-"}
                      </td>
                      <td className="p-3">
                        <StatusBadge status={run.status} />
                      </td>
                      <td className="p-3 th-text-secondary text-xs" title={run.created_at ? formatDateTime(run.created_at) : ""}>
                        {timeAgo(run.created_at, t)}
                      </td>
                      <td className="p-3 th-text-secondary text-xs" title={run.completed_at ? formatDateTime(run.completed_at) : ""}>
                        {run.completed_at ? timeAgo(run.completed_at, t) : "-"}
                      </td>
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          {(run.status === "initial" || run.status === "running") && (
                            <button
                              onClick={() => handleCancelRun(run.id)}
                              disabled={cancellingRunId === run.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              title={t("cancelThisRunTitle")}
                            >
                              {cancellingRunId === run.id ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <StopCircle size={12} />
                              )}
                              {t("cancelAction")}
                            </button>
                          )}
                          {(run.status === "failed" || run.status === "cancelled") && (
                            <button
                              onClick={() => handleRetryRun(run)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-purple-400/10 hover:bg-purple-400/20 text-purple-400 hover:text-purple-300 border border-purple-400/20 transition-all"
                              title={t("retryThisAgentTitle")}
                            >
                              <RotateCw size={12} />
                              {t("retryAction")}
                            </button>
                          )}
                          {run.status === "completed" && (
                            <button
                              onClick={() => handleRetryRun(run)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 border border-blue-500/20 transition-all"
                              title={t("runAgentAgainTitle")}
                            >
                              <RotateCw size={12} />
                              {t("rerunAction")}
                            </button>
                          )}
                          <button
                            onClick={() => handleToggleRunDetails(run.id)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                              expandedRunId === run.id
                                ? "bg-white/10 th-text-secondary th-border-secondary"
                                : "th-bg-surface hover:bg-white/10 th-text-muted hover:th-text-secondary th-border"
                            }`}
                            title={t("viewDetailsTitle")}
                          >
                            <Eye size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedRunId === run.id && (
                      <tr>
                        <td colSpan={6} className="p-0">
                          <div className="bg-white/2 border-b th-border p-4">
                            {loadingRunId === run.id ? (
                              <div className="flex items-center gap-2 th-text-muted text-xs">
                                <Loader2 size={14} className="animate-spin" />
                                {t("loadingRunDetails")}
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center gap-2 th-text-secondary text-xs font-semibold mb-3">
                                  <FileText size={14} />
                                  {t("runDetailsHeading")}
                                </div>
                                {renderRunDetails()}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {recentRuns.length > RUNS_PER_PAGE && (
            <div className="flex items-center justify-between px-4 py-3 border-t th-border">
              <span className="text-xs th-text-muted">
                {t("paginationRange", { start: runsPage * RUNS_PER_PAGE + 1, end: Math.min((runsPage + 1) * RUNS_PER_PAGE, recentRuns.length), total: recentRuns.length })}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setRunsPage((p) => Math.max(0, p - 1))}
                  disabled={runsPage === 0}
                  className="p-1.5 rounded-lg th-text-muted hover:th-text hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: Math.ceil(recentRuns.length / RUNS_PER_PAGE) }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => setRunsPage(i)}
                    className={`min-w-7 h-7 rounded-lg text-xs font-semibold transition-colors ${
                      i === runsPage
                        ? "bg-blue-500/30 text-blue-400 border border-blue-500/30"
                        : "th-text-muted hover:th-text hover:bg-white/10"
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={() => setRunsPage((p) => Math.min(Math.ceil(recentRuns.length / RUNS_PER_PAGE) - 1, p + 1))}
                  disabled={runsPage >= Math.ceil(recentRuns.length / RUNS_PER_PAGE) - 1}
                  className="p-1.5 rounded-lg th-text-muted hover:th-text hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col th-bg-body overflow-hidden">
      {/* Header */}
      <header className="shrink-0 p-6 bg-linear-to-r from-brand/20 to-brand-secondary/20 border-b th-border backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-linear-to-br from-brand to-brand-secondary rounded-2xl shadow-lg">
              <Calendar size={32} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black th-text tracking-tight">
                {t("title")}
              </h1>
              <p className="th-text-secondary text-sm font-medium mt-1">
                {t("subtitle")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setPreselectedAgent(null);
                setPrefilledMessage("");
                setRunNowMode(true);
                setShowModal(true);
              }}
              className="glass-btn flex items-center gap-2 px-5 py-3 bg-linear-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20 hover:scale-105"
            >
              <Play size={20} />
              {t("runNow")}
            </button>
            <button
              onClick={() => {
                setPreselectedAgent(null);
                setPrefilledMessage("");
                setRunNowMode(false);
                setShowModal(true);
              }}
              className="glass-btn flex items-center gap-2 px-5 py-3 bg-brand hover:bg-brand-hover text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20 hover:scale-105"
            >
              <Calendar size={20} />
              {t("schedule")}
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="max-w-7xl mx-auto">
            <SkeletonList count={5} />
          </div>
        ) : (
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Stats Bar */}
            <StatsBar stats={stats} />

            {/* Tab Bar */}
            <div className="flex items-center border-b th-border">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                const badge = tabBadges[tab.key];
                const showBadge = tab.key === "runs" ? badge > 0 : badge > 0;

                return (
                  <button
                    key={tab.key}
                    onClick={() => { window.location.hash = tab.key; setActiveTab(tab.key); }}
                    className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold transition-all border-b-2 ${
                      isActive
                        ? "border-blue-500 text-blue-400"
                        : "border-transparent th-text-muted hover:th-text-secondary"
                    }`}
                  >
                    <Icon size={16} />
                    {t(tab.labelKey)}
                    {showBadge && (
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums ${
                        isActive
                          ? "bg-blue-500/20 text-blue-400"
                          : "th-bg-surface th-text-muted"
                      }`}>
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Tab Content */}
            {activeTab === "agents" && renderAgentsTab()}
            {activeTab === "schedules" && renderSchedulesTab()}
            {activeTab === "runs" && renderRunsTab()}
          </div>
        )}
      </div>

      {/* Schedule Run Modal */}
      <ScheduleRunModal
        show={showModal}
        agents={agents}
        preselectedAgent={preselectedAgent}
        prefilledMessage={prefilledMessage}
        runNowMode={runNowMode}
        existingSchedule={preselectedAgent?.schedule || null}
        onClose={() => {
          setShowModal(false);
          setPreselectedAgent(null);
          setPrefilledMessage("");
          setRunNowMode(false);
        }}
        onSubmit={handleScheduleRun}
        onRunNow={handleRunNow}
      />

    </div>
  );
}
