"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "use-intl";
import { FileSpreadsheet, X, Loader2 } from "lucide-react";
import OneDriveFilePicker from "@/components/bi/OneDriveFilePicker";
import { getOnedriveExcelPreview } from "@/lib/api";

function autoDetectEmailColumn(columns) {
  if (!Array.isArray(columns) || columns.length === 0) return "";
  const exact = columns.find((c) => c?.toLowerCase?.() === "email");
  if (exact) return exact;
  const match = columns.find((c) => /e[\-_\s]?mail|adresse/i.test(String(c)));
  return match || columns[0] || "";
}

/**
 * Compact form field embedded in the agent creation modal for templates
 * that declare ``requires_onedrive_file``. Shows the currently selected
 * file (if any) and opens the shared OneDriveFilePicker in an inline
 * panel — same OAuth popup, same file browsing — so the user can pick a
 * OneDrive Excel file while creating the agent, without bouncing through
 * the chat.
 */
export default function OneDriveFileField({ value, onChange }) {
  const t = useTranslations("OneDriveFileField");
  const [picking, setPicking] = useState(false);
  const [columns, setColumns] = useState(value?.columns || []);
  const [loadingCols, setLoadingCols] = useState(false);
  const [previewError, setPreviewError] = useState(null);

  // Whenever the picked file changes, fetch its headers so the user can
  // confirm or change the auto-detected email column without leaving the
  // creation form.
  useEffect(() => {
    if (!value?.item_path) {
      setColumns([]);
      setPreviewError(null);
      return;
    }
    let cancelled = false;
    setLoadingCols(true);
    setPreviewError(null);
    getOnedriveExcelPreview(value.item_path, { limit: 1 })
      .then((res) => {
        if (cancelled) return;
        const cols = Array.isArray(res?.columns) ? res.columns : [];
        setColumns(cols);
        if (!value.email_column) {
          const detected = autoDetectEmailColumn(cols);
          if (detected) onChange({ ...value, email_column: detected, columns: cols });
          else onChange({ ...value, columns: cols });
        } else {
          onChange({ ...value, columns: cols });
        }
      })
      .catch((err) => {
        if (!cancelled) setPreviewError(err?.message || t("readHeadersFailed"));
      })
      .finally(() => {
        if (!cancelled) setLoadingCols(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.item_path]);

  return (
    <div>
      <label className="block text-sm font-medium th-text-muted mb-2 pl-1">
        {t("title")} <span className="text-red-400">*</span>
      </label>

      {!picking && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border th-border th-bg-surface">
          <FileSpreadsheet size={16} className="text-sky-400 shrink-0" />
          {value ? (
            <>
              <span className="text-sm th-text truncate flex-1">
                {value.filename || value.item_path}
              </span>
              <button
                type="button"
                onClick={() => onChange(null)}
                className="p-1 rounded hover:th-bg-surface-hover th-text-faint hover:th-text transition-colors"
                title={t("removeFileTooltip")}
              >
                <X size={14} />
              </button>
              <button
                type="button"
                onClick={() => setPicking(true)}
                className="text-xs px-2 py-1 rounded-md bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-colors font-semibold"
              >
                {t("change")}
              </button>
            </>
          ) : (
            <>
              <span className="text-sm th-text-faint flex-1">
                {t("noFileSelected")}
              </span>
              <button
                type="button"
                onClick={() => setPicking(true)}
                className="text-xs px-2.5 py-1 rounded-md bg-sky-500/20 text-sky-200 hover:bg-sky-500/30 transition-colors font-semibold"
              >
                {t("browseOneDrive")}
              </button>
            </>
          )}
        </div>
      )}

      {picking && (
        <div className="mt-2 p-3 rounded-xl border th-border th-bg-surface">
          <OneDriveFilePicker
            onFileSelected={(file) => {
              onChange(file);
              setPicking(false);
            }}
            onCancel={() => setPicking(false)}
          />
        </div>
      )}

      {/* Email-column picker — auto-detected, user-overridable */}
      {value?.item_path && !picking && (
        <div className="mt-3">
          <label className="block text-xs font-medium th-text-muted mb-1.5 pl-1">
            {t("recipientEmailColumnLabel")}
          </label>
          {loadingCols ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg th-bg-surface border th-border text-xs th-text-faint">
              <Loader2 size={12} className="animate-spin" />
              {t("readingFileHeaders")}
            </div>
          ) : previewError ? (
            <p className="text-xs text-amber-300 px-1">
              {t.rich("headerReadError", {
                error: previewError,
                code: (chunks) => <code>{chunks}</code>,
              })}
            </p>
          ) : columns.length > 0 ? (
            <select
              value={value?.email_column || ""}
              onChange={(e) =>
                onChange({ ...value, email_column: e.target.value })
              }
              className="glass-input w-full px-3 py-2 rounded-lg text-sm"
            >
              {columns.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-xs th-text-faint px-1">
              {t("noColumnsDetected")}
            </p>
          )}
        </div>
      )}

      <p className="mt-1.5 text-xs th-text-faint pl-1">
        {t("footerHint")}
      </p>
    </div>
  );
}
