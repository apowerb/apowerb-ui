"use client";

import { useTranslations } from "use-intl";

/**
 * Renders the list of tool configurations with checkbox-selection and inline edit.
 */
export default function ConfigurableToolsList({
  configurableTools,
  selectedIds,
  onToggleSelect,
  editingToolConfig,
  editToolName,
  setEditToolName,
  editToolValues,
  setEditToolValues,
  editToolExpectedParams,
  editToolError,
  savingToolConfig,
  onSave,
  onCancelEdit,
  onEdit,
  toolConfigConflicts,
}) {
  const t = useTranslations("ConfigurableToolsList");

  return (
    <div>
      <div className="text-xs font-semibold th-text-faint mb-1.5 pl-1">{t("title")}</div>

      {toolConfigConflicts.length > 0 && (
        <div className="p-2 rounded-lg bg-purple-400/10 border border-purple-400/30 mb-3">
          <p className="text-[11px] text-purple-400 font-medium">{t("parameterOverlapDetected")}</p>
          {toolConfigConflicts.map(({ key, configs }) => (
            <p key={key} className="text-[10px] text-purple-400/70 ml-2">
              {t("setBy", { key, configs: configs.join(", ") })}
            </p>
          ))}
        </div>
      )}

      <div className="glass-card rounded-xl p-1 max-h-60 overflow-y-auto custom-scrollbar">
        {configurableTools.length === 0 ? (
          <div className="p-4 text-center th-text-ghost text-sm italic">
            {t("noToolConfigsYet")}
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {configurableTools.map((config) => {
              const configId = String(config.tool_config_id);
              const selected = selectedIds.includes(configId);
              const isEditing = editingToolConfig === configId;

              if (isEditing) {
                const allKeys = new Set([
                  ...editToolExpectedParams.map((p) => p.key),
                  ...Object.keys(editToolValues),
                ]);

                return (
                  <EditToolConfigBlock
                    key={configId}
                    config={config}
                    editToolName={editToolName}
                    setEditToolName={setEditToolName}
                    editToolValues={editToolValues}
                    setEditToolValues={setEditToolValues}
                    editToolExpectedParams={editToolExpectedParams}
                    editToolError={editToolError}
                    savingToolConfig={savingToolConfig}
                    allKeys={allKeys}
                    onSave={onSave}
                    onCancel={onCancelEdit}
                  />
                );
              }

              return (
                <ToolConfigRow
                  key={configId}
                  config={config}
                  configId={configId}
                  selected={selected}
                  onToggle={() => onToggleSelect(configId, selected)}
                  onEdit={() => onEdit(config)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function EditToolConfigBlock({
  config,
  editToolName,
  setEditToolName,
  editToolValues,
  setEditToolValues,
  editToolExpectedParams,
  editToolError,
  savingToolConfig,
  allKeys,
  onSave,
  onCancel,
}) {
  const t = useTranslations("ConfigurableToolsList");

  return (
    <div className="p-3 rounded-lg border border-purple-400/30 bg-purple-400/5 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold th-text">{t("editTitle", { name: config.tool_config_name })}</span>
        <button onClick={onCancel} className="text-xs th-text-ghost hover:th-text-faint">
          &#x2715;
        </button>
      </div>
      <div>
        <label className="text-[11px] th-text-faint mb-0.5 block">{t("configNameLabel")}</label>
        <input
          type="text"
          value={editToolName}
          onChange={(e) => setEditToolName(e.target.value)}
          className="w-full px-3 py-1.5 rounded-lg th-bg-surface border th-border text-sm text-white"
        />
      </div>
      {[...allKeys].map((key) => {
        const expectedParam = editToolExpectedParams.find((p) => p.key === key);
        return (
          <div key={key}>
            <label className="text-[11px] th-text-faint mb-0.5 block">{key}</label>
            <input
              type={key.includes("PASSWORD") || key.includes("SECRET") || key.endsWith("_KEY") ? "password" : "text"}
              value={editToolValues[key] || ""}
              onChange={(e) => setEditToolValues((prev) => ({ ...prev, [key]: e.target.value }))}
              placeholder={expectedParam?.default || ""}
              className="w-full px-3 py-1.5 rounded-lg th-bg-surface border th-border text-sm th-text placeholder-white/20"
            />
          </div>
        );
      })}
      {editToolError && <div className="text-xs text-red-400">{editToolError}</div>}
      <div className="flex gap-2">
        <button
          onClick={onSave}
          disabled={savingToolConfig}
          className="flex-1 py-1.5 rounded-lg bg-purple-400/20 text-purple-300 text-sm font-medium hover:bg-purple-400/30 disabled:opacity-50"
        >
          {savingToolConfig ? t("saving") : t("save")}
        </button>
        <button onClick={onCancel} className="px-4 py-1.5 rounded-lg th-text-faint text-sm hover:th-text-muted">
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}

function ToolConfigRow({ config, configId, selected, onToggle, onEdit }) {
  const t = useTranslations("ConfigurableToolsList");
  const paramKeys = Object.keys(config.tool_config_params || {});
  const paramCount = paramKeys.length;

  return (
    <label
      className={`flex items-start gap-2 p-3 rounded-lg cursor-pointer transition-all border ${
        selected ? "bg-purple-400/10 border-purple-400/30" : "border-transparent hover:bg-white/5"
      }`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="rounded accent-purple-500 w-4 h-4 bg-white/10 border-white/20 mt-0.5 shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`text-sm font-semibold truncate ${selected ? "th-text" : "th-text-secondary"}`}
            title={config.tool_config_name}
          >
            {config.tool_config_name}
            {paramCount > 0 && (
              <span className="text-[10px] th-text-faint ml-1 font-normal">
                ({paramKeys
                  .filter((k) => k.startsWith("DB_") || k.includes("KEY") || k.includes("HOST") || k.includes("URL"))
                  .join(", ") || t("paramsCountFallback", { count: paramCount })})
              </span>
            )}
          </span>
          {(() => {
            const raw = config.tool_name || "";
            let names = [raw];
            try { if (raw.startsWith("[")) names = JSON.parse(raw); } catch {}
            return names.map((n, i) => (
              <span key={i} className={`text-xs px-2 py-0.5 rounded-full ${selected ? "bg-purple-400/20 text-purple-300" : "th-bg-surface th-text-faint"}`}>
                {n.split(".").pop() || "tool"}
              </span>
            ));
          })()}
        </div>
        <div className="text-xs th-text-faint mt-0.5 truncate" title={config.tool_name}>
          {(() => {
            const raw = config.tool_name || "";
            try { if (raw.startsWith("[")) return t("toolsCount", { count: JSON.parse(raw).length }); } catch {}
            return raw;
          })()}
        </div>
        {paramCount > 0 && (
          <div className="text-xs th-text-ghost mt-1">
            {t("paramsConfigured", { count: paramCount })}
          </div>
        )}
        {selected && paramCount === 0 && (
          <div className="flex items-center gap-1 mt-1">
            <svg className="w-3 h-3 text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span className="text-[10px] text-purple-400">
              {t("noParamsWarning")}
            </span>
          </div>
        )}
      </div>
      {selected && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(); }}
          className="shrink-0 p-1 rounded hover:th-bg-surface-hover th-text-ghost hover:th-text-muted transition-colors"
          title={t("editConfigurationTooltip")}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
      )}
    </label>
  );
}
