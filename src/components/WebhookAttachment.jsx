"use client";

import { useState } from "react";
import { useTranslations } from "use-intl";
import { Loader2, Download } from "lucide-react";
import { fetchWebhookLogAttachmentObjectUrl } from "@/lib/api";
import { useToast } from "./Toast";

function formatBytes(n) {
  if (n == null) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}

/**
 * One webhook-log attachment row in the webhook-log tab.
 *
 * The serve endpoint (`/api/webhooks/logs/{id}/attachments/{name}`) is
 * Bearer-auth'd, so a raw `<a href>` / `<iframe src>` sends no Authorization
 * header and the backend answers 401 (the live bug, 2026-05-27). Mirror the
 * BI `AttachmentMenu` pattern: fetch the bytes WITH the token, then
 * `window.open` the resulting Blob object URL (PDF/image preview inline in the
 * browser, everything else downloads). Lazy — only on click, never on render.
 * Revoke the object URL after a delay so the new tab has time to load it.
 * Feedback is surfaced via toasts (success + error).
 */
export default function WebhookAttachment({ logId, att }) {
  const t = useTranslations("WebhookAttachment");
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const open = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const objectUrl = await fetchWebhookLogAttachmentObjectUrl(logId, att.filename);
      window.open(objectUrl, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      toast.success(t("attachmentOpened"));
    } catch {
      toast.error(t("attachmentUnavailable"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="th-bg-elevated border th-border rounded-xl p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="th-text text-xs font-medium truncate" title={att.filename}>{att.filename}</p>
          <p className="th-text-faint text-[10px]">
            {att.content_type}{att.size != null ? ` — ${formatBytes(att.size)}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={open}
          disabled={loading}
          title={t("openInNewTab")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg th-bg-surface border th-border th-text-secondary text-xs font-semibold hover:th-bg-surface-hover transition-all shrink-0 disabled:opacity-50"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
          {t("viewDownload")}
        </button>
      </div>
    </div>
  );
}
