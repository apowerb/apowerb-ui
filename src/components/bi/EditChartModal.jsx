"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "use-intl";
import {
  X,
  Loader2,
  BarChart3,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  Hash,
  Table2,
  Database,
  FileSpreadsheet,
  Upload,
  RefreshCw,
  Bot,
} from "lucide-react";
import { updateChart, uploadBiCsv, listBiDatasets, listBiDbConfigs, getChartData } from "@/lib/api";
import AgentSourcePicker from "./AgentSourcePicker";
import OneDriveFilePicker from "./OneDriveFilePicker";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "../Toast";

const VIZ_TYPES = [
  { key: "chart", icon: BarChart3 },
  { key: "table", icon: Table2 },
  { key: "kpi", icon: Hash },
];

const CHART_SUB_TYPES = [
  { key: "bar", icon: BarChart3 },
  { key: "line", icon: LineChartIcon },
  { key: "pie", icon: PieChartIcon },
];

function resolveVizType(chartType) {
  if (["bar", "line", "pie"].includes(chartType)) return { vizType: "chart", subType: chartType };
  if (chartType === "table") return { vizType: "table", subType: "bar" };
  if (chartType === "stat") return { vizType: "kpi", subType: "bar" };
  return { vizType: "chart", subType: "bar" };
}

