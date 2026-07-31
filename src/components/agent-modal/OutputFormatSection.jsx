"use client";

import { useState } from "react";
import { useTranslations } from "use-intl";
import { FileCode, ChevronDown, ChevronRight } from "lucide-react";

export default function OutputFormatSection({ outputSchema, onChange }) {
  const t = useTranslations("OutputFormatSection");
  const [isOpen, setIsOpen] = useState(false);
  const schema = outputSchema || {};
  const hasConfig = !!schema.instruction;

  const mode = "instruction" in schema ? "instruction" : "none";

  const handleModeChange = (newMode) => {
    if (newMode === "none") {
      onChange(null);
    } else {
      onChange({ instruction: schema.instruction || "" });
    }
  };

  return (
    <div className="border th-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 th-bg-surface hover:th-bg-surface-hover transition-colors"
      >
        <div className="flex items-center gap-2">
          <FileCode size={16} className="text-purple-400" />
          <span className="text-sm font-bold th-text">{t("title")}</span>
          {hasConfig && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-400/20 text-purple-400">
              {t("activeBadge")}
            </span>
          )}
        </div>
        {isOpen ? <ChevronDown size={16} className="th-text-faint" /> : <ChevronRight size={16} className="th-text-faint" />}
      </button>

      {isOpen && (
        <div className="p-4 space-y-4 th-bg-overlay">
          <div className="flex gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="output_format_mode"
                checked={mode === "none"}
                onChange={() => handleModeChange("none")}
                className="accent-purple-500"
              />
              <span className="text-sm th-text-secondary">{t("noneOption")}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="output_format_mode"
                checked={mode === "instruction"}
                onChange={() => handleModeChange("instruction")}
                className="accent-purple-500"
              />
              <span className="text-sm th-text-secondary">{t("customInstructionOption")}</span>
            </label>
          </div>

          {mode === "instruction" && (
            <div>
              <label className="block text-xs font-medium th-text-muted mb-2">
                {t("outputInstructionLabel")}
              </label>
              <textarea
                value={schema.instruction || ""}
                onChange={(e) => onChange({ ...schema, instruction: e.target.value })}
                placeholder={t("outputInstructionPlaceholder")}
                rows={3}
                className="glass-input w-full px-3 py-2 rounded-lg text-sm resize-none"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
