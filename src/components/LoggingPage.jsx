"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "use-intl";
import {
  AlertTriangle,
  Bot,
  ChevronRight,
  Cpu,
  MessageSquare,
  RefreshCw,
  StickyNote,
  ScrollText,
  Search,
  Wrench,
} from "lucide-react";
import {
  getLoggingAlerts,
  getLoggingAnnotations,
  getLoggingConversations,
  getLoggingLogs,
  getLoggingSpans,
  getLoggingStats,
  postLoggingAnnotation,
} from "@/lib/api";
import {
  buildTimeline,
  buildTurns,
  extractContent,
  fmtDuration,
  fmtJson,
  fmtTime,
  subFilterOptions,
  waterfallGeometry,
} from "@/lib/loggingTimeline";
import { Skeleton } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";

const KIND_STYLE = {
  TOOL: "text-sky-400 bg-sky-400/15",
  LLM: "text-blue-300 bg-blue-400/15",
  AGENT: "text-brand bg-brand/15",
  INFO: "text-emerald-500 bg-emerald-500/15",
  WARN: "text-amber-500 bg-amber-500/15",
  ERROR: "text-red-500 bg-red-500/15",
};

const BAR_STYLE = {
  TOOL: "bg-sky-400",
  LLM: "bg-blue-400",
  AGENT: "bg-brand/60",
  INFO: "bg-emerald-500",
  WARN: "bg-amber-500",
  ERROR: "bg-red-500",
};

function fmtTokens(n) {
  return n >= 10000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function StatsBanner({ stats }) {
  const t = useTranslations("LoggingPage");
  if (!stats) return null;
  const cached = stats.cached_tokens ?? 0;
  const cacheRatio = stats.input_tokens
    ? Math.round((cached / stats.input_tokens) * 100)
    : 0;
  const tiles = [
    { label: t("statConversations"), value: stats.conversations },
    { label: t("statTurns"), value: stats.turns },
    { label: t("statAvgTurn"), value: fmtDuration(stats.avg_turn_ms) ?? "—" },
    { label: t("statP95Turn"), value: fmtDuration(stats.p95_turn_ms) ?? "—" },
    { label: t("statToolCalls"), value: stats.tool_calls },
    {
      label: t("statTokensInOut"),
      value: `${fmtTokens(stats.input_tokens)} / ${fmtTokens(stats.output_tokens)}`,
    },
    {
      label: t("statPromptCache"),
      value: `${cacheRatio}%`,
      // Low cache = money left on the table (context re-sent full price).
      warn: stats.input_tokens > 0 && cacheRatio < 30,
      title: t("statCacheTooltip", { cached: fmtTokens(cached), total: fmtTokens(stats.input_tokens) }),
    },
    { label: t("statAppErrors"), value: stats.app_errors, alert: stats.app_errors > 0 },
  ];
  return (
    <div className="shrink-0 flex items-stretch gap-2 px-5 py-3 border-b th-border overflow-x-auto">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          title={tile.title}
          className="glass-card rounded-xl border th-border px-3.5 py-2 min-w-[92px]"
        >
          <div
            className={`text-base font-bold tabular-nums leading-tight ${
              tile.alert ? "text-red-500" : tile.warn ? "text-amber-500" : "th-text"
            }`}
          >
            {tile.value}
          </div>
          <div className="text-[10px] th-text-muted whitespace-nowrap">
            {tile.label} · 24h
          </div>
        </div>
      ))}
    </div>
  );
}