export default function EditChartModal({ chart, onClose, onSaved }) {
  const t = useTranslations("EditChartModal");
  const toast = useToast();
  const { user } = useAuth();
  const organizationId = user?.email?.split("@")[1] || "default";
  const fileInputRef = useRef(null);
  const initial = resolveVizType(chart.chart_type || "bar");

  const vizTypeLabels = {
    chart: { label: t("vizChartLabel"), description: t("vizChartDescription") },
    table: { label: t("vizTableLabel"), description: t("vizTableDescription") },
    kpi: { label: t("vizKpiLabel"), description: t("vizKpiDescription") },
  };
  const chartSubTypeLabels = {
    bar: t("chartTypeBar"),
    line: t("chartTypeLine"),
    pie: t("chartTypePie"),
  };

  const [name, setName] = useState(chart.name || "");
  const [vizType, setVizType] = useState(initial.vizType);
  const [chartSubType, setChartSubType] = useState(initial.subType);
  const [saving, setSaving] = useState(false);

  // KPI config
  const existingConfig = chart.config || {};
  const [kpiMode, setKpiMode] = useState(existingConfig.formula ? "formula" : "column");
  const [kpiColumn, setKpiColumn] = useState(existingConfig.column || "");
  const [kpiAgg, setKpiAgg] = useState(existingConfig.aggregation || "sum");
  const [kpiFormula, setKpiFormula] = useState(existingConfig.formula || "");
  const [kpiUnit, setKpiUnit] = useState(existingConfig.unit || "");
  const [kpiPrefix, setKpiPrefix] = useState(existingConfig.prefix || "");
  const [kpiFormat, setKpiFormat] = useState(existingConfig.format || "");
  const [kpiColor, setKpiColor] = useState(existingConfig.color || "default");
  const [kpiDescription, setKpiDescription] = useState(existingConfig.description || "");

  // Chart column config
  const [chartLabelCol, setChartLabelCol] = useState(existingConfig.labelColumn || "");
  const [chartValueCols, setChartValueCols] = useState(existingConfig.valueColumns || []);

  // Load columns from chart data
  const [availableColumns, setAvailableColumns] = useState([]);
  const [loadingColumns, setLoadingColumns] = useState(false);
  useEffect(() => {
    if (!chart.id) return;
    setLoadingColumns(true);
    getChartData(chart.id, { page_size: 5 })
      .then((res) => {
        if (res.rows?.length > 0) {
          const firstRow = res.rows[0];
          const cols = Object.keys(firstRow).map((name) => {
            const val = firstRow[name];
            const isNumeric = typeof val === "number" || !isNaN(Number(val));
            return { name, type: isNumeric ? "number" : "string" };
          });
          setAvailableColumns(cols);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingColumns(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chart.id]);

  // Source state — editable
  const [sourceQuery, setSourceQuery] = useState(chart.source?.query || "");
  const [connectionId, setConnectionId] = useState(chart.source?.connection_config_id || null);
  const [showChangeSource, setShowChangeSource] = useState(false);
  const [changeMode, setChangeMode] = useState(null); // "csv" | "existing" | "db" | "agent"
  const [sourceType, setSourceType] = useState(chart?.source?.source_type || "database");
  const [agentIds, setAgentIds] = useState(chart?.source?.source_options?.agent_ids || []);
  const [onedriveFile, setOnedriveFile] = useState(() => {
    const opts = chart?.source?.source_options || {};
    if (chart?.source?.source_type === "onedrive_excel") {
      return {
        item_id: opts.item_id || null,
        item_path: opts.item_path || "",
        filename: (opts.item_path || "").split("/").pop() || "file.xlsx",
      };
    }
    return null;
  });
  const [refreshInterval, setRefreshInterval] = useState(
    chart?.refresh_interval ?? 30,
  );

  // Lists for source change
  const [datasets, setDatasets] = useState([]);
  const [dbConfigs, setDbConfigs] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dbTableName, setDbTableName] = useState("");
  const [selectedDbConfig, setSelectedDbConfig] = useState(null);

  const isCSV = sourceQuery.startsWith("csv://");
  const hasConnection = !!connectionId;

  const handleSave = async () => {
    if (!name.trim()) { toast.error(t("chartNameRequired")); return; }
    setSaving(true);
    try {
      let chart_type;
      if (vizType === "chart") chart_type = chartSubType;
      else if (vizType === "table") chart_type = "table";
      else if (vizType === "kpi") chart_type = "stat";

      const kpiConfig = {};
      if (vizType === "kpi") {
        if (kpiMode === "formula" && kpiFormula.trim()) {
          kpiConfig.formula = kpiFormula.trim();
        } else if (kpiColumn) {
          kpiConfig.column = kpiColumn;
        }
        kpiConfig.aggregation = kpiAgg;
        if (kpiUnit.trim()) kpiConfig.unit = kpiUnit.trim();
        if (kpiPrefix.trim()) kpiConfig.prefix = kpiPrefix.trim();
        if (kpiFormat) kpiConfig.format = kpiFormat;
        if (kpiColor && kpiColor !== "default") kpiConfig.color = kpiColor;
        if (kpiDescription.trim()) kpiConfig.description = kpiDescription.trim();
      }

      let finalConfig = chart.config || {};
      if (vizType === "kpi") {
        finalConfig = kpiConfig;
      } else if (vizType === "chart") {
        const chartConfig = {};
        if (chartLabelCol) chartConfig.labelColumn = chartLabelCol;
        if (chartValueCols.length > 0) chartConfig.valueColumns = chartValueCols;
        finalConfig = chartConfig;
      } else {
        finalConfig = {};
      }

      let source;
      if (sourceType === "agent") {
        source = {
          source_type: "agent",
          query: "",
          source_options: { agent_ids: agentIds },
        };
      } else if (sourceType === "onedrive_excel") {
        if (!onedriveFile?.item_path) {
          toast.error(t("pickOneDriveFileRequired"));
          setSaving(false);
          return;
        }
        source = {
          source_type: "onedrive_excel",
          query: "",
          connection_config_id: null,
          source_options: {
            item_id: onedriveFile.item_id,
            item_path: onedriveFile.item_path,
            sheet_name: chart?.source?.source_options?.sheet_name || null,
          },
        };
      } else if (sourceQuery.startsWith("csv://")) {
        source = { source_type: "csv", query: sourceQuery };
      } else {
        source = {
          source_type: "database",
          query: sourceQuery,
          connection_config_id: connectionId || undefined,
        };
      }

      const payload = {
        name: name.trim(),
        title: name.trim(),
        chart_type,
        source,
        config: finalConfig,
      };
      // Auto-refresh (seconds) — sent only when non-zero, matches the wizard.
      if (typeof refreshInterval === "number" && refreshInterval > 0) {
        payload.refresh_interval = refreshInterval;
      } else if (refreshInterval === 0 || refreshInterval === "") {
        payload.refresh_interval = null;
      }

      await updateChart(chart.id, payload);
      toast.success(t("chartUpdated"));
      onSaved?.();
    } catch (err) {
      toast.error(t("updateChartFailed", { message: err.message }));
    } finally {
      setSaving(false);
    }
  };

  // Load datasets or DB configs when change mode is selected
  useEffect(() => {
    if (changeMode === "existing") {
      setLoadingList(true);
      listBiDatasets(organizationId)
        .then((res) => setDatasets(res.datasets || []))
        .catch((err) => toast.error(t("loadDatasetsFailed", { message: err.message })))
        .finally(() => setLoadingList(false));
    } else if (changeMode === "db") {
      setLoadingList(true);
      listBiDbConfigs(organizationId)
        .then((res) => setDbConfigs(res.configs || []))
        .catch((err) => toast.error(t("loadConnectionsFailed", { message: err.message })))
        .finally(() => setLoadingList(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changeMode]);

  const handleCsvUpload = async (file) => {
    setUploading(true);
    try {
      const result = await uploadBiCsv(file, "auto", organizationId);
      setSourceQuery(`csv://${result.file_id}`);
      setConnectionId(null);
      setShowChangeSource(false);
      setChangeMode(null);
      toast.success(t("csvUploaded", { filename: result.filename }));
    } catch (err) {
      toast.error(t("uploadFailed", { message: err.message }));
    } finally {
      setUploading(false);
    }
  };

  const handleSelectDataset = (ds) => {
    setSourceQuery(`csv://${ds.file_id}`);
    setConnectionId(null);
    setShowChangeSource(false);
    setChangeMode(null);
  };

  const handleSelectDbTable = () => {
    if (!selectedDbConfig || !dbTableName.trim()) {
      toast.error(t("selectConnectionAndTable"));
      return;
    }
    setSourceQuery(`SELECT * FROM ${dbTableName.trim()}`);
    setConnectionId(selectedDbConfig.id);
    setShowChangeSource(false);
    setChangeMode(null);
    setSelectedDbConfig(null);
    setDbTableName("");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="glass-card rounded-2xl p-6 w-full max-w-lg animate-scale-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold th-text">{t("editChart")}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:th-bg-surface-hover th-text-secondary transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-5">
          {/* Data Source */}
          <div>
            <label className="block text-sm font-medium th-text mb-1.5">{t("dataSource")}</label>
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl border th-border th-bg-surface">
              {sourceType === "agent" ? (
                <>
                  <Bot size={16} className="text-indigo-400 shrink-0" />
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                    {t("agent")}
                  </span>
                  <span className="text-xs th-text-faint truncate ml-1">{t("agentsCount", { count: agentIds.length })}</span>
                </>
              ) : sourceType === "onedrive_excel" ? (
                <>
                  <FileSpreadsheet size={16} className="text-sky-400 shrink-0" />
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                    {t("oneDriveSpreadsheet")}
                  </span>
                  <span className="text-xs th-text-faint truncate ml-1">
                    {onedriveFile?.filename || onedriveFile?.item_path || t("noFileSelected")}
                  </span>
                </>
              ) : isCSV ? (
                <>
                  <FileSpreadsheet size={16} className="text-blue-400 shrink-0" />
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    CSV
                  </span>
                  <span className="text-xs th-text-faint truncate ml-1">{sourceQuery.replace("csv://", "")}</span>
                </>
              ) : hasConnection ? (
                <>
                  <Database size={16} className="text-blue-400 shrink-0" />
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    {t("database")}
                  </span>
                  <span className="text-xs th-text-faint truncate ml-1">{sourceQuery}</span>
                </>
              ) : (
                <>
                  <BarChart3 size={16} className="th-text-faint shrink-0" />
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold th-bg-surface th-text-muted border th-border-hover">
                    {t("sampleData")}
                  </span>
                  {sourceQuery && <span className="text-xs th-text-faint truncate ml-1">{sourceQuery}</span>}
                </>
              )}
              <button
                onClick={() => { setShowChangeSource(!showChangeSource); setChangeMode(null); }}
                className="ml-auto p-1.5 rounded-lg hover:th-bg-surface-hover th-text-faint hover:text-blue-400 transition-colors shrink-0"
                title={t("changeDataSourceTitle")}
              >
                <RefreshCw size={14} />
              </button>
            </div>

            {/* Change Source Panel */}
            {showChangeSource && (
              <div className="mt-3 p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 space-y-3">
                <p className="text-xs font-medium th-text">{t("changeDataSourceLabel")}</p>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { key: "csv", label: t("uploadCsv"), icon: Upload },
                    { key: "existing", label: t("existingLabel"), icon: FileSpreadsheet },
                    { key: "db", label: t("database"), icon: Database },
                    { key: "onedrive", label: "OneDrive", icon: FileSpreadsheet },
                    { key: "agent", label: t("agent"), icon: Bot },
                  ].map((opt) => {
                    const Icon = opt.icon;
                    const isActive = changeMode === opt.key;
                    return (
                      <button
                        key={opt.key}
                        onClick={() => setChangeMode(isActive ? null : opt.key)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs font-medium transition-all ${
                          isActive
                            ? "border-blue-500 bg-blue-500/10 text-blue-400"
                            : "th-border th-bg-surface th-text-secondary hover:th-border-hover"
                        }`}
                      >
                        <Icon size={16} />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                {/* Upload CSV */}
                {changeMode === "csv" && (
                  <div>
                    <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleCsvUpload(e.target.files[0]); }} />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="w-full py-3 border-2 border-dashed th-border-hover hover:border-blue-500/50 rounded-xl text-sm th-text-secondary hover:text-blue-400 transition-all"
                    >
                      {uploading ? <Loader2 size={16} className="inline animate-spin mr-2" /> : null}
                      {uploading ? t("uploading") : t("clickToSelectCsv")}
                    </button>
                  </div>
                )}

                {/* Existing datasets */}
                {changeMode === "existing" && (
                  <div className="max-h-[150px] overflow-y-auto space-y-1.5">
                    {loadingList ? (
                      <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-blue-400" /></div>
                    ) : datasets.length === 0 ? (
                      <p className="text-xs th-text-faint py-2 text-center">{t("noDatasetsUploadedYet")}</p>
                    ) : (
                      datasets.map((ds) => (
                        <button
                          key={ds.file_id}
                          onClick={() => handleSelectDataset(ds)}
                          className="w-full text-left px-3 py-2 rounded-lg border th-border th-bg-surface hover:border-blue-500/30 hover:bg-blue-500/5 transition-all"
                        >
                          <span className="text-xs font-medium th-text">{ds.filename}</span>
                          <span className="text-[10px] th-text-faint ml-2">{t("colsRowsSummary", { cols: ds.columns_count, rows: ds.row_count })}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}

                {/* Database */}
                {changeMode === "db" && (
                  <div className="space-y-2">
                    {loadingList ? (
                      <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-blue-400" /></div>
                    ) : dbConfigs.length === 0 ? (
                      <p className="text-xs th-text-faint py-2 text-center">{t("noDbConnectionsConfigured")}</p>
                    ) : (
                      <>
                        <div className="max-h-[100px] overflow-y-auto space-y-1.5">
                          {dbConfigs.map((cfg) => (
                            <button
                              key={cfg.id}
                              onClick={() => setSelectedDbConfig(cfg)}
                              className={`w-full text-left px-3 py-2 rounded-lg border transition-all ${
                                selectedDbConfig?.id === cfg.id
                                  ? "border-blue-500 bg-blue-500/10"
                                  : "th-border th-bg-surface hover:th-border-hover"
                              }`}
                            >
                              <span className="text-xs font-medium th-text">{cfg.config_name}</span>
                              <span className="text-[10px] th-text-faint ml-2">{cfg.host}:{cfg.port}/{cfg.database}</span>
                            </button>
                          ))}
                        </div>
                        {selectedDbConfig && (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={dbTableName}
                              onChange={(e) => setDbTableName(e.target.value)}
                              placeholder={t("tableNamePlaceholder")}
                              className="glass-input flex-1 px-3 py-2 text-xs rounded-lg"
                            />
                            <button
                              onClick={handleSelectDbTable}
                              disabled={!dbTableName.trim()}
                              className="px-3 py-2 text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg font-medium hover:bg-blue-500/30 transition-all disabled:opacity-50"
                            >
                              {t("apply")}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Agent */}
                {changeMode === "agent" && (
                  <AgentSourcePicker
                    selectedIds={agentIds}
                    onChange={(ids) => {
                      setAgentIds(ids);
                      setSourceType("agent");
                    }}
                  />
                )}

                {/* OneDrive Spreadsheet */}
                {changeMode === "onedrive" && (
                  <OneDriveFilePicker
                    onFileSelected={({ item_id, item_path, filename }) => {
                      setOnedriveFile({ item_id, item_path, filename });
                      setSourceType("onedrive_excel");
                      setSourceQuery("");
                      setConnectionId(null);
                      setChangeMode(null);
                    }}
                    onCancel={() => setChangeMode(null)}
                  />
                )}
              </div>
            )}
          </div>

          {/* Auto-refresh */}
          <div className="p-3 rounded-lg th-bg-surface border th-border">
            <label className="text-sm font-medium th-text-secondary">
              {t("autoRefresh")}
            </label>
            <select
              value={
                typeof refreshInterval === "number"
                  ? refreshInterval
                  : Number(refreshInterval) || 0
              }
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="glass-input mt-1 w-full rounded-lg text-sm px-3 py-2"
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

          {/* Visualization Type */}
          <div>
            <label className="block text-sm font-medium th-text mb-1.5">{t("visualization")}</label>
            <div className="grid grid-cols-3 gap-3">
              {VIZ_TYPES.map((vt) => {
                const Icon = vt.icon;
                const isSelected = vizType === vt.key;
                return (
                  <button
                    key={vt.key}
                    type="button"
                    onClick={() => setVizType(vt.key)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                      isSelected
                        ? "border-blue-500 bg-blue-500/10 text-blue-400"
                        : "th-border th-bg-surface th-text-secondary hover:th-border-hover"
                    }`}
                  >
                    <Icon size={24} />
                    <span className="text-sm font-semibold">{vizTypeLabels[vt.key].label}</span>
                    <span className={`text-[10px] leading-tight text-center ${isSelected ? "text-blue-400/70" : "th-text-faint"}`}>
                      {vizTypeLabels[vt.key].description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chart Sub-Type */}
          {vizType === "chart" && (
            <div>
              <label className="block text-sm font-medium th-text mb-1.5">{t("chartStyle")}</label>
              <div className="grid grid-cols-3 gap-2">
                {CHART_SUB_TYPES.map((st) => {
                  const Icon = st.icon;
                  const isSelected = chartSubType === st.key;
                  return (
                    <button
                      key={st.key}
                      type="button"
                      onClick={() => setChartSubType(st.key)}
                      className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border transition-all ${
                        isSelected
                          ? "border-blue-500 bg-blue-500/10 text-blue-400"
                          : "th-border th-bg-surface th-text-secondary hover:th-border-hover"
                      }`}
                    >
                      <Icon size={16} />
                      <span className="text-xs font-medium">{chartSubTypeLabels[st.key]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Chart Column Config */}
          {vizType === "chart" && (
            <div className="space-y-3 p-4 rounded-xl border th-border bg-white/[0.02]">
              {loadingColumns ? (
                <div className="flex items-center justify-center py-3">
                  <Loader2 size={16} className="animate-spin text-blue-400 mr-2" />
                  <span className="text-xs th-text-faint">{t("loadingColumns")}</span>
                </div>
              ) : availableColumns.length > 0 ? (
                <>
                  <div>
                    <label className="block text-xs font-medium th-text-secondary mb-1.5">{t("labelXAxis")}</label>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setChartLabelCol("")}
                        className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all ${
                          !chartLabelCol
                            ? "border-blue-500 bg-blue-500/10 text-blue-400"
                            : "th-border th-bg-surface th-text-secondary hover:th-border-hover"
                        }`}
                      >
                        {t("auto")}
                      </button>
                      {availableColumns.map((col) => (
                        <button
                          key={col.name}
                          type="button"
                          onClick={() => setChartLabelCol(col.name)}
                          className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all ${
                            chartLabelCol === col.name
                              ? "border-blue-500 bg-blue-500/10 text-blue-400"
                              : "th-border th-bg-surface th-text-secondary hover:th-border-hover"
                          }`}
                        >
                          {col.name}
                          <span className="ml-1 opacity-50">{col.type === "number" ? "#" : "Aa"}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium th-text-secondary mb-1.5">
                      {chartSubType === "pie" ? t("valueYAxisPickOne") : t("valueYAxisPickMany")}
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setChartValueCols([])}
                        className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all ${
                          chartValueCols.length === 0
                            ? "border-blue-500 bg-blue-500/10 text-blue-400"
                            : "th-border th-bg-surface th-text-secondary hover:th-border-hover"
                        }`}
                      >
                        {t("allNumeric")}
                      </button>
                      {availableColumns.filter((c) => c.type === "number").map((col) => {
                        const isSelected = chartValueCols.includes(col.name);
                        return (
                          <button
                            key={col.name}
                            type="button"
                            onClick={() => {
                              if (chartSubType === "pie") {
                                setChartValueCols(isSelected ? [] : [col.name]);
                              } else {
                                setChartValueCols((prev) =>
                                  isSelected ? prev.filter((c) => c !== col.name) : [...prev, col.name]
                                );
                              }
                            }}
                            className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all ${
                              isSelected
                                ? "border-blue-400 bg-blue-400/10 text-blue-400"
                                : "th-border th-bg-surface th-text-secondary hover:th-border-hover"
                            }`}
                          >
                            {col.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-xs th-text-faint py-1">{t("noColumnDataHint")}</p>
              )}
            </div>
          )}

          {/* KPI Config */}
          {vizType === "kpi" && (
            <div className="space-y-4 p-4 rounded-xl border th-border bg-white/[0.02]">
              <div>
                <label className="block text-xs font-medium th-text-secondary mb-1.5">{t("kpiMode")}</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: "column", label: t("kpiModeColumn") },
                    { key: "formula", label: t("kpiModeFormula") },
                  ].map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setKpiMode(m.key)}
                      className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
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

              {kpiMode === "column" && (
                <div>
                  <label className="block text-xs font-medium th-text-secondary mb-1.5">{t("column")}</label>
                  {availableColumns.filter((c) => c.type === "number").length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {availableColumns.filter((c) => c.type === "number").map((col) => (
                        <button
                          key={col.name}
                          type="button"
                          onClick={() => setKpiColumn(col.name)}
                          className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all ${
                            kpiColumn === col.name
                              ? "border-blue-500 bg-blue-500/10 text-blue-400"
                              : "th-border th-bg-surface th-text-secondary hover:th-border-hover"
                          }`}
                        >
                          {col.name}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={kpiColumn}
                      onChange={(e) => setKpiColumn(e.target.value)}
                      placeholder={t("columnNamePlaceholder")}
                      className="glass-input w-full px-3 py-2 text-sm rounded-lg"
                    />
                  )}
                </div>
              )}

              {kpiMode === "formula" && (
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-medium th-text-secondary mb-1.5">{t("formula")}</label>
                    <input
                      type="text"
                      value={kpiFormula}
                      onChange={(e) => setKpiFormula(e.target.value)}
                      placeholder={t("formulaPlaceholder")}
                      className="glass-input w-full px-3 py-2 text-sm rounded-lg font-mono"
                    />
                    <p className="text-[10px] th-text-faint mt-1">{t("formulaVariablesHint")}</p>
                  </div>
                  {availableColumns.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {availableColumns.map((col) => (
                        <button
                          key={col.name}
                          type="button"
                          onClick={() => setKpiFormula((prev) => prev + `{${col.name}}`)}
                          className="px-2 py-0.5 rounded border th-border th-bg-surface text-[10px] th-text-secondary hover:border-blue-500/30 hover:text-blue-400 transition-all font-mono"
                        >
                          {`{${col.name}}`}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium th-text-secondary mb-1.5">{t("aggregation")}</label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { key: "sum", label: t("aggSum") },
                    { key: "avg", label: t("aggAvg") },
                    { key: "count", label: t("aggCount") },
                    { key: "min", label: t("aggMin") },
                    { key: "max", label: t("aggMax") },
                  ].map((a) => (
                    <button
                      key={a.key}
                      type="button"
                      onClick={() => setKpiAgg(a.key)}
                      className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
                        kpiAgg === a.key
                          ? "border-blue-500 bg-blue-500/10 text-blue-400"
                          : "th-border th-bg-surface th-text-secondary hover:th-border-hover"
                      }`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Prefix + Unit row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium th-text-secondary mb-1.5">{t("prefix")}</label>
                  <input
                    type="text"
                    value={kpiPrefix}
                    onChange={(e) => setKpiPrefix(e.target.value)}
                    placeholder={t("prefixPlaceholder")}
                    className="glass-input w-full px-3 py-2 text-sm rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium th-text-secondary mb-1.5">{t("unit")}</label>
                  <input
                    type="text"
                    value={kpiUnit}
                    onChange={(e) => setKpiUnit(e.target.value)}
                    placeholder={t("unitPlaceholder")}
                    className="glass-input w-full px-3 py-2 text-sm rounded-lg"
                  />
                </div>
              </div>

              {/* Number format */}
              <div>
                <label className="block text-xs font-medium th-text-secondary mb-1.5">{t("numberFormat")}</label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { key: "", label: t("formatAuto") },
                    { key: "compact", label: t("formatCompact") },
                    { key: "integer", label: t("formatInteger") },
                    { key: "decimal1", label: t("formatDecimal1") },
                    { key: "decimal2", label: t("formatDecimal2") },
                    { key: "percent", label: t("formatPercent") },
                  ].map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setKpiFormat(f.key)}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all ${
                        kpiFormat === f.key
                          ? "border-blue-500 bg-blue-500/10 text-blue-400"
                          : "th-border th-bg-surface th-text-secondary hover:th-border-hover"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="block text-xs font-medium th-text-secondary mb-1.5">{t("color")}</label>
                <div className="flex flex-wrap gap-2">
                  {["default", "purple", "blue", "green", "orange", "red", "cyan", "pink"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setKpiColor(c)}
                      className={`w-7 h-7 rounded-lg border-2 transition-all ${
                        kpiColor === c ? "scale-110 ring-2 ring-white/30" : "hover:scale-105"
                      } ${
                        c === "default" ? "th-bg-surface th-border-hover"
                        : c === "purple" ? "bg-purple-500/40 border-purple-500/50"
                        : c === "blue" ? "bg-blue-500/40 border-blue-500/50"
                        : c === "green" ? "bg-blue-500/40 border-blue-500/50"
                        : c === "orange" ? "bg-purple-500/40 border-purple-500/50"
                        : c === "red" ? "bg-purple-500/40 border-purple-500/50"
                        : c === "cyan" ? "bg-blue-400/40 border-blue-400/50"
                        : "bg-purple-500/40 border-purple-500/50"
                      }`}
                      title={c}
                    />
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium th-text-secondary mb-1.5">{t("description")}</label>
                <input
                  type="text"
                  value={kpiDescription}
                  onChange={(e) => setKpiDescription(e.target.value)}
                  placeholder={t("descriptionPlaceholder")}
                  className="glass-input w-full px-3 py-2 text-sm rounded-lg"
                />
              </div>
            </div>
          )}

          {/* Chart Name */}
          <div>
            <label className="block text-sm font-medium th-text mb-1.5">
              {t("name")} <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("namePlaceholder")}
              className="glass-input w-full px-4 py-2.5 rounded-lg"
              autoFocus
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg th-text-secondary hover:th-text hover:th-bg-surface-hover font-medium transition-colors"
          >
            {t("cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="btn-brand flex items-center gap-2 px-5 py-2.5 text-white rounded-lg font-bold"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            {saving ? t("saving") : t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}
