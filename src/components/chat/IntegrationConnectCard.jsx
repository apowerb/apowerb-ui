"use client";

import {
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { IntegrationLogo } from "@/lib/integrationIcons";

const PROVIDER_CONFIG = {
  google_drive:         { label: "Google Drive" },
  google_gmail:         { label: "Gmail" },
  google_calendar:      { label: "Google Calendar" },
  google_sheets:        { label: "Google Sheets" },
  google_docs:          { label: "Google Docs" },
  microsoft_outlook:    { label: "Outlook" },
  microsoft_teams:      { label: "Teams" },
  microsoft_onedrive:   { label: "OneDrive" },
  microsoft_sharepoint: { label: "SharePoint" },
  github:               { label: "GitHub" },
  odoo:                 { label: "Odoo" },
};

const STATUS_STYLES = {
  pending:    "border-blue-500/30 bg-blue-500/5",
  connecting: "border-blue-500/30 bg-blue-500/5",
  connected:  "border-emerald-500/30 bg-emerald-500/5",
  failed:     "border-red-500/30 bg-red-500/5",
};

export default function IntegrationConnectCard({ request, onConnect }) {
  if (!request) return null;

  const config = PROVIDER_CONFIG[request.provider] || { label: request.provider };
  const borderStyle = STATUS_STYLES[request.status] || STATUS_STYLES.pending;

  return (
    <div className={`my-2 rounded-xl border overflow-hidden ${borderStyle}`}>
      <div className="flex items-center gap-3 px-3 py-2">
        <span className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-white/80 dark:bg-white/10 ring-1 ring-black/5 dark:ring-white/10">
          <IntegrationLogo provider={request.provider} size={20} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium th-text-secondary">
            {config.label}
          </p>
          {request.reason && (
            <p className="text-[11px] th-text-muted">{request.reason}</p>
          )}
        </div>

        {request.status === "pending" && (
          <button
            onClick={() => onConnect?.(request.id)}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-300 text-xs font-semibold transition-colors"
          >
            <ExternalLink size={12} />
            Connect
          </button>
        )}

        {request.status === "connecting" && (
          <span className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs text-blue-300">
            <Loader2 size={14} className="animate-spin" />
            Connecting...
          </span>
        )}

        {request.status === "connected" && (
          <span className="shrink-0 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-medium">
            <CheckCircle2 size={14} />
            Connected
          </span>
        )}

        {request.status === "failed" && (
          <div className="shrink-0 flex items-center gap-2">
            <span className="flex items-center gap-1 text-[11px] text-red-400">
              <XCircle size={14} />
              Connection failed
            </span>
            <button
              onClick={() => onConnect?.(request.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 text-xs font-semibold transition-colors"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
