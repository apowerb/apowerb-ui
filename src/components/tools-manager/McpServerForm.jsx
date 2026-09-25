"use client";

import React, { useId } from "react";
import { Info, X, Check } from "lucide-react";
import { useTranslations } from "use-intl";
import { MCP_TEMPLATES, isMcpSaveDisabled } from "./toolsManagerUtils";
import { Card, PrimaryButton, SecondaryButton } from "./ui";

const INPUT =
  "w-full h-10 px-3 th-bg-surface border th-border rounded-xl text-sm th-text placeholder-[var(--text-faint)] focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all";

function Field({ label, hint, className = "", children }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-xs font-medium th-text-secondary mb-1.5">{label}</label>
      {React.cloneElement(children, { id })}
      {hint && <p className="text-[11px] th-text-faint mt-1">{hint}</p>}
    </div>
  );
}

function StepTitle({ n, children }) {
  return (
    <p className="flex items-center gap-2 text-sm font-semibold th-text mb-3">
      <span className="w-5 h-5 rounded-full bg-blue-500/15 text-blue-400 text-[11px] font-bold flex items-center justify-center">{n}</span>
      {children}
    </p>
  );
}

/**
 * Add / edit panel for an MCP server — step 1 picks a template, step 2
 * shows the fields that template needs (database connection, URL or
 * local command).
 */
