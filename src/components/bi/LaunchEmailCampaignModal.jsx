"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useTranslations } from "use-intl";
import {
  Send,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { launchCampaign, getCampaignStatus } from "@/lib/api";
import { useToast } from "../Toast";

const POLL_INTERVAL_MS = 2000;

function renderTemplate(template, row) {
  if (!template) return "";
  const data = row || {};
  return template.replace(/\{\{\s*([^}\s]+)\s*\}\}/g, (_, key) => {
    const value = data[key];
    if (value === undefined || value === null) return "";
    return String(value);
  });
}

function pickDefaultEmailColumn(columns) {
  if (!Array.isArray(columns) || columns.length === 0) return "Email";
  const emailMatch = columns.find((c) => /email/i.test(c));
  return emailMatch || "Email";
}

export default function LaunchEmailCampaignModal({
  open,
  onClose,
  itemPath,
  dashboardId,
  availableColumns = [],
  previewRow = null,
  sheetName = null,
}) {
  const toast = useToast();
  const t = useTranslations("LaunchEmailCampaignModal");

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [activeField, setActiveField] = useState("body");
  const subjectRef = useRef(null);
  const bodyRef = useRef(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [emailColumn, setEmailColumn] = useState(
    pickDefaultEmailColumn(availableColumns),
  );
  const [sheet, setSheet] = useState(sheetName || "");
  const [forceResend, setForceResend] = useState(false);
  const [launching, setLaunching] = useState(false);

  const [campaignId, setCampaignId] = useState(null);
  const [status, setStatus] = useState(null);
  const [summaryShown, setSummaryShown] = useState(false);
  const pollRef = useRef(null);

  // Re-sync email column default when columns change
  useEffect(() => {
    setEmailColumn(pickDefaultEmailColumn(availableColumns));
  }, [availableColumns]);

  useEffect(() => {
    setSheet(sheetName || "");
  }, [sheetName]);

  const previewSubject = useMemo(
    () => renderTemplate(subject, previewRow),
    [subject, previewRow],
  );
  const previewBody = useMemo(
    () => renderTemplate(body, previewRow),
    [body, previewRow],
  );

  const canLaunch =
    subject.trim().length > 0 && body.trim().length > 0 && !launching;

  const VAR_MIME = "application/x-campaign-var";

  const insertVariable = useCallback(
    (field, column) => {
      const ref = field === "subject" ? subjectRef : bodyRef;
      const el = ref.current;
      const current = field === "subject" ? subject : body;
      const setter = field === "subject" ? setSubject : setBody;
      const token = `{{${column}}}`;
      const start = el?.selectionStart ?? current.length;
      const end = el?.selectionEnd ?? current.length;
      const next = current.slice(0, start) + token + current.slice(end);
      setter(next);
      requestAnimationFrame(() => {
        if (!el) return;
        const pos = start + token.length;
        el.focus();
        try {
          el.setSelectionRange(pos, pos);
        } catch {
          /* number inputs etc. don't support setSelectionRange */
        }
      });
    },
    [subject, body],
  );

  const handleChipDragStart = (e, column) => {
    e.dataTransfer.setData("text/plain", `{{${column}}}`);
    e.dataTransfer.setData(VAR_MIME, column);
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleFieldDragOver = (e) => {
    if (e.dataTransfer.types?.includes(VAR_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  };

  const handleFieldDrop = (field) => (e) => {
    const column = e.dataTransfer.getData(VAR_MIME);
    if (!column) return;
    e.preventDefault();
    insertVariable(field, column);
  };

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(
    async (cid) => {
      try {
        const result = await getCampaignStatus(cid);
        setStatus(result);
        if (result?.done) {
          stopPolling();
          if (!summaryShown) {
            setSummaryShown(true);
            const failed = result.failed || 0;
            const sent = result.sent || 0;
            if (failed > 0) {
              toast.error(t("finishedWithFailures", { sent, failed }));
            } else {
              toast.success(t("finishedSuccess", { sent }));
            }
          }
        }
      } catch (err) {
        console.error("Polling campaign status failed:", err);
      }
    },
    [stopPolling, summaryShown, toast, t],
  );

  const startPolling = useCallback(
    (cid) => {
      stopPolling();
      pollStatus(cid);
      pollRef.current = setInterval(() => pollStatus(cid), POLL_INTERVAL_MS);
    },
    [pollStatus, stopPolling],
  );

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const handleLaunch = async () => {
    if (!canLaunch) return;
    setLaunching(true);
    try {
      const payload = {
        item_path: itemPath,
        subject: subject.trim() === "" ? subject : subject,
        body,
        email_column: emailColumn || "Email",
        sheet_name: sheet || null,
        dashboard_id: dashboardId,
        force_resend: forceResend,
      };
      const response = await launchCampaign(payload);
      const cid = response?.campaign_id;
      if (!cid) {
        throw new Error(t("missingCampaignId"));
      }
      setCampaignId(cid);
      setStatus({
        total: response.total_contacts || 0,
        sent: 0,
        failed: 0,
        pending: response.total_contacts || 0,
        done: false,
        errors: [],
      });
      startPolling(cid);
    } catch (err) {
      toast.error(t("launchFailed", { message: err.message }));
    } finally {
      setLaunching(false);
    }
  };

  const handleClose = () => {
    stopPolling();
    onClose?.();
  };

  if (!open) return null;

  const inProgress = campaignId !== null;
  const processed = (status?.sent || 0) + (status?.failed || 0);
  const total = status?.total || 0;
  const percent = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="glass-card rounded-2xl p-6 w-full max-w-2xl animate-scale-in max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Send size={20} className="text-blue-400" />
            </div>
            <h2 className="text-xl font-bold th-text">{t("title")}</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:th-bg-surface-hover th-text-secondary transition-colors"
            aria-label={t("close")}
          >
            <X size={20} />
          </button>
        </div>

        {!inProgress && (
          <div className="space-y-5">
            {/* Subject */}
            <div>
              <label
                htmlFor="campaign-subject"
                className="block text-sm font-medium th-text mb-1.5"
              >
                {t("subjectLabel")}
              </label>
              <input
                id="campaign-subject"
                ref={subjectRef}
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                onFocus={() => setActiveField("subject")}
                onDragOver={handleFieldDragOver}
                onDrop={handleFieldDrop("subject")}
                placeholder={t("subjectPlaceholder")}
                className="w-full px-3 py-2.5 th-bg-surface border th-border rounded-lg th-text placeholder:th-text-faint focus:outline-none focus:border-blue-500/60"
              />
            </div>

            {/* Body */}
            <div>
              <label
                htmlFor="campaign-body"
                className="block text-sm font-medium th-text mb-1.5"
              >
                {t("bodyLabel")}
              </label>
              <textarea
                id="campaign-body"
                ref={bodyRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onFocus={() => setActiveField("body")}
                onDragOver={handleFieldDragOver}
                onDrop={handleFieldDrop("body")}
                rows={8}
                placeholder={t("bodyPlaceholder")}
                className="w-full px-3 py-2.5 th-bg-surface border th-border rounded-lg th-text placeholder:th-text-faint focus:outline-none focus:border-blue-500/60 font-mono text-sm"
              />
              {availableColumns.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs th-text-faint mb-1.5">
                    {t.rich("insertHint", {
                      field: activeField,
                      bold: (chunks) => (
                        <span className="th-text font-semibold">{chunks}</span>
                      ),
                    })}
                  </p>
                  <div
                    className="flex flex-wrap gap-1.5"
                    data-testid="variable-chips"
                  >
                    {availableColumns.map((col) => (
                      <button
                        key={col}
                        type="button"
                        draggable
                        onDragStart={(e) => handleChipDragStart(e, col)}
                        onClick={() => insertVariable(activeField, col)}
                        className="px-2 py-1 rounded border th-border th-bg-surface hover:border-blue-500/40 hover:text-blue-400 th-text-secondary text-xs font-mono cursor-grab active:cursor-grabbing select-none"
                        title={t("chipTitle")}
                      >
                        {`{{${col}}}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Preview */}
            <div className="glass-card rounded-xl p-4 border th-border">
              <p className="text-xs font-semibold th-text-muted uppercase tracking-wider mb-2">
                {t("previewLabel")}
              </p>
              <div data-testid="campaign-preview" className="space-y-2">
                <div>
                  <p className="text-xs th-text-faint mb-0.5">{t("subjectLabel")}</p>
                  <p className="text-sm th-text">
                    {previewSubject || <span className="th-text-faint">—</span>}
                  </p>
                </div>
                <div>
                  <p className="text-xs th-text-faint mb-0.5">{t("bodyLabel")}</p>
                  <pre className="text-sm th-text whitespace-pre-wrap font-sans">
                    {previewBody || <span className="th-text-faint">—</span>}
                  </pre>
                </div>
              </div>
            </div>

            {/* Advanced */}
            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="flex items-center gap-1.5 text-sm font-medium th-text-secondary hover:th-text transition-colors"
              >
                {showAdvanced ? (
                  <ChevronUp size={16} />
                ) : (
                  <ChevronDown size={16} />
                )}
                {t("advanced")}
              </button>
              {showAdvanced && (
                <div className="mt-3 space-y-3">
                  <div>
                    <label
                      htmlFor="campaign-email-column"
                      className="block text-sm font-medium th-text mb-1.5"
                    >
                      {t("emailColumnLabel")}
                    </label>
                    <select
                      id="campaign-email-column"
                      value={emailColumn}
                      onChange={(e) => setEmailColumn(e.target.value)}
                      className="w-full px-3 py-2.5 th-bg-surface border th-border rounded-lg th-text focus:outline-none focus:border-blue-500/60"
                    >
                      {(availableColumns.length > 0
                        ? availableColumns
                        : ["Email"]
                      ).map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="campaign-sheet-name"
                      className="block text-sm font-medium th-text mb-1.5"
                    >
                      {t("sheetNameLabel")}
                    </label>
                    <input
                      id="campaign-sheet-name"
                      type="text"
                      value={sheet}
                      onChange={(e) => setSheet(e.target.value)}
                      placeholder={t("sheetNamePlaceholder")}
                      className="w-full px-3 py-2.5 th-bg-surface border th-border rounded-lg th-text placeholder:th-text-faint focus:outline-none focus:border-blue-500/60"
                    />
                  </div>
                  <label
                    htmlFor="campaign-force-resend"
                    className="flex items-start gap-2.5 p-2.5 rounded-lg th-bg-surface border th-border cursor-pointer hover:border-blue-500/40 transition-colors"
                  >
                    <input
                      id="campaign-force-resend"
                      type="checkbox"
                      checked={forceResend}
                      onChange={(e) => setForceResend(e.target.checked)}
                      className="mt-0.5 accent-blue-500"
                    />
                    <span className="text-sm th-text">
                      {t("resendLabel")}
                      <span className="block text-xs th-text-faint mt-0.5">
                        {t("resendHint")}
                      </span>
                    </span>
                  </label>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={handleClose}
                className="px-4 py-2.5 rounded-lg th-text-secondary hover:th-text hover:th-bg-surface-hover font-medium transition-colors"
              >
                {t("cancel")}
              </button>
              <button
                onClick={handleLaunch}
                disabled={!canLaunch}
                className="btn-brand flex items-center gap-2 px-5 py-2.5 text-white rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {launching ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                {t("launch")}
              </button>
            </div>
          </div>
        )}

        {inProgress && (
          <div data-testid="campaign-progress" className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold th-text">
                  {t("sendingProgress", { processed, total })}
                </p>
                <p className="text-xs th-text-faint">{percent}%</p>
              </div>
              {!status?.done && status?.current_email && (
                <p
                  data-testid="campaign-current"
                  className="text-xs th-text-secondary mb-2 flex items-center gap-1.5"
                >
                  <Loader2 size={12} className="animate-spin text-blue-400" />
                  <span>
                    {t.rich("sendingTo", {
                      email: () => (
                        <span className="th-text font-mono">
                          {status.current_email}
                        </span>
                      ),
                    })}
                    {status?.current_row ? (
                      <span className="th-text-faint">
                        {" "}
                        {t("rowSuffix", { row: status.current_row })}
                      </span>
                    ) : null}
                  </span>
                </p>
              )}
              <div className="w-full h-2 th-bg-surface rounded-full overflow-hidden border th-border">
                <div
                  className="h-full bg-blue-500 transition-all"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                <div className="rounded-lg th-bg-surface border th-border p-2.5">
                  <p className="th-text-faint">{t("sentLabel")}</p>
                  <p className="th-text font-bold text-base">
                    {status?.sent || 0}
                  </p>
                </div>
                <div className="rounded-lg th-bg-surface border th-border p-2.5">
                  <p className="th-text-faint">{t("failedLabel")}</p>
                  <p className="th-text font-bold text-base">
                    {status?.failed || 0}
                  </p>
                </div>
                <div className="rounded-lg th-bg-surface border th-border p-2.5">
                  <p className="th-text-faint">{t("pendingLabel")}</p>
                  <p className="th-text font-bold text-base">
                    {status?.pending || 0}
                  </p>
                </div>
              </div>
            </div>

            {Array.isArray(status?.errors) && status.errors.length > 0 && (
              <div className="glass-card rounded-xl p-4 border border-red-500/30 bg-red-500/5">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle size={16} className="text-red-400" />
                  <p className="text-sm font-semibold th-text">
                    {t("errorsHeading", { count: status.errors.length })}
                  </p>
                </div>
                <ul className="space-y-1 max-h-40 overflow-y-auto">
                  {status.errors.map((err, idx) => (
                    <li
                      key={idx}
                      className="text-xs th-text-secondary font-mono break-all"
                    >
                      {typeof err === "string"
                        ? err
                        : `${err.email || t("unknownEmail")}: ${err.error || ""}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {Array.isArray(status?.warnings) && status.warnings.length > 0 && (
              <div className="glass-card rounded-xl p-4 border border-amber-500/30 bg-amber-500/5">
                <div className="flex items-center gap-2 mb-1.5">
                  <AlertCircle size={16} className="text-amber-400" />
                  <p className="text-sm font-semibold th-text">
                    {t("warningsHeading", { count: status.warnings.length })}
                  </p>
                </div>
                <p className="text-xs th-text-faint mb-2">
                  {t("warningsHint")}
                </p>
                <ul className="space-y-1 max-h-40 overflow-y-auto">
                  {status.warnings.map((w, idx) => (
                    <li
                      key={idx}
                      className="text-xs th-text-secondary font-mono break-all"
                    >
                      {typeof w === "string"
                        ? w
                        : `${w.email || t("unknownEmail")}: ${w.warning || ""}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {status?.done && (
              <div className="flex items-center gap-2 text-sm th-text">
                <CheckCircle2 size={16} className="text-green-400" />
                {t("finished")}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={handleClose}
                className="btn-brand flex items-center gap-2 px-5 py-2.5 text-white rounded-lg font-bold"
              >
                {t("close")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
