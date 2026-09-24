"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslations } from "use-intl";
import { CheckCircle2, Plug, PlugZap, Loader2, Trash2, RefreshCw, ChevronDown, ChevronUp, Plus, X, Mail, AlertCircle, Star, Sparkles, Database } from "lucide-react";
import EntityJumpButton from "@/components/EntityJumpButton";
import { providerHasToolMapping } from "@/lib/providerMap";
import OdooConnectModal from "@/components/OdooConnectModal";
import TeamsWebhookModal from "@/components/TeamsWebhookModal";
import { getTeamsWebhookStatus, deleteTeamsWebhook } from "@/lib/api";
import { SkeletonCard } from "./Skeleton";
import {
  GithubIcon,
  GoogleDriveIcon,
  GmailIcon,
  GoogleCalendarIcon,
  GoogleSheetsIcon,
  GoogleDocsIcon,
  OutlookIcon,
  TeamsIcon,
  SharePointIcon,
  OneDriveIcon,
} from "@/components/icons/integrationLogos";

export function getProviders(t) {
  return [
    {
      key: "github",
      label: "GitHub",
      description: t("githubDescription"),
      icon: GithubIcon,
      iconBg: "th-bg-surface",
      badge: t("versionControlBadge"),
      badgeColor: "bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/20",
      providerKey: "github",       // matches DB provider string
      connectPath: "/github/connect",
    },
    {
      key: "microsoft_outlook",
      label: "Outlook",
      description: t("outlookDescription"),
      icon: OutlookIcon,
      iconBg: "bg-[#0078d4]/20",
      badge: "Microsoft 365",
      badgeColor: "bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/20",
      providerKey: "microsoft_outlook",
      connectPath: "/microsoft/outlook/connect",
      msService: "outlook",
    },
    {
      key: "microsoft_teams",
      label: "Teams",
      description: t("teamsDescription"),
      icon: TeamsIcon,
      iconBg: "bg-indigo-500/20",
      badge: "Microsoft 365",
      badgeColor: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border-indigo-500/20",
      providerKey: "microsoft_teams",
      connectPath: "/microsoft/teams/connect",
      msService: "teams",
    },
    {
      key: "microsoft_onedrive",
      label: "OneDrive",
      description: t("onedriveDescription"),
      icon: OneDriveIcon,
      iconBg: "bg-sky-500/20",
      badge: "Microsoft 365",
      badgeColor: "bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/20",
      providerKey: "microsoft_onedrive",
      connectPath: "/microsoft/onedrive/connect",
      msService: "onedrive",
    },
    {
      key: "microsoft_sharepoint",
      label: "SharePoint",
      description: t("sharepointDescription"),
      icon: SharePointIcon,
      iconBg: "bg-blue-400/20",
      badge: "Microsoft 365",
      badgeColor: "bg-blue-400/15 text-blue-600 dark:text-blue-300 border-blue-400/20",
      providerKey: "microsoft_sharepoint",
      connectPath: "/microsoft/sharepoint/connect",
      msService: "sharepoint",
    },
    {
      key: "google_drive",
      label: "Google Drive",
      description: t("googleDriveDescription"),
      icon: GoogleDriveIcon,
      iconBg: "th-bg-surface",
      badge: t("storageBadge"),
      badgeColor: "bg-purple-400/15 text-purple-600 dark:text-purple-300 border-purple-400/20",
      providerKey: "google_drive",
      connectPath: "/google/connect",
      google: true,
    },
    {
      key: "google_gmail",
      label: "Gmail",
      description: t("gmailDescription"),
      icon: GmailIcon,
      iconBg: "th-bg-surface",
      badge: t("emailBadge"),
      badgeColor: "bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/20",
      providerKey: "google_gmail",
      connectPath: "/google/connect",
      google: true,
    },
    {
      key: "google_calendar",
      label: "Google Calendar",
      description: t("googleCalendarDescription"),
      icon: GoogleCalendarIcon,
      iconBg: "th-bg-surface",
      badge: t("calendarBadge"),
      badgeColor: "bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/20",
      providerKey: "google_calendar",
      connectPath: "/google/connect",
      google: true,
    },
    {
      key: "google_sheets",
      label: "Google Sheets",
      description: t("googleSheetsDescription"),
      icon: GoogleSheetsIcon,
      iconBg: "th-bg-surface",
      badge: t("spreadsheetsBadge"),
      badgeColor: "bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/20",
      providerKey: "google_sheets",
      connectPath: "/google/connect",
      google: true,
    },
    {
      key: "google_docs",
      label: "Google Docs",
      description: t("googleDocsDescription"),
      icon: GoogleDocsIcon,
      iconBg: "th-bg-surface",
      badge: t("documentsBadge"),
      badgeColor: "bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/20",
      providerKey: "google_docs",
      connectPath: "/google/connect",
      google: true,
    },
    {
      key: "odoo",
      label: "Odoo",
      description: t("odooDescription"),
      icon: Database,
      iconBg: "bg-purple-500/20",
      badge: t("crmErpBadge"),
      badgeColor: "bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/20",
      providerKey: "odoo",
      custom: true, // not OAuth — opens a credentials modal
    },
  ];
}

