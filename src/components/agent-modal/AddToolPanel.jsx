"use client";

import { useTranslations } from "use-intl";
import { Loader2 } from "lucide-react";

/**
 * Inline panel to pick a tool + configure its params to create a new Tool Config.
 */
export default function AddToolPanel({
  allTools,
  addToolError,
  toolSearch,
  setToolSearch,
  selectedNewTool,
  newToolParams,
  newToolValues,
  setNewToolValues,
  newToolConfigName,
  setNewToolConfigName,
  addingTool,
  onSelectNewTool,
  onBack,
  onCancel,
  onCreate,
}) {
  const t = useTranslations("AddToolPanel");

  if (!selectedNewTool) {
    return (
      <>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 th-text-ghost" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={toolSearch}
            onChange={(e) => setToolSearch(e.target.value)}
            placeholder={t("searchToolsPlaceholder")}
            className="w-full pl-9 pr-3 py-2 rounded-lg th-bg-surface border th-border text-sm th-text placeholder-white/30 focus:border-purple-400/50 focus:outline-none"
            autoFocus
          />
        </div>
        <div className="max-h-48 overflow-y-auto space-y-2 custom-scrollbar">
          {Object.keys(allTools).length === 0 && !addToolError && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-white/30" />
              <span className="ml-2 text-xs th-text-ghost">{t("loadingTools")}</span>
            </div>
          )}
          {addToolError && (
            <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400">
              {addToolError}
            </div>
          )}
          {Object.entries(allTools)
            .map(([category, tools]) => {
              const searchLower = toolSearch.toLowerCase();
              const filtered = tools.filter(
                (toolName) =>
                  toolName.toLowerCase().includes(searchLower) ||
                  category.toLowerCase().includes(searchLower)
              );
              if (filtered.length === 0) return null;
              return (
                <div key={category}>
                  <div className="text-[10px] th-text-ghost uppercase tracking-wider mb-1 px-2">
                    {category}
                  </div>
                  {filtered.map((toolName) => (
                    <button
                      key={toolName}
                      onClick={() => onSelectNewTool(toolName)}
                      className="w-full text-left p-2 rounded-lg hover:th-bg-surface-hover text-sm th-text-secondary hover:th-text transition-all flex items-center gap-2"
                    >
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full th-bg-surface th-text-faint shrink-0">
                        {category}
                      </span>
                      <span className="truncate">{toolName.split(".").pop()}</span>
                    </button>
                  ))}
                </div>
              );
            })
            .filter(Boolean)}
          {Object.keys(allTools).length > 0 &&
            Object.entries(allTools).every(([category, tools]) => {
              const searchLower = toolSearch.toLowerCase();
              return tools.filter(
                (toolName) =>
                  toolName.toLowerCase().includes(searchLower) ||
                  category.toLowerCase().includes(searchLower)
              ).length === 0;
            }) && (
              <div className="p-3 text-center th-text-ghost text-xs italic">
                {t("noToolsMatch")}
              </div>
            )}
        </div>
        <button onClick={onCancel} className="text-xs th-text-ghost hover:th-text-faint transition-colors">
          {t("cancel")}
        </button>
      </>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium th-text">
          {selectedNewTool.split(".").pop()}
        </span>
        <button
          onClick={onBack}
          className="text-xs th-text-ghost hover:th-text-faint transition-colors"
        >
          {t("back")}
        </button>
      </div>
      <div>
        <label className="text-[11px] th-text-faint mb-0.5 block">{t("configNameLabel")}</label>
        <input
          type="text"
          value={newToolConfigName}
          onChange={(e) => setNewToolConfigName(e.target.value)}
          placeholder={t("configNamePlaceholder")}
          className="w-full px-3 py-2 rounded-lg th-bg-surface border th-border text-sm th-text placeholder-white/20 focus:border-purple-400/50 focus:outline-none"
        />
      </div>
      {newToolParams.length > 0 ? (
        <div className="space-y-2">
          {newToolParams.map(({ key, default: def }) => (
            <div key={key}>
              <label className="text-[11px] th-text-faint mb-0.5 block">{key}</label>
              <input
                type={
                  key.toUpperCase().includes("PASSWORD") ||
                  key.toUpperCase().includes("SECRET") ||
                  key.toUpperCase().includes("KEY")
                    ? "password"
                    : "text"
                }
                value={newToolValues[key] || ""}
                onChange={(e) =>
                  setNewToolValues((prev) => ({ ...prev, [key]: e.target.value }))
                }
                placeholder={def || ""}
                className="w-full px-3 py-1.5 rounded-lg th-bg-surface border th-border text-sm th-text placeholder-white/20 focus:border-purple-400/50 focus:outline-none"
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs th-text-ghost italic">
          {t("noParamsRequired")}
        </p>
      )}
      {addToolError && (
        <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400">
          {addToolError}
        </div>
      )}
      <div className="flex gap-2">
        <button
          onClick={onCreate}
          disabled={addingTool || !newToolConfigName.trim()}
          className="flex-1 py-2 rounded-lg bg-purple-400/20 text-purple-300 text-sm font-medium hover:bg-purple-400/30 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
        >
          {addingTool && <Loader2 className="w-3 h-3 animate-spin" />}
          {addingTool ? t("creating") : t("createAndAdd")}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg th-text-faint text-sm hover:th-text-muted transition-colors"
        >
          {t("cancel")}
        </button>
      </div>
    </>
  );
}