function TurnSummary({ turn, totalMs }) {
  const t = useTranslations("LoggingPage");
  const s = turn.stats;
  const parts = [];
  if (s.llmCalls) {
    parts.push(`${s.llmCalls} LLM · ${fmtDuration(s.llmMs)}`);
  }
  if (s.toolCalls) {
    parts.push(t("toolsCountLabel", { count: s.toolCalls }));
  }
  if (s.inputTokens || s.outputTokens) {
    parts.push(t("tokensInOutLabel", { input: fmtTokens(s.inputTokens), output: fmtTokens(s.outputTokens) }));
  }
  if (s.models.length) parts.push(s.models.join(", "));
  return (
    <div className="flex items-center gap-2.5 mb-2 flex-wrap">
      <span className="px-2.5 py-0.5 rounded-lg border th-border th-bg-surface text-xs font-bold th-text">
        {t("turnBadge", { no: turn.no })}
      </span>
      {s.errors > 0 && (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide text-red-500 bg-red-500/15">
          {t("errorsCountLabel", { count: s.errors })}
        </span>
      )}
      {totalMs != null && (
        <span className="text-[11px] font-semibold th-text tabular-nums">
          {fmtDuration(totalMs)}
        </span>
      )}
      {parts.map((p) => (
        <span key={p} className="text-[11px] th-text-muted tabular-nums">
          · {p}
        </span>
      ))}
      <span className="font-mono text-[11px] th-text-faint ml-auto">
        {t("traceLabel", { id: turn.traceId.slice(0, 12) })}
      </span>
    </div>
  );
}

function WaterfallTrack({ item, window }) {
  const geo = waterfallGeometry(item, window);
  if (!geo) return <span className="hidden sm:block w-24" />;
  return (
    <span className="hidden sm:block relative w-24 h-2 rounded-full th-bg-surface overflow-hidden self-center">
      {geo.widthPct > 0.5 ? (
        <span
          className={`absolute top-0 h-full rounded-full ${BAR_STYLE[item.kind] || "bg-brand/60"}`}
          style={{ left: `${geo.leftPct}%`, width: `${Math.max(geo.widthPct, 2)}%` }}
        />
      ) : (
        <span
          className={`absolute top-0 h-full w-[3px] rounded-full opacity-70 ${BAR_STYLE[item.kind] || "bg-brand/60"}`}
          style={{ left: `min(${geo.leftPct}%, calc(100% - 3px))` }}
        />
      )}
    </span>
  );
}

function getFilters(t) {
  return [
    { key: "ALL", label: t("filterAllLabel") },
    { key: "TOOL", label: t("filterToolsLabel") },
    { key: "LLM", label: "LLM" },
    { key: "AGENT", label: t("filterAgentEventsLabel") },
    { key: "INFO", label: t("filterAppLabel") },
    { key: "ERROR", label: t("filterErrorsLabel") },
  ];
}

