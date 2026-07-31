"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslations } from "use-intl";
import {
  X,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  FileSpreadsheet,
  AlertCircle,
  FolderOpen,
} from "lucide-react";
import OneDriveFilePicker from "../bi/OneDriveFilePicker";
import LaunchEmailCampaignModal from "../bi/LaunchEmailCampaignModal";
import { getOnedriveExcelPreview } from "@/lib/api";
import { useToast } from "../Toast";

const STEPS = [
  { key: "source", labelKey: "stepSource" },
  { key: "mapping", labelKey: "stepMapping" },
  { key: "template", labelKey: "stepTemplate" },
];

function Stepper({ activeStep }) {
  const t = useTranslations("NewExcelCampaignWizard");
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {STEPS.map((step, idx) => {
        const isCompleted = idx < activeStep;
        const isActive = idx === activeStep;
        return (
          <div key={step.key} className="flex items-center gap-2">
            {idx > 0 && (
              <div
                className={`w-10 h-0.5 rounded-full transition-colors ${
                  isCompleted ? "bg-blue-500" : "th-bg-surface"
                }`}
              />
            )}
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  isCompleted
                    ? "bg-blue-500 text-white"
                    : isActive
                      ? "bg-blue-500/20 text-blue-400 border border-blue-500"
                      : "th-bg-surface th-text-faint border th-border"
                }`}
              >
                {isCompleted ? <Check size={14} /> : idx + 1}
              </div>
              <span
                className={`text-sm font-medium ${
                  isActive
                    ? "text-blue-400"
                    : isCompleted
                      ? "th-text"
                      : "th-text-faint"
                }`}
              >
                {t(step.labelKey)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function pickDefaultEmailColumn(columns) {
  if (!Array.isArray(columns) || columns.length === 0) return "";
  const match = columns.find((c) => /email/i.test(c));
  return match || columns[0];
}

function StepSource({ onBrowse, picking, onCancelPicker, onFileSelected }) {
  const t = useTranslations("NewExcelCampaignWizard");
  if (picking) {
    return (
      <OneDriveFilePicker
        onFileSelected={onFileSelected}
        onCancel={onCancelPicker}
      />
    );
  }
  return (
    <div>
      <h3 className="text-lg font-bold th-text mb-2">
        {t("chooseExcelFileTitle")}
      </h3>
      <p className="th-text-secondary text-sm mb-5">
        {t("chooseExcelFileDesc")}
      </p>
      <div className="flex items-center justify-center py-10">
        <button
          type="button"
          onClick={onBrowse}
          className="btn-brand flex items-center gap-2 px-6 py-3 text-white rounded-xl font-bold shadow-lg"
        >
          <FolderOpen size={18} />
          {t("browseOneDrive")}
        </button>
      </div>
    </div>
  );
}

function StepMapping({
  filename,
  preview,
  loading,
  error,
  emailColumn,
  setEmailColumn,
  onChangeFile,
}) {
  const t = useTranslations("NewExcelCampaignWizard");
  const columns = preview?.columns || [];
  const rows = preview?.rows || [];

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 rounded-xl border th-border th-bg-surface px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <FileSpreadsheet size={18} className="text-emerald-300 shrink-0" />
          <span className="th-text text-sm font-medium truncate">
            {filename || "—"}
          </span>
        </div>
        <button
          type="button"
          onClick={onChangeFile}
          className="text-xs th-text-secondary hover:th-text underline decoration-dotted"
        >
          {t("change")}
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={22} className="animate-spin text-blue-400" />
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 mb-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm th-text">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="mb-4">
            <label
              htmlFor="recipient-email-column"
              className="block text-sm font-medium th-text mb-1.5"
            >
              {t("emailColumnLabel")}
            </label>
            <select
              id="recipient-email-column"
              value={emailColumn}
              onChange={(e) => setEmailColumn(e.target.value)}
              className="w-full px-3 py-2.5 th-bg-surface border th-border rounded-lg th-text focus:outline-none focus:border-blue-500/60"
            >
              {columns.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-xl border th-border th-bg-surface overflow-hidden mb-3">
            <div className="max-h-64 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 th-bg-surface border-b th-border">
                  <tr>
                    {columns.map((col) => (
                      <th
                        key={col}
                        className="text-left px-3 py-2 th-text-secondary font-semibold whitespace-nowrap"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr
                      key={idx}
                      className="border-b th-border last:border-b-0"
                    >
                      {columns.map((col) => (
                        <td
                          key={col}
                          className="px-3 py-2 th-text whitespace-nowrap"
                        >
                          {row[col] === undefined || row[col] === null
                            ? ""
                            : String(row[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs th-text-faint">
            {t("otherColumnsHint")}{" "}
            <code className="th-text">{`{{firstname}}`}</code>,{" "}
            <code className="th-text">{`{{company}}`}</code>.
          </p>
        </>
      )}
    </div>
  );
}

export default function NewExcelCampaignWizard({ open, onClose }) {
  const t = useTranslations("NewExcelCampaignWizard");
  const toast = useToast();

  const [step, setStep] = useState(0);
  const [picking, setPicking] = useState(false);
  const [file, setFile] = useState(null); // { item_id, item_path, filename }
  const [preview, setPreview] = useState(null); // { columns, rows }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [emailColumn, setEmailColumn] = useState("");

  const loadPreview = useCallback(
    async (itemPath) => {
      setLoading(true);
      setError(null);
      try {
        const data = await getOnedriveExcelPreview(itemPath, { limit: 5 });
        const columns = Array.isArray(data?.columns) ? data.columns : [];
        const rows = Array.isArray(data?.rows) ? data.rows : [];
        setPreview({ columns, rows });
        setEmailColumn(pickDefaultEmailColumn(columns));
      } catch (err) {
        setError(err?.message || t("previewLoadFailed"));
        toast.error(t("previewFailedToast", { message: err?.message || t("unknownError") }));
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  const handleFileSelected = useCallback(
    (picked) => {
      setFile(picked);
      setPicking(false);
      setStep(1);
      loadPreview(picked.item_path);
    },
    [loadPreview],
  );

  const handleChangeFile = useCallback(() => {
    setPreview(null);
    setError(null);
    setEmailColumn("");
    setFile(null);
    setStep(0);
    setPicking(true);
  }, []);

  const handleClose = useCallback(() => {
    setStep(0);
    setPicking(false);
    setFile(null);
    setPreview(null);
    setError(null);
    setEmailColumn("");
    onClose?.();
  }, [onClose]);

  const canGoNext = useMemo(() => {
    if (step !== 1) return false;
    if (!preview) return false;
    if (!(preview.rows && preview.rows.length > 0)) return false;
    if (!emailColumn) return false;
    return true;
  }, [step, preview, emailColumn]);

  useEffect(() => {
    if (!open) {
      setStep(0);
      setPicking(false);
      setFile(null);
      setPreview(null);
      setError(null);
      setEmailColumn("");
    }
  }, [open]);

  if (!open) return null;

  // Step 3 — delegate completely to LaunchEmailCampaignModal.
  if (step === 2 && file && preview) {
    return (
      <LaunchEmailCampaignModal
        open={true}
        onClose={handleClose}
        itemPath={file.item_path}
        dashboardId={null}
        availableColumns={preview.columns || []}
        previewRow={preview.rows?.[0] || null}
        sheetName={null}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="glass-card rounded-2xl p-6 w-full max-w-3xl animate-scale-in max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold th-text">{t("newCampaignTitle")}</h2>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:th-bg-surface-hover th-text-secondary transition-colors"
            aria-label={t("closeAria")}
          >
            <X size={20} />
          </button>
        </div>

        <Stepper activeStep={step} />

        {step === 0 && (
          <StepSource
            onBrowse={() => setPicking(true)}
            picking={picking}
            onCancelPicker={() => setPicking(false)}
            onFileSelected={handleFileSelected}
          />
        )}

        {step === 1 && (
          <StepMapping
            filename={file?.filename}
            preview={preview}
            loading={loading}
            error={error}
            emailColumn={emailColumn}
            setEmailColumn={setEmailColumn}
            onChangeFile={handleChangeFile}
          />
        )}

        {/* Footer navigation (hidden on step 0 when picker is open so it owns its own footer) */}
        {!(step === 0 && picking) && (
          <div className="flex items-center justify-between pt-5 mt-2 border-t th-border">
            <button
              type="button"
              onClick={() => {
                if (step === 0) {
                  handleClose();
                } else {
                  setStep(step - 1);
                }
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg th-text-secondary hover:th-text hover:th-bg-surface-hover text-sm font-medium transition-colors"
            >
              <ArrowLeft size={14} />
              {step === 0 ? t("cancel") : t("back")}
            </button>
            {step === 1 && (
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!canGoNext}
                className="btn-brand flex items-center gap-2 px-5 py-2 text-white rounded-lg font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t("next")}
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
