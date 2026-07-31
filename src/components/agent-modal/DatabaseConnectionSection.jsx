"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "use-intl";
import {
  Database,
  Server,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { listToolConfigs } from "@/lib/api";
import { PostgreSQLIcon, MySQLIcon } from "./icons/DbIcons";

// DB Type configs
export const DB_TYPES = [
  {
    id: "postgresql",
    label: "PostgreSQL",
    color: "#336791",
    glowColor: "rgba(51,103,145,0.5)",
    borderColor: "border-[#336791]/50",
    bgColor: "bg-[#336791]/10",
    textColor: "text-[#5b9bd5]",
    badgeBg: "bg-[#336791]/20",
    badgeText: "text-[#7ab3d9]",
    defaultPort: "5432",
    hasSchema: true,
    icon: PostgreSQLIcon,
  },
  {
    id: "mysql",
    label: "MySQL",
    color: "#00758F",
    glowColor: "rgba(0,117,143,0.5)",
    borderColor: "border-[#00758F]/50",
    bgColor: "bg-[#00758F]/10",
    textColor: "text-[#00a3be]",
    badgeBg: "bg-[#00758F]/20",
    badgeText: "text-[#00c8e0]",
    defaultPort: "3306",
    hasSchema: true,
    icon: MySQLIcon,
  },
];

export default function DatabaseConnectionSection({ dbCredentials = {}, onChange }) {
  const t = useTranslations("DatabaseConnectionSection");
  const hasInitialConnector = !!dbCredentials?.tool_config_id;
  const [isOpen, setIsOpen] = useState(hasInitialConnector || !!dbCredentials?.DB_NAME);
  const [mode, setMode] = useState(hasInitialConnector ? "connector" : "credentials");
  const [toolConfigs, setToolConfigs] = useState([]);
  const [loadingConfigs, setLoadingConfigs] = useState(true);
  const creds = dbCredentials || {};

  // DB Type state — derive from creds or default to postgresql
  const currentDbTypeId = creds.DB_TYPE || "postgresql";
  const currentDbType = DB_TYPES.find((dt) => dt.id === currentDbTypeId) || DB_TYPES[0];

  const hasConnector = !!creds.tool_config_id;
  const hasManualCreds = !!creds.DB_NAME;

  const update = (key, value) => {
    const { tool_config_id, ...rest } = creds;
    const updated = { ...rest, [key]: value };
    // MySQL: always keep schema as "public" silently
    if (currentDbTypeId === "mysql") updated.DB_SCHEMA = "public";
    onChange(updated);
  };

  const handleDbTypeChange = (dbType) => {
    const { tool_config_id, ...rest } = creds;
    const updatedCreds = {
      ...rest,
      DB_TYPE: dbType.id,
    };
    // MySQL: always send schema as "public" silently
    if (dbType.id === "mysql") {
      updatedCreds.DB_SCHEMA = "public";
    }
    onChange(updatedCreds);
  };

  useEffect(() => {
    if (mode !== "connector") return;
    let cancelled = false;
    listToolConfigs()
      .then((configs) => {
        if (cancelled) return;
        const dbConfigs = (configs || []).filter((c) => {
          const cat = (c.tool_category || c.tool_name || "").toLowerCase();
          return cat.includes("database") || cat.includes("sql") || cat.includes("db") || cat.includes("text_to_sql");
        });
        setToolConfigs(dbConfigs);
      })
      .catch(() => { if (!cancelled) setToolConfigs([]); })
      .finally(() => { if (!cancelled) setLoadingConfigs(false); });
    return () => { cancelled = true; };
  }, [mode]);

  const handleSelectConnector = (configId) => {
    if (configId) {
      onChange({ tool_config_id: configId, DB_TYPE: currentDbTypeId });
    } else {
      onChange({ DB_TYPE: currentDbTypeId });
    }
  };

  const baseFields = [
    { key: "DB_HOST", label: t("hostLabel"), placeholder: "localhost", type: "text", span: 1 },
    { key: "DB_PORT", label: t("portLabel"), placeholder: currentDbType.defaultPort, type: "text", span: 1 },
    { key: "DB_NAME", label: t("databaseLabel"), placeholder: currentDbType.id === "mysql" ? "mydb" : "my_database", type: "text", required: true, span: 1 },
    { key: "DB_USER", label: t("userLabel"), placeholder: currentDbType.id === "mysql" ? "root" : "postgres", type: "text", required: true, span: 1 },
    { key: "DB_PASSWORD", label: t("passwordLabel"), placeholder: "••••••••", type: "password", required: true, span: 2 },
  ];

  const schemaField = { key: "DB_SCHEMA", label: t("schemaLabel"), placeholder: "public", type: "text", span: 2 };
  const fields = currentDbType.id === "postgresql" ? [...baseFields, schemaField] : baseFields;

  return (
    <div className="space-y-3">
      {/* ── DB Type Selector (outside the box, like Provider) ── */}
      <div>
        <label className="text-sm font-medium th-text-muted mb-3 pl-1 flex items-center gap-2">
          <Database size={14} /> {t("databaseEngineLabel")}
        </label>
        <div className="grid grid-cols-2 gap-3">
          {DB_TYPES.map((dbType) => {
            const isSelected = currentDbTypeId === dbType.id;
            const Icon = dbType.icon;
            return (
              <button
                key={dbType.id}
                type="button"
                onClick={() => handleDbTypeChange(dbType)}
                className={`relative group flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all duration-200 font-semibold text-sm ${
                  isSelected
                    ? `${dbType.borderColor} ${dbType.bgColor} ${dbType.textColor} shadow-lg`
                    : "th-border bg-white/3 th-text-faint hover:th-border-hover hover:th-text-muted hover:th-bg-surface"
                }`}
                style={isSelected ? { boxShadow: `0 0 18px ${dbType.glowColor}, 0 0 4px ${dbType.glowColor}` } : {}}
              >
                {/* Glow pulse when selected */}
                {isSelected && (
                  <div
                    className="absolute inset-0 rounded-xl opacity-20 animate-pulse pointer-events-none"
                    style={{ background: `radial-gradient(ellipse at center, ${dbType.color} 0%, transparent 70%)` }}
                  />
                )}
                <div className={`relative shrink-0 transition-transform duration-200 ${isSelected ? "scale-110" : "scale-90 opacity-50 group-hover:opacity-70 group-hover:scale-100"}`}>
                  <Icon size={28} />
                </div>
                <div className="relative text-left">
                  <div className={`font-bold text-sm leading-none ${isSelected ? dbType.textColor : "text-white/50"}`}>
                    {dbType.label}
                  </div>
                </div>
                {isSelected && (
                  <div className={`ml-auto relative shrink-0 w-2 h-2 rounded-full`} style={{ backgroundColor: dbType.color, boxShadow: `0 0 6px ${dbType.color}` }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Connection Box ── */}
      <div
        className={`border rounded-xl overflow-hidden transition-colors duration-300 ${
          currentDbType ? currentDbType.borderColor.replace("/50", "/30") : "border-white/10"
        }`}
        style={{ borderColor: `${currentDbType.color}33` }}
      >
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between p-3 th-bg-surface hover:th-bg-surface-hover transition-colors"
        >
          <div className="flex items-center gap-2">
            <Server size={16} style={{ color: currentDbType.color }} />
            <span className="text-sm font-bold th-text">{t("title")}</span>
            {(hasManualCreds || hasConnector) && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${currentDbType.badgeBg} ${currentDbType.badgeText}`}
              >
                {hasConnector ? t("connectorBadge") : t("configuredBadge")}
              </span>
            )}
            {/* DB type badge in header */}
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${currentDbType.badgeBg} ${currentDbType.badgeText}`}
            >
              {currentDbType.label}
            </span>
          </div>
          {isOpen ? <ChevronDown size={16} className="th-text-faint" /> : <ChevronRight size={16} className="th-text-faint" />}
        </button>

        {isOpen && (
          <div className="p-4 space-y-3 th-bg-overlay">
            <p className="text-xs th-text-faint mb-2">
              {t("connectIntro", { dbLabel: currentDbType.label })}
            </p>

            {/* Mode toggle */}
            <div className="flex gap-1 p-0.5 th-bg-surface rounded-lg">
              <button
                type="button"
                onClick={() => setMode("credentials")}
                className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-colors ${
                  mode === "credentials" ? "th-bg-surface th-text" : "th-text-faint hover:th-text-muted"
                }`}
              >
                {t("newCredentialsTab")}
              </button>
              <button
                type="button"
                onClick={() => setMode("connector")}
                className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-colors ${
                  mode === "connector" ? "th-bg-surface th-text" : "th-text-faint hover:th-text-muted"
                }`}
              >
                {t("existingConnectorTab")}
              </button>
            </div>

            {/* Credentials mode */}
            {mode === "credentials" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {fields.map((f) => (
                    <div key={f.key} className={f.span === 2 ? "col-span-2" : ""}>
                      <label className="block text-xs font-medium th-text-muted mb-1">
                        {f.label} {f.required && <span className="text-red-400">*</span>}
                      </label>
                      <input
                        type={f.type}
                        value={creds[f.key] || ""}
                        onChange={(e) => update(f.key, e.target.value)}
                        placeholder={f.placeholder}
                        className="glass-input w-full px-3 py-2 rounded-lg text-sm"
                      />
                    </div>
                  ))}
                </div>

                {/* Save as connector */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="dbSaveConnector"
                    checked={!!creds.save_connector}
                    onChange={(e) => update("save_connector", e.target.checked)}
                    className="rounded border-white/20 bg-white/5 text-blue-400 focus:ring-blue-400/30"
                  />
                  <label htmlFor="dbSaveConnector" className="text-xs th-text-faint">
                    {t("saveAsConnectorLabel")}
                  </label>
                </div>
                {creds.save_connector && (
                  <input
                    type="text"
                    value={creds.connector_name || ""}
                    onChange={(e) => update("connector_name", e.target.value)}
                    placeholder={t("connectorNamePlaceholder")}
                    className="glass-input w-full px-3 py-2 rounded-lg text-sm"
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
                    <Database size={20} className="mx-auto text-white/20 mb-1.5" />
                    <p className="text-xs th-text-faint">{t("noConnectorFound")}</p>
                    <p className="text-[10px] th-text-ghost mt-0.5">
                      {t("noConnectorHint")}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="block text-xs font-medium th-text-muted mb-1">{t("connectorLabel")}</label>
                    <select
                      value={creds.tool_config_id || ""}
                      onChange={(e) => handleSelectConnector(e.target.value)}
                      className="w-full px-3 py-2 th-bg-surface border th-border rounded-lg text-sm th-text focus:outline-none focus:border-blue-400/50"
                    >
                      <option value="" className="th-bg-modal">{t("selectConnectorOption")}</option>
                      {toolConfigs.map((c) => (
                        <option key={c.tool_config_id} value={c.tool_config_id} className="th-bg-modal">
                          {c.tool_config_name || c.tool_name} — {c.tool_config_id}
                        </option>
                      ))}
                    </select>

                    {creds.tool_config_id && (() => {
                      const selected = toolConfigs.find((c) => c.tool_config_id === creds.tool_config_id);
                      if (!selected) return null;
                      const paramCount = Object.keys(selected.tool_config_params || {}).length;
                      return (
                        <div className="flex items-center gap-2 p-2.5 bg-blue-400/5 border border-blue-400/10 rounded-lg">
                          <Database size={14} className="text-blue-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs th-text-secondary font-medium truncate">
                              {selected.tool_config_name || selected.tool_name}
                            </p>
                            <p className="text-[10px] th-text-faint">
                              {t("paramsConfigured", { count: paramCount })}
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