export default function LoggingPage() {
  const t = useTranslations("LoggingPage");
  const FILTERS = useMemo(() => getFilters(t), [t]);
  const [conversations, setConversations] = useState(null);
  const [convError, setConvError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [data, setData] = useState(null); // { logs, spans }
  const [dataError, setDataError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("ALL");
  const [subFilter, setSubFilter] = useState(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(() => new Set());
  const [stats, setStats] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [noteDraft, setNoteDraft] = useState(null); // { traceId, text }
  const [noteSaving, setNoteSaving] = useState(false);

  const loadConversations = useCallback(async () => {
    setConvError(null);
    try {
      const res = await getLoggingConversations(50);
      setConversations(res.conversations || []);
      setSelectedId((prev) => prev ?? res.conversations?.[0]?.conversation_id ?? null);
    } catch (err) {
      setConvError(err.message);
      setConversations([]);
    }
    // Aggregates and alerts are decorative — never block the page on them.
    try {
      setStats(await getLoggingStats(24));
    } catch {
      setStats(null);
    }
    try {
      const res = await getLoggingAlerts();
      setAlerts(res.alerts || []);
    } catch {
      setAlerts([]);
    }
  }, []);

  const loadData = useCallback(async (conversationId) => {
    if (!conversationId) return;
    setLoading(true);
    setDataError(null);
    try {
      const [logsRes, spansRes, notesRes] = await Promise.all([
        getLoggingLogs({ conversationId, limit: 500 }),
        getLoggingSpans({ conversationId, limit: 1000 }),
        getLoggingAnnotations(conversationId).catch(() => ({ annotations: [] })),
      ]);
      setData({ logs: logsRes.logs || [], spans: spansRes.spans || [] });
      setAnnotations(notesRes.annotations || []);
    } catch (err) {
      setDataError(err.message);
      setData({ logs: [], spans: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    setExpanded(new Set());
    setSubFilter(null);
    loadData(selectedId);
  }, [selectedId, loadData]);

  const filteredConversations = useMemo(() => {
    if (!conversations) return [];
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) =>
      `${c.conversation_id} ${c.user_id || ""}`.toLowerCase().includes(q),
    );
  }, [conversations, query]);

  // Parsing/sorting depends on the data only; the (cheap) filtering and
  // grouping recompute on filter clicks without re-parsing 1500 records.
  const { items, counts, turnDurations } = useMemo(
    () => buildTimeline(data),
    [data],
  );
  const turns = useMemo(
    () => buildTurns(items, filter, subFilter, search),
    [items, filter, subFilter, search],
  );
  const subOptions = useMemo(() => subFilterOptions(items), [items]);

  const notesByTrace = useMemo(() => {
    const map = new Map();
    for (const note of annotations) {
      const key = note.trace_id || "conversation";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(note);
    }
    return map;
  }, [annotations]);

  const saveNote = async () => {
    const text = noteDraft?.text?.trim();
    if (!text || noteSaving) return;
    setNoteSaving(true);
    try {
      await postLoggingAnnotation({
        conversationId: selectedId,
        traceId: noteDraft.traceId,
        note: text,
      });
      setNoteDraft(null);
      const res = await getLoggingAnnotations(selectedId);
      setAnnotations(res.annotations || []);
    } catch (err) {
      console.error("[logging] failed to save note:", err.message);
    } finally {
      setNoteSaving(false);
    }
  };

  const selectFilter = (key) => {
    setFilter(key);
    setExpanded(new Set());
  };

  const toggleSubFilter = (type, value) => {
    setSubFilter((prev) =>
      prev && prev.type === type && prev.value === value ? null : { type, value },
    );
    setExpanded(new Set());
  };

  const toggleExpanded = (key) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full">
      <header className="shrink-0 p-6 bg-linear-to-r from-brand/20 to-brand-secondary/20 border-b th-border backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-linear-to-br from-brand to-brand-secondary rounded-2xl shadow-lg">
            <ScrollText size={32} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black th-text tracking-tight">{t("pageTitle")}</h1>
            <p className="th-text-secondary text-sm font-medium mt-1">
              {t("pageSubtitle")}
            </p>
          </div>
          <button
            onClick={() => {
              loadConversations();
              loadData(selectedId);
            }}
            className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl border th-border th-bg-surface th-text text-sm font-medium hover:th-bg-surface-hover"
          >
            <RefreshCw size={15} />
            {t("refreshLabel")}
          </button>
        </div>
      </header>

      {alerts.length > 0 && (
        <div className="shrink-0 flex flex-col gap-1.5 px-5 py-3 border-b border-red-500/40 bg-red-500/8">
          {alerts.map((alert) => (
            <button
              key={alert.id}
              onClick={() =>
                alert.target !== "global" && setSelectedId(alert.target)
              }
              className="flex items-center gap-2.5 text-left text-sm rounded-lg px-2 py-1 hover:bg-red-500/10"
            >
              <AlertTriangle
                size={14}
                className={alert.severity === "error" ? "text-red-500" : "text-amber-500"}
              />
              <span className={`text-[10px] font-bold tracking-wide rounded-md px-1.5 py-0.5 ${
                alert.severity === "error"
                  ? "text-red-500 bg-red-500/15"
                  : "text-amber-500 bg-amber-500/15"
              }`}>
                {alert.rule_key}
              </span>
              <span className="th-text truncate">{alert.message}</span>
              {alert.target !== "global" && (
                <span className="font-mono text-[11px] th-text-muted truncate">
                  {alert.target}
                </span>
              )}
              <span className="ml-auto text-[11px] th-text-faint tabular-nums shrink-0">
                {fmtTime(alert.triggered_at)}
              </span>
            </button>
          ))}
        </div>
      )}

      <StatsBanner stats={stats} />

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[320px_1fr] min-h-0">
        {/* ── Conversations ── */}
        <aside className="border-r th-border flex flex-col min-h-0">
          <div className="p-3 shrink-0">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 th-text-faint" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("searchConversationsPlaceholder")}
                className="w-full pl-9 pr-3 py-2 rounded-xl th-bg-input border th-border th-text text-sm placeholder:th-text-faint focus:outline-none focus:border-brand"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-4">
            {conversations === null ? (
              <div className="space-y-2 p-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : convError ? (
              <EmptyState
                icon={AlertTriangle}
                title={t("loggingStoreUnreachableTitle")}
                description={convError}
                action={loadConversations}
                actionLabel={t("retryLabel")}
              />
            ) : filteredConversations.length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                title={t("noConversationsYetTitle")}
                description={t("noConversationsYetDescription")}
              />
            ) : (
              filteredConversations.map((c) => (
                <button
                  key={c.conversation_id}
                  onClick={() => setSelectedId(c.conversation_id)}
                  className={`w-full text-left rounded-xl px-3 py-2.5 mt-1 border transition-colors ${
                    c.conversation_id === selectedId
                      ? "border-brand th-bg-surface"
                      : "border-transparent hover:th-bg-surface-hover"
                  }`}
                >
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-xs font-semibold th-text truncate">
                      {c.conversation_id}
                    </span>
                    <span className="ml-auto text-[11px] th-text-muted tabular-nums shrink-0">
                      {fmtTime(c.first_seen)}
                    </span>
                  </div>
                  <div className="text-[11px] th-text-muted mt-0.5 truncate">
                    {c.user_id ? (
                      <span
                        role="button"
                        tabIndex={0}
                        title={t("showAllConversationsTooltip", { user: c.user_id })}
                        onClick={(e) => {
                          e.stopPropagation();
                          setQuery(c.user_id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.stopPropagation();
                            setQuery(c.user_id);
                          }
                        }}
                        className="underline decoration-dotted underline-offset-2 hover:th-text"
                      >
                        {c.user_id}
                      </span>
                    ) : (
                      t("unknownUserFallback")
                    )}{" "}
                    · {t("turnsCountLabel", { count: c.trace_count })}
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* ── Timeline ── */}
        <section className="flex flex-col min-h-0">
          <div className="shrink-0 flex items-center gap-2 flex-wrap px-5 py-3 border-b th-border">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => selectFilter(f.key)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                  filter === f.key
                    ? "border-brand text-brand bg-brand/10"
                    : "th-border th-text-muted hover:th-bg-surface-hover"
                }`}
              >
                {f.label}
                <span className="ml-1.5 opacity-70 tabular-nums">
                  {f.key === "ERROR" ? (counts.ERROR || 0) + (counts.WARN || 0) : counts[f.key] ?? 0}
                </span>
              </button>
            ))}
            <div className="relative ml-auto">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 th-text-faint" />
              <input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setExpanded(new Set());
                }}
                placeholder={t("searchTimelinePlaceholder")}
                className="w-56 pl-8 pr-3 py-1.5 rounded-lg th-bg-input border th-border th-text text-xs placeholder:th-text-faint focus:outline-none focus:border-brand"
              />
            </div>
          </div>

          {(subOptions.tools.length > 0 || subOptions.models.length > 0 || subOptions.hasSlow) && (
            <div className="shrink-0 flex items-center gap-1.5 flex-wrap px-5 py-2 border-b th-border">
              {subOptions.tools.map((tool) => (
                <button
                  key={`tool-${tool}`}
                  onClick={() => toggleSubFilter("tool", tool)}
                  className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${
                    subFilter?.type === "tool" && subFilter.value === tool
                      ? "border-sky-400 text-sky-400 bg-sky-400/10"
                      : "th-border th-text-muted hover:th-bg-surface-hover"
                  }`}
                >
                  <Wrench size={10} />
                  {tool}
                </button>
              ))}
              {subOptions.models.map((model) => (
                <button
                  key={`model-${model}`}
                  onClick={() => toggleSubFilter("model", model)}
                  className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${
                    subFilter?.type === "model" && subFilter.value === model
                      ? "border-blue-400 text-blue-300 bg-blue-400/10"
                      : "th-border th-text-muted hover:th-bg-surface-hover"
                  }`}
                >
                  <Cpu size={10} />
                  {model}
                </button>
              ))}
              {subOptions.hasSlow && (
                <button
                  onClick={() => toggleSubFilter("slow", true)}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${
                    subFilter?.type === "slow"
                      ? "border-amber-500 text-amber-500 bg-amber-500/10"
                      : "th-border th-text-muted hover:th-bg-surface-hover"
                  }`}
                >
                  {t("slowThresholdLabel")}
                </button>
              )}
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-5">
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-5/6" />
              </div>
            ) : dataError ? (
              <EmptyState
                icon={AlertTriangle}
                title={t("couldNotLoadLogsTitle")}
                description={dataError}
                action={() => loadData(selectedId)}
                actionLabel={t("retryLabel")}
              />
            ) : !selectedId ? (
              <EmptyState
                icon={ScrollText}
                title={t("selectConversationTitle")}
                description={t("selectConversationDescription")}
              />
            ) : turns.length === 0 ? (
              <EmptyState
                icon={ScrollText}
                title={t("nothingForFilterTitle")}
                description={t("nothingForFilterDescription")}
              />
            ) : (
              turns.map((turn) => (
                <div key={turn.traceId} className="mb-6">
                  <TurnSummary
                    turn={turn}
                    totalMs={
                      turnDurations.get(turn.traceId) ??
                      (turn.stats.window.end != null
                        ? turn.stats.window.end - turn.stats.window.start
                        : null)
                    }
                  />

                  {(notesByTrace.get(turn.traceId) || []).map((note) => (
                    <div
                      key={note.id}
                      className="flex items-baseline gap-2 ml-1 mb-1.5 px-3 py-1.5 rounded-lg bg-amber-500/8 border border-amber-500/25 text-[12px]"
                    >
                      <StickyNote size={11} className="text-amber-500 shrink-0 translate-y-px" />
                      <span className="font-semibold th-text shrink-0">{note.author}</span>
                      <span className="th-text-faint tabular-nums shrink-0">
                        {fmtTime(note.created_at)}
                      </span>
                      <span className="th-text-secondary">{note.note}</span>
                    </div>
                  ))}

                  {noteDraft?.traceId === turn.traceId ? (
                    <div className="flex items-center gap-2 ml-1 mb-2">
                      <input
                        autoFocus
                        value={noteDraft.text}
                        onChange={(e) => setNoteDraft({ ...noteDraft, text: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveNote();
                          if (e.key === "Escape") setNoteDraft(null);
                        }}
                        maxLength={2000}
                        placeholder={t("noteInputPlaceholder")}
                        className="flex-1 max-w-xl px-3 py-1.5 rounded-lg th-bg-input border th-border th-text text-xs placeholder:th-text-faint focus:outline-none focus:border-amber-500"
                      />
                      <button
                        onClick={saveNote}
                        disabled={noteSaving || !noteDraft.text.trim()}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-500 bg-amber-500/15 disabled:opacity-40"
                      >
                        {noteSaving ? t("savingLabel") : t("saveLabel")}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setNoteDraft({ traceId: turn.traceId, text: "" })}
                      className="flex items-center gap-1.5 ml-1 mb-1.5 px-2 py-0.5 rounded-md text-[11px] th-text-faint hover:text-amber-500 hover:bg-amber-500/10"
                    >
                      <StickyNote size={11} />
                      {t("addNoteLabel")}
                    </button>
                  )}

                  {turn.items.map((item) => {
                    const isOpen = expanded.has(item.id);
                    const span = item.span;
                    const log = item.log;
                    const attrs = Object.entries(
                      (span?.attributes || log?.attributes) ?? {},
                    ).filter(([k]) => !k.startsWith("gcp.vertex.agent.tool_"));
                    const args = span?.attributes?.["gcp.vertex.agent.tool_call_args"];
                    const resp = span?.attributes?.["gcp.vertex.agent.tool_response"];
                    const fullContent = log ? extractContent(log.body) : null;
                    const showFull =
                      fullContent && fullContent !== "<elided>" &&
                      fullContent.length > 60;
                    // The actionable error text lives in the span status
                    // message (e.g. the auth failure + how to fix it), not
                    // in the ids — show it first and in full.
                    const errorMessage = span?.status_message;
                    return (
                      <div key={item.id}>
                        <button
                          onClick={() => toggleExpanded(item.id)}
                          className={`w-full grid grid-cols-[70px_60px_1fr_auto_14px] sm:grid-cols-[70px_60px_1fr_6rem_52px_14px] items-baseline gap-3 px-3 py-1.5 rounded-lg text-left hover:th-bg-surface-hover border-l-2 ${
                            item.kind === "ERROR"
                              ? "border-red-500"
                              : item.kind === "WARN"
                                ? "border-amber-500"
                                : "border-transparent"
                          }`}
                        >
                          <span className="font-mono text-[11px] th-text-muted tabular-nums">
                            {fmtTime(item.ts)}
                          </span>
                          <span
                            className={`text-[10px] font-bold tracking-wide text-center rounded-md px-1.5 py-0.5 ${KIND_STYLE[item.kind] || KIND_STYLE.AGENT}`}
                          >
                            {item.kind}
                          </span>
                          <span
                            className={`text-sm truncate ${item.kind === "ERROR" ? "text-red-400 font-medium" : "th-text"}`}
                          >
                            {item.kind === "TOOL" && <Wrench size={12} className="inline mr-1.5 -mt-0.5 th-text-faint" />}
                            {item.kind === "LLM" && <Cpu size={12} className="inline mr-1.5 -mt-0.5 th-text-faint" />}
                            {item.label}
                            {item.count > 1 && (
                              <span className="ml-2 text-[10px] font-bold th-text-muted th-bg-surface border th-border rounded-full px-1.5 py-0.5">
                                ×{item.count}
                              </span>
                            )}
                          </span>
                          <WaterfallTrack item={item} window={turn.stats.window} />
                          <span className="text-[11px] th-text-muted tabular-nums text-right">
                            {fmtDuration(span?.duration_ms)}
                          </span>
                          <ChevronRight
                            size={13}
                            className={`th-text-faint transition-transform ${isOpen ? "rotate-90" : ""}`}
                          />
                        </button>

                        {isOpen && (
                          <div className="ml-[84px] my-1 px-4 py-3 rounded-xl th-bg-surface border th-border font-mono text-[11px] th-text-secondary space-y-2">
                            {errorMessage && (
                              <div>
                                <div className="text-red-400 font-semibold mb-1">{t("errorLabel")}</div>
                                <pre className="whitespace-pre-wrap break-words text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg p-2.5 max-h-80 overflow-y-auto select-text">{errorMessage}</pre>
                              </div>
                            )}
                            <div className="grid grid-cols-[max-content_1fr] gap-x-5 gap-y-1">
                              <span>{t("sourceLabel")}</span>
                              <span className="th-text flex items-center gap-1.5">
                                <Bot size={12} />
                                {span ? span.service || t("agentSourceFallback") : log?.event_name || t("applicationSourceFallback")}
                              </span>
                              <span>trace_id</span>
                              <span className="th-text break-all">{turn.traceId}</span>
                              <span>span_id</span>
                              <span className="th-text break-all">
                                {(span || log)?.span_id || "—"}
                              </span>
                              {attrs.map(([k, v]) => (
                                <span key={k} className="contents">
                                  <span>{k}</span>
                                  <span className="th-text break-all">
                                    {typeof v === "string" ? v : JSON.stringify(v)}
                                  </span>
                                </span>
                              ))}
                            </div>
                            {showFull && (
                              <div>
                                <div className="th-text font-semibold mb-1">{t("contentLabel")}</div>
                                <pre className="whitespace-pre-wrap break-words th-bg-elevated rounded-lg p-2.5 max-h-96 overflow-y-auto">{fullContent}</pre>
                              </div>
                            )}
                            {args && (
                              <div>
                                <div className="th-text font-semibold mb-1">{t("callArgumentsLabel")}</div>
                                <pre className="whitespace-pre-wrap break-all th-bg-elevated rounded-lg p-2.5 max-h-96 overflow-y-auto">{fmtJson(args, Infinity)}</pre>
                              </div>
                            )}
                            {resp && (
                              <div>
                                <div className="th-text font-semibold mb-1">{t("toolResponseLabel")}</div>
                                <pre className="whitespace-pre-wrap break-all th-bg-elevated rounded-lg p-2.5 max-h-96 overflow-y-auto">{fmtJson(resp, Infinity)}</pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
