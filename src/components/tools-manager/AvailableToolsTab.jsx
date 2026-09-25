"use client";

import React, { useState } from "react";
import { Plus, Wrench, CheckCircle2 } from "lucide-react";
import { useTranslations } from "use-intl";
import { toolLeafName } from "./toolsManagerUtils";
import {
  Toolbar, SearchField, SelectField, ResultCount, Card, EmptyPanel,
  SecondaryButton, useCategoryInfo,
} from "./ui";

const PREVIEW_COUNT = 6;

/** Wraps the part of `text` that matches `query` in a <mark>. */
function Highlight({ text, query }) {
  const q = query.trim().toLowerCase();
  const i = q ? text.toLowerCase().indexOf(q) : -1;
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-amber-500/25 text-inherit rounded-sm">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

function CategoryCard({ category, tools, configuredCount, searching, search, onConfigure }) {
  const t = useTranslations("AvailableToolsTab");
  const info = useCategoryInfo()(category);
  const [expanded, setExpanded] = useState(false);
  const showAll = expanded || searching;
  const visible = showAll ? tools : tools.slice(0, PREVIEW_COUNT);
  const hidden = tools.length - visible.length;
  const Icon = info.Icon;

  return (
    <Card className="p-4 flex flex-col hover:border-blue-500/30 transition-colors">
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
          <Icon size={18} className="text-blue-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold th-text truncate" title={info.label}>
            <Highlight text={info.label} query={search} />
          </h3>
          <p className="flex items-center gap-2 text-xs th-text-muted mt-0.5">
            <span>{t("toolsCount", { count: tools.length })}</span>
            {configuredCount > 0 && (
              <span className="inline-flex items-center gap-1 text-emerald-500 font-medium">
                <CheckCircle2 size={12} />
                {t("configuredCount", { count: configuredCount })}
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onConfigure(category)}
          title={t("configureHint", { category: info.label })}
          className="shrink-0 inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs font-semibold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
        >
          <Plus size={14} />
          {t("configure")}
        </button>
      </div>

      {info.description && (
        <p className="text-xs th-text-secondary leading-relaxed mt-3 line-clamp-2" title={info.description}>
          {info.description}
        </p>
      )}

      <ul className="flex flex-wrap gap-1.5 mt-3" aria-label={t("toolsInCategory", { category: info.label })}>
        {visible.map((tool) => (
          <li
            key={tool}
            title={tool}
            className="px-2 py-0.5 rounded-md text-[11px] font-mono th-bg-surface border th-border th-text-secondary"
          >
            <Highlight text={toolLeafName(tool)} query={search} />
          </li>
        ))}
        {hidden > 0 && (
          <li>
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="px-2 py-0.5 rounded-md text-[11px] font-semibold text-blue-400 hover:bg-blue-500/10 transition-colors"
            >
              {t("showMore", { count: hidden })}
            </button>
          </li>
        )}
        {expanded && !searching && tools.length > PREVIEW_COUNT && (
          <li>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="px-2 py-0.5 rounded-md text-[11px] font-semibold th-text-muted hover:th-text hover:bg-white/10 transition-colors"
            >
              {t("showLess")}
            </button>
          </li>
        )}
      </ul>
    </Card>
  );
}

/**
 * "Available Tools" tab — one card per tool category with its tools, a short
 * description and a shortcut to configure it. Search reaches both category
 * and tool names; the category select narrows to a single card.
 */
export default function AvailableToolsTab({
  toolSearch, setToolSearch,
  categoryFilter, setCategoryFilter,
  filterOptions,
  sortedEntries,
  configCountByCategory,
  onConfigure,
}) {
  const t = useTranslations("AvailableToolsTab");
  const categoryInfo = useCategoryInfo();
  const searching = toolSearch.trim().length > 0;
  const toolCount = sortedEntries.reduce((n, [, tools]) => n + tools.length, 0);
  const options = filterOptions
    .map((o) => ({ key: o.key, label: o.key === "all" ? t("allCategories") : categoryInfo(o.key).label }))
    .sort((a, b) => (a.key === "all" ? -1 : b.key === "all" ? 1 : a.label.localeCompare(b.label)));
  const filtersActive = searching || categoryFilter !== "all";

  return (
    <div>
      <Toolbar>
        <SearchField
          value={toolSearch}
          onChange={setToolSearch}
          placeholder={t("searchPlaceholder")}
          clearLabel={t("clearSearch")}
        />
        <SelectField
          label={t("categoryFilterLabel")}
          value={categoryFilter}
          onChange={setCategoryFilter}
          options={options}
        />
        <ResultCount>
          {t("resultSummary", { tools: toolCount, categories: sortedEntries.length })}
        </ResultCount>
      </Toolbar>

      {sortedEntries.length === 0 ? (
        <EmptyPanel icon={Wrench} title={t("noToolsMatch")} description={t("noToolsMatchHint")}>
          {filtersActive && (
            <SecondaryButton onClick={() => { setToolSearch(""); setCategoryFilter("all"); }}>
              {t("resetFilters")}
            </SecondaryButton>
          )}
        </EmptyPanel>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sortedEntries.map(([category, tools]) => (
            <CategoryCard
              key={category}
              category={category}
              tools={tools}
              configuredCount={configCountByCategory[category] || 0}
              searching={searching}
              search={toolSearch}
              onConfigure={onConfigure}
            />
          ))}
        </div>
      )}
    </div>
  );
}
