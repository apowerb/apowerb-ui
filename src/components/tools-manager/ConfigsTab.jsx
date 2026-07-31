"use client";

import React from "react";
import { Plus, Wrench, Search, Eye, Trash2 } from "lucide-react";
import { useTranslations } from "use-intl";

/**
 * "My Configurations" tab — displays saved tool configurations with search,
 * category filter pills, view/delete actions and an empty-state CTA.
 */
export default function ConfigsTab({
  configSearch, setConfigSearch,
  configCategoryFilter, setConfigCategoryFilter,
  filterOptions,
  filteredConfigs,
  onCreate,
  onEdit,
  onDelete,
}) {
  const t = useTranslations("ConfigsTab");
  return (
    <div>
      {/* Search + Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="relative flex-1 min-w-50 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 th-text-faint" />
          <input
            type="text"
            placeholder={t("searchPlaceholder")}
            value={configSearch}
            onChange={(e) => setConfigSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 th-bg-surface border th-border rounded-xl text-sm th-text placeholder-[var(--text-faint)] focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-all"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {filterOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setConfigCategoryFilter(opt.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border capitalize ${
                configCategoryFilter === opt.key
                  ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                  : "th-bg-surface th-text-muted th-border hover:bg-white/10 hover:th-text-secondary"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <span className="text-xs th-text-faint ml-auto">
          {t("configurationsCount", { count: filteredConfigs.length })}
        </span>
      </div>

      {filteredConfigs.length === 0 ? (
        <div className="glass-card p-12 rounded-2xl text-center border border-dashed th-border">
          <Wrench size={48} className="mx-auto mb-4 th-text-faint" />
          <h3 className="text-xl font-bold th-text mb-2">
            {configSearch || configCategoryFilter !== "all"
              ? t("noneMatchFilters")
              : t("noConfigsYet")}
          </h3>
          <p className="th-text-muted mb-6">
            {configSearch === "" && configCategoryFilter === "all" && t("createFirstConfigHint")}
          </p>
          {configSearch === "" && configCategoryFilter === "all" && (
            <button
              onClick={() => onCreate()}
              className="glass-btn px-6 py-3 bg-brand hover:bg-brand-hover text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20"
            >
              <Plus size={20} className="inline mr-2" />
              {t("createToolConfig")}
            </button>
          )}
        </div>
      ) : (
        <div className="glass-card rounded-xl border th-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b th-border th-bg-surface">
                  <th className="text-left p-3 th-text-secondary font-semibold">{t("nameColumn")}</th>
                  <th className="text-left p-3 th-text-secondary font-semibold">{t("toolColumn")}</th>
                  <th className="text-left p-3 th-text-secondary font-semibold">{t("statusColumn")}</th>
                  <th className="text-left p-3 th-text-secondary font-semibold">{t("actionsColumn")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredConfigs.map((config) => (
                  <tr
                    key={config.tool_config_id}
                    className="border-b th-border hover:th-bg-surface transition-colors"
                  >
                    <td className="p-3">
                      <span className="th-text text-sm font-medium">
                        {config.tool_config_name?.replace(/^tools_/, "")}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {(() => {
                          const raw = config.tool_name || "";
                          let names = [raw];
                          try { if (raw.startsWith("[")) names = JSON.parse(raw); } catch { /* keep raw */ }
                          return names.map((n, i) => (
                            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/25 font-mono">
                              {n.split(".").pop()?.replace(/^tool_/, "")}
                            </span>
                          ));
                        })()}
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                        config.status === "active"
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-gray-500/20 text-gray-400"
                      }`}>
                        {config.status}
                      </span>
                    </td>
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => onEdit(config)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 border border-blue-500/20 transition-all"
                        >
                          <Eye size={12} /> {t("view")}
                        </button>
                        <button
                          onClick={() => onDelete(config.tool_config_id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 transition-all"
                        >
                          <Trash2 size={12} /> {t("delete")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