export default function McpServerForm({
  newMcp, setNewMcp,
  dbConfig, setDbConfig,
  selectedTemplate,
  onApplyTemplate,
  onSave,
  onCancel,
  isEditing = false,
  editingName,
}) {
  const t = useTranslations("McpServerForm");
  const saveDisabled = isMcpSaveDisabled({ newMcp, selectedTemplate, dbConfig });
  const setDb = (key) => (e) => setDbConfig((p) => ({ ...p, [key]: e.target.value }));

  return (
    <Card className="p-5 mb-6 border-blue-500/30 shadow-lg">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="text-base font-semibold th-text">
            {isEditing ? t("editTitle", { name: editingName || newMcp.name }) : t("addTitle")}
          </h2>
          <p className="text-xs th-text-muted mt-0.5">{t("subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label={t("cancel")}
          title={t("cancel")}
          className="p-1.5 rounded-lg th-text-muted hover:th-text hover:bg-white/10 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      <StepTitle n={1}>{t("prompt")}</StepTitle>
      <div role="radiogroup" aria-label={t("prompt")} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
        {MCP_TEMPLATES.map((tpl) => {
          const Icon = tpl.icon;
          const isActive = selectedTemplate === tpl.id;
          return (
            <button
              key={tpl.id}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => onApplyTemplate(tpl)}
              className={`relative flex items-start gap-3 p-3 rounded-xl border text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
                isActive ? tpl.accent.active : "th-border hover:bg-white/10"
              }`}
            >
              <span className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${tpl.accent.tile}`}>
                <Icon size={17} />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold th-text pr-4">{t(`templates.${tpl.id}.label`)}</span>
                <span className="block text-[11px] th-text-muted mt-0.5 leading-snug">{t(`templates.${tpl.id}.desc`)}</span>
              </span>
              {isActive && <Check size={14} className="absolute top-2.5 right-2.5 text-blue-400" />}
            </button>
          );
        })}
      </div>

      {selectedTemplate && (
        <div className="mt-6">
          <StepTitle n={2}>{t("detailsTitle")}</StepTitle>

          {selectedTemplate === "toolbox-db" ? (
            <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
              <Field label={t("nameLabel")} className="sm:col-span-2">
                <input type="text" className={INPUT} placeholder={t("dbNamePlaceholder")}
                  value={newMcp.name} onChange={(e) => setNewMcp((p) => ({ ...p, name: e.target.value }))} />
              </Field>
              <Field label={t("databaseTypeLabel")} className="sm:col-span-2">
                <select
                  className={INPUT}
                  value={dbConfig.db_type}
                  onChange={(e) => {
                    const dbType = e.target.value;
                    const defaultPort = { postgres: "5432", mysql: "3306", mssql: "1433", sqlite: "" }[dbType] ?? "5432";
                    setDbConfig((p) => ({ ...p, db_type: dbType, port: defaultPort }));
                  }}
                >
                  <option value="postgres">PostgreSQL</option>
                  <option value="mysql">MySQL</option>
                  <option value="mssql">SQL Server</option>
                  <option value="sqlite">SQLite</option>
                </select>
              </Field>
              <Field label={t("sslModeLabel")} className="sm:col-span-2">
                <select className={INPUT} value={dbConfig.sslmode} onChange={setDb("sslmode")}>
                  <option value="disable">{t("sslDisable")}</option>
                  <option value="require">{t("sslRequire")}</option>
                  <option value="verify-ca">{t("sslVerifyCa")}</option>
                  <option value="verify-full">{t("sslVerifyFull")}</option>
                </select>
              </Field>
              <Field label={t("hostLabel")} className="sm:col-span-3">
                <input type="text" className={`${INPUT} font-mono`} placeholder={t("hostPlaceholder")}
                  value={dbConfig.host} onChange={setDb("host")} />
              </Field>
              <Field label={t("portLabel")} className="sm:col-span-1">
                <input type="text" inputMode="numeric" className={`${INPUT} font-mono`} placeholder={t("portPlaceholder")}
                  value={dbConfig.port} onChange={setDb("port")} />
              </Field>
              <Field label={t("databaseLabel")} className="sm:col-span-2">
                <input type="text" className={`${INPUT} font-mono`} placeholder={t("databasePlaceholder")}
                  value={dbConfig.database} onChange={setDb("database")} />
              </Field>
              <Field label={t("usernameLabel")} className="sm:col-span-3">
                <input type="text" autoComplete="off" className={`${INPUT} font-mono`} placeholder={t("usernamePlaceholder")}
                  value={dbConfig.user} onChange={setDb("user")} />
              </Field>
              <Field label={t("passwordLabel")} className="sm:col-span-3">
                <input type="password" autoComplete="new-password" className={`${INPUT} font-mono`} placeholder={t("passwordPlaceholder")}
                  value={dbConfig.password} onChange={setDb("password")} />
              </Field>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label={t("nameLabel")}>
                <input type="text" className={INPUT} placeholder={t("genericNamePlaceholder")}
                  value={newMcp.name} onChange={(e) => setNewMcp((p) => ({ ...p, name: e.target.value }))} />
              </Field>
              {newMcp.transport === "http" ? (
                <Field label={t("urlLabel")} className="sm:col-span-2">
                  <input type="url" className={`${INPUT} font-mono`} placeholder={t("urlPlaceholder")}
                    value={newMcp.url} onChange={(e) => setNewMcp((p) => ({ ...p, url: e.target.value }))} />
                </Field>
              ) : (
                <Field label={t("commandLabel")} hint={t("commandHint")} className="sm:col-span-2">
                  <input
                    type="text"
                    className={`${INPUT} font-mono`}
                    placeholder={t("commandPlaceholder")}
                    value={newMcp.command + (newMcp.args ? ` ${newMcp.args}` : "")}
                    onChange={(e) => {
                      const parts = e.target.value.split(" ");
                      setNewMcp((p) => ({ ...p, command: parts[0] || "", args: parts.slice(1).join(" ") }));
                    }}
                  />
                </Field>
              )}
            </div>
          )}

          {newMcp.url?.includes("YOUR_API_KEY") && (
            <p className="mt-3 text-xs flex items-center gap-2 text-amber-400 bg-amber-500/8 border border-amber-500/20 rounded-xl px-3 py-2">
              <Info size={14} className="shrink-0" />
              <span>
                {t.rich("apiKeyReplaceHint", {
                  code: (chunks) => <code className="font-mono bg-white/10 px-1 rounded text-[11px]">{chunks}</code>,
                })}
              </span>
            </p>
          )}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t th-border">
        <SecondaryButton onClick={onCancel}>{t("cancel")}</SecondaryButton>
        <PrimaryButton onClick={onSave} disabled={saveDisabled}>
          {isEditing ? t("saveChanges") : t("addServer")}
        </PrimaryButton>
      </div>
    </Card>
  );
}
