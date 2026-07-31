"use client";

import { useMemo, useState, useCallback } from "react";
import { useTranslations } from "use-intl";
import { AlertCircle, PlugZap, Loader2, X } from "lucide-react";
import { useIntegrations } from "@/hooks/useIntegrations";
import { useOAuthPopup } from "@/hooks/useOAuthPopup";

const PROVIDER_LABELS = {
  microsoft_outlook: "Outlook",
  microsoft_teams: "Teams",
  microsoft_onedrive: "OneDrive",
  microsoft_sharepoint: "SharePoint",
  google_drive: "Google Drive",
  google_gmail: "Gmail",
  google_calendar: "Google Calendar",
  google_sheets: "Google Sheets",
  google_docs: "Google Docs",
  github: "GitHub",
};

export default function IntegrationReconnectBanner() {
  const t = useTranslations("IntegrationReconnectBanner");
  const { integrations, refetch } = useIntegrations();
  const [dismissed, setDismissed] = useState(() => new Set());
  const [connecting, setConnecting] = useState(null);

  const expired = useMemo(
    () =>
      integrations.filter(
        (i) =>
          i.token_status &&
          i.token_status !== "active" &&
          PROVIDER_LABELS[i.provider] &&
          !dismissed.has(i.provider),
      ),
    [integrations, dismissed],
  );

  const { openOAuth } = useOAuthPopup({
    onSuccess: () => {
      setConnecting(null);
      if (typeof refetch === "function") refetch();
    },
    onFailure: (err) => {
      setConnecting(null);
      console.error("[IntegrationReconnectBanner] reconnect failed:", err);
    },
    onCancel: () => setConnecting(null),
  });

  const handleReconnect = useCallback(
    (integ) => {
      if (!PROVIDER_LABELS[integ.provider]) return;
      setConnecting(integ.provider);
      // Inline OAuth popup — keeps the user in the chat instead of a full
      // redirect to the integrations page.
      openOAuth(integ.provider);
    },
    [openOAuth],
  );

  if (expired.length === 0) return null;

  return (
    <div className="px-4 pt-3 space-y-2">
      {expired.map((integ) => {
        const label = PROVIDER_LABELS[integ.provider];
        const isLoading = connecting === integ.provider;
        return (
          <div
            key={integ.provider}
            className="warning-banner flex items-center gap-3 px-3 py-2 rounded-xl border text-xs"
          >
            <AlertCircle size={14} className="warning-banner-icon shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="warning-banner-title">
                {t("connectionExpired", { label })}
              </p>
              <p className="warning-banner-desc">
                {t("reconnectDesc", { label })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleReconnect(integ)}
              disabled={isLoading}
              className="warning-banner-btn shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-semibold transition-all disabled:opacity-60"
            >
              {isLoading ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <PlugZap size={12} />
              )}
              {t("reconnect")}
            </button>
            <button
              type="button"
              onClick={() =>
                setDismissed((prev) => {
                  const next = new Set(prev);
                  next.add(integ.provider);
                  return next;
                })
              }
              className="warning-banner-dismiss shrink-0 p-1"
              title={t("dismissUntilReload")}
              aria-label={t("dismiss")}
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
