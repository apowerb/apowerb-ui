"use client";

import { useTranslations } from "use-intl";

export default function SkillsList({ availableSkills, selectedSkills, onChange }) {
  const t = useTranslations("SkillsList");

  const toggle = (skillName) => {
    const current = selectedSkills || [];
    const updated = current.includes(skillName)
      ? current.filter((s) => s !== skillName)
      : [...current, skillName];
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold th-text-secondary flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        {t("title")}
      </h3>
      <p className="text-xs th-text-faint">
        {t("description")}
      </p>
      {availableSkills.length === 0 ? (
        <p className="text-xs th-text-faint italic">{t("noSkillsAvailable")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-1">
          {availableSkills.map((skill) => {
            const skillName = skill.skill_name || skill.name;
            const selected = (selectedSkills || []).includes(skillName);
            const isBuiltIn = skill.source === "portfolio" || skill.is_portfolio;
            return (
              <label
                key={skillName}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                  selected
                    ? "border-blue-500/50 bg-blue-500/10"
                    : "th-border th-bg-surface hover:th-border-hover"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggle(skillName)}
                  className="mt-0.5 rounded border-white/20 th-bg-surface text-blue-500 focus:ring-blue-500/30"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium th-text-secondary">{skillName}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      isBuiltIn
                        ? "bg-blue-500/20 text-blue-400"
                        : "bg-purple-500/20 text-purple-400"
                    }`}>
                      {isBuiltIn ? t("builtInBadge") : t("customBadge")}
                    </span>
                  </div>
                  <p className="text-xs th-text-faint mt-0.5 line-clamp-2">{skill.description}</p>
                </div>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
