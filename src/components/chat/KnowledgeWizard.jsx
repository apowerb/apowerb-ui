"use client";

import { useTranslations } from "use-intl";
import { useState, useEffect, useCallback } from "react";
import {
  Upload,
  Globe,
  Database,
  Cloud,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Plus,
  X,
  Sparkles,
} from "lucide-react";
import FileUploadZone from "./FileUploadZone";
import { listToolConfigs } from "@/lib/api";

function SourceStatusIcon({ status }) {
  if (status === "complete") {
    return <CheckCircle2 size={16} className="text-blue-400" />;
  }
  if (status === "error") {
    return <AlertCircle size={16} className="text-red-400" />;
  }
  if (status === "cancelled") {
    return <X size={16} className="th-text-faint" />;
  }
  return <Loader2 size={16} className="text-blue-400 animate-spin" />;
}

function FileForm({ onSubmit, disabled }) {
  const t = useTranslations("KnowledgeWizard");
  const [files, setFiles] = useState([]);

  const handleSubmit = useCallback(() => {
    if (files.length === 0) return;
    // Extract raw File objects from FileUploadZone file objects
    const rawFiles = files.map((f) => f.file).filter(Boolean);
    if (rawFiles.length > 0) {
      onSubmit(rawFiles);
      setFiles([]);
    }
  }, [files, onSubmit]);

  return (
    <div className="space-y-3">
      <FileUploadZone
        files={files}
        onFilesChange={setFiles}
        disabled={disabled}
      />
      {files.length > 0 && (
        <button
          onClick={handleSubmit}
          disabled={disabled}
          className="w-full py-2 px-4 rounded-lg bg-brand/20 text-brand text-sm font-medium hover:bg-brand/30 transition-colors disabled:opacity-50"
        >
          <Plus size={14} className="inline mr-1.5" />
          {t("addFiles", { count: files.length })}
        </button>
      )}
    </div>
  );
}

function UrlForm({ onSubmit, disabled }) {
  const t = useTranslations("KnowledgeWizard");
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");

  const handleSubmit = useCallback(() => {
    if (!url.trim()) return;
    onSubmit(url.trim(), name.trim() || url.trim());
    setUrl("");
    setName("");
  }, [url, name, onSubmit]);

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs th-text-muted mb-1">{t("urlLabel")}</label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t("urlPlaceholder")}
          disabled={disabled}
          className="w-full px-3 py-2 th-bg-surface border th-border rounded-lg text-sm th-text-secondary placeholder:th-text-faint focus:outline-none focus:border-brand/50"
        />
      </div>
      <div>
        <label className="block text-xs th-text-muted mb-1">{t("nameOptionalLabel")}</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("namePlaceholderDoc")}
          disabled={disabled}
          className="w-full px-3 py-2 th-bg-surface border th-border rounded-lg text-sm th-text-secondary placeholder:th-text-faint focus:outline-none focus:border-brand/50"
        />
      </div>
      <button
        onClick={handleSubmit}
        disabled={disabled || !url.trim()}
        className="w-full py-2 px-4 rounded-lg bg-brand/20 text-brand text-sm font-medium hover:bg-brand/30 transition-colors disabled:opacity-50"
      >
        <Plus size={14} className="inline mr-1.5" />
        {t("addUrl")}
      </button>
    </div>
  );
}

