"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "@/lib/navigation";
import {
  Users,
  MessageSquare,
  Coins,
  Plus,
  ArrowRight,
  Clock,
  Bell,
  Zap,
  PlugZap,
  Calendar,
  Sparkles,
  Play,
  LayoutDashboard,
} from "lucide-react";
import { useTranslations } from "use-intl";
import { useAuth } from "@/contexts/AuthContext";
import {
  listAgents,
  getBillingBalance,
  listNotifications,
  getPublicConfig,
  createAgent,
  listAllSessions,
  listPipelines,
  listSuperAgents,
} from "@/lib/api";
import { useIntegrations } from "@/hooks/useIntegrations";
import { Skeleton } from "./Skeleton";
import EmptyState from "./EmptyState";
import { useToast } from "./Toast";
import OnboardingTour from "./OnboardingTour";
import { formatDate as formatDateParis } from "@/lib/datetime";

const FEATURED_TEMPLATE_COUNT = 3;

function formatRelative(ts, t) {
  if (!ts) return "";
  const date = typeof ts === "number" ? new Date(ts) : new Date(ts);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return t("justNow");
  if (min < 60) return t("minutesAgo", { min });
  const h = Math.floor(min / 60);
  if (h < 24) return t("hoursAgo", { h });
  const d = Math.floor(h / 24);
  if (d < 7) return t("daysAgo", { d });
  return formatDateParis(ts);
}

