"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "@/lib/navigation";
import {
  Plug,
  Mail,
  ChevronDown,
  Check,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { useIntegrations } from "@/hooks/useIntegrations";
import { useTranslations } from "use-intl";

const PROVIDER_LABELS = {
  microsoft_outlook:    "Outlook",
  microsoft_teams:      "Teams",
  microsoft_onedrive:   "OneDrive",
  microsoft_sharepoint: "SharePoint",
  github:               "GitHub",
  google_drive:         "Google Drive",
  google_gmail:         "Gmail",
  google_calendar:      "Google Calendar",
  google_sheets:        "Google Sheets",
  google_docs:          "Google Docs",
};

export default function IntegrationShortcutBar() {
  const t = useTranslations("IntegrationShortcutBar");
  const router = useRouter();
  const { integrations, byProvider, refetch } = useIntegrations();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [mailboxMenuOpen, setMailboxMenuOpen] = useState(false);
  const [updatingActive, setUpdatingActive] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!popoverOpen && !mailboxMenuOpen) return;
    const onClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setPopoverOpen(false);
        setMailboxMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [popoverOpen, mailboxMenuOpen]);

  const expiredCount = integrations.filter(
    (i) => i.token_status && i.token_status !== "active",
  ).length;
  const connectedCount = integrations.length;

  const outlook = byProvider["microsoft_outlook"];
  const sharedMailboxes = outlook?.meta?.shared_mailboxes || [];
  const activeMailbox = outlook?.meta?.active_shared_mailbox || null;
  const showMailboxSwitcher =
    !!outlook &&
    outlook.token_status === "active" &&
    sharedMailboxes.length > 0;

  const setActiveMailbox = async (email) => {
    if (!outlook) return;
    setUpdatingActive(true);
    try {
      const token = localStorage.getItem("th2_auth_token");
      const res = await fetch(
        "/api/integrations/microsoft/outlook/shared-mailboxes/active",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            email: activeMailbox === email ? null : email,
          }),
        },
      );
      if (res.ok) await refetch();
    } catch (err) {
      console.error("[IntegrationShortcutBar] setActiveMailbox failed:", err);
    } finally {
      setUpdatingActive(false);
      setMailboxMenuOpen(false);
    }
  };

  return (
    <div
      ref={rootRef}
      className="flex items-center gap-1.5 px-1 pb-2 text-xs relative"
    >
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setPopoverOpen((o) => !o);
            setMailboxMenuOpen(false);
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all ${
            expiredCount > 0
              ? "warning-pill"
              : "th-border th-bg-surface hover:th-bg-surface-hover th-text-secondary"
          }`}
          title={t("integrations")}
          aria-label={t("integrations")}
        >
          <Plug size={12} />
          <span className="font-semibold">{t("integrations")}</span>
          {connectedCount > 0 && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                expiredCount > 0
                  ? "warning-pill-badge"
                  : "bg-blue-500/20 text-blue-300"
              }`}
            >
              {expiredCount > 0
                ? t("expiredCount", { count: expiredCount })
                : connectedCount}
            </span>
          )}
        </button>

        {popoverOpen && (
          <div className="absolute bottom-full mb-2 left-0 z-50 w-72 p-3 rounded-xl border th-border th-bg-sidebar shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="th-text-secondary font-semibold text-xs">
                {t("yourIntegrations")}
              </span>
              <button
                type="button"
                onClick={() => {
                  setPopoverOpen(false);
                  router.push("/integrations");
                }}
                className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 font-semibold"
              >
                {t("manage")} <ExternalLink size={10} />
              </button>
            </div>
            {integrations.length === 0 ? (
              <p className="th-text-faint text-[11px] text-center py-2">
                {t("noIntegrations")}
              </p>
            ) : (
              <ul className="space-y-1">
                {integrations.map((i) => {
                  const label = PROVIDER_LABELS[i.provider] || i.provider;
                  const isExpired =
                    i.token_status && i.token_status !== "active";
                  return (
                    <li
                      key={i.provider}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md th-bg-surface/50"
                    >
                      {isExpired ? (
                        <AlertCircle
                          size={11}
                          className="text-amber-400 shrink-0"
                        />
                      ) : (
                        <CheckCircle2
                          size={11}
                          className="text-blue-400 shrink-0"
                        />
                      )}
                      <span className="flex-1 th-text-secondary text-[11px] font-medium truncate">
                        {label}
                      </span>
                      <span
                        className={`text-[10px] font-semibold ${
                          isExpired ? "text-amber-300" : "text-blue-300/80"
                        }`}
                      >
                        {isExpired ? t("expired") : t("active")}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {showMailboxSwitcher && (
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setMailboxMenuOpen((o) => !o);
              setPopoverOpen(false);
            }}
            disabled={updatingActive}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border th-border th-bg-surface hover:th-bg-surface-hover th-text-secondary transition-all disabled:opacity-60"
            title={t("activeMailboxTooltip")}
            aria-label={t("switchMailbox")}
          >
            <Mail size={12} />
            <span className="font-semibold truncate max-w-[160px]">
              {activeMailbox || t("myMailbox")}
            </span>
            <ChevronDown size={11} />
          </button>

          {mailboxMenuOpen && (
            <div className="absolute bottom-full mb-2 left-0 z-50 w-64 py-1 rounded-xl border th-border th-bg-sidebar shadow-xl">
              <button
                type="button"
                onClick={() => setActiveMailbox(activeMailbox)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:th-bg-surface-hover text-xs text-left"
              >
                {activeMailbox === null ? (
                  <Check size={12} className="text-blue-400 shrink-0" />
                ) : (
                  <span className="w-3 shrink-0" />
                )}
                <span className="th-text-secondary flex-1 truncate">
                  {t("myMailbox")}
                </span>
                <span className="th-text-faint text-[10px]">{t("default")}</span>
              </button>
              <div className="my-1 border-t th-border" />
              {sharedMailboxes.map((email) => (
                <button
                  key={email}
                  type="button"
                  onClick={() => setActiveMailbox(email)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:th-bg-surface-hover text-xs text-left"
                >
                  {activeMailbox === email ? (
                    <Check size={12} className="text-blue-400 shrink-0" />
                  ) : (
                    <span className="w-3 shrink-0" />
                  )}
                  <span className="th-text-secondary flex-1 truncate">
                    {email}
                  </span>
                </button>
              ))}
              <div className="my-1 border-t th-border" />
              <button
                type="button"
                onClick={() => {
                  setMailboxMenuOpen(false);
                  router.push("/integrations");
                }}
                className="w-full flex items-center gap-1.5 px-3 py-2 hover:th-bg-surface-hover text-xs text-blue-400 font-semibold"
              >
                <ExternalLink size={11} />
                {t("manageSharedMailboxes")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