function ExplorationSteps({ step, error }) {
  const t = useTranslations("KnowledgeWizard");
  const steps = [
    { id: "connecting", label: t("stepConnecting") },
    { id: "schema_discovery", label: t("stepSchemaDiscovery") },
    { id: "generating_sql", label: t("stepGeneratingSql") },
    { id: "sql_validation", label: t("stepSqlValidation") },
    { id: "indexing", label: t("stepIndexing") },
  ];

  const stepOrder = steps.map((s) => s.id);
  const currentIdx = stepOrder.indexOf(step);

  return (
    <div className="space-y-2">
      {steps.map((s, idx) => {
        const isDone = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const isError = isCurrent && error;

        return (
          <div key={s.id} className="flex items-center gap-2.5">
            {isError ? (
              <AlertCircle size={14} className="text-red-400 shrink-0" />
            ) : isDone ? (
              <CheckCircle2 size={14} className="text-blue-400 shrink-0" />
            ) : isCurrent ? (
              <Loader2 size={14} className="text-blue-400 animate-spin shrink-0" />
            ) : (
              <div className="w-3.5 h-3.5 rounded-full border th-border shrink-0" />
            )}
            <span
              className={`text-xs ${
                isError
                  ? "text-red-400"
                  : isDone
                    ? "text-blue-400/80"
                    : isCurrent
                      ? "th-text-secondary"
                      : "th-text-faint"
              }`}
            >
              {isDone ? s.label.replace("...", " ✓") : s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function DbNlForm({ onSubmit, disabled }) {
  const t = useTranslations("KnowledgeWizard");
  const [mode, setMode] = useState("credentials"); // "credentials" | "connector"
  const [toolConfigs, setToolConfigs] = useState([]);
  const [selectedConfig, setSelectedConfig] = useState("");
  const [loadingConfigs, setLoadingConfigs] = useState(false);

  // Credentials
  const [host, setHost] = useState("");
  const [port, setPort] = useState("5432");
  const [database, setDatabase] = useState("");
  const [schemaName, setSchemaName] = useState("public");
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [saveConnector, setSaveConnector] = useState(false);
  const [connectorName, setConnectorName] = useState("");

  // NL + name
  const [nlDescription, setNlDescription] = useState("");
  const [name, setName] = useState("");

  // Exploration state
  const [isExploring, setIsExploring] = useState(false);
  const [explorationStep, setExplorationStep] = useState(null);
  const [explorationError, setExplorationError] = useState(null);
  const [generatedSql, setGeneratedSql] = useState(null);
  const [rowCount, setRowCount] = useState(null);

  // Load tool configs when switching to connector mode
  useEffect(() => {
    if (mode !== "connector") return;
    let cancelled = false;
    setLoadingConfigs(true);
    listToolConfigs()
      .then((configs) => {
        if (cancelled) return;
        const dbConfigs = (configs || []).filter((c) => {
          const cat = (c.tool_category || c.tool_name || "").toLowerCase();
          return cat.includes("database") || cat.includes("sql") || cat.includes("db") || cat.includes("text_to_sql");
        });
        setToolConfigs(dbConfigs);
      })
      .catch(() => {
        if (!cancelled) setToolConfigs([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingConfigs(false);
      });
    return () => { cancelled = true; };
  }, [mode]);

  const canSubmit =
    nlDescription.trim() &&
    name.trim() &&
    (mode === "credentials"
      ? host.trim() && database.trim() && user.trim() && password.trim()
      : selectedConfig);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || isExploring) return;

    setIsExploring(true);
    setExplorationError(null);
    setGeneratedSql(null);
    setExplorationStep("connecting");

    const payload = {
      nl_description: nlDescription.trim(),
      name: name.trim(),
    };

    if (mode === "credentials") {
      payload.credentials = {
        host: host.trim(),
        port: parseInt(port, 10) || 5432,
        database: database.trim(),
        user: user.trim(),
        password: password.trim(),
        schema_name: schemaName.trim() || "public",
      };
      if (saveConnector) {
        payload.save_connector = true;
        payload.connector_name = connectorName.trim() || undefined;
      }
    } else {
      payload.tool_config_id = selectedConfig;
    }

    // Simulate step progression for UX (backend does it all in one call)
    const stepTimer1 = setTimeout(() => setExplorationStep("schema_discovery"), 1500);
    const stepTimer2 = setTimeout(() => setExplorationStep("generating_sql"), 4000);
    const stepTimer3 = setTimeout(() => setExplorationStep("sql_validation"), 7000);
    const stepTimer4 = setTimeout(() => setExplorationStep("indexing"), 9000);

    try {
      const result = await onSubmit(payload);
      setExplorationStep("indexing");
      if (result?.generated_sql) {
        setGeneratedSql(result.generated_sql);
      }
      if (result?.row_count != null) {
        setRowCount(result.row_count);
      }
      // Success — reset form after a short delay
      setTimeout(() => {
        setIsExploring(false);
        setExplorationStep(null);
        setGeneratedSql(null);
        setRowCount(null);
        setNlDescription("");
        setName("");
      }, 2000);
    } catch (err) {
      setExplorationError(err.message || "Unknown error");
    } finally {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      clearTimeout(stepTimer3);
      clearTimeout(stepTimer4);
    }
  }, [canSubmit, isExploring, nlDescription, name, mode, host, port, database, user, password, schemaName, saveConnector, connectorName, selectedConfig, onSubmit]);

  const resetExploration = useCallback(() => {
    setIsExploring(false);
    setExplorationStep(null);
    setExplorationError(null);
    setGeneratedSql(null);
    setRowCount(null);
  }, []);

  // Exploring — show steps view
  if (isExploring) {
    return (
      <div className="space-y-4">
        <ExplorationSteps step={explorationStep} error={explorationError} />

        {generatedSql && (
          <div className="th-bg-surface border th-border rounded-lg p-3">
            <p className="text-[10px] th-text-faint mb-1.5 uppercase tracking-wider">
              {t("generatedSql")}
              {rowCount != null && <span className="ml-2 text-blue-400/60">{t("rowsCount", { count: rowCount })}</span>}
            </p>
            <pre className="text-xs text-blue-300/80 font-mono whitespace-pre-wrap break-all">{generatedSql}</pre>
          </div>
        )}

        {explorationError && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertCircle size={14} className="text-red-400 shrink-0" />
              <p className="text-xs text-red-300">{explorationError}</p>
            </div>
            <button
              onClick={resetExploration}
              className="w-full py-2 px-4 rounded-lg text-sm th-text-muted hover:th-text-secondary hover:th-bg-surface transition-colors"
            >
              {t("retry")}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Mode toggle */}
      <div className="flex gap-1 p-0.5 th-bg-surface rounded-lg">
        <button
          onClick={() => setMode("credentials")}
          className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-colors ${
            mode === "credentials"
              ? "th-bg-surface-hover th-text-secondary"
              : "th-text-faint hover:th-text-muted"
          }`}
        >
          {t("credentialsTab")}
        </button>
        <button
          onClick={() => setMode("connector")}
          className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-colors ${
            mode === "connector"
              ? "th-bg-surface-hover th-text-secondary"
              : "th-text-faint hover:th-text-muted"
          }`}
        >
          {t("existingConnectorTab")}
        </button>
      </div>

      {/* Credentials mode */}
      {mode === "credentials" && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] th-text-faint mb-0.5">{t("hostLabel")}</label>
              <input
                type="text" value={host} onChange={(e) => setHost(e.target.value)}
                placeholder={t("hostPlaceholder")} disabled={disabled}
                className="w-full px-2.5 py-1.5 th-bg-surface border th-border rounded-lg text-xs th-text-secondary placeholder:th-text-faint focus:outline-none focus:border-brand/50"
              />
            </div>
            <div>
              <label className="block text-[10px] th-text-faint mb-0.5">{t("portLabel")}</label>
              <input
                type="number" value={port} onChange={(e) => setPort(e.target.value)}
                placeholder={t("portPlaceholder")} disabled={disabled}
                className="w-full px-2.5 py-1.5 th-bg-surface border th-border rounded-lg text-xs th-text-secondary placeholder:th-text-faint focus:outline-none focus:border-brand/50"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] th-text-faint mb-0.5">{t("databaseLabel")}</label>
              <input
                type="text" value={database} onChange={(e) => setDatabase(e.target.value)}
                placeholder={t("databasePlaceholder")} disabled={disabled}
                className="w-full px-2.5 py-1.5 th-bg-surface border th-border rounded-lg text-xs th-text-secondary placeholder:th-text-faint focus:outline-none focus:border-brand/50"
              />
            </div>
            <div>
              <label className="block text-[10px] th-text-faint mb-0.5">{t("schemaLabel")}</label>
              <input
                type="text" value={schemaName} onChange={(e) => setSchemaName(e.target.value)}
                placeholder={t("schemaPlaceholder")} disabled={disabled}
                className="w-full px-2.5 py-1.5 th-bg-surface border th-border rounded-lg text-xs th-text-secondary placeholder:th-text-faint focus:outline-none focus:border-brand/50"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] th-text-faint mb-0.5">{t("userLabel")}</label>
              <input
                type="text" value={user} onChange={(e) => setUser(e.target.value)}
                placeholder={t("userPlaceholder")} disabled={disabled}
                className="w-full px-2.5 py-1.5 th-bg-surface border th-border rounded-lg text-xs th-text-secondary placeholder:th-text-faint focus:outline-none focus:border-brand/50"
              />
            </div>
            <div>
              <label className="block text-[10px] th-text-faint mb-0.5">{t("passwordLabel")}</label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••" disabled={disabled}
                className="w-full px-2.5 py-1.5 th-bg-surface border th-border rounded-lg text-xs th-text-secondary placeholder:th-text-faint focus:outline-none focus:border-brand/50"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox" id="saveConnector" checked={saveConnector}
              onChange={(e) => setSaveConnector(e.target.checked)}
              className="rounded th-border th-bg-surface text-brand focus:ring-brand/30"
            />
            <label htmlFor="saveConnector" className="text-[10px] th-text-faint">
              {t("saveAsConnector")}
            </label>
          </div>
          {saveConnector && (
            <input
              type="text" value={connectorName} onChange={(e) => setConnectorName(e.target.value)}
              placeholder={t("connectorNamePlaceholder")} disabled={disabled}
              className="w-full px-2.5 py-1.5 th-bg-surface border th-border rounded-lg text-xs th-text-secondary placeholder:th-text-faint focus:outline-none focus:border-brand/50"
            />
          )}
        </div>
      )}

      {/* Connector mode */}
      {mode === "connector" && (
        <div>
          {loadingConfigs ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 size={16} className="th-text-faint animate-spin" />
              <span className="ml-2 text-xs th-text-faint">{t("loadingConnectors")}</span>
            </div>
          ) : toolConfigs.length === 0 ? (
            <div className="text-center py-4">
              <Database size={20} className="mx-auto th-text-ghost mb-1.5" />
              <p className="text-xs th-text-faint">{t("noConnectorConfigured")}</p>
              <p className="text-[10px] th-text-ghost mt-0.5">{t("configureDbToolHint")}</p>
            </div>
          ) : (
            <div>
              <label className="block text-[10px] th-text-faint mb-0.5">{t("connectorLabel")}</label>
              <select
                value={selectedConfig} onChange={(e) => setSelectedConfig(e.target.value)} disabled={disabled}
                className="w-full px-2.5 py-1.5 th-bg-surface border th-border rounded-lg text-xs th-text-secondary focus:outline-none focus:border-brand/50"
              >
                <option value="" className="bg-zinc-900">{t("selectConnector")}</option>
                {toolConfigs.map((c) => (
                  <option key={c.tool_config_id} value={c.tool_config_id} className="bg-zinc-900">
                    {c.tool_config_name || c.tool_name} — {c.tool_config_id}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* NL description */}
      <div>
        <label className="block text-[10px] th-text-faint mb-0.5 flex items-center gap-1">
          <Sparkles size={10} className="text-brand" />
          {t("describeDataLabel")}
        </label>
        <textarea
          value={nlDescription} onChange={(e) => setNlDescription(e.target.value)}
          placeholder={t("describeDataPlaceholder")}
          disabled={disabled} rows={2}
          className="w-full px-2.5 py-1.5 th-bg-surface border th-border rounded-lg text-xs th-text-secondary placeholder:th-text-faint focus:outline-none focus:border-brand/50 resize-none"
        />
      </div>

      {/* Source name */}
      <div>
        <label className="block text-[10px] th-text-faint mb-0.5">{t("sourceNameLabel")}</label>
        <input
          type="text" value={name} onChange={(e) => setName(e.target.value)}
          placeholder={t("sourceNamePlaceholder")} disabled={disabled}
          className="w-full px-2.5 py-1.5 th-bg-surface border th-border rounded-lg text-xs th-text-secondary placeholder:th-text-faint focus:outline-none focus:border-brand/50"
        />
      </div>

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={disabled || !canSubmit}
        className="w-full py-2 px-4 rounded-lg bg-brand/20 text-brand text-sm font-medium hover:bg-brand/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
      >
        <Sparkles size={14} />
        {t("exploreAndIndex")}
      </button>
    </div>
  );
}

function S3Form({ onSubmit, disabled }) {
  const t = useTranslations("KnowledgeWizard");
  const [toolConfigs, setToolConfigs] = useState([]);
  const [selectedConfig, setSelectedConfig] = useState("");
  const [s3Url, setS3Url] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listToolConfigs()
      .then((configs) => {
        if (cancelled) return;
        const s3Configs = (configs || []).filter((c) => {
          const cat = (c.tool_category || c.tool_name || "").toLowerCase();
          return cat.includes("s3");
        });
        setToolConfigs(s3Configs);
      })
      .catch(() => {
        if (!cancelled) setToolConfigs([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = useCallback(() => {
    if (!selectedConfig || !s3Url.trim()) return;
    onSubmit(selectedConfig, [s3Url.trim()], name.trim() || s3Url.trim());
    setS3Url("");
    setName("");
  }, [selectedConfig, s3Url, name, onSubmit]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 size={20} className="th-text-faint animate-spin" />
        <span className="ml-2 text-sm th-text-faint">{t("loadingConnectors")}</span>
      </div>
    );
  }

  if (toolConfigs.length === 0) {
    return (
      <div className="text-center py-6">
        <Cloud size={24} className="mx-auto th-text-ghost mb-2" />
        <p className="text-sm th-text-faint">{t("noS3ConnectorConfigured")}</p>
        <p className="text-xs th-text-ghost mt-1">{t("configureS3ToolHint")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs th-text-muted mb-1">{t("s3ConnectorLabel")}</label>
        <select
          value={selectedConfig}
          onChange={(e) => setSelectedConfig(e.target.value)}
          disabled={disabled}
          className="w-full px-3 py-2 th-bg-surface border th-border rounded-lg text-sm th-text-secondary focus:outline-none focus:border-brand/50"
        >
          <option value="" className="bg-zinc-900">{t("selectConnector")}</option>
          {toolConfigs.map((c) => (
            <option key={c.tool_config_id} value={c.tool_config_id} className="bg-zinc-900">
              {c.tool_config_name || c.tool_name} — {c.tool_config_id}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs th-text-muted mb-1">
          {t("s3UrlPrefixLabel")}
        </label>
        <input
          type="text"
          value={s3Url}
          onChange={(e) => setS3Url(e.target.value)}
          placeholder={t("s3UrlPlaceholder")}
          disabled={disabled}
          className="w-full px-3 py-2 th-bg-surface border th-border rounded-lg text-sm th-text-secondary placeholder:th-text-faint focus:outline-none focus:border-brand/50"
        />
      </div>
      <div>
        <label className="block text-xs th-text-muted mb-1">{t("nameOptionalLabel")}</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("s3NamePlaceholder")}
          disabled={disabled}
          className="w-full px-3 py-2 th-bg-surface border th-border rounded-lg text-sm th-text-secondary placeholder:th-text-faint focus:outline-none focus:border-brand/50"
        />
      </div>
      <button
        onClick={handleSubmit}
        disabled={disabled || !selectedConfig || !s3Url.trim()}
        className="w-full py-2 px-4 rounded-lg bg-brand/20 text-brand text-sm font-medium hover:bg-brand/30 transition-colors disabled:opacity-50"
      >
        <Plus size={14} className="inline mr-1.5" />
        {t("addS3Source")}
      </button>
    </div>
  );
}

export default function KnowledgeWizard({ agentId, onReady, knowledgeBase }) {
  const t = useTranslations("KnowledgeWizard");
  const SOURCE_TYPES = [
    { id: "file", label: t("sourceFileLabel"), icon: Upload, description: t("sourceFileDesc") },
    { id: "url", label: t("sourceUrlLabel"), icon: Globe, description: t("sourceUrlDesc") },
    { id: "db", label: t("sourceDbLabel"), icon: Database, description: t("sourceDbDesc") },
    { id: "s3", label: t("sourceS3Label"), icon: Cloud, description: t("sourceS3Desc") },
  ];
  const [step, setStep] = useState("add"); // "add" | "indexing" | "ready"
  const [selectedSource, setSelectedSource] = useState(null); // "file" | "url" | "db" | "s3" | null

  const {
    sources,
    isIndexing,
    isCancelled,
    isReady,
    error,
    addFiles,
    addUrl,
    addDb,
    addDbNl,
    addS3,
    cancelIndexing,
  } = knowledgeBase;

  // Auto-transition between steps (forward AND backward)
  const [prevSources, setPrevSources] = useState(sources.length);
  const [prevIsIndexing, setPrevIsIndexing] = useState(isIndexing);
  const [prevIsReady, setPrevIsReady] = useState(isReady);
  if (sources.length !== prevSources || isIndexing !== prevIsIndexing || isReady !== prevIsReady) {
    setPrevSources(sources.length);
    setPrevIsIndexing(isIndexing);
    setPrevIsReady(isReady);
    if (sources.length === 0 && !isIndexing) {
      setStep("add");
      setSelectedSource(null);
    } else if (isReady) {
      setStep("ready");
    } else if (isIndexing && step === "add") {
      setStep("indexing");
    }
  }

  const handleAddFiles = useCallback(
    async (rawFiles) => {
      await addFiles(rawFiles);
    },
    [addFiles],
  );

  const handleAddUrl = useCallback(
    async (url, name) => {
      await addUrl(url, name);
    },
    [addUrl],
  );

  const handleAddDb = useCallback(
    async (toolConfigId, sqlQuery, name) => {
      await addDb(toolConfigId, sqlQuery, name);
    },
    [addDb],
  );

  const handleAddDbNl = useCallback(
    async (payload) => {
      return await addDbNl(payload);
    },
    [addDbNl],
  );

  const handleAddS3 = useCallback(
    async (toolConfigId, s3Urls, name) => {
      await addS3(toolConfigId, s3Urls, name);
    },
    [addS3],
  );

  const handleStartIndexing = useCallback(() => {
    // Sources are already submitted individually, just transition to indexing view
    if (sources.length > 0) {
      setStep("indexing");
    }
  }, [sources]);

  const completedCount = sources.filter((s) => s.status === "complete").length;
  const errorCount = sources.filter((s) => s.status === "error").length;

  // --- Step: ADD ---
  if (step === "add") {
    return (
      <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-2xl space-y-6">
          {/* Header */}
          <div className="text-center">
            <h2 className="text-xl font-semibold th-text-secondary">{t("knowledgeBaseTitle")}</h2>
            <p className="text-sm th-text-muted mt-1">
              {t("knowledgeBaseSubtitle")}
            </p>
          </div>

          {/* Source type cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {SOURCE_TYPES.map((type) => {
              const Icon = type.icon;
              const isSelected = selectedSource === type.id;
              return (
                <button
                  key={type.id}
                  onClick={() => setSelectedSource(isSelected ? null : type.id)}
                  className={`
                    flex flex-col items-center gap-2 p-4 rounded-xl border transition-all text-center
                    ${
                      isSelected
                        ? "bg-brand/10 border-brand/30 text-brand"
                        : "th-bg-surface th-border th-text-muted hover:th-bg-surface-hover hover:th-text-secondary"
                    }
                  `}
                >
                  <Icon size={24} />
                  <span className="text-sm font-medium">{type.label}</span>
                  <span className="text-[10px] th-text-faint leading-tight">
                    {type.description}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Selected source form */}
          {selectedSource && (
            <div className="th-bg-surface border th-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium th-text-secondary">
                  {SOURCE_TYPES.find((st) => st.id === selectedSource)?.label}
                </h3>
                <button
                  onClick={() => setSelectedSource(null)}
                  className="p-1 rounded hover:th-bg-surface-hover th-text-faint hover:th-text-muted transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              {selectedSource === "file" && (
                <FileForm onSubmit={handleAddFiles} disabled={false} />
              )}
              {selectedSource === "url" && (
                <UrlForm onSubmit={handleAddUrl} disabled={false} />
              )}
              {selectedSource === "db" && (
                <DbNlForm onSubmit={handleAddDbNl} disabled={false} />
              )}
              {selectedSource === "s3" && (
                <S3Form onSubmit={handleAddS3} disabled={false} />
              )}
            </div>
          )}

          {/* Error display */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertCircle size={16} className="text-red-400 shrink-0" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Added sources list */}
          {sources.length > 0 && (
            <div className="th-bg-surface border th-border rounded-xl p-4">
              <h3 className="text-sm font-medium th-text-secondary mb-3">
                {t("addedSources", { count: sources.length })}
              </h3>
              <div className="space-y-2">
                {sources.map((source, idx) => (
                  <div
                    key={source.knowledge_id || idx}
                    className="flex items-center gap-3 px-3 py-2 th-bg-surface rounded-lg"
                  >
                    <SourceStatusIcon status={source.status} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm th-text-secondary truncate">
                        {source.name}
                      </p>
                      <p className="text-[10px] th-text-faint">{source.type}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Launch indexing button */}
          {sources.length > 0 && sources.some((s) => s.status === "processing") && (
            <button
              onClick={handleStartIndexing}
              className="w-full py-3 px-6 rounded-xl bg-brand/20 text-brand font-medium hover:bg-brand/30 transition-colors flex items-center justify-center gap-2"
            >
              <Loader2 size={16} className="animate-spin" />
              {t("indexingInProgressButton")}
            </button>
          )}

          {sources.length > 0 &&
            !sources.some((s) => s.status === "processing") &&
            !isReady && (
              <button
                onClick={handleStartIndexing}
                className="w-full py-3 px-6 rounded-xl bg-brand text-white font-medium hover:bg-brand-hover transition-colors flex items-center justify-center gap-2"
              >
                {t("startIndexing")}
                <ArrowRight size={16} />
              </button>
            )}

          {isReady && (
            <button
              onClick={() => onReady?.()}
              className="w-full py-3 px-6 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-500 transition-colors flex items-center justify-center gap-2"
            >
              {t("startChat")}
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
    );
  }

  // --- Step: INDEXING ---
  if (step === "indexing") {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-lg space-y-6">
          {/* Header */}
          <div className="text-center">
            <Loader2 size={32} className="mx-auto text-brand animate-spin mb-3" />
            <h2 className="text-xl font-semibold th-text-secondary">{t("indexingInProgressTitle")}</h2>
            <p className="text-sm th-text-muted mt-1">
              {t("sourcesIndexed", { completed: completedCount, total: sources.length })}
              {errorCount > 0 && (
                <span className="text-red-400">
                  {" "}{t("errorsCount", { count: errorCount })}
                </span>
              )}
            </p>
          </div>

          {/* Sources list with status */}
          <div className="th-bg-surface border th-border rounded-xl p-4 space-y-2">
            {sources.map((source, idx) => (
              <div
                key={source.knowledge_id || idx}
                className="flex items-center gap-3 px-3 py-2.5 th-bg-surface rounded-lg"
              >
                <SourceStatusIcon status={source.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm th-text-secondary truncate">
                    {source.name}
                  </p>
                  <p className="text-[10px] th-text-faint">{source.type}</p>
                </div>
                <span
                  className={`text-[10px] font-medium ${
                    source.status === "complete"
                      ? "text-blue-400"
                      : source.status === "error"
                        ? "text-red-400"
                        : source.status === "cancelled"
                          ? "th-text-faint"
                          : "th-text-faint"
                  }`}
                >
                  {source.status === "complete"
                    ? t("statusDone")
                    : source.status === "error"
                      ? t("statusError")
                      : source.status === "cancelled"
                        ? t("statusCancelled")
                        : t("statusProcessing")}
                </span>
              </div>
            ))}
          </div>

          {/* Error display */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertCircle size={16} className="text-red-400 shrink-0" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Cancel / proceed buttons */}
          {isCancelled ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                <AlertCircle size={15} className="text-purple-300 shrink-0" />
                <p className="text-sm text-purple-300">
                  {t("indexingContinuesBackground")}
                </p>
              </div>
              {completedCount > 0 && (
                <button
                  onClick={() => onReady?.()}
                  className="w-full py-3 px-6 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-500 transition-colors flex items-center justify-center gap-2"
                >
                  {t("startChat")}
                  <ArrowRight size={16} />
                </button>
              )}
              <button
                onClick={() => setStep("add")}
                className="w-full py-2 px-4 rounded-lg text-sm th-text-muted hover:th-text-secondary hover:th-bg-surface transition-colors"
              >
                {t("backToSources")}
              </button>
            </div>
          ) : (
            <button
              onClick={cancelIndexing}
              className="w-full py-2.5 px-4 rounded-xl border border-red-500/20 text-red-400/80 text-sm font-medium hover:bg-red-500/10 hover:text-red-300 transition-colors flex items-center justify-center gap-2"
            >
              <X size={14} />
              {t("stopWaiting")}
            </button>
          )}
        </div>
      </div>
    );
  }

  // --- Step: READY ---
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center">
          <CheckCircle2 size={40} className="mx-auto text-blue-400 mb-3" />
          <h2 className="text-xl font-semibold th-text-secondary">{t("knowledgeBaseReadyTitle")}</h2>
          <p className="text-sm th-text-muted mt-1">
            {t("sourcesIndexedReady", { count: completedCount })}
            {errorCount > 0 && (
              <span className="text-red-400"> {t("sourcesFailed", { count: errorCount })}</span>
            )}
          </p>
        </div>

        {/* Sources summary */}
        <div className="th-bg-surface border th-border rounded-xl p-4 space-y-2">
          {sources.map((source, idx) => (
            <div
              key={source.knowledge_id || idx}
              className="flex items-center gap-3 px-3 py-2 th-bg-surface rounded-lg"
            >
              <SourceStatusIcon status={source.status} />
              <div className="flex-1 min-w-0">
                <p className="text-sm th-text-secondary truncate">{source.name}</p>
                <p className="text-[10px] th-text-faint">{source.type}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Button to start chat */}
        <button
          onClick={() => onReady?.()}
          className="w-full py-3 px-6 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-500 transition-colors flex items-center justify-center gap-2"
        >
          {t("startChat")}
          <ArrowRight size={16} />
        </button>

        {/* Option to add more sources */}
        <button
          onClick={() => setStep("add")}
          className="w-full py-2 px-4 rounded-lg text-sm th-text-muted hover:th-text-secondary hover:th-bg-surface transition-colors"
        >
          {t("addMoreSources")}
        </button>
      </div>
    </div>
  );
}
