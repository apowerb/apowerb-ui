"use client";

import React from "react";
import { Info } from "lucide-react";
import { useTranslations } from "use-intl";
import { MCP_TEMPLATES, isMcpSaveDisabled } from "./toolsManagerUtils";

/**
 * "Add MCP Server" form — template picker + fields that adapt to the
 * selected template (database source config or URL / stdio command).
 */
export default function McpServerForm({
  newMcp, setNewMcp,
  dbConfig, setDbConfig,
  selectedTemplate,
  onApplyTemplate,
  onSave,
  onCancel,
}) {
  const t = useTranslations("McpServerForm");
  return (
    <div className="glass-card rounded-xl border border-purple-500/20 p-5 mb-4 space-y-5">
      {/* Template picker */}
      <div>
        <p className="text-sm font-bold th-text mb-3">{t("prompt")}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {MCP_TEMPLATES.map((tpl) => {
            const Icon = tpl.icon;
            const isActive = selectedTemplate === tpl.id;
            return (
              <button
                key={tpl.id}
                onClick={() => onApplyTemplate(tpl)}
                className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all ${
                  isActive
                    ? `bg-${tpl.color}-500/10 border-${tpl.color}-500/30`
                    : "th-bg-surface/50 th-border hover:th-bg-surface"
                }`}
              >
                <Icon size={18} className={isActive ? `text-${tpl.color}-400` : "th-text-muted"} />
                <div>
                  <p className={`text-xs font-bold ${isActive ? `text-${tpl.color}-400` : "th-text-secondary"}`}>{tpl.label}</p>
                  <p className="text-[10px] th-text-faint mt-0.5 leading-snug">{tpl.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Form — fields adapt to selected template */}
      {selectedTemplate && (
        <div className="space-y-3 pt-3 border-t th-border">
          {selectedTemplate === "toolbox-db" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs th-text-muted mb-1 font-medium">{t("nameLabel")}</label>
                  <input
                    type="text" placeholder={t("dbNamePlaceholder")}
                    value={newMcp.name}
                    onChange={(e) => setNewMcp((p) => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2 th-bg-surface border th-border rounded-lg text-sm th-text placeholder-[var(--text-faint)] focus:outline-none focus:border-purple-500/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs th-text-muted mb-1 font-medium">{t("databaseTypeLabel")}</label>
                  <select
                    value={dbConfig.db_type}
                    onChange={(e) => {
                      const dbType = e.target.value;
                      const defaultPort = { postgres: "5432", mysql: "3306", mssql: "1433", sqlite: "" }[dbType] || "5432";
                      setDbConfig((p) => ({ ...p, db_type: dbType, port: defaultPort }));
                    }}
                    className="w-full px-3 py-2 th-bg-surface border th-border rounded-lg text-sm th-text focus:outline-none focus:border-purple-500/50 transition-all"
                  >
                    <option value="postgres">PostgreSQL</option>
                    <option value="mysql">MySQL</option>
                    <option value="mssql">SQL Server</option>
                    <option value="sqlite">SQLite</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs th-text-muted mb-1 font-medium">{t("sslModeLabel")}</label>
                  <select
                    value={dbConfig.sslmode}
                    onChange={(e) => setDbConfig((p) => ({ ...p, sslmode: e.target.value }))}
                    className="w-full px-3 py-2 th-bg-surface border th-border rounded-lg text-sm th-text focus:outline-none focus:border-purple-500/50 transition-all"
                  >
                    <option value="disable">{t("sslDisable")}</option>
                    <option value="require">{t("sslRequire")}</option>
                    <option value="verify-ca">{t("sslVerifyCa")}</option>
                    <option value="verify-full">{t("sslVerifyFull")}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs th-text-muted mb-1 font-medium">{t("hostLabel")}</label>
                  <input
                    type="text" placeholder={t("hostPlaceholder")}
                    value={dbConfig.host}
                    onChange={(e) => setDbConfig((p) => ({ ...p, host: e.target.value }))}
                    className="w-full px-3 py-2 th-bg-surface border th-border rounded-lg text-sm th-text font-mono placeholder-[var(--text-faint)] focus:outline-none focus:border-purple-500/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs th-text-muted mb-1 font-medium">{t("portLabel")}</label>
                  <input
                    type="text" placeholder={t("portPlaceholder")}
                    value={dbConfig.port}
                    onChange={(e) => setDbConfig((p) => ({ ...p, port: e.target.value }))}
                    className="w-full px-3 py-2 th-bg-surface border th-border rounded-lg text-sm th-text font-mono placeholder-[var(--text-faint)] focus:outline-none focus:border-purple-500/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs th-text-muted mb-1 font-medium">{t("databaseLabel")}</label>
                  <input
                    type="text" placeholder={t("databasePlaceholder")}
                    value={dbConfig.database}
                    onChange={(e) => setDbConfig((p) => ({ ...p, database: e.target.value }))}
                    className="w-full px-3 py-2 th-bg-surface border th-border rounded-lg text-sm th-text font-mono placeholder-[var(--text-faint)] focus:outline-none focus:border-purple-500/50 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs th-text-muted mb-1 font-medium">{t("usernameLabel")}</label>
                  <input
                    type="text" placeholder={t("usernamePlaceholder")}
                    value={dbConfig.user}
                    onChange={(e) => setDbConfig((p) => ({ ...p, user: e.target.value }))}
                    className="w-full px-3 py-2 th-bg-surface border th-border rounded-lg text-sm th-text font-mono placeholder-[var(--text-faint)] focus:outline-none focus:border-purple-500/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs th-text-muted mb-1 font-medium">{t("passwordLabel")}</label>
                  <input
                    type="password" placeholder={t("passwordPlaceholder")}
                    value={dbConfig.password}
                    onChange={(e) => setDbConfig((p) => ({ ...p, password: e.target.value }))}
                    className="w-full px-3 py-2 th-bg-surface border th-border rounded-lg text-sm th-text font-mono placeholder-[var(--text-faint)] focus:outline-none focus:border-purple-500/50 transition-all"
                  />
                </div>
              </div>
            </>
          )}

          {selectedTemplate !== "toolbox-db" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs th-text-muted mb-1 font-medium">{t("nameLabel")}</label>
                  <input
                    type="text" placeholder={t("genericNamePlaceholder")}
                    value={newMcp.name}
                    onChange={(e) => setNewMcp((p) => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2 th-bg-surface border th-border rounded-lg text-sm th-text placeholder-[var(--text-faint)] focus:outline-none focus:border-purple-500/50 transition-all"
                  />
                </div>
                {newMcp.transport === "http" ? (
                  <div>
                    <label className="block text-xs th-text-muted mb-1 font-medium">{t("urlLabel")}</label>
                    <input
                      type="text" placeholder={t("urlPlaceholder")}
                      value={newMcp.url}
                      onChange={(e) => setNewMcp((p) => ({ ...p, url: e.target.value }))}
                      className="w-full px-3 py-2 th-bg-surface border th-border rounded-lg text-sm th-text font-mono placeholder-[var(--text-faint)] focus:outline-none focus:border-purple-500/50 transition-all"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs th-text-muted mb-1 font-medium">{t("commandLabel")}</label>
                    <input
                      type="text" placeholder={t("commandPlaceholder")}
                      value={newMcp.command + (newMcp.args ? ` ${newMcp.args}` : "")}
                      onChange={(e) => {
                        const parts = e.target.value.split(" ");
                        setNewMcp((p) => ({ ...p, command: parts[0] || "", args: parts.slice(1).join(" ") }));
                      }}
                      className="w-full px-3 py-2 th-bg-surface border th-border rounded-lg text-sm th-text font-mono placeholder-[var(--text-faint)] focus:outline-none focus:border-purple-500/50 transition-all"
                    />
                  </div>
                )}
              </div>

              {newMcp.url?.includes("YOUR_API_KEY") && (
                <p className="text-xs text-purple-400/80 flex items-center gap-1.5 bg-purple-400/5 border border-purple-400/15 rounded-lg px-3 py-2">
                  <Info size={14} className="shrink-0" />
                  {t.rich("apiKeyReplaceHint", {
                    code: (chunks) => <code className="font-mono bg-white/10 px-1 rounded text-[11px]">{chunks}</code>,
                  })}
                </p>
              )}
            </>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 pt-2 border-t th-border">
        <button
          onClick={onSave}
          disabled={isMcpSaveDisabled({ newMcp, selectedTemplate, dbConfig })}
          className="px-6 py-2.5 bg-purple-500 hover:bg-purple-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold transition-all shadow-lg shadow-purple-500/20"
        >
          {t("save")}
        </button>
        <button
          onClick={onCancel}
          className="px-5 py-2.5 th-bg-surface hover:bg-white/10 th-text-secondary rounded-lg text-sm font-semibold border th-border transition-all"
        >
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}
