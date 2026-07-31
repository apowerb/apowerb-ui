"use client";

import React from "react";
import { Plus, Zap, Trash2 } from "lucide-react";
import { useTranslations } from "use-intl";

/**
 * Modal form for creating or editing a custom skill.
 * Shown when `show` is true. References are edited as a key/value list.
 */
export default function SkillModal({
  show,
  editingSkill,
  newSkill, setNewSkill,
  onClose,
  onSave,
}) {
  const t = useTranslations("SkillModal");
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4 th-bg-modal border border-purple-400/20 rounded-2xl shadow-2xl shadow-purple-400/10">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-5 border-b th-border th-bg-modal/95 backdrop-blur-sm rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-400/10">
              <Zap size={20} className="text-purple-300" />
            </div>
            <h2 className="text-lg font-bold th-text">
              {editingSkill ? t("editTitle") : t("createTitle")}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 th-text-muted hover:th-text transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs th-text-muted mb-1.5 font-medium">{t("skillNameLabel")}</label>
              <input
                type="text"
                placeholder={t("skillNamePlaceholder")}
                value={newSkill.skill_name}
                onChange={(e) => setNewSkill((p) => ({ ...p, skill_name: e.target.value }))}
                className="w-full px-3 py-2.5 th-bg-surface border th-border rounded-lg text-sm th-text font-mono placeholder-[var(--text-faint)] focus:outline-none focus:border-purple-400/50 focus:ring-1 focus:ring-purple-400/30 transition-all"
              />
              <p className="text-[10px] th-text-faint mt-1">{t("skillNameHint")}</p>
            </div>
            <div>
              <label className="block text-xs th-text-muted mb-1.5 font-medium">{t("descriptionLabel")}</label>
              <textarea
                placeholder={t("descriptionPlaceholder")}
                value={newSkill.description}
                onChange={(e) => setNewSkill((p) => ({ ...p, description: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2.5 th-bg-surface border th-border rounded-lg text-sm th-text placeholder-[var(--text-faint)] focus:outline-none focus:border-purple-400/50 focus:ring-1 focus:ring-purple-400/30 transition-all resize-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs th-text-muted mb-1.5 font-medium">{t("instructionsLabel")}</label>
            <textarea
              placeholder={t("instructionsPlaceholder")}
              value={newSkill.instructions}
              onChange={(e) => setNewSkill((p) => ({ ...p, instructions: e.target.value }))}
              rows={10}
              className="w-full px-3 py-2.5 th-bg-surface border th-border rounded-lg text-sm th-text placeholder-[var(--text-faint)] focus:outline-none focus:border-purple-400/50 focus:ring-1 focus:ring-purple-400/30 transition-all resize-y font-mono"
            />
          </div>

          {/* References — key-value pairs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs th-text-muted font-medium">{t("referencesLabel")}</label>
              <button
                type="button"
                onClick={() => {
                  const key = `ref_${Object.keys(newSkill.references).length + 1}`;
                  setNewSkill((p) => ({ ...p, references: { ...p.references, [key]: "" } }));
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-purple-400/10 hover:bg-purple-400/20 text-purple-300 border border-purple-400/20 transition-all"
              >
                <Plus size={10} /> {t("addReference")}
              </button>
            </div>
            {Object.keys(newSkill.references).length > 0 && (
              <div className="space-y-2">
                {Object.entries(newSkill.references).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder={t("referenceNamePlaceholder")}
                      value={key}
                      onChange={(e) => {
                        const newRefs = { ...newSkill.references };
                        const val = newRefs[key];
                        delete newRefs[key];
                        newRefs[e.target.value] = val;
                        setNewSkill((p) => ({ ...p, references: newRefs }));
                      }}
                      className="flex-1 px-3 py-2 th-bg-surface border th-border rounded-lg text-xs th-text font-mono placeholder-[var(--text-faint)] focus:outline-none focus:border-purple-400/50 transition-all"
                    />
                    <input
                      type="text"
                      placeholder={t("referenceContentPlaceholder")}
                      value={value}
                      onChange={(e) => {
                        setNewSkill((p) => ({
                          ...p,
                          references: { ...p.references, [key]: e.target.value },
                        }));
                      }}
                      className="flex-[2] px-3 py-2 th-bg-surface border th-border rounded-lg text-xs th-text font-mono placeholder-[var(--text-faint)] focus:outline-none focus:border-purple-400/50 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const newRefs = { ...newSkill.references };
                        delete newRefs[key];
                        setNewSkill((p) => ({ ...p, references: newRefs }));
                      }}
                      className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* is_public checkbox */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={newSkill.is_public}
              onChange={(e) => setNewSkill((p) => ({ ...p, is_public: e.target.checked }))}
              className="rounded th-border th-bg-surface text-purple-400 focus:ring-purple-400/30"
            />
            <span className="text-xs th-text-secondary">{t("makePublicLabel")}</span>
          </label>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-end gap-3 p-5 border-t th-border th-bg-modal/95 backdrop-blur-sm rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-5 py-2.5 th-bg-surface hover:bg-white/10 th-text-secondary rounded-lg text-sm font-semibold border th-border transition-all"
          >
            {t("cancel")}
          </button>
          <button
            onClick={onSave}
            disabled={!newSkill.skill_name || !newSkill.instructions}
            className="px-6 py-2.5 bg-purple-400 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-black rounded-lg text-sm font-bold transition-all shadow-lg shadow-purple-400/20"
          >
            {editingSkill ? t("updateSkill") : t("createSkill")}
          </button>
        </div>
      </div>
    </div>
  );
}
