"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "use-intl";
import {
  BarChart3,
  LineChart,
  PieChart,
  Hash,
  Table2,
  Upload,
  Database,
  FileSpreadsheet,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  X,
  Server,
  Bot,
} from "lucide-react";
import {
  uploadBiCsv,
  listBiDatasets,
  previewBiDataset,
  previewOnedriveSpreadsheet,
  listBiDbConfigs,
  createChart,
  addDashboardComponent,
} from "@/lib/api";
import AgentSourcePicker from "./AgentSourcePicker";
import OneDriveFilePicker from "./OneDriveFilePicker";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "../Toast";

const STEPS = [
  { key: "source" },
  { key: "preview" },
  { key: "viz" },
];

// ---------------------------------------------------------------------------
// Stepper
// ---------------------------------------------------------------------------
function Stepper({ activeStep }) {
  const t = useTranslations("AddChartWizard");
  const stepLabels = {
    source: t("stepSource"),
    preview: t("stepPreview"),
    viz: t("stepViz"),
  };
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
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
                  isActive ? "text-blue-400" : isCompleted ? "th-text" : "th-text-faint"
                }`}
              >
                {stepLabels[step.key]}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Select Data Source
// ---------------------------------------------------------------------------
function StepSource({
  sourceMode,
  setSourceMode,
  onDataSourceSelected,
  toast,
  organizationId,
  agentIds,
  setAgentIds,
}) {
  const t = useTranslations("AddChartWizard");
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [csvSeparator, setCsvSeparator] = useState("auto");

  const [datasets, setDatasets] = useState([]);
  const [datasetsLoading, setDatasetsLoading] = useState(false);

  const [dbConfigs, setDbConfigs] = useState([]);
  const [dbConfigsLoading, setDbConfigsLoading] = useState(false);
  const [selectedDb, setSelectedDb] = useState(null);
  const [tableName, setTableName] = useState("");

  // Fetch datasets when expanding "existing"
  const fetchDatasets = useCallback(async () => {
    setDatasetsLoading(true);
    try {
      const res = await listBiDatasets(organizationId);
      setDatasets(res?.datasets || []);
    } catch (err) {
      toast.error(t("loadDatasetsFailed", { message: err.message }));
      setDatasets([]);
    } finally {
      setDatasetsLoading(false);
    }
  }, [toast, organizationId]);

  // Fetch db configs when expanding "database"
  const fetchDbConfigs = useCallback(async () => {
    setDbConfigsLoading(true);
    try {
      const res = await listBiDbConfigs(organizationId);
      setDbConfigs(res?.configs || []);
    } catch (err) {
      toast.error(t("loadDbConnectionsFailed", { message: err.message }));
      setDbConfigs([]);
    } finally {
      setDbConfigsLoading(false);
    }
  }, [toast, organizationId]);

  useEffect(() => {
    if (sourceMode === "existing") fetchDatasets();
    if (sourceMode === "database") fetchDbConfigs();
  }, [sourceMode, fetchDatasets, fetchDbConfigs]);

  // CSV upload handlers
  const handleFile = async (file) => {
    if (!file) return;
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      toast.error(t("uploadCsvOnly"));
      return;
    }
    setUploading(true);
    try {
      const result = await uploadBiCsv(file, csvSeparator, organizationId);
      onDataSourceSelected({
        type: "csv",
        file_id: result.file_id,
        filename: result.filename,
      });
    } catch (err) {
      toast.error(t("csvUploadFailed", { message: err.message }));
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer?.files?.[0]);
  };

  const handleFileSelect = (e) => {
    handleFile(e.target.files?.[0]);
  };

  // Existing dataset click
  const handleDatasetClick = (ds) => {
    onDataSourceSelected({
      type: "csv",
      file_id: ds.file_id,
      filename: ds.filename,
    });
  };

  // Database preview
  const handleDbPreview = () => {
    if (!selectedDb || !tableName.trim()) {
      toast.error(t("selectConnectionAndTable"));
      return;
    }
    onDataSourceSelected({
      type: "db",
      connection_config_id: selectedDb.id,
      query: `SELECT * FROM ${tableName.trim()}`,
      dbName: selectedDb.database,
      configName: selectedDb.config_name,
    });
  };

  // Top-level option cards (when no mode selected)
  if (!sourceMode) {
    return (
      <div>
        <h3 className="text-lg font-bold th-text mb-4">{t("selectDataSource")}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {/* Upload CSV */}
          <button
            onClick={() => setSourceMode("upload")}
            className="flex flex-col items-center gap-3 p-6 rounded-xl border th-border th-bg-surface hover:border-blue-500/30 hover:bg-blue-500/5 transition-all group"
          >
            <div className="p-3 bg-blue-500/10 rounded-xl group-hover:bg-blue-500/20 transition-colors">
              <Upload size={28} className="text-blue-400" />
            </div>
            <span className="text-sm font-semibold th-text">{t("uploadCsv")}</span>
          </button>

          {/* Existing Dataset */}
          <button
            onClick={() => setSourceMode("existing")}
            className="flex flex-col items-center gap-3 p-6 rounded-xl border th-border th-bg-surface hover:border-blue-500/30 hover:bg-blue-500/5 transition-all group"
          >
            <div className="p-3 bg-blue-400/10 rounded-xl group-hover:bg-blue-400/20 transition-colors">
              <FileSpreadsheet size={28} className="text-blue-400" />
            </div>
            <span className="text-sm font-semibold th-text">{t("existingDataset")}</span>
          </button>

          {/* Database */}
          <button
            onClick={() => setSourceMode("database")}
            className="flex flex-col items-center gap-3 p-6 rounded-xl border th-border th-bg-surface hover:border-blue-500/30 hover:bg-blue-500/5 transition-all group"
          >
            <div className="p-3 bg-blue-500/10 rounded-xl group-hover:bg-blue-500/20 transition-colors">
              <Database size={28} className="text-blue-400" />
            </div>
            <span className="text-sm font-semibold th-text">{t("database")}</span>
          </button>

          {/* Agent */}
          <button
            onClick={() => setSourceMode("agent")}
            className="flex flex-col items-center gap-3 p-6 rounded-xl border th-border th-bg-surface hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all group"
          >
            <div className="p-3 bg-indigo-500/10 rounded-xl group-hover:bg-indigo-500/20 transition-colors">
              <Bot size={28} className="text-indigo-400" />
            </div>
            <span className="text-sm font-semibold th-text">{t("agent")}</span>
          </button>

          {/* OneDrive Spreadsheet */}
          <button
            onClick={() => setSourceMode("onedrive")}
            className="flex flex-col items-center gap-3 p-6 rounded-xl border th-border th-bg-surface hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all group"
          >
            <div className="p-3 bg-emerald-500/10 rounded-xl group-hover:bg-emerald-500/20 transition-colors">
              <FileSpreadsheet size={28} className="text-emerald-400" />
            </div>
            <span className="text-sm font-semibold th-text">{t("oneDriveSpreadsheet")}</span>
          </button>
        </div>
      </div>
    );
  }

  // ---- Upload CSV sub-view ----
  if (sourceMode === "upload") {
    return (
      <div>
        <button
          onClick={() => setSourceMode(null)}
          className="flex items-center gap-1.5 text-sm th-text-secondary hover:th-text mb-4 transition-colors"
        >
          <ArrowLeft size={16} />
          {t("backToOptions")}
        </button>
        <h3 className="text-lg font-bold th-text mb-4">{t("uploadCsv")}</h3>

        {/* Separator selector */}
        <div className="mb-4">
          <label className="block text-xs font-medium th-text-secondary mb-1.5">{t("separator")}</label>
          <div className="flex flex-wrap gap-1.5">
            {[
              { key: "auto", label: t("sepAuto") },
              { key: "comma", label: t("sepComma") },
              { key: "semicolon", label: t("sepSemicolon") },
              { key: "tab", label: t("sepTab") },
              { key: "pipe", label: t("sepPipe") },
            ].map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setCsvSeparator(s.key)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                  csvSeparator === s.key
                    ? "border-purple-500 bg-purple-500/10 text-purple-400"
                    : "th-border th-bg-surface th-text-secondary hover:th-border-hover"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
            uploading
              ? "border-blue-500/50 bg-blue-500/10 cursor-wait"
              : dragOver
                ? "border-blue-500 bg-blue-500/10"
                : "th-border-hover hover:border-[var(--border-hover)] th-bg-surface"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />
          {uploading ? (
            <>
              <Loader2 size={32} className="mx-auto mb-3 text-blue-400 animate-spin" />
              <p className="text-sm text-blue-400 font-medium">{t("uploading")}</p>
            </>
          ) : (
            <>
              <Upload size={32} className="mx-auto mb-3 th-text-faint" />
              <p className="text-sm th-text-secondary">
                {t("dragDropCsv")}
              </p>
              <p className="text-xs th-text-faint mt-1">{t("csvOnly")}</p>
            </>
          )}
        </div>
      </div>
    );
  }

  // ---- Existing Dataset sub-view ----
  if (sourceMode === "existing") {
    return (
      <div>
        <button
          onClick={() => setSourceMode(null)}
          className="flex items-center gap-1.5 text-sm th-text-secondary hover:th-text mb-4 transition-colors"
        >
          <ArrowLeft size={16} />
          {t("backToOptions")}
        </button>
        <h3 className="text-lg font-bold th-text mb-4">{t("existingDataset")}</h3>
        {datasetsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-blue-400" />
          </div>
        ) : datasets.length === 0 ? (
          <div className="py-12 text-center">
            <FileSpreadsheet size={40} className="mx-auto mb-3 th-text-faint" />
            <p className="th-text-secondary text-sm">{t("noDatasetsYet")}</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
            {datasets.map((ds) => (
              <button
                key={ds.file_id}
                onClick={() => handleDatasetClick(ds)}
                className="w-full text-left glass-card rounded-xl p-4 hover:border-blue-500/30 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-400/10 rounded-lg shrink-0">
                    <FileSpreadsheet size={18} className="text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold th-text group-hover:text-blue-400 transition-colors truncate">
                      {ds.filename}
                    </h4>
                    <div className="flex items-center gap-4 mt-1.5">
                      <span className="text-xs th-text-faint">
                        {t("columnsCount", { count: ds.columns_count })}
                      </span>
                      <span className="text-xs th-text-faint">
                        {t("rowsCount", { count: ds.row_count })}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ---- Database sub-view ----
  if (sourceMode === "database") {
    return (
      <div>
        <button
          onClick={() => {
            setSourceMode(null);
            setSelectedDb(null);
            setTableName("");
          }}
          className="flex items-center gap-1.5 text-sm th-text-secondary hover:th-text mb-4 transition-colors"
        >
          <ArrowLeft size={16} />
          {t("backToOptions")}
        </button>
        <h3 className="text-lg font-bold th-text mb-4">{t("database")}</h3>
        {dbConfigsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-blue-400" />
          </div>
        ) : dbConfigs.length === 0 ? (
          <div className="py-12 text-center">
            <Database size={40} className="mx-auto mb-3 th-text-faint" />
            <p className="th-text-secondary text-sm mb-2">{t("noConnectionsConfigured")}</p>
            <p className="text-xs th-text-faint">
              {t("configureDbHint")}
            </p>
          </div>
        ) : !selectedDb ? (
          <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
            {dbConfigs.map((cfg) => (
              <button
                key={cfg.id}
                onClick={() => setSelectedDb(cfg)}
                className="w-full text-left glass-card rounded-xl p-4 hover:border-blue-500/30 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg shrink-0">
                    <Server size={18} className="text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold th-text group-hover:text-blue-400 transition-colors truncate">
                      {cfg.config_name}
                    </h4>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-blue-500/15 text-blue-400 border border-blue-500/30">
                        {cfg.db_type}
                      </span>
                      <span className="text-xs th-text-faint truncate">
                        {cfg.host}{cfg.port ? `:${cfg.port}` : ""}
                      </span>
                      {cfg.database && (
                        <span className="text-xs th-text-faint truncate">
                          {cfg.database}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="glass-card rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg shrink-0">
                  <Server size={18} className="text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-bold th-text">{selectedDb.config_name}</p>
                  <p className="text-xs th-text-faint">
                    {selectedDb.db_type} - {selectedDb.host}
                    {selectedDb.port ? `:${selectedDb.port}` : ""} / {selectedDb.database}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedDb(null);
                    setTableName("");
                  }}
                  className="ml-auto p-1.5 rounded-lg hover:th-bg-surface-hover th-text-faint hover:th-text-secondary transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium th-text mb-1.5">
                {t("tableName")}
              </label>
              <input
                type="text"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                placeholder={t("tableNamePlaceholder")}
                className="glass-input w-full px-4 py-2.5 rounded-lg"
                autoFocus
              />
            </div>
            <button
              onClick={handleDbPreview}
              disabled={!tableName.trim()}
              className="btn-brand flex items-center gap-2 px-5 py-2.5 text-white rounded-lg font-bold"
            >
              <ArrowRight size={16} />
              {t("previewButton")}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ---- OneDrive sub-view ----
  if (sourceMode === "onedrive") {
    return (
      <OneDriveFilePicker
        onFileSelected={({ item_id, item_path, filename }) => {
          onDataSourceSelected({
            type: "onedrive_excel",
            item_id,
            item_path,
            filename,
          });
        }}
        onCancel={() => setSourceMode(null)}
      />
    );
  }

  // ---- Agent sub-view ----
  if (sourceMode === "agent") {
    return (
      <div>
        <button
          onClick={() => setSourceMode(null)}
          className="flex items-center gap-1.5 text-sm th-text-secondary hover:th-text mb-4 transition-colors"
        >
          <ArrowLeft size={16} />
          {t("backToOptions")}
        </button>
        <h3 className="text-lg font-bold th-text mb-4">{t("selectAgents")}</h3>
        <AgentSourcePicker
          selectedIds={agentIds}
          onChange={(ids) => setAgentIds(ids)}
        />
        <button
          disabled={agentIds.length === 0}
          onClick={() => {
            onDataSourceSelected({
              type: "agent",
              agent_ids: agentIds,
            });
          }}
          className="mt-4 w-full py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-bold disabled:opacity-40 hover:bg-indigo-500 transition"
        >
          {t("continueWithAgents", { count: agentIds.length })}
        </button>
      </div>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Step 2 — Preview Data
// ---------------------------------------------------------------------------
function StepPreview({ dataSource, onBack, onNext, toast, organizationId }) {
  const t = useTranslations("AddChartWizard");
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (dataSource.type !== "csv") return;
    let cancelled = false;
    setLoading(true);
    previewBiDataset(dataSource.file_id, organizationId)
      .then((data) => {
        if (!cancelled) setPreview(data);
      })
      .catch((err) => {
        if (!cancelled) toast.error(t("loadPreviewFailed", { message: err.message }));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dataSource, toast, organizationId]);

  // CSV preview
  if (dataSource.type === "csv") {
    return (
      <div>
        <h3 className="text-lg font-bold th-text mb-4">{t("previewData")}</h3>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin text-blue-400" />
          </div>
        ) : preview ? (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3 flex-wrap">
              <FileSpreadsheet size={20} className="text-blue-400" />
              <span className="text-sm font-semibold th-text">{dataSource.filename}</span>
              <span className="text-xs th-text-faint">{t("rowsCount", { count: preview.row_count })}</span>
              {preview.separator && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  {t("separatorTag", { value: preview.separator === "comma" ? "," : preview.separator === "semicolon" ? ";" : preview.separator === "tab" ? "TAB" : preview.separator === "pipe" ? "|" : preview.separator })}
                </span>
              )}
            </div>

            {/* Column badges */}
            <div className="flex flex-wrap gap-2">
              {preview.columns?.map((col, colIdx) => (
                <span
                  key={col.name || colIdx}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg th-bg-surface border th-border text-xs"
                >
                  <span className="th-text font-medium">{col.name}</span>
                  <span className="th-text-faint">{col.type}</span>
                </span>
              ))}
            </div>

            {/* Sample rows table */}
            {preview.sample_rows?.length > 0 && (
              <div className="overflow-x-auto rounded-xl border th-border max-h-[30vh] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b th-border th-bg-surface">
                      {preview.columns.map((col, colIdx) => (
                        <th
                          key={col.name || colIdx}
                          className="text-left px-3 py-2 th-text-secondary font-semibold whitespace-nowrap"
                        >
                          {col.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.sample_rows.slice(0, 10).map((row, i) => (
                      <tr
                        key={i}
                        className="border-b th-border hover:th-bg-surface transition-colors"
                      >
                        {preview.columns.map((col, colIdx) => (
                          <td
                            key={col.name || colIdx}
                            className="px-3 py-2 th-text whitespace-nowrap max-w-[200px] truncate"
                          >
                            {row[col.name] ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="py-12 text-center">
            <p className="th-text-secondary text-sm">{t("noPreviewAvailable")}</p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg th-text-secondary hover:th-text hover:th-bg-surface-hover font-medium transition-colors"
          >
            <ArrowLeft size={16} />
            {t("back")}
          </button>
          <button
            onClick={onNext}
            disabled={loading}
            className="btn-brand flex items-center gap-2 px-5 py-2.5 text-white rounded-lg font-bold"
          >
            {t("next")}
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  // DB preview
  return (
    <div>
      <h3 className="text-lg font-bold th-text mb-4">{t("previewData")}</h3>
      <div className="glass-card rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <Database size={18} className="text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-bold th-text">{dataSource.configName || t("database")}</p>
            <p className="text-xs th-text-faint">{dataSource.dbName}</p>
          </div>
        </div>
        <div className="rounded-lg th-bg-surface p-3 font-mono text-xs th-text overflow-x-auto">
          {dataSource.query}
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
          {t("dataWillLoadOnCreate")}
        </span>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg th-text-secondary hover:th-text hover:th-bg-surface-hover font-medium transition-colors"
        >
          <ArrowLeft size={16} />
          {t("back")}
        </button>
        <button
          onClick={onNext}
          className="btn-brand flex items-center gap-2 px-5 py-2.5 text-white rounded-lg font-bold"
        >
          {t("next")}
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Create Visualization
// ---------------------------------------------------------------------------
const AGGREGATIONS = [
  { key: "sum" },
  { key: "avg" },
  { key: "count" },
  { key: "min" },
  { key: "max" },
];

function StepVisualization({
  dataSource,
  previewColumns,
  vizType,
  setVizType,
  chartSubType,
  setChartSubType,
  kpiColumn,
  setKpiColumn,
  kpiAgg,
  setKpiAgg,
  kpiFormula,
  setKpiFormula,
  kpiUnit,
  setKpiUnit,
  kpiMode,
  setKpiMode,
  chartLabelCol,
  setChartLabelCol,
  chartValueCols,
  setChartValueCols,
  name,
  setName,
  refreshInterval,
  setRefreshInterval,
  creating,
  onBack,
  onCreate,
}) {
  const t = useTranslations("AddChartWizard");
  const numericColumns = (previewColumns || []).filter((col) =>
    ["int", "float", "number", "integer", "double", "decimal"].includes(
      (col.type || "").toLowerCase()
    )
  );
  const allColumns = previewColumns || [];

  const aggregationLabels = {
    sum: t("aggSum"),
    avg: t("aggAvg"),
    count: t("aggCount"),
    min: t("aggMin"),
    max: t("aggMax"),
  };

  const VIZ_OPTIONS = [
    {
      key: "chart",
      icon: BarChart3,
      label: t("vizChartLabel"),
      subtitle: t("vizChartSubtitle"),
    },
    {
      key: "table",
      icon: Table2,
      label: t("vizTableLabel"),
      subtitle: t("vizTableSubtitle"),
    },
    {
      key: "kpi",
      icon: Hash,
      label: t("vizKpiLabel"),
      subtitle: t("vizKpiSubtitle"),
    },
  ];

  const getPlaceholder = () => {
    if (vizType === "kpi") return t("placeholderKpi");
    if (vizType === "table") return t("placeholderTable");
    if (chartSubType === "pie") return t("placeholderPie");
    if (chartSubType === "line") return t("placeholderLine");
    return t("placeholderDefault");
  };

  return (
    <div>
      <h3 className="text-lg font-bold th-text mb-4">{t("createVisualization")}</h3>

      {/* Viz type cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {VIZ_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isSelected = vizType === opt.key;
          return (
            <button
              key={opt.key}
              onClick={() => {
                setVizType(opt.key);
                if (opt.key === "chart" && !chartSubType) setChartSubType("bar");
              }}
              className={`flex flex-col items-center gap-2 p-5 rounded-xl border transition-all ${
                isSelected
                  ? "border-blue-500 bg-blue-500/10"
                  : "th-border th-bg-surface hover:th-border-hover"
              }`}
            >
              <Icon
                size={28}
                className={isSelected ? "text-blue-400" : "th-text-faint"}
              />
              <span
                className={`text-sm font-semibold ${
                  isSelected ? "text-blue-400" : "th-text"
                }`}
              >
                {opt.label}
              </span>
              <span className="text-[11px] th-text-faint">{opt.subtitle}</span>
            </button>
          );
        })}
      </div>

      {/* Chart sub-type selection */}
      {vizType === "chart" && (
        <div className="mb-6">
          <label className="block text-sm font-medium th-text mb-2">{t("chartType")}</label>
          <div className="flex items-center gap-3">
            {[
              { key: "bar", icon: BarChart3, label: t("chartTypeBar") },
              { key: "line", icon: LineChart, label: t("chartTypeLine") },
              { key: "pie", icon: PieChart, label: t("chartTypePie") },
            ].map((st) => {
              const Icon = st.icon;
              const isSelected = chartSubType === st.key;
              return (
                <button
                  key={st.key}
                  onClick={() => setChartSubType(st.key)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all ${
                    isSelected
                      ? "border-blue-500 bg-blue-500/10 text-blue-400"
                      : "th-border th-bg-surface th-text-secondary hover:th-border-hover"
                  }`}
                >
                  <Icon size={16} />
                  <span className="text-sm font-medium">{st.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Chart column selectors */}
      {vizType === "chart" && allColumns.length > 0 && (
        <div className="mb-6 space-y-4 p-4 rounded-xl border th-border bg-white/[0.02]">
          <div>
            <label className="block text-sm font-medium th-text mb-1.5">
              {t("labelXAxis")}
            </label>
            <select
              value={chartLabelCol}
              onChange={(e) => setChartLabelCol(e.target.value)}
              className="glass-input w-full px-4 py-2.5 rounded-lg"
            >
              <option value="">{t("autoDetect")}</option>
              {allColumns.map((col) => (
                <option key={col.name} value={col.name}>
                  {col.name} ({col.type})
                </option>
              ))}
            </select>
            <p className="text-xs th-text-faint mt-1">
              {t("categoryAxisHint")}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium th-text mb-1.5">
              {chartSubType === "pie" ? t("valueYAxisSingle") : t("valueYAxisMultiple")}
            </label>
            {chartSubType === "pie" ? (
              <select
                value={chartValueCols[0] || ""}
                onChange={(e) => setChartValueCols(e.target.value ? [e.target.value] : [])}
                className="glass-input w-full px-4 py-2.5 rounded-lg"
              >
                <option value="">{t("autoDetect")}</option>
                {numericColumns.map((col) => (
                  <option key={col.name} value={col.name}>
                    {col.name} ({col.type})
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex flex-wrap gap-2">
                {numericColumns.length > 0 ? numericColumns.map((col) => {
                  const isSelected = chartValueCols.includes(col.name);
                  return (
                    <button
                      key={col.name}
                      type="button"
                      onClick={() => {
                        setChartValueCols((prev) =>
                          isSelected
                            ? prev.filter((c) => c !== col.name)
                            : [...prev, col.name]
                        );
                      }}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                        isSelected
                          ? "border-blue-500 bg-blue-500/10 text-blue-400"
                          : "th-border th-bg-surface th-text-secondary hover:th-border-hover"
                      }`}
                    >
                      {col.name}
                    </button>
                  );
                }) : (
                  <p className="text-xs th-text-faint">{t("noNumericColumnsHint")}</p>
                )}
              </div>
            )}
            <p className="text-xs th-text-faint mt-1">
              {chartSubType === "pie" ? t("valueColHintPie") : t("valueColHintMulti")}
            </p>
          </div>
        </div>
      )}

      {/* KPI config */}
      {vizType === "kpi" && (
        <div className="mb-6 space-y-4">
          {/* Mode toggle: Column or Formula */}
          <div>
            <label className="block text-sm font-medium th-text mb-1.5">{t("kpiMode")}</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: "column", label: t("kpiModeColumn") },
                { key: "formula", label: t("kpiModeFormula") },
              ].map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setKpiMode(m.key)}
                  className={`px-3 py-2.5 rounded-lg border text-xs font-medium transition-all ${
                    kpiMode === m.key
                      ? "border-blue-500 bg-blue-500/10 text-blue-400"
                      : "th-border th-bg-surface th-text-secondary hover:th-border-hover"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Column mode */}
          {kpiMode === "column" && (
            <>
              {numericColumns.length > 0 && (
                <div>
                  <label className="block text-sm font-medium th-text mb-1.5">{t("column")}</label>
                  <select
                    value={kpiColumn}
                    onChange={(e) => setKpiColumn(e.target.value)}
                    className="glass-input w-full px-4 py-2.5 rounded-lg"
                  >
                    <option value="">{t("selectNumericColumn")}</option>
                    {numericColumns.map((col) => (
                      <option key={col.name} value={col.name}>
                        {col.name} ({col.type})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium th-text mb-1.5">{t("aggregation")}</label>
                <div className="flex flex-wrap gap-2">
                  {AGGREGATIONS.map((a) => (
                    <button
                      key={a.key}
                      type="button"
                      onClick={() => setKpiAgg(a.key)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                        kpiAgg === a.key
                          ? "border-blue-500 bg-blue-500/10 text-blue-400"
                          : "th-border th-bg-surface th-text-secondary hover:th-border-hover"
                      }`}
                    >
                      {aggregationLabels[a.key]}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Formula mode */}
          {kpiMode === "formula" && (
            <>
              <div>
                <label className="block text-sm font-medium th-text mb-1.5">{t("formula")}</label>
                <input
                  type="text"
                  value={kpiFormula}
                  onChange={(e) => setKpiFormula(e.target.value)}
                  placeholder={t("formulaPlaceholder")}
                  className="glass-input w-full px-4 py-2.5 rounded-lg font-mono text-sm"
                />
                <p className="text-xs th-text-faint mt-1">
                  {t("formulaHint")}
                </p>
              </div>
              {allColumns.length > 0 && (
                <div>
                  <label className="block text-xs font-medium th-text-secondary mb-1.5">{t("availableColumns")}</label>
                  <div className="flex flex-wrap gap-1.5">
                    {allColumns.map((col) => (
                      <button
                        key={col.name}
                        type="button"
                        onClick={() => setKpiFormula((prev) => prev + `{${col.name}}`)}
                        className="px-2 py-1 rounded border th-border th-bg-surface text-[11px] th-text-secondary hover:border-blue-500/30 hover:text-blue-400 transition-all font-mono"
                      >
                        {`{${col.name}}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium th-text mb-1.5">{t("aggregation")}</label>
                <div className="flex flex-wrap gap-2">
                  {AGGREGATIONS.map((a) => (
                    <button
                      key={a.key}
                      type="button"
                      onClick={() => setKpiAgg(a.key)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                        kpiAgg === a.key
                          ? "border-blue-500 bg-blue-500/10 text-blue-400"
                          : "th-border th-bg-surface th-text-secondary hover:th-border-hover"
                      }`}
                    >
                      {aggregationLabels[a.key]}
                    </button>
                  ))}
                </div>
                <p className="text-xs th-text-faint mt-1">
                  {t("formulaAggHint")}
                </p>
              </div>
            </>
          )}

          {/* Unit */}
          <div>
            <label className="block text-sm font-medium th-text mb-1.5">{t("unit")}</label>
            <input
              type="text"
              value={kpiUnit}
              onChange={(e) => setKpiUnit(e.target.value)}
              placeholder={t("unitPlaceholder")}
              className="glass-input w-full px-4 py-2.5 rounded-lg"
            />
          </div>
        </div>
      )}

      {/* Name field */}
      <div className="mb-6">
        <label className="block text-sm font-medium th-text mb-1.5">
          {t("name")} <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={getPlaceholder()}
          className="glass-input w-full px-4 py-2.5 rounded-lg"
        />
      </div>

      {/* Auto-refresh */}
      <div className="mb-6">
        <label className="block text-sm font-medium th-text mb-1.5">
          {t("autoRefresh")}
        </label>
        <select
          value={refreshInterval}
          onChange={(e) => setRefreshInterval(Number(e.target.value))}
          className="glass-input w-full px-4 py-2.5 rounded-lg"
          aria-label={t("autoRefreshAriaLabel")}
        >
          <option value={0}>{t("refreshNever")}</option>
          <option value={10}>{t("refreshEvery10s")}</option>
          <option value={30}>{t("refreshEvery30s")}</option>
          <option value={60}>{t("refreshEveryMinute")}</option>
          <option value={300}>{t("refreshEvery5min")}</option>
          <option value={900}>{t("refreshEvery15min")}</option>
        </select>
        <p className="text-xs th-text-faint mt-1">
          {t("refreshHint")}
        </p>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg th-text-secondary hover:th-text hover:th-bg-surface-hover font-medium transition-colors"
        >
          <ArrowLeft size={16} />
          {t("back")}
        </button>
        <button
          onClick={onCreate}
          disabled={creating || !name.trim() || !vizType}
          className="btn-brand flex items-center gap-2 px-5 py-2.5 text-white rounded-lg font-bold"
        >
          {creating && <Loader2 size={16} className="animate-spin" />}
          {creating ? t("creating") : t("create")}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Wizard
// ---------------------------------------------------------------------------
export default function AddChartWizard({
  dashboardId,
  componentCount,
  onClose,
  onCreated,
}) {
  const t = useTranslations("AddChartWizard");
  const toast = useToast();
  const { user } = useAuth();
  const organizationId = user?.email?.split("@")[1] || "default";

  // Wizard state
  const [step, setStep] = useState(0);
  const [sourceMode, setSourceMode] = useState(null); // null | "upload" | "existing" | "database" | "agent" | "onedrive"
  const [dataSource, setDataSource] = useState(null);
  const [agentIds, setAgentIds] = useState([]);

  // Preview columns (saved from step 2 for step 3 KPI)
  const [previewColumns, setPreviewColumns] = useState([]);

  // Step 3 state
  const [vizType, setVizType] = useState(null); // "chart" | "table" | "kpi"
  const [chartSubType, setChartSubType] = useState("bar"); // "bar" | "line" | "pie"
  const [kpiColumn, setKpiColumn] = useState("");
  const [kpiAgg, setKpiAgg] = useState("sum");
  const [kpiFormula, setKpiFormula] = useState("");
  const [kpiUnit, setKpiUnit] = useState("");
  const [kpiMode, setKpiMode] = useState("column"); // "column" | "formula"
  const [chartLabelCol, setChartLabelCol] = useState("");
  const [chartValueCols, setChartValueCols] = useState([]);
  const [name, setName] = useState("");
  const [refreshInterval, setRefreshInterval] = useState(30);
  const [creating, setCreating] = useState(false);

  // When data source is selected in Step 1, auto-advance
  const handleDataSourceSelected = (ds) => {
    setDataSource(ds);
    setStep(1);
  };

  // On step 2 mount, try to capture columns for KPI dropdown in step 3
  const handlePreviewLoaded = useCallback((columns) => {
    setPreviewColumns(columns || []);
  }, []);

  // Step 2 -> capture columns then go to step 3
  const handlePreviewNext = () => {
    setStep(2);
  };

  // Create handler
  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error(t("chartNameRequired"));
      return;
    }
    if (!vizType) {
      toast.error(t("selectVizTypeRequired"));
      return;
    }

    setCreating(true);
    try {
      // 1. Determine chart_type
      let chart_type;
      if (vizType === "chart") chart_type = chartSubType;
      else if (vizType === "table") chart_type = "table";
      else if (vizType === "kpi") chart_type = "stat";

      // 2. Build source
      let source;
      if (dataSource?.type === "agent") {
        source = {
          source_type: "agent",
          query: "",
          source_options: { agent_ids: dataSource.agent_ids },
        };
      } else if (dataSource?.type === "csv") {
        source = {
          source_type: "csv",
          query: `csv://${dataSource.file_id}`,
        };
      } else if (dataSource?.type === "onedrive_excel") {
        source = {
          source_type: "onedrive_excel",
          query: "",
          connection_config_id: null,
          source_options: {
            item_id: dataSource.item_id,
            item_path: dataSource.item_path,
            sheet_name: null,
          },
        };
      } else if (
        dataSource?.type === "db" &&
        dataSource.connection_config_id &&
        (dataSource.query || "").trim()
      ) {
        source = {
          source_type: "database",
          query: dataSource.query,
          connection_config_id: dataSource.connection_config_id,
        };
      } else {
        // Reject rather than persist a chart with no usable data source:
        // the backend stores it but every /data fetch then returns 422.
        toast.error(t("pickDataSourceRequired"));
        setCreating(false);
        return;
      }

      // 3. Create chart
      const chartPayload = {
        name: name.trim(),
        title: name.trim(),
        chart_type,
        organization_id: organizationId,
        source,
      };
      if (refreshInterval > 0) {
        chartPayload.refresh_interval = refreshInterval;
      }
      if (vizType === "kpi") {
        const kpiConfig = {};
        if (kpiMode === "formula" && kpiFormula.trim()) {
          kpiConfig.formula = kpiFormula.trim();
        } else if (kpiColumn) {
          kpiConfig.column = kpiColumn;
        }
        kpiConfig.aggregation = kpiAgg;
        if (kpiUnit.trim()) kpiConfig.unit = kpiUnit.trim();
        chartPayload.config = kpiConfig;
      }

      // Chart column config
      if (vizType === "chart") {
        const chartConfig = {};
        if (chartLabelCol) chartConfig.labelColumn = chartLabelCol;
        if (chartValueCols.length > 0) chartConfig.valueColumns = chartValueCols;
        if (Object.keys(chartConfig).length > 0) chartPayload.config = chartConfig;
      }

      const chart = await createChart(chartPayload);

      // 4. Add to dashboard
      const isKpi = chart_type === "stat";
      const isTable = chart_type === "table";
      const width = isKpi ? 3 : isTable ? 12 : 6;
      const height = isKpi ? 3 : isTable ? 6 : 4;

      await addDashboardComponent(dashboardId, {
        component: {
          component_type: "chart",
          position: {
            col: 0,
            row: componentCount * 4,
            width,
            height,
          },
          chart: {
            chart_id: chart.id,
            title_override: name.trim(),
          },
        },
      });

      toast.success(t("chartCreated"));
      onCreated();
    } catch (err) {
      toast.error(t("createChartFailed", { message: err.message }));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="glass-card rounded-2xl p-6 w-full max-w-2xl animate-scale-in max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold th-text">{t("addChart")}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:th-bg-surface-hover th-text-secondary transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Stepper */}
        <Stepper activeStep={step} />

        {/* Step content */}
        {step === 0 && (
          <StepSource
            sourceMode={sourceMode}
            setSourceMode={setSourceMode}
            onDataSourceSelected={handleDataSourceSelected}
            toast={toast}
            organizationId={organizationId}
            agentIds={agentIds}
            setAgentIds={setAgentIds}
          />
        )}

        {step === 1 && dataSource && (
          <StepPreviewWrapper
            dataSource={dataSource}
            onBack={() => {
              setStep(0);
              setDataSource(null);
              setSourceMode(null);
            }}
            onNext={handlePreviewNext}
            onColumnsLoaded={handlePreviewLoaded}
            toast={toast}
            organizationId={organizationId}
          />
        )}

        {step === 2 && (
          <StepVisualization
            dataSource={dataSource}
            previewColumns={previewColumns}
            vizType={vizType}
            setVizType={setVizType}
            chartSubType={chartSubType}
            setChartSubType={setChartSubType}
            kpiColumn={kpiColumn}
            setKpiColumn={setKpiColumn}
            kpiAgg={kpiAgg}
            setKpiAgg={setKpiAgg}
            kpiFormula={kpiFormula}
            setKpiFormula={setKpiFormula}
            kpiUnit={kpiUnit}
            setKpiUnit={setKpiUnit}
            kpiMode={kpiMode}
            setKpiMode={setKpiMode}
            chartLabelCol={chartLabelCol}
            setChartLabelCol={setChartLabelCol}
            chartValueCols={chartValueCols}
            setChartValueCols={setChartValueCols}
            name={name}
            setName={setName}
            refreshInterval={refreshInterval}
            setRefreshInterval={setRefreshInterval}
            creating={creating}
            onBack={() => setStep(1)}
            onCreate={handleCreate}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// OneDrive preview error banner — maps HTTP status to an actionable message.
// ---------------------------------------------------------------------------
function OnedrivePreviewErrorBanner({ error }) {
  const t = useTranslations("AddChartWizard");
  const status = error?.status;
  let title = t("previewFailedTitle");
  let hint = error?.message || t("unableToLoadPreview");
  let accent = "amber";

  if (status === 401) {
    title = t("oneDriveNotConnectedTitle");
    hint = t("oneDriveNotConnectedHint");
    accent = "amber";
  } else if (status === 404) {
    title = t("fileNotFoundTitle");
    hint = t("fileNotFoundHint");
    accent = "red";
  } else if (status === 415) {
    title = t("unsupportedFormatTitle");
    hint = t("unsupportedFormatHint");
    accent = "red";
  } else if (status >= 500 || status === null) {
    title = t("previewErrorTitle");
    accent = "red";
  }

  const colors = accent === "red"
    ? "border-red-500/30 bg-red-500/10 text-red-300"
    : "border-amber-500/30 bg-amber-500/10 text-amber-300";

  return (
    <div className={`rounded-lg border p-4 ${colors}`}>
      <p className="text-sm font-semibold mb-1">{title}</p>
      <p className="text-xs opacity-90">{hint}</p>
      {status === 401 && (
        <a
          href="/integrations"
          className="inline-block mt-2 text-xs font-semibold underline hover:no-underline"
        >
          {t("openIntegrations")}
        </a>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wrapper around StepPreview that also forwards columns to parent
// ---------------------------------------------------------------------------
function StepPreviewWrapper({ dataSource, onBack, onNext, onColumnsLoaded, toast, organizationId }) {
  const t = useTranslations("AddChartWizard");
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (dataSource.type === "csv") {
      setLoading(true);
      setPreviewError(null);
      previewBiDataset(dataSource.file_id, organizationId)
        .then((data) => {
          if (!cancelled) {
            setPreview(data);
            onColumnsLoaded(data?.columns || []);
          }
        })
        .catch((err) => {
          if (!cancelled) toast.error(t("loadPreviewFailed", { message: err.message }));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    } else if (dataSource.type === "onedrive_excel") {
      setLoading(true);
      setPreview(null);
      setPreviewError(null);
      previewOnedriveSpreadsheet({
        itemPath: dataSource.item_path,
        itemId: dataSource.item_id ?? null,
        sheetName: dataSource.sheet_name ?? null,
      })
        .then((data) => {
          if (!cancelled) {
            setPreview(data);
            onColumnsLoaded(data?.columns || []);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setPreviewError({
              status: err?.status ?? null,
              message: err?.message || t("genericPreviewError"),
            });
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSource]);

  // CSV preview
  if (dataSource.type === "csv") {
    return (
      <div>
        <h3 className="text-lg font-bold th-text mb-4">{t("previewData")}</h3>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin text-blue-400" />
          </div>
        ) : preview ? (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3 flex-wrap">
              <FileSpreadsheet size={20} className="text-blue-400" />
              <span className="text-sm font-semibold th-text">{dataSource.filename}</span>
              <span className="text-xs th-text-faint">{t("rowsCount", { count: preview.row_count })}</span>
              {preview.separator && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  {t("separatorTag", { value: preview.separator === "comma" ? "," : preview.separator === "semicolon" ? ";" : preview.separator === "tab" ? "TAB" : preview.separator === "pipe" ? "|" : preview.separator })}
                </span>
              )}
            </div>

            {/* Column badges */}
            <div className="flex flex-wrap gap-2">
              {preview.columns?.map((col, colIdx) => (
                <span
                  key={col.name || colIdx}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg th-bg-surface border th-border text-xs"
                >
                  <span className="th-text font-medium">{col.name}</span>
                  <span className="th-text-faint">{col.type}</span>
                </span>
              ))}
            </div>

            {/* Sample rows table */}
            {preview.sample_rows?.length > 0 && (
              <div className="overflow-x-auto rounded-xl border th-border max-h-[30vh] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b th-border th-bg-surface">
                      {preview.columns.map((col, colIdx) => (
                        <th
                          key={col.name || colIdx}
                          className="text-left px-3 py-2 th-text-secondary font-semibold whitespace-nowrap"
                        >
                          {col.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.sample_rows.slice(0, 10).map((row, i) => (
                      <tr
                        key={i}
                        className="border-b th-border hover:th-bg-surface transition-colors"
                      >
                        {preview.columns.map((col, colIdx) => (
                          <td
                            key={col.name || colIdx}
                            className="px-3 py-2 th-text whitespace-nowrap max-w-[200px] truncate"
                          >
                            {row[col.name] ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="py-12 text-center">
            <p className="th-text-secondary text-sm">{t("noPreviewAvailable")}</p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg th-text-secondary hover:th-text hover:th-bg-surface-hover font-medium transition-colors"
          >
            <ArrowLeft size={16} />
            {t("back")}
          </button>
          <button
            onClick={onNext}
            disabled={loading}
            className="btn-brand flex items-center gap-2 px-5 py-2.5 text-white rounded-lg font-bold"
          >
            {t("next")}
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  // Agent preview
  if (dataSource.type === "agent") {
    return (
      <div>
        <h3 className="text-lg font-bold th-text mb-4">{t("previewData")}</h3>
        <div className="glass-card rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <Bot size={18} className="text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-bold th-text">{t("agentDataSource")}</p>
              <p className="text-xs th-text-faint">{t("agentsSelected", { count: dataSource.agent_ids.length })}</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            {t("dataFetchedFromAgents")}
          </span>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg th-text-secondary hover:th-text hover:th-bg-surface-hover font-medium transition-colors"
          >
            <ArrowLeft size={16} />
            {t("back")}
          </button>
          <button
            onClick={onNext}
            className="btn-brand flex items-center gap-2 px-5 py-2.5 text-white rounded-lg font-bold"
          >
            {t("next")}
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  // OneDrive Spreadsheet preview
  if (dataSource.type === "onedrive_excel") {
    return (
      <div>
        <h3 className="text-lg font-bold th-text mb-4">{t("previewData")}</h3>
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3 flex-wrap">
            <FileSpreadsheet size={20} className="text-emerald-400" />
            <span className="text-sm font-semibold th-text truncate max-w-[50%]">
              {dataSource.filename || t("oneDriveSpreadsheet")}
            </span>
            <span className="text-xs th-text-faint truncate">
              {dataSource.item_path}
            </span>
            {preview?.row_count != null && (
              <span className="text-xs th-text-faint">
                {t("rowsCount", { count: preview.row_count })}
              </span>
            )}
            {preview?.sheet_name && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                {t("sheetLabel", { name: preview.sheet_name })}
              </span>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={28} className="animate-spin text-emerald-400" />
            </div>
          ) : previewError ? (
            <OnedrivePreviewErrorBanner error={previewError} />
          ) : preview ? (
            <>
              {/* Column badges */}
              <div className="flex flex-wrap gap-2">
                {preview.columns?.map((col, colIdx) => (
                  <span
                    key={col.name || colIdx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg th-bg-surface border th-border text-xs"
                  >
                    <span className="th-text font-medium">{col.name}</span>
                    <span className="th-text-faint">{col.type}</span>
                  </span>
                ))}
              </div>

              {/* Sample rows table */}
              {preview.sample_rows?.length > 0 && (
                <div className="overflow-x-auto rounded-xl border th-border max-h-[30vh] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b th-border th-bg-surface">
                        {preview.columns.map((col, colIdx) => (
                          <th
                            key={col.name || colIdx}
                            className="text-left px-3 py-2 th-text-secondary font-semibold whitespace-nowrap"
                          >
                            {col.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.sample_rows.slice(0, 10).map((row, i) => (
                        <tr
                          key={i}
                          className="border-b th-border hover:th-bg-surface transition-colors"
                        >
                          {preview.columns.map((col, colIdx) => (
                            <td
                              key={col.name || colIdx}
                              className="px-3 py-2 th-text whitespace-nowrap max-w-[200px] truncate"
                            >
                              {row[col.name] ?? ""}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg th-text-secondary hover:th-text hover:th-bg-surface-hover font-medium transition-colors"
          >
            <ArrowLeft size={16} />
            {t("back")}
          </button>
          <button
            onClick={onNext}
            className="btn-brand flex items-center gap-2 px-5 py-2.5 text-white rounded-lg font-bold"
          >
            {t("next")}
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  // DB preview
  return (
    <div>
      <h3 className="text-lg font-bold th-text mb-4">{t("previewData")}</h3>
      <div className="glass-card rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <Database size={18} className="text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-bold th-text">{dataSource.configName || t("database")}</p>
            <p className="text-xs th-text-faint">{dataSource.dbName}</p>
          </div>
        </div>
        <div className="rounded-lg th-bg-surface p-3 font-mono text-xs th-text overflow-x-auto">
          {dataSource.query}
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
          {t("dataWillLoadOnCreate")}
        </span>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg th-text-secondary hover:th-text hover:th-bg-surface-hover font-medium transition-colors"
        >
          <ArrowLeft size={16} />
          {t("back")}
        </button>
        <button
          onClick={onNext}
          className="btn-brand flex items-center gap-2 px-5 py-2.5 text-white rounded-lg font-bold"
        >
          {t("next")}
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
