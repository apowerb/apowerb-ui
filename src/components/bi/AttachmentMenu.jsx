"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "use-intl";
import { Loader2, Paperclip } from "lucide-react";
import { getWebhookLog, fetchWebhookLogAttachmentObjectUrl } from "@/lib/api";
import { useToast } from "../Toast";

export default function AttachmentMenu({ webhookLogId }) {
  const t = useTranslations("AttachmentMenu");
  const [open, setOpen] = useState(false);
  const [attachments, setAttachments] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const containerRef = useRef(null);
  const toast = useToast();

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Reset cached state when the row changes. The BI DataTable can recycle
  // this component instance for a different row (its <tr> key is the row
  // index), handing us a new webhookLogId without a remount. Without this
  // reset the previously-fetched filename leaks onto the new log and the
  // serve endpoint 404s (live bug 2026-06-01: log 4657 requesting log
  // 5046's 1080.pdf).
  useEffect(() => {
    setAttachments(null);
    setError(null);
    setOpen(false);
    setLoading(false);
  }, [webhookLogId]);

  if (webhookLogId == null) {
    return (
      <button
        type="button"
        disabled
        title={t("notAvailablePrevious")}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs th-text-faint opacity-40 cursor-not-allowed"
      >
        <Paperclip size={12} />
        {t("view")}
      </button>
    );
  }

  // Open one attachment in a new tab. The serve endpoint is Bearer-auth'd,
  // so we can't just ``window.open`` the API URL — a top-level navigation
  // sends no Authorization header and the backend answers 401. Instead we
  // fetch the bytes with the token, then open the resulting Blob object URL
  // (PDFs/images preview inline; everything else downloads). Revoke the URL
  // after a delay so the new tab has time to load it.
  const openAttachment = async (filename) => {
    setLoading(true);
    try {
      const objectUrl = await fetchWebhookLogAttachmentObjectUrl(webhookLogId, filename);
      window.open(objectUrl, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      toast.success(t("openedToast"));
    } catch {
      setError(t("unreachable"));
      toast.error(t("unreachableToast"));
    } finally {
      setLoading(false);
    }
  };

  const handleClick = async () => {
    if (error) return;

    // Cache hit — attachments already fetched
    if (attachments !== null) {
      if (attachments.length === 1) {
        await openAttachment(attachments[0].filename);
      } else {
        setOpen((v) => !v);
      }
      return;
    }

    // First fetch — the metadata list (which is JSON, so it goes through
    // the normal auth'd ``request`` path and works fine).
    setLoading(true);
    try {
      const result = await getWebhookLog(webhookLogId);
      const list = result?.log?.attachments ?? [];
      setAttachments(list);
      if (list.length === 0) {
        // The webhook log exists but had no captured attachments (e.g.
        // backfilled rows from before PR #188 went live, or webhooks
        // where the agent never reached the attachment fetch step).
        setError(t("noAttachments"));
        setLoading(false);
      } else if (list.length === 1) {
        await openAttachment(list[0].filename);
      } else {
        setOpen(true);
        setLoading(false);
      }
    } catch {
      setError(t("unreachable"));
      toast.error(t("unreachableToast"));
      setLoading(false);
    }
  };

  const handleDropdownItem = async (filename) => {
    setOpen(false);
    await openAttachment(filename);
  };

  // ``error`` covers two cases: a fetch failure ("PJ inaccessible") and a
  // successful fetch that returned 0 attachments ("Aucune PJ ..."). In
  // both cases the button is non-interactive — leaving it clickable would
  // be confusing because nothing happens on click.
  const buttonTitle = error || t("defaultTooltip");
  const isDisabled = loading || Boolean(error);

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={handleClick}
        disabled={isDisabled}
        title={buttonTitle}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs th-text hover:th-bg-surface transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? <Loader2 size={12} className="animate-spin" /> : <Paperclip size={12} />}
        {t("view")}
      </button>

      {open && attachments && attachments.length > 1 && (
        <ul
          role="menu"
          className="absolute z-50 right-0 mt-1 min-w-max rounded-lg border th-border th-bg-surface shadow-lg py-1"
        >
          {attachments.map(({ filename }) => (
            <li key={filename} role="menuitem">
              <button
                type="button"
                onClick={() => handleDropdownItem(filename)}
                className="w-full text-left px-3 py-2 text-xs th-text hover:th-bg-surface-hover transition-colors whitespace-nowrap"
              >
                {filename}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
