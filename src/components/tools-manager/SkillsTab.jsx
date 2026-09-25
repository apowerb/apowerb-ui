"use client";

import React from "react";
import { Plus, Zap, Trash2, Pencil, Download, Upload, Globe2 } from "lucide-react";
import { useTranslations } from "use-intl";
import { SKILL_FILTERS } from "./toolsManagerUtils";
import {
  Toolbar, SearchField, Segmented, ResultCount, Card, EmptyPanel, IconButton,
  PrimaryButton, SecondaryButton, Badge,
} from "./ui";

function SkillCard({ skill, skillKey, exportOpen, setExportDropdownId, onEdit, onDelete, onExport }) {
  const t = useTranslations("SkillsTab");
  const custom = skill.source === "custom";
  const preview = skill.instructions_preview || skill.instructions || "";
  const refs = Object.keys(skill.references || {});

  return (
    <Card className="p-4 flex flex-col hover:border-purple-500/30 transition-colors">
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-10 h-10 rounded-xl bg-purple-500/15 flex items-center justify-center">
          <Zap size={18} className="text-purple-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold th-text font-mono truncate max-w-full" title={skill.skill_name}>{skill.skill_name}</h3>
            <Badge tone={custom ? "purple" : "blue"}>{custom ? t("customBadge") : t("builtInBadge")}</Badge>
            {skill.is_public && <Badge><Globe2 size={10} />{t("publicBadge")}</Badge>}
          </div>
          {skill.description && <p className="text-xs th-text-secondary mt-1 line-clamp-2">{skill.description}</p>}
        </div>
        <div className="flex items-center gap-0.5 shrink-0 -mr-1 -mt-1">
          <div className="relative" data-export-dropdown>
            <IconButton
              icon={Download}
              label={t("exportLabel")}
              aria-haspopup="menu"
              aria-expanded={exportOpen}
              onClick={() => setExportDropdownId(exportOpen ? null : skillKey)}
            />
            {exportOpen && (
              <div role="menu" className="absolute right-0 top-full mt-1 th-bg-modal border th-border rounded-xl shadow-xl z-20 p-1 min-w-44">
                {[["json", "exportAsJson"], ["adk", "exportAsAdk"]].map(([format, key]) => (
                  <button
                    key={format}
                    type="button"
                    role="menuitem"
                    onClick={() => { onExport(skill, format); setExportDropdownId(null); }}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs th-text-secondary hover:bg-white/10 hover:th-text transition-colors"
                  >
                    {t(key)}
                  </button>
                ))}
              </div>
            )}
          </div>
          {custom && (
            <>
              <IconButton icon={Pencil} label={t("edit")} onClick={() => onEdit(skill)} />
              <IconButton icon={Trash2} label={t("delete")} tone="danger" onClick={() => onDelete(skill.skill_id || skill.id)} />
            </>
          )}
        </div>
      </div>

      {preview && (
        <p className="mt-3 px-3 py-2 rounded-lg bg-white/3 border th-border text-[11px] th-text-muted font-mono leading-relaxed line-clamp-3" title={t("instructionsLabel")}>
          {preview}
        </p>
      )}

      {refs.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          <span className="text-[11px] th-text-faint mr-0.5">{t("referencesLabel")}</span>
          {refs.map((k) => <Badge key={k} mono>{k}</Badge>)}
        </div>
      )}
    </Card>
  );
}

/**
 * "Skills" tab — built-in (portfolio) and custom skills as cards, with a
 * source filter, import/export and edit/delete for custom ones.
 */
export default function SkillsTab({
  skillSearch, setSkillSearch,
  skillFilter, setSkillFilter,
  filteredSkills,
  totalSkills,
  exportDropdownId, setExportDropdownId,
  importInputRef,
  openNewSkill,
  onImport,
  onEdit,
  onDelete,
  onExport,
}) {
  const t = useTranslations("SkillsTab");
  const filtersActive = skillSearch !== "" || skillFilter !== "all";

  return (
    <div>
      <input ref={importInputRef} type="file" accept=".json,.zip" onChange={onImport} className="hidden" />

      {totalSkills === 0 ? (
        <EmptyPanel icon={Zap} title={t("noSkillsAvailable")} description={t("createFirstSkillHint")}>
          <PrimaryButton icon={Plus} onClick={openNewSkill}>{t("createSkill")}</PrimaryButton>
          <SecondaryButton icon={Upload} onClick={() => importInputRef.current?.click()}>{t("importSkill")}</SecondaryButton>
        </EmptyPanel>
      ) : (
        <>
          <Toolbar>
            <SearchField
              value={skillSearch}
              onChange={setSkillSearch}
              placeholder={t("searchPlaceholder")}
              clearLabel={t("clearSearch")}
            />
            <Segmented
              label={t("sourceFilterLabel")}
              value={skillFilter}
              onChange={setSkillFilter}
              options={SKILL_FILTERS.map((o) => ({ key: o.key, label: t(o.labelKey) }))}
            />
            <ResultCount>{t("skillsCount", { count: filteredSkills.length })}</ResultCount>
          </Toolbar>

          {filteredSkills.length === 0 ? (
            <EmptyPanel icon={Zap} title={t("noneMatchFilters")}>
              {filtersActive && (
                <SecondaryButton onClick={() => { setSkillSearch(""); setSkillFilter("all"); }}>
                  {t("resetFilters")}
                </SecondaryButton>
              )}
            </EmptyPanel>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredSkills.map((skill) => {
                const skillKey = skill.skill_id || skill.id || skill.skill_name;
                return (
                  <SkillCard
                    key={skillKey}
                    skill={skill}
                    skillKey={skillKey}
                    exportOpen={exportDropdownId === skillKey}
                    setExportDropdownId={setExportDropdownId}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onExport={onExport}
                  />
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