function SharedMailboxesPanel({ integration }) {
  const t = useTranslations("IntegrationsManager");
  const [expanded, setExpanded] = useState(false);
  const [mailboxes, setMailboxes] = useState(integration?.meta?.shared_mailboxes || []);
  const [active, setActive] = useState(integration?.meta?.active_shared_mailbox || null);
  const [suggestions, setSuggestions] = useState([]);
  const [newEmail, setNewEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [updatingActive, setUpdatingActive] = useState(false);
  const [error, setError] = useState(null);

  const getHeaders = useCallback(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("th2_auth_token") : null;
    return token
      ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
      : { "Content-Type": "application/json" };
  }, []);

  const fetchMailboxes = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/microsoft/outlook/shared-mailboxes", { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data?.mailboxes) ? data.mailboxes : Array.isArray(data) ? data : [];
        setMailboxes(list);
        setActive(data?.active || null);
      }
    } catch {
      /* silent */
    }
  }, [getHeaders]);

  const fetchSuggestions = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/microsoft/outlook/shared-mailboxes/suggestions", { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSuggestions(Array.isArray(data?.suggestions) ? data.suggestions : []);
      }
    } catch {
      /* silent */
    }
  }, [getHeaders]);

  useEffect(() => {
    if (expanded) {
      fetchMailboxes();
      fetchSuggestions();
    }
  }, [expanded, fetchMailboxes, fetchSuggestions]);

  const addMailbox = useCallback(
    async (rawEmail) => {
      const email = (rawEmail || "").trim().toLowerCase();
      if (!email) return;
      setAdding(true);
      setError(null);
      try {
        const res = await fetch("/api/integrations/microsoft/outlook/shared-mailboxes", {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({ email }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.detail || t("failedAddMailboxError"));
        }
        setNewEmail("");
        await fetchMailboxes();
      } catch (err) {
        setError(err.message);
      } finally {
        setAdding(false);
      }
    },
    [getHeaders, fetchMailboxes],
  );

  const handleAdd = () => addMailbox(newEmail);

  const handleSetActive = async (email) => {
    setUpdatingActive(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/microsoft/outlook/shared-mailboxes/active", {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify({ email: active === email ? null : email }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail || t("failedUpdateActiveMailboxError"));
      }
      const data = await res.json();
      setActive(data?.active || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingActive(false);
    }
  };

  const handleRemove = async (email) => {
    setRemoving(email);
    setError(null);
    try {
      const res = await fetch(`/api/integrations/microsoft/outlook/shared-mailboxes/${encodeURIComponent(email)}`, {
        method: "DELETE",
        headers: getHeaders(),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail || t("failedRemoveMailboxError"));
      }
      await fetchMailboxes();
    } catch (err) {
      setError(err.message);
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="w-full" style={{ maxWidth: 500 }}>
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl border th-border th-bg-surface hover:th-bg-surface-hover transition-all text-xs font-semibold th-text-secondary"
      >
        <Mail size={14} />
        {t("sharedMailboxesLabel")}
        {mailboxes.length > 0 && (
          <span className="ml-1 bg-blue-500/20 border border-blue-500/30 text-blue-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            {mailboxes.length}
          </span>
        )}
        <span className="ml-auto">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {expanded && (
        <div className="mt-2 p-4 rounded-xl border th-border th-bg-surface space-y-3">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              <AlertCircle size={13} />
              {error}
              <button onClick={() => setError(null)} className="ml-auto hover:text-red-300">
                <X size={12} />
              </button>
            </div>
          )}

          {mailboxes.length === 0 && !adding && (
            <p className="th-text-faint text-xs text-center py-2">{t("noSharedMailboxesText")}</p>
          )}

          {mailboxes.map((mb) => {
            const email = typeof mb === "string" ? mb : mb.email;
            const isActive = active === email;
            return (
              <div
                key={email}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg th-bg-body border text-xs transition-colors ${
                  isActive ? "border-amber-500/50 bg-amber-500/5" : "th-border"
                }`}
              >
                <button
                  onClick={() => handleSetActive(email)}
                  disabled={updatingActive}
                  title={isActive ? t("unsetActiveMailboxTooltip") : t("setActiveMailboxTooltip")}
                  className={`shrink-0 p-1 rounded-md transition-all disabled:opacity-50 ${
                    isActive
                      ? "text-amber-400 hover:text-amber-300"
                      : "th-text-faint hover:text-amber-400"
                  }`}
                >
                  <Star size={13} fill={isActive ? "currentColor" : "none"} />
                </button>
                <Mail size={13} className="th-text-muted shrink-0" />
                <span className="th-text-secondary font-medium truncate flex-1">{email}</span>
                {isActive && (
                  <span className="shrink-0 text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                    {t("activeBadge")}
                  </span>
                )}
                <button
                  onClick={() => handleRemove(email)}
                  disabled={removing === email}
                  className="shrink-0 p-1 rounded-md hover:bg-red-500/10 text-red-400 hover:text-red-300 transition-all disabled:opacity-50"
                >
                  {removing === email ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                </button>
              </div>
            );
          })}

          <div className="flex items-center gap-2">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder={t("sharedEmailPlaceholder")}
              className="flex-1 px-3 py-2 rounded-lg th-bg-body border th-border th-text text-xs placeholder:th-text-faint focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-all"
            />
            <button
              onClick={handleAdd}
              disabled={adding || !newEmail.trim()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-400 hover:bg-blue-500/30 hover:text-blue-300 text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {adding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              {t("addButton")}
            </button>
          </div>

          {suggestions.length > 0 && (
            <div className="pt-2 border-t th-border space-y-2">
              <div className="flex items-center gap-1.5 th-text-faint text-[11px] font-semibold uppercase tracking-wider">
                <Sparkles size={11} />
                {t("suggestionsFromGroupsLabel")}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {suggestions
                  .filter((s) => !mailboxes.includes(s.email))
                  .map((s) => (
                    <button
                      key={s.email}
                      onClick={() => addMailbox(s.email)}
                      disabled={adding}
                      title={s.name}
                      className="px-2.5 py-1.5 rounded-lg th-bg-body border th-border hover:border-blue-500/40 th-text-secondary hover:text-blue-400 text-[11px] transition-all disabled:opacity-50 inline-flex items-center gap-1.5"
                    >
                      <Plus size={11} />
                      <span className="truncate max-w-[220px]">{s.email}</span>
                    </button>
                  ))}
                {suggestions.every((s) => mailboxes.includes(s.email)) && (
                  <span className="th-text-faint text-[11px] italic">{t("allSuggestionsAddedText")}</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function IntegrationCard({ provider, integration, onConnect, onDisconnect, connecting, children }) {
  const t = useTranslations("IntegrationsManager");
  const Icon = provider.icon;
  const isConnected = !!integration;
  const tokenStatus = integration?.token_status || (isConnected ? "active" : null);
  const isExpired = isConnected && tokenStatus !== "active";
  return (
    <div
      className={`relative flex flex-col gap-4 p-5 rounded-2xl border th-bg-surface backdrop-blur-xl transition-all duration-300 th-bg-surface-hover hover:scale-[1.02] ${
        isExpired
          ? "border-amber-500/40 shadow-lg shadow-amber-500/10"
          : isConnected
          ? "border-blue-500/40 shadow-lg shadow-blue-500/5"
          : "th-border th-border-hover"
      }`}
      style={{ width: 240 }}
    >
      {isConnected && (
        <div className="absolute top-3 right-3 flex items-center gap-1">
          {isExpired ? (
            <div
              className="pill-warning flex items-center gap-1 border text-[10px] font-semibold px-2 py-0.5 rounded-full"
              title={t("tokenExpiredTooltip")}
            >
              <AlertCircle size={10} /> {t("reconnectNeededLabel")}
            </div>
          ) : (
            <div className="pill-success flex items-center gap-1 border text-[10px] font-semibold px-2 py-0.5 rounded-full">
              <CheckCircle2 size={10} /> {t("connectedLabel")}
            </div>
          )}
          {providerHasToolMapping(provider.providerKey) && (
            <EntityJumpButton
              to="agents"
              params={{ filter: `uses:${provider.providerKey}` }}
              title={t("seeAgentsUsingTooltip", { provider: provider.label })}
              size={11}
              className="!p-1"
            />
          )}
        </div>
      )}
      <div className={`w-12 h-12 rounded-xl ${provider.iconBg} border th-border flex items-center justify-center`}>
        <Icon size={26} />
      </div>
      <div className="flex flex-col gap-1 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="th-text font-bold text-sm">{provider.label}</h3>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${provider.badgeColor}`}>
            {provider.badge}
          </span>
        </div>
        <p className="th-text-muted text-xs leading-relaxed">{provider.description}</p>
        {isConnected && integration.username && (
          <p className="th-text-faint text-xs mt-1 break-all">
            {t("asPrefixLabel")} <span className="th-text-secondary font-medium">@{integration.username}</span>
          </p>
        )}
      </div>
      {isConnected && !isExpired && (
        <button
          onClick={() => onDisconnect(provider)}
          className="btn-danger-outline flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-semibold transition-all"
        >
          <Trash2 size={13} /> {t("disconnectButton")}
        </button>
      )}
      {isConnected && isExpired && (
        <div className="flex gap-2">
          <button
            onClick={() => onConnect(provider)}
            disabled={connecting === provider.key}
            className="btn-warning-outline flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {connecting === provider.key ? (
              <><Loader2 size={13} className="animate-spin" /> {t("redirectingLabel")}</>
            ) : (
              <><PlugZap size={13} /> {t("reconnectButton")}</>
            )}
          </button>
          <button
            onClick={() => onDisconnect(provider)}
            title={t("disconnectButton")}
            className="btn-danger-outline shrink-0 p-2 rounded-xl border transition-all"
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}
      {!isConnected && (
        <button
          onClick={() => onConnect(provider)}
          disabled={connecting === provider.key}
          className="btn-brand flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-white text-xs font-bold shadow-lg shadow-blue-500/20 hover:scale-105"
        >
          {connecting === provider.key ? (
            <><Loader2 size={13} className="animate-spin" /> {t("redirectingLabel")}</>
          ) : (
            <><PlugZap size={13} /> {t("connectButton")}</>
          )}
        </button>
      )}
      {children && <div className="pt-1 border-t th-border -mx-1 px-1">{children}</div>}
    </div>
  );
}

/**
 * Standalone card for the incoming Teams webhook (apowerb#198). Unlike the
 * OAuth providers above, this isn't backed by `/api/integrations/` — it has
 * its own tri-state endpoint (`getTeamsWebhookStatus` never returns the
 * URL, only `configured`), so it manages its own fetch/refresh instead of
 * going through `integrationMap`.
 */
export function TeamsWebhookCard({ onToast = () => {} }) {
  const t = useTranslations("IntegrationsManager");
  const [configured, setConfigured] = useState(null);
  const [checking, setChecking] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const refreshStatus = useCallback(async () => {
    setChecking(true);
    try {
      const res = await getTeamsWebhookStatus();
      setConfigured(!!res?.configured);
    } catch {
      setConfigured(null);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus(); // eslint-disable-line react-hooks/set-state-in-effect -- async fetch with setState in callbacks
  }, [refreshStatus]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteTeamsWebhook();
      setConfigured(false);
      onToast("success", t("teamsWebhookDeletedToast"));
    } catch (err) {
      onToast("error", err.message || t("teamsWebhookDeleteFailedError"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className={`relative flex flex-col gap-4 p-5 rounded-2xl border th-bg-surface backdrop-blur-xl transition-all duration-300 th-bg-surface-hover hover:scale-[1.02] ${
        configured ? "border-blue-500/40 shadow-lg shadow-blue-500/5" : "th-border th-border-hover"
      }`}
      style={{ width: 240 }}
    >
      {configured && (
        <div className="absolute top-3 right-3">
          <div className="pill-success flex items-center gap-1 border text-[10px] font-semibold px-2 py-0.5 rounded-full">
            <CheckCircle2 size={10} /> {t("connectedLabel")}
          </div>
        </div>
      )}
      <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border th-border flex items-center justify-center">
        <TeamsIcon size={26} />
      </div>
      <div className="flex flex-col gap-1 flex-1">
        <h3 className="th-text font-bold text-sm">{t("teamsWebhookTitle")}</h3>
        <p className="th-text-muted text-xs leading-relaxed">{t("teamsWebhookDescription")}</p>
      </div>
      {configured ? (
        <div className="flex gap-2">
          <button
            onClick={() => setModalOpen(true)}
            className="btn-brand flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-white text-xs font-bold shadow-lg shadow-blue-500/20"
          >
            <PlugZap size={13} /> {t("teamsWebhookReplaceButton")}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            title={t("teamsWebhookDeleteButton")}
            className="btn-danger-outline shrink-0 p-2 rounded-xl border transition-all disabled:opacity-50"
          >
            {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
          </button>
        </div>
      ) : (
        <button
          onClick={() => setModalOpen(true)}
          disabled={checking}
          className="btn-brand flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-white text-xs font-bold shadow-lg shadow-blue-500/20 disabled:opacity-60"
        >
          <PlugZap size={13} /> {t("teamsWebhookConfigureButton")}
        </button>
      )}
      {modalOpen && (
        <TeamsWebhookModal
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            setModalOpen(false);
            setConfigured(true);
            onToast("success", t("teamsWebhookConfiguredToast"));
          }}
        />
      )}
    </div>
  );
}

function StatsBar({ total, connected }) {
  const t = useTranslations("IntegrationsManager");
  const cards = [
    { label: t("availableLabel"),  value: total,     icon: Plug,         color: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/20"   },
    { label: t("connectedLabel"),  value: connected, icon: CheckCircle2, color: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/20"   },
    { label: t("comingSoonLabel"), value: "0",       icon: PlugZap,      color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" },
  ];
  return (
    <div className="grid grid-cols-3 gap-3">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div key={c.label} className={`${c.bg} ${c.border} border rounded-xl p-4 flex items-center gap-3`}>
            <div className={`p-2 rounded-lg ${c.bg}`}>
              <Icon size={20} className={c.color} />
            </div>
            <div>
              <p className="text-2xl font-black th-text">{c.value}</p>
              <p className="text-xs th-text-muted">{c.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function IntegrationsManager() {
  const t = useTranslations("IntegrationsManager");
  const PROVIDERS = useMemo(() => getProviders(t), [t]);
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [connecting, setConnecting]     = useState(null);
  const [refreshing, setRefreshing]     = useState(false);
  const [toast, setToast]               = useState(null);
  const [odooModalOpen, setOdooModalOpen] = useState(false);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchIntegrations = async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const token = localStorage.getItem("th2_auth_token");
      const res = await fetch("/api/integrations/", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setIntegrations(Array.isArray(data) ? data : []);
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchIntegrations(); }, []);

  const handleConnect = async (provider) => {
    // Custom (non-OAuth) providers open a dedicated modal instead of
    // redirecting through an OAuth flow.
    if (provider.custom && provider.providerKey === "odoo") {
      setOdooModalOpen(true);
      return;
    }

    setConnecting(provider.key);
    try {
      const token = localStorage.getItem("th2_auth_token");
      const callbackOrigin = window.location.origin;
      let connectUrl;
      let redirectUri;

      if (provider.google) {
        redirectUri = `${callbackOrigin}/integrations/google/callback`;
        connectUrl = `/api/integrations/google/connect?service=${provider.key}&redirect_uri=${encodeURIComponent(redirectUri)}`;
      } else if (provider.msService) {
        redirectUri = `${callbackOrigin}/integrations/microsoft/callback`;
        connectUrl = `/api/integrations${provider.connectPath}?redirect_uri=${encodeURIComponent(redirectUri)}`;
      } else {
        redirectUri = `${callbackOrigin}/integrations/${provider.key}/callback`;
        connectUrl = `/api/integrations${provider.connectPath}?redirect_uri=${encodeURIComponent(redirectUri)}`;
      }

      const res = await fetch(connectUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || t("failedGetOAuthUrlError"));

      if (provider.msService) {
        sessionStorage.setItem(
          "microsoft_oauth_pending",
          JSON.stringify({ state: data.state, service: provider.msService }),
        );
      }
      if (provider.google) {
        localStorage.setItem("google_oauth_service", provider.key);
      }

      window.location.href = data.url;
    } catch (err) {
      showToast("error", err.message || t("couldNotStartOAuthError", { provider: provider.label }));
      setConnecting(null);
    }
  };

  const handleDisconnect = async (provider) => {
    try {
      const token = localStorage.getItem("th2_auth_token");
      const res = await fetch(`/api/integrations/${provider.providerKey}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail || t("genericFailedError")); }
      setIntegrations((prev) => prev.filter((i) => i.provider !== provider.providerKey));
      showToast("success", t("disconnectedSuccessToast", { provider: provider.label }));
    } catch (err) {
      showToast("error", err.message || t("failedDisconnectError", { provider: provider.label }));
    }
  };

  // Build a map keyed by the DB provider string (e.g. "github", "microsoft_outlook")
  const integrationMap = Object.fromEntries(integrations.map((i) => [i.provider, i]));

  return (
    <div className="h-full flex flex-col th-bg-body overflow-hidden">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl text-sm font-medium ${
          toast.type === "success"
            ? "bg-blue-500/20 border-blue-500/30 text-blue-300"
            : "bg-purple-500/20 border-purple-500/30 text-purple-300"
        }`}>
          {toast.type === "success" ? <CheckCircle2 size={16} /> : <PlugZap size={16} />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <header className="shrink-0 p-6 bg-linear-to-r from-brand/20 to-brand-secondary/20 border-b th-border backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-linear-to-br from-brand to-brand-secondary rounded-2xl shadow-lg">
              <PlugZap size={32} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black th-text tracking-tight">{t("pageTitle")}</h1>
              <p className="th-text-muted text-sm font-medium mt-1">
                {t("pageSubtitle")}
              </p>
            </div>
          </div>
          <button
            onClick={() => fetchIntegrations(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-5 py-3 bg-brand hover:bg-brand-hover border border-brand/30 text-white rounded-xl font-bold transition-all hover:scale-105 disabled:opacity-50 shadow-lg shadow-blue-500/20"
          >
            <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">

          <StatsBar total={PROVIDERS.length} connected={integrations.length} />

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : (
            <>
              <p className="th-text-faint text-xs font-semibold uppercase tracking-widest">
                {t("availableIntegrationsHeading")}
              </p>
              <div className="flex flex-wrap gap-4">
                {PROVIDERS.map((provider) => {
                  const integration = integrationMap[provider.providerKey] || null;
                  const showSharedMailboxes = provider.key === "microsoft_outlook" && integration;
                  return (
                    <IntegrationCard
                      key={provider.key}
                      provider={provider}
                      integration={integration}
                      onConnect={handleConnect}
                      onDisconnect={handleDisconnect}
                      connecting={connecting}
                    >
                      {showSharedMailboxes && (
                        <SharedMailboxesPanel integration={integration} />
                      )}
                    </IntegrationCard>
                  );
                })}
                <TeamsWebhookCard onToast={showToast} />
              </div>
            </>
          )}
        </div>
      </div>

      {odooModalOpen && (
        <OdooConnectModal
          onClose={() => setOdooModalOpen(false)}
          onConnected={() => {
            showToast("success", t("odooConnectedSuccessToast"));
            fetchIntegrations(true);
          }}
        />
      )}
    </div>
  );
}