"use client";

import React from "react";
import {
  Plus, Search, Zap, Trash2, Edit3, Download, Upload, Info,
} from "lucide-react";
import { useTranslations } from "use-intl";
import { SKILL_FILTERS } from "./toolsManagerUtils";

/**
 * "Skills" tab — list of built-in (portfolio) and custom skills with
 * search, source filter, import/export and CRUD for custom ones.
 */
export default function SkillsTab({
  skillSearch, setSkillSearch,
  skillFilter, setSkillFilter,
  filteredSkills,
  exportDropdownId, setExportDropdownId,
  openNewSkill,
  onImport,
  onEdit,
  onDelete,
  onExport,
}) {
  const t = useTranslations("SkillsTab");
  return (
    <div>
      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-purple-400/5 border border-purple-400/15 mb-4">
        <Info size={18} className="text-purple-300 shrink-0 mt-0.5" />
        <div className="text-xs th-text-secondary leading-relaxed">
          {t.rich("infoBanner", {
            skills: (chunks) => <span className="text-purple-300 font-semibold">{chunks}</span>,
          })}
        </div>
      </div>

      {/* Search + Filter + New Skill */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="relative flex-1 min-w-50 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 th-text-muted" />
          <input
            type="text"
            placeholder={t("searchPlaceholder")}
            value={skillSearch}
            onChange={(e) => setSkillSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 th-bg-surface border th-border rounded-xl text-sm th-text placeholder-[var(--text-faint)] focus:outline-none focus:border-purple-400/50 focus:ring-1 focus:ring-purple-400/30 transition-all"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {SKILL_FILTERS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSkillFilter(opt.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                skillFilter === opt.key
                  ? "bg-purple-400/20 text-purple-300 border-purple-400/30"
                  : "th-bg-surface th-text-muted th-border hover:bg-white/10 hover:th-text-secondary"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <span className="text-xs th-text-muted ml-auto">
          {t("skillsCount", { count: filteredSkills.length })}
        </span>
        <input
          type="file"
          id="skill-import-input"
          accept=".json,.zip"
          onChange={onImport}
          className="hidden"
        />
        <button
          onClick={() => document.getElementById("skill-import-input").click()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-400/10 text-purple-300 border border-purple-400/20 hover:bg-purple-400/20 rounded-xl text-sm font-bold transition-all"
        >
          <Upload size={16} />
          {t("importSkill")}
        </button>
        <button
          onClick={openNewSkill}
          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-400 hover:bg-purple-500 text-black rounded-xl text-sm font-bold transition-all shadow-lg shadow-purple-400/20 hover:scale-105"
        >
          <Plus size={16} />
          {t("newSkill")}
        </button>
      </div>

      {/* Skills List */}
      {filteredSkills.length === 0 ? (
        <div className="glass-card p-12 rounded-2xl text-center border border-dashed th-border">
          <Zap size={48} className="mx-auto mb-4 th-text-faint" />
          <h3 className="text-xl font-bold th-text mb-2">
            {skillSearch || skillFilter !== "all"
              ? t("noneMatchFilters")
              : t("noSkillsAvailable")}
          </h3>
          <p className="th-text-secondary mb-6 max-w-md mx-auto">
            {skillSearch === "" && skillFilter === "all" && t("createFirstSkillHint")}
          </p>
          {skillSearch === "" && skillFilter === "all" && (
            <button
              onClick={openNewSkill}
              className="glass-btn px-6 py-3 bg-purple-400 hover:bg-purple-500 text-black rounded-xl font-bold transition-all shadow-lg shadow-purple-400/20"
            >
              <Plus size={20} className="inline mr-2" />
              {t("createSkill")}
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredSkills.map((skill) => {
            const skillKey = skill.skill_id || skill.id || skill.skill_name;
            return (
              <div
                key={skillKey}
                className="glass-card rounded-xl border th-border hover:border-purple-400/20 p-4 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-purple-400/10">
                      <Zap size={20} className="text-purple-300" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold th-text flex items-center gap-2">
                        {skill.skill_name}
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          skill.source === "custom"
                            ? "bg-purple-500/15 text-purple-400 border border-purple-500/25"
                            : "bg-blue-500/15 text-blue-400 border border-blue-500/25"
                        }`}>
                          {skill.source === "custom" ? t("customBadge") : t("builtInBadge")}
                        </span>
                        {skill.is_public && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold th-bg-surface th-text-muted border th-border">
                            {t("publicBadge")}
                          </span>
                        )}
                      </h4>
                      {skill.description && (
                        <p className="text-xs th-text-muted mt-0.5">{skill.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative" data-export-dropdown>
                      <button
                        onClick={() => setExportDropdownId(exportDropdownId === skillKey ? null : skillKey)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold th-bg-surface hover:bg-white/10 th-text-secondary border th-border transition-all"
                      >
                        <Download size={12} /> {t("exportLabel")}
                      </button>
                      {exportDropdownId === skillKey && (
                        <div className="absolute right-0 top-full mt-1 th-bg-elevated border th-border rounded-lg shadow-xl z-10 py-1 min-w-[160px]">
                          <button
                            onClick={() => { onExport(skill, "json"); setExportDropdownId(null); }}
                            className="w-full text-left px-3 py-2 text-xs th-text-secondary hover:bg-white/10 hover:th-text transition-all"
                          >
                            {t("exportAsJson")}
                          </button>
                          <button
                            onClick={() => { onExport(skill, "adk"); setExportDropdownId(null); }}
                            className="w-full text-left px-3 py-2 text-xs th-text-secondary hover:bg-white/10 hover:th-text transition-all"
                          >
                            {t("exportAsAdk")}
                          </button>
                        </div>
                      )}
                    </div>
                    {skill.source === "custom" && (
                      <>
                        <button
                          onClick={() => onEdit(skill)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-purple-400/10 hover:bg-purple-400/20 text-purple-300 hover:text-purple-300 border border-purple-400/20 transition-all"
                        >
                          <Edit3 size={12} /> {t("edit")}
                        </button>
                        <button
                          onClick={() => onDelete(skill.skill_id || skill.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 transition-all"
                        >
                          <Trash2 size={12} /> {t("delete")}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {(skill.instructions_preview || skill.instructions) && (
                  <div className="mt-3 pt-3 border-t th-border">
                    <p className="text-[10px] th-text-faint uppercase tracking-wider mb-1">{t("instructionsLabel")}</p>
                    <p className="text-xs th-text-muted font-mono leading-relaxed">
                      {(skill.instructions_preview || skill.instructions).substring(0, 200)}
                      {(skill.instructions_preview || skill.instructions).length > 200 ? "..." : ""}
                    </p>
                  </div>
                )}

                {skill.references && Object.keys(skill.references).length > 0 && (
                  <div className="mt-3 pt-3 border-t th-border">
                    <p className="text-[10px] th-text-faint uppercase tracking-wider mb-1">{t("referencesLabel")}</p>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(skill.references).map(([k]) => (
                        <span key={k} className="px-2 py-0.5 rounded text-[11px] font-mono bg-purple-400/5 text-purple-300/60 border border-purple-400/10">
                          {k}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
