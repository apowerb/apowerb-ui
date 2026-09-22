"use client";

import { useState } from "react";
import { useTranslations } from "use-intl";
import { X, Loader2, AlertCircle, ExternalLink } from "lucide-react";
import { saveTeamsWebhook } from "@/lib/api";

/**
 * Modal that registers a Teams incoming webhook URL (apowerb#198). Unlike
 * OdooConnectModal, there is a single secret to collect. The URL is cleared
 * from state as soon as it's submitted — never kept around, logged, or
 * redisplayed — since the backend never returns it either (GET only ever
 * answers `{configured}`).
 */
export default function TeamsWebhookModal({ onClose, onSaved }) {
  const t = useTranslations("TeamsWebhookModal");
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const canSubmit = url.trim() && !submitting;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    const value = url.trim();
    setUrl("");
    setSubmitting(true);
    setError(null);
    try {
      await saveTeamsWebhook(value);
      onSaved?.();
    } catch (err) {
      setError(err.message || t("unexpectedError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center th-bg-overlay backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md mx-4 rounded-2xl th-bg-modal border th-border shadow-2xl backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b th-border-secondary">
          <div>
            <h3 className="th-text font-bold text-base">{t("title")}</h3>
            <p className="th-text-muted text-xs mt-0.5">{t("subtitle")}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:th-bg-surface-hover th-text-faint transition-colors"
            aria-label={t("closeAria")}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
              <AlertCircle size={13} className="shrink-0" />
              <span className="flex-1">{error}</span>
            </div>
          )}

          <div>
            <label
              htmlFor="teams-webhook-url"
              className="block th-text-secondary text-xs font-semibold mb-1"
            >
              {t("urlLabel")}
            </label>
            <input
              id="teams-webhook-url"
              type="password"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t("urlPlaceholder")}
              className="w-full glass-input px-3 py-2 rounded-lg text-sm focus:outline-none"
              autoComplete="off"
              required
            />
            <p className="th-text-faint text-[10px] mt-1 flex items-center gap-1">
              {t("helpText")}
              <ExternalLink size={9} />
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg th-bg-surface hover:th-bg-surface-hover th-text-secondary text-xs font-semibold transition-colors"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="btn-brand flex items-center gap-2 px-4 py-2 rounded-lg text-white text-xs font-bold shadow-lg shadow-blue-500/20"
            >
              {submitting ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  {t("saving")}
                </>
              ) : (
                t("save")
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