function StatCard({ icon: Icon, label, value, hint, loading, tone = "brand" }) {
  const iconBg = {
    brand: "bg-brand text-white shadow-brand/20",
    emerald: "bg-emerald-500 text-white shadow-emerald-500/20",
    amber: "bg-amber-500 text-white shadow-amber-500/20",
    blue: "bg-blue-500 text-white shadow-blue-500/20",
  }[tone] || "bg-brand text-white shadow-brand/20";

  return (
    <div className="glass-card stat-card p-4 rounded-2xl flex flex-col gap-2">
      <div className="flex items-center gap-2.5">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-sm shrink-0 ${iconBg}`}>
          <Icon size={18} />
        </div>
        <span className="text-xs th-text-muted font-medium">{label}</span>
      </div>
      {loading ? (
        <Skeleton className="h-8 w-20" />
      ) : (
        <div className="text-2xl font-bold th-text">{value}</div>
      )}
      {hint && <div className="text-xs th-text-muted">{hint}</div>}
    </div>
  );
}

export default function HomeDashboard() {
  const router = useRouter();
  const t = useTranslations("HomeDashboard");
  const { user, updateProfile } = useAuth();
  const toast = useToast();
  const { integrations, loading: integrationsLoading } = useIntegrations();

  const [agents, setAgents] = useState([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [pipelines, setPipelines] = useState([]);
  const [pipelinesLoading, setPipelinesLoading] = useState(true);
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [balance, setBalance] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [billingEnabled, setBillingEnabled] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [notifsLoading, setNotifsLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [creatingStarter, setCreatingStarter] = useState(false);

  const fetchData = useCallback(async () => {
    setAgentsLoading(true);
    setSessionsLoading(true);
    setPipelinesLoading(true);
    setTemplatesLoading(true);
    setBalanceLoading(true);
    setNotifsLoading(true);

    const [agentsRes, sessionsRes, pipelinesRes, templatesRes, cfgRes, balRes, notifsRes] =
      await Promise.allSettled([
        listAgents(),
        listAllSessions(),
        listPipelines(),
        listSuperAgents(),
        getPublicConfig(),
        getBillingBalance(),
        listNotifications({ limit: 5, unread_only: false }),
      ]);

    if (agentsRes.status === "fulfilled") {
      setAgents(Array.isArray(agentsRes.value) ? agentsRes.value : []);
    }
    if (sessionsRes.status === "fulfilled") {
      const raw = sessionsRes.value;
      const list = Array.isArray(raw) ? raw : raw?.sessions || [];
      setSessions(Array.isArray(list) ? list : []);
    }
    if (pipelinesRes.status === "fulfilled") {
      const raw = pipelinesRes.value;
      const list = Array.isArray(raw) ? raw : raw?.pipelines || [];
      setPipelines(Array.isArray(list) ? list : []);
    }
    if (templatesRes.status === "fulfilled") {
      const raw = templatesRes.value;
      const list = Array.isArray(raw) ? raw : raw?.templates || raw?.superagents || [];
      setTemplates(Array.isArray(list) ? list : []);
    }
    if (cfgRes.status === "fulfilled") {
      setBillingEnabled(cfgRes.value?.billing_enabled !== false);
    }
    if (balRes.status === "fulfilled") {
      setBalance(balRes.value);
    }
    if (notifsRes.status === "fulfilled") {
      const list = notifsRes.value?.notifications ?? [];
      setNotifications(Array.isArray(list) ? list : []);
    }

    setAgentsLoading(false);
    setSessionsLoading(false);
    setPipelinesLoading(false);
    setTemplatesLoading(false);
    setBalanceLoading(false);
    setNotifsLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    // Le flag SERVEUR fait foi (onboarding par COMPTE, pas par navigateur).
    // On ne gate plus sur localStorage : sinon le modal restait masque pour un
    // nouvel utilisateur sur un navigateur qui avait deja vu l'onboarding.
    if (!user) return;
    if (user.onboarding_completed === true) return;
    const timer = setTimeout(() => setShowOnboarding(true), 600);
    return () => clearTimeout(timer);
  }, [user]);

  const handleCloseOnboarding = useCallback(() => {
    setShowOnboarding(false);
    // Persiste le flag cote serveur -> l'onboarding ne re-apparait pas, quel que
    // soit le navigateur. Best-effort : un echec reseau le re-proposera plus tard.
    updateProfile?.({ onboarding_completed: true }).catch(() => {});
  }, [updateProfile]);

  const ownedAgents = useMemo(
    () => agents.filter((a) => (a.agent_type || "base") !== "sub_agent"),
    [agents],
  );

  const recentSessions = useMemo(() => {
    return [...sessions]
      .sort((a, b) => {
        const ta = new Date(a.update_time || a.updated_at || a.last_update_time || 0).getTime();
        const tb = new Date(b.update_time || b.updated_at || b.last_update_time || 0).getTime();
        return tb - ta;
      })
      .slice(0, 5);
  }, [sessions]);

  const topSession = recentSessions[0] || null;

  const activePipelines = useMemo(
    () => pipelines.filter((p) => p.status !== "disabled" && p.enabled !== false),
    [pipelines],
  );

  const connectedIntegrations = useMemo(
    () => integrations.filter((i) => i.status !== "disconnected" && i.status !== "error"),
    [integrations],
  );

  const featuredTemplates = useMemo(
    () =>
      [...templates]
        .filter((tpl) => tpl.featured || tpl.is_featured || true)
        .slice(0, FEATURED_TEMPLATE_COUNT),
    [templates],
  );

  const credits = balance?.credits ?? balance?.balance ?? null;
  const unreadNotifs = notifications.filter((n) => !n.is_read);

  const resumeSession = (session) => {
    const agentName = session.agent_name || session.agent_id || session.agentId;
    const sessionId = session.session_id || session.id;
    if (!agentName || !sessionId) {
      router.push("/chat");
      return;
    }
    router.push(`/chat?agent=${encodeURIComponent(agentName)}&session=${encodeURIComponent(sessionId)}`);
  };

  const handleNewAgent = () => router.push("/agents");

  const handleCreateStarter = async () => {
    if (creatingStarter) return;
    setCreatingStarter(true);
    try {
      const name = `starter_agent_${Date.now()}`;
      await createAgent({
        agent_name: name,
        agent_type: "base",
        agent_description: "Your first agent. Ask it anything.",
        agent_instruction:
          "You are a helpful AI assistant. Answer clearly and concisely.",
        agent_model: "gemini-2.0-flash",
        agent_tools: [],
        sub_agents: [],
      });
      toast.success(t("starterAgentCreated"));
      await fetchData();
      router.push("/agents");
    } catch (err) {
      toast.error(err.message || t("starterAgentFailed"));
    } finally {
      setCreatingStarter(false);
    }
  };

  const greetingName = user?.name || user?.email?.split("@")[0] || t("fallbackName");
  const hasAgents = ownedAgents.length > 0;

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 md:p-5 lg:p-6 max-w-7xl mx-auto space-y-5">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold th-text">
              {t("greeting", { name: greetingName })}
            </h1>
            <p className="text-sm th-text-muted mt-1">
              {hasAgents
                ? t("pickUpSubtitle")
                : t("newSubtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={handleNewAgent}
            className="btn-brand px-5 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center gap-2 self-start md:self-auto"
          >
            <Plus size={16} />
            {t("newAgentButton")}
          </button>
        </header>

        {/* Resume hero */}
        <section aria-label="Resume">
          {sessionsLoading ? (
            <Skeleton className="h-24 w-full rounded-2xl" />
          ) : topSession ? (
            <button
              type="button"
              onClick={() => resumeSession(topSession)}
              className="group w-full text-left glass-card rounded-2xl p-4 md:p-5 flex items-center gap-4 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand hover:border-brand/40"
            >
              <div className="w-12 h-12 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0">
                <Play size={20} className="text-brand" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold th-text-faint uppercase tracking-wider">
                  {t("continueLabel")}
                </div>
                <div className="text-base font-semibold th-text truncate mt-0.5">
                  {topSession.agent_name || topSession.agent_id || t("recentSessionFallback")}
                </div>
                <div className="text-xs th-text-muted truncate mt-0.5">
                  {formatRelative(topSession.update_time || topSession.updated_at || topSession.last_update_time, t)}
                  {topSession.event_count ? ` · ${t("messagesCount", { count: topSession.event_count })}` : ""}
                </div>
              </div>
              <ArrowRight
                size={20}
                className="shrink-0 th-text-faint group-hover:text-brand group-hover:translate-x-1 transition-all"
              />
            </button>
          ) : hasAgents ? (
            <button
              type="button"
              onClick={() => router.push("/chat")}
              className="group w-full text-left glass-card rounded-2xl p-4 md:p-5 flex items-center gap-4 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand hover:border-brand/40"
            >
              <div className="w-12 h-12 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0">
                <MessageSquare size={20} className="text-brand" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold th-text-faint uppercase tracking-wider">
                  {t("readyLabel")}
                </div>
                <div className="text-base font-semibold th-text mt-0.5">
                  {t("startNewConversation")}
                </div>
                <div className="text-xs th-text-muted mt-0.5">
                  {t("talkToAgents", { count: ownedAgents.length })}
                </div>
              </div>
              <ArrowRight size={20} className="shrink-0 th-text-faint group-hover:text-brand group-hover:translate-x-1 transition-all" />
            </button>
          ) : (
            <div className="glass-card rounded-2xl p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0">
                <Sparkles size={20} className="text-brand" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-base font-semibold th-text">
                  {t("noAgentTitle")}
                </div>
                <div className="text-xs th-text-muted mt-0.5">
                  {t("noAgentSubtitle")}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCreateStarter}
                  disabled={creatingStarter}
                  className="btn-brand px-4 py-2 rounded-xl text-xs font-semibold disabled:opacity-60"
                >
                  {creatingStarter ? t("creatingEllipsis") : t("createStarterButton")}
                </button>
                <button
                  type="button"
                  onClick={handleNewAgent}
                  className="px-4 py-2 rounded-xl text-xs font-semibold th-bg-surface border th-border hover:th-bg-surface-hover transition-colors"
                >
                  {t("buildOwnButton")}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Stats — now action-oriented */}
        <section
          aria-label="Overview"
          className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4"
        >
          <StatCard
            icon={Users}
            label={t("agentsLabel")}
            value={ownedAgents.length}
            loading={agentsLoading}
            hint={ownedAgents.length === 0 ? t("createOneHint") : t("viewAllHint")}
            tone="brand"
          />
          <StatCard
            icon={PlugZap}
            label={t("integrationsLabel")}
            value={connectedIntegrations.length}
            loading={integrationsLoading}
            hint={
              connectedIntegrations.length === 0
                ? t("connectHint")
                : t("connectedCount", { count: connectedIntegrations.length })
            }
            tone="emerald"
          />
          <StatCard
            icon={Calendar}
            label={t("scheduledLabel")}
            value={activePipelines.length}
            loading={pipelinesLoading}
            hint={
              activePipelines.length === 0 ? t("automateTaskHint") : t("activeTriggersHint")
            }
            tone="blue"
          />
          {billingEnabled ? (
            <StatCard
              icon={Coins}
              label={t("creditsLabel")}
              value={credits !== null ? credits.toLocaleString() : "—"}
              loading={balanceLoading}
              hint={credits === 0 ? t("topUpHint") : null}
              tone="amber"
            />
          ) : (
            <StatCard
              icon={Bell}
              label={t("unreadLabel")}
              value={unreadNotifs.length}
              loading={notifsLoading}
              hint={
                unreadNotifs.length > 0 ? t("checkNotificationsHint") : t("allCaughtUpHint")
              }
              tone="amber"
            />
          )}
        </section>

        {/* Two-column : recent sessions + discover */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Recent sessions */}
          <section
            aria-label="Recent sessions"
            className="lg:col-span-2 glass-card rounded-2xl p-5"
          >
            <div className="mb-4">
              <h2 className="text-sm font-semibold th-text">{t("recentConversationsHeading")}</h2>
            </div>

            {sessionsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : recentSessions.length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                title={hasAgents ? t("noConversationsTitle") : t("noAgentsTitle")}
                description={
                  hasAgents
                    ? t("openChatDescription")
                    : t("buildAgentDescription")
                }
                action={hasAgents ? () => router.push("/chat") : handleCreateStarter}
                actionLabel={
                  hasAgents
                    ? t("openChatAction")
                    : creatingStarter
                      ? t("creatingEllipsis")
                      : t("createStarterAgentAction")
                }
              />
            ) : (
              <ul className="space-y-2">
                {recentSessions.map((session) => {
                  const sid = session.session_id || session.id;
                  const agentName = session.agent_name || session.agent_id || t("agentFallback");
                  const ts =
                    session.update_time ||
                    session.updated_at ||
                    session.last_update_time ||
                    session.create_time;
                  return (
                    <li key={sid}>
                      <button
                        type="button"
                        onClick={() => resumeSession(session)}
                        className="w-full text-left p-3 rounded-xl th-bg-surface hover:th-bg-surface-hover border th-border transition-colors flex items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                      >
                        <div className="w-9 h-9 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
                          <MessageSquare size={16} className="text-brand" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold th-text truncate">
                            {agentName}
                          </div>
                          <div className="text-xs th-text-muted truncate">
                            {session.last_message || sid}
                          </div>
                        </div>
                        <div className="text-[11px] th-text-faint shrink-0 hidden sm:flex items-center gap-1">
                          <Clock size={11} />
                          {formatRelative(ts, t)}
                        </div>
                        <ArrowRight size={14} className="th-text-faint shrink-0" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Discover / Notifications column */}
          <div className="flex flex-col gap-4 md:gap-6">
            {/* Notifications — only if there are unread */}
            {unreadNotifs.length > 0 && (
              <section
                aria-label="Unread notifications"
                className="glass-card rounded-2xl p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold th-text">
                    {t("notificationsHeading")}
                  </h2>
                  <span className="text-[11px] font-semibold bg-brand text-white px-2.5 py-1 rounded-full leading-none">
                    {t("newCount", { count: unreadNotifs.length })}
                  </span>
                </div>
                <ul className="space-y-2">
                  {unreadNotifs.slice(0, 3).map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => n.link && router.push(n.link)}
                        disabled={!n.link}
                        className="w-full text-left p-2.5 rounded-xl notif-unread hover:th-bg-surface-hover transition-colors disabled:cursor-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                      >
                        <div className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand mt-1.5 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold th-text truncate">
                              {n.title || t("notificationFallback")}
                            </div>
                            {n.message && (
                              <div className="text-[11px] th-text-muted line-clamp-2 mt-0.5">
                                {n.message}
                              </div>
                            )}
                            <div className="text-[10px] th-text-faint mt-1">
                              {formatRelative(n.created_at, t)}
                            </div>
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Discover — featured templates */}
            <section
              aria-label="Discover"
              className="glass-card rounded-2xl p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold th-text inline-flex items-center gap-1.5">
                  <Sparkles size={14} className="text-brand" />
                  {t("discoverHeading")}
                </h2>
                <button
                  type="button"
                  onClick={() => router.push("/marketplace")}
                  className="text-xs th-text-faint hover:text-brand transition-colors inline-flex items-center gap-1 rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  {t("browseButton")}
                  <ArrowRight size={12} />
                </button>
              </div>

              {templatesLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </div>
              ) : featuredTemplates.length === 0 ? (
                <p className="text-xs th-text-muted py-4 text-center">
                  {t("noTemplatesText")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {featuredTemplates.map((tpl) => {
                    const key = tpl.template_id || tpl.id || tpl.name;
                    return (
                      <li key={key}>
                        <button
                          type="button"
                          onClick={() =>
                            router.push(
                              `/marketplace?template=${encodeURIComponent(key)}`,
                            )
                          }
                          className="w-full text-left p-2.5 rounded-xl th-bg-surface border th-border hover:border-brand/40 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                        >
                          <div className="text-xs font-semibold th-text truncate">
                            {tpl.label || tpl.name || t("templateFallback")}
                          </div>
                          {tpl.description && (
                            <div className="text-[11px] th-text-muted line-clamp-2 mt-0.5">
                              {tpl.description}
                            </div>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Shortcuts */}
            <section aria-label="Shortcuts" className="glass-card rounded-2xl p-5">
              <h2 className="text-sm font-semibold th-text mb-3">{t("shortcutsHeading")}</h2>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => router.push("/integrations")}
                  className="w-full text-left p-2.5 rounded-xl th-bg-surface border th-border hover:th-bg-surface-hover transition-colors flex items-center gap-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  <PlugZap size={16} className="text-brand shrink-0" />
                  <span className="text-xs th-text flex-1 truncate">
                    {t("manageIntegrationsLabel")}
                  </span>
                  <ArrowRight size={12} className="th-text-faint" />
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/bi")}
                  className="w-full text-left p-2.5 rounded-xl th-bg-surface border th-border hover:th-bg-surface-hover transition-colors flex items-center gap-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  <LayoutDashboard size={16} className="text-brand shrink-0" />
                  <span className="text-xs th-text flex-1 truncate">
                    {t("biDashboardsLabel")}
                  </span>
                  <ArrowRight size={12} className="th-text-faint" />
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/tool-box")}
                  className="w-full text-left p-2.5 rounded-xl th-bg-surface border th-border hover:th-bg-surface-hover transition-colors flex items-center gap-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  <Zap size={16} className="text-brand shrink-0" />
                  <span className="text-xs th-text flex-1 truncate">
                    {t("toolBoxLabel")}
                  </span>
                  <ArrowRight size={12} className="th-text-faint" />
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>

      {showOnboarding && (
        <OnboardingTour
          onClose={handleCloseOnboarding}
          onCreateStarterAgent={handleCreateStarter}
          canCreateStarter={ownedAgents.length === 0}
          creatingStarter={creatingStarter}
        />
      )}
    </div>
  );
}
