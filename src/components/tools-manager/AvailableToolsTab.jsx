"use client";

import React from "react";
import {
  Plus, Wrench, Search, ChevronRight, ArrowUpDown,
} from "lucide-react";
import { useTranslations } from "use-intl";
import { toolLeafName } from "./toolsManagerUtils";

/**
 * "Available Tools" tab — category-grouped list of tools discovered from the
 * backend, with search/sort/filter and an "expand" behaviour per category.
 */
export default function AvailableToolsTab({
  toolSearch, setToolSearch,
  categoryFilter, setCategoryFilter,
  filterOptions,
  sortedEntries,
  toolSortKey,
  expandedCategory, setExpandedCategory,
  onSort,
  onConfigure,
}) {
  const t = useTranslations("AvailableToolsTab");
  return (
    <div>
      {/* Search + Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="relative flex-1 min-w-50 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 th-text-faint" />
          <input
            type="text"
            placeholder={t("searchPlaceholder")}
            value={toolSearch}
            onChange={(e) => setToolSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 th-bg-surface border th-border rounded-xl text-sm th-text placeholder-[var(--text-faint)] focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-all"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {filterOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setCategoryFilter(opt.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border capitalize ${
                categoryFilter === opt.key
                  ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                  : "th-bg-surface th-text-muted th-border hover:bg-white/10 hover:th-text-secondary"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <span className="text-xs th-text-faint ml-auto">
          {t("categoriesCount", { count: sortedEntries.length })}
        </span>
      </div>

      {/* Tools Table — expandable rows */}
      <div className="glass-card rounded-xl border th-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b th-border th-bg-surface">
                <th
                  className="text-left p-3 th-text-secondary font-semibold cursor-pointer hover:th-text transition-colors select-none"
                  onClick={() => onSort("name")}
                >
                  <span className="inline-flex items-center gap-1">
                    {t("categoryColumn")}
                    <ArrowUpDown size={12} className={toolSortKey === "name" ? "text-blue-400" : "th-text-ghost"} />
                  </span>
                </th>
                <th className="text-left p-3 th-text-secondary font-semibold">{t("countColumn")}</th>
                <th className="text-left p-3 th-text-secondary font-semibold" />
                <th className="text-left p-3 th-text-secondary font-semibold">{t("actionsColumn")}</th>
              </tr>
            </thead>
            <tbody>
              {sortedEntries.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center">
                    <Wrench size={36} className="mx-auto mb-3 th-text-ghost" />
                    <p className="th-text-faint text-sm">{t("noToolsMatch")}</p>
                  </td>
                </tr>
              ) : (
                sortedEntries.map(([category, tools]) => {
                  const isExpanded = expandedCategory === category;
                  return (
                    <React.Fragment key={category}>
                      <tr
                        className={`border-b th-border transition-colors cursor-pointer ${
                          isExpanded ? "bg-blue-500/6 border-blue-500/20" : "hover:th-bg-surface"
                        }`}
                        onClick={() => setExpandedCategory(isExpanded ? null : category)}
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className={`shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}>
                              <ChevronRight size={14} className="th-text-faint" />
                            </div>
                            <span className="th-text text-sm font-medium capitalize">
                              {category.replace(/^tools_/, "")}
                            </span>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/25">
                            {t("toolsCount", { count: tools.length })}
                          </span>
                        </td>
                        <td className="p-3" />
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => onConfigure(category)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 border border-blue-500/20 transition-all"
                          >
                            <Plus size={12} />
                            {t("configure")}
                          </button>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr>
                          <td colSpan={4} className="p-0">
                            <div className="bg-linear-to-b from-blue-500/4 to-transparent border-b border-blue-500/10">
                              <div className="px-5 py-3">
                                <div className="rounded-lg border th-border overflow-hidden">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="th-bg-surface th-text-muted">
                                        <th className="text-left p-2.5 font-semibold">{t("toolNameColumn")}</th>
                                        <th className="text-left p-2.5 font-semibold">{t("fullPathColumn")}</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {tools.map((tool) => (
                                        <tr key={tool} className="border-t th-border hover:th-bg-surface/50 transition-colors">
                                          <td className="p-2.5">
                                            <div className="flex items-center gap-2">
                                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400/60 shrink-0" />
                                              <span className="th-text-secondary font-mono">
                                                {toolLeafName(tool)}
                                              </span>
                                            </div>
                                          </td>
                                          <td className="p-2.5 th-text-faint font-mono">{tool}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
