"use client";

import React from "react";
import { Plus, Settings2, Pencil, Trash2, Sparkles } from "lucide-react";
import { useTranslations } from "use-intl";
import { parseToolNames, toolLeafName } from "./toolsManagerUtils";
import {
  Toolbar, SearchField, SelectField, ResultCount, Card, EmptyPanel, IconButton,
  PrimaryButton, SecondaryButton, Badge, useCategoryInfo,
} from "./ui";

const MAX_TOOL_CHIPS = 3;

/**
 * "My Configurations" tab — saved tool configurations as a list of rows:
 * category icon, name, tools, status and row actions. Clicking a row opens
 * it for editing.
 */
export default function ConfigsTab({
  configSearch, setConfigSearch,
  configCategoryFilter, setConfigCategoryFilter,
  filterOptions,
  filteredConfigs,
  totalConfigs,
  resolveCategory,
  onCreate,
  onEdit,
  onDelete,
  onBrowseTools,
}) {
  const t = useTranslations("ConfigsTab");
  const categoryInfo = useCategoryInfo();
  const filtersActive = configSearch !== "" || configCategoryFilter !== "all";
  const options = filterOptions
    .map((o) => ({ key: o.key, label: o.key === "all" ? t("allCategories") : categoryInfo(o.key).label }))
    .sort((a, b) => (a.key === "all" ? -1 : b.key === "all" ? 1 : a.label.localeCompare(b.label)));

  if (totalConfigs === 0) {
    return (
      <EmptyPanel icon={Settings2} title={t("noConfigsYet")} description={t("createFirstConfigHint")}>
        <PrimaryButton icon={Plus} onClick={() => onCreate()}>{t("createToolConfig")}</PrimaryButton>
        <SecondaryButton icon={Sparkles} onClick={onBrowseTools}>{t("browseTools")}</SecondaryButton>
      </EmptyPanel>
    );
  }

  return (
    <div>
      <Toolbar>
        <SearchField
          value={configSearch}
          onChange={setConfigSearch}
          placeholder={t("searchPlaceholder")}
          clearLabel={t("clearSearch")}
        />
        <SelectField
          label={t("categoryFilterLabel")}
          value={configCategoryFilter}
          onChange={setConfigCategoryFilter}
          options={options}
        />
        <ResultCount>{t("configurationsCount", { count: filteredConfigs.length })}</ResultCount>
      </Toolbar>

      {filteredConfigs.length === 0 ? (
        <EmptyPanel icon={Settings2} title={t("noneMatchFilters")}>
          {filtersActive && (
            <SecondaryButton onClick={() => { setConfigSearch(""); setConfigCategoryFilter("all"); }}>
              {t("resetFilters")}
            </SecondaryButton>
          )}
        </EmptyPanel>
      ) : (
        <Card className="divide-y divide-[var(--border-primary)] overflow-hidden">
          {filteredConfigs.map((config) => {
            const info = categoryInfo(resolveCategory(config));
            const Icon = info.Icon;
            const tools = parseToolNames(config.tool_name);
            const active = config.status === "active";
            return (
              <div
                key={config.tool_config_id}
                role="button"
                tabIndex={0}
                onClick={() => onEdit(config)}
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget) return; // keys on the row's own buttons
                  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onEdit(config); }
                }}
                className="group flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/10 focus:outline-none focus-visible:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 sm:w-72 shrink-0">
                  <div className="shrink-0 w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <Icon size={16} className="text-blue-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold th-text truncate" title={config.tool_config_name}>
                      {config.tool_config_name?.replace(/^tools_/, "") || t("untitled")}
                    </p>
                    <p className="text-xs th-text-muted truncate">{info.label}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
                  {tools.slice(0, MAX_TOOL_CHIPS).map((name) => (
                    <Badge key={name} mono title={name}>{toolLeafName(name)}</Badge>
                  ))}
                  {tools.length > MAX_TOOL_CHIPS && (
                    <Badge title={tools.slice(MAX_TOOL_CHIPS).map(toolLeafName).join(", ")}>
                      {t("moreTools", { count: tools.length - MAX_TOOL_CHIPS })}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${active ? "text-emerald-500" : "th-text-faint"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-[var(--text-faint)]"}`} />
                    {active ? t("statusActive") : t("statusInactive")}
                  </span>
                  <div className="flex items-center gap-0.5 sm:opacity-60 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                    <IconButton icon={Pencil} label={t("edit")} onClick={() => onEdit(config)} />
                    <IconButton icon={Trash2} label={t("delete")} tone="danger" onClick={() => onDelete(config.tool_config_id)} />
                  </div>
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
