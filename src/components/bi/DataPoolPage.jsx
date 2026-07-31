"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "use-intl";
import { useRouter } from "@/lib/navigation";
import {
  Database,
  Upload,
  FileSpreadsheet,
  Plug,
  Eye,
  X,
  Loader2,
  ArrowLeft,
  Columns3,
  Rows3,
  Calendar,
  Server,
  Trash2,
} from "lucide-react";
import {
  listBiDatasets,
  previewBiDataset,
  listBiDbConfigs,
  uploadBiCsv,
  deleteBiDataset,
} from "@/lib/api";
import { formatDate as formatDateParis } from "@/lib/datetime";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "../Toast";
import EmptyState from "@/components/EmptyState";
import ConfirmToast from "@/components/ConfirmToast";

export default function DataPoolPage() {
  const router = useRouter();
  const toast = useToast();
  const t = useTranslations("DataPoolPage");
  const { user } = useAuth();
  const organizationId = user?.email?.split("@")[1] || "default";
  const fileInputRef = useRef(null);

  const [activeTab, setActiveTab] = useState("datasets");
  const [datasets, setDatasets] = useState([]);
  const [dbConfigs, setDbConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Preview modal state
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Delete confirm state
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchDatasets = useCallback(async () => {
    try {
      const res = await listBiDatasets(organizationId);
      setDatasets(res?.datasets || []);
    } catch (err) {
      console.warn("Failed to load datasets:", err);
      setDatasets([]);
    }
  }, [organizationId]);

  const fetchDbConfigs = useCallback(async () => {
    try {
      const res = await listBiDbConfigs(organizationId);
      setDbConfigs(res?.configs || []);
    } catch (err) {
      console.warn("Failed to load DB configs:", err);
      setDbConfigs([]);
    }
  }, [organizationId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchDatasets(), fetchDbConfigs()]).finally(() =>
      setLoading(false)
    );
  }, [fetchDatasets, fetchDbConfigs]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadBiCsv(file, "auto", organizationId);
      toast.success(t("uploadSuccess"));
      await fetchDatasets();
    } catch (err) {
      toast.error(t("uploadFailed", { message: err.message }));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteDataset = (e, fileId, filename) => {
    e.stopPropagation();
    setDeleteTarget({ fileId, filename });
  };

  const confirmDeleteDataset = async () => {
    if (!deleteTarget) return;
    const { fileId } = deleteTarget;
    setDeleteTarget(null);
    try {
      await deleteBiDataset(fileId, organizationId);
      toast.success(t("deleteSuccess"));
      await fetchDatasets();
    } catch (err) {
      toast.error(t("deleteFailed", { message: err.message }));
    }
  };

  const handlePreview = async (fileId) => {
    setPreviewLoading(true);
    setPreviewData(null);
    try {
      const data = await previewBiDataset(fileId, organizationId);
      setPreviewData(data);
    } catch (err) {
      toast.error(t("previewFailed", { message: err.message }));
    } finally {
      setPreviewLoading(false);
    }
  };

  const tabs = [
    { key: "datasets", label: t("tabDatasets"), icon: FileSpreadsheet },
    { key: "connections", label: t("tabConnections"), icon: Plug },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <header className="shrink-0 p-6 bg-linear-to-r from-brand/20 to-brand-secondary/20 border-b th-border backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/bi")}
              className="p-2 rounded-lg hover:th-bg-surface-hover th-text-secondary transition-colors"
              title={t("backToBi")}
            >
              <ArrowLeft size={20} />
            </button>
            <div className="p-3 bg-linear-to-br from-blue-400 to-blue-500 rounded-2xl shadow-lg">
              <Database size={32} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black th-text tracking-tight">
                {t("title")}
              </h1>
              <p className="th-text-secondary text-sm font-medium mt-1">
                {t("subtitle")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-5 py-3 bg-linear-to-r from-blue-400 to-blue-500 hover:from-blue-500 hover:to-blue-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Upload size={20} />
              )}
              {t("uploadCsv")}
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="glass-card p-8 rounded-2xl text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-[var(--border-primary)] border-t-blue-400 mx-auto mb-4" />
              <p className="th-text-secondary">{t("loading")}</p>
            </div>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Tabs */}
            <div className="flex items-center gap-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      activeTab === tab.key
                        ? "bg-blue-400/20 text-blue-400 border border-blue-400/30"
                        : "th-bg-surface border th-border th-text-secondary hover:th-bg-surface-hover"
                    }`}
                  >
                    <Icon size={16} />
                    {tab.label}
                    <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold th-bg-surface">
                      {tab.key === "datasets"
                        ? datasets.length
                        : dbConfigs.length}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Datasets Tab */}
            {activeTab === "datasets" && (
              <>
                {datasets.length === 0 ? (
                  <div className="glass-card p-12 rounded-2xl border border-dashed th-border-hover">
                    <EmptyState
                      icon={FileSpreadsheet}
                      title={t("emptyDatasetsTitle")}
                      description={t("emptyDatasetsDescription")}
                      action={() => fileInputRef.current?.click()}
                      actionLabel={t("uploadCsv")}
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {datasets.map((ds) => (
                      <div
                        key={ds.file_id}
                        onClick={() => handlePreview(ds.file_id)}
                        className="glass-card rounded-xl p-5 cursor-pointer hover:border-blue-400/30 transition-all group"
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-blue-400/10 rounded-lg shrink-0">
                            <FileSpreadsheet
                              size={20}
                              className="text-blue-400"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h3 className="text-lg font-bold th-text group-hover:text-blue-400 transition-colors truncate">
                                {ds.filename}
                              </h3>
                              <div className="flex items-center gap-1 shrink-0 ml-2">
                                <Eye
                                  size={16}
                                  className="th-text-faint group-hover:text-blue-400 transition-colors"
                                />
                                <button
                                  onClick={(e) => handleDeleteDataset(e, ds.file_id, ds.filename)}
                                  className="p-1 rounded-md hover:bg-red-500/20 text-transparent group-hover:th-text-faint hover:!text-red-400 transition-all"
                                  title={t("deleteDatasetTitle")}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 mt-3">
                              <span className="flex items-center gap-1.5 text-xs th-text-faint">
                                <Columns3 size={12} />
                                {t("columnsCount", { count: ds.columns_count })}
                              </span>
                              <span className="flex items-center gap-1.5 text-xs th-text-faint">
                                <Rows3 size={12} />
                                {t("rowsCount", { count: ds.row_count })}
                              </span>
                              {ds.uploaded_at && (
                                <span className="flex items-center gap-1.5 text-xs th-text-faint">
                                  <Calendar size={12} />
                                  {formatDateParis(ds.uploaded_at)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Connections Tab */}
            {activeTab === "connections" && (
              <>
                {dbConfigs.length === 0 ? (
                  <div className="glass-card p-12 rounded-2xl border border-dashed th-border-hover">
                    <EmptyState
                      icon={Database}
                      title={t("emptyConnectionsTitle")}
                      description={t("emptyConnectionsDescription")}
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {dbConfigs.map((cfg) => (
                      <div
                        key={cfg.id}
                        className="glass-card rounded-xl p-5 transition-all"
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-blue-500/10 rounded-lg shrink-0">
                            <Server size={20} className="text-blue-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-bold th-text truncate">
                              {cfg.config_name}
                            </h3>
                            <div className="flex items-center gap-4 mt-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-blue-500/15 text-blue-400 border border-blue-500/30">
                                {cfg.db_type}
                              </span>
                              <span className="text-xs th-text-faint truncate">
                                {cfg.host}
                                {cfg.port ? `:${cfg.port}` : ""}
                              </span>
                              {cfg.database && (
                                <span className="text-xs th-text-faint truncate">
                                  {cfg.database}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {(previewData || previewLoading) && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card rounded-2xl w-full max-w-5xl max-h-[85vh] flex flex-col animate-scale-in">
            {/* Modal header */}
            <div className="flex items-center justify-between p-6 border-b th-border shrink-0">
              {previewLoading ? (
                <div className="flex items-center gap-3">
                  <Loader2 size={20} className="animate-spin text-blue-400" />
                  <span className="th-text-secondary">{t("loadingPreview")}</span>
                </div>
              ) : (
                <div>
                  <h2 className="text-xl font-bold th-text">
                    {previewData?.filename}
                  </h2>
                  <p className="text-sm th-text-secondary mt-1">
                    {t("rowsCount", { count: previewData?.row_count })}
                    {" · "}
                    {t("columnsCount", { count: previewData?.columns?.length })}
                  </p>
                </div>
              )}
              <button
                onClick={() => {
                  setPreviewData(null);
                  setPreviewLoading(false);
                }}
                className="p-2 rounded-lg hover:th-bg-surface-hover th-text-secondary transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Columns list */}
            {previewData && (
              <>
                <div className="px-6 py-3 border-b th-border shrink-0">
                  <div className="flex flex-wrap gap-2">
                    {previewData.columns.map((col) => (
                      <span
                        key={col.name}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg th-bg-surface border th-border text-xs"
                      >
                        <span className="th-text font-medium">{col.name}</span>
                        <span className="th-text-faint">{col.type}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Sample rows table */}
                <div className="flex-1 overflow-auto p-6">
                  {previewData.sample_rows.length > 0 ? (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b th-border">
                          {previewData.columns.map((col) => (
                            <th
                              key={col.name}
                              className="text-left px-3 py-2 th-text-secondary font-semibold whitespace-nowrap"
                            >
                              {col.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.sample_rows.map((row, i) => (
                          <tr
                            key={i}
                            className="border-b th-border hover:th-bg-surface transition-colors"
                          >
                            {previewData.columns.map((col) => (
                              <td
                                key={col.name}
                                className="px-3 py-2 th-text whitespace-nowrap max-w-[200px] truncate"
                              >
                                {row[col.name] ?? ""}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-center th-text-secondary py-8">
                      {t("noSampleRows")}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmToast
          message={t("deleteConfirm", { filename: deleteTarget.filename })}
          onConfirm={confirmDeleteDataset}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
