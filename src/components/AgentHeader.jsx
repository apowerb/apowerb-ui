"use client";

import { ChevronDown, ChevronUp, Save } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "use-intl";

export default function AgentHeader({
  agentData,
  onChange,
  onSave,
  isSaving,
  isNew,
  availableTools = [],
}) {
  const t = useTranslations("AgentHeader");
  const [expanded, setExpanded] = useState(true);

  const handleChange = (field, value) => {
    onChange({ ...agentData, [field]: value });
  };

  return (
    <div className="th-bg-elevated border-b th-border">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-4 flex-1">
          <input
            type="text"
            value={agentData.agent_name || ""}
            onChange={(e) => handleChange("agent_name", e.target.value)}
            placeholder={t("agentNamePlaceholder")}
            className="text-2xl font-bold bg-transparent th-text border-b border-transparent hover:th-border focus:border-blue-500 focus:outline-none px-1"
          />
          <span className="text-xs px-2 py-1 rounded bg-purple-600 text-white">
            Sequential
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-brand hover:bg-brand-hover disabled:bg-blue-800 text-white rounded-lg font-semibold transition-colors"
          >
            <Save size={18} />
            {isSaving ? t("saving") : isNew ? t("create") : t("save")}
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-2 th-text-faint hover:th-text hover:th-bg-surface-hover rounded"
          >
            {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
        </div>
      </div>

      {/* Expandable Details */}
      {expanded && (
        <div className="px-6 pb-4 grid grid-cols-2 gap-4">
          {/* Left Column */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs th-text-faint mb-1">{t("modelLabel")}</label>
              <input
                type="text"
                value={agentData.agent_model || ""}
                onChange={(e) => handleChange("agent_model", e.target.value)}
                placeholder={t("modelPlaceholder")}
                className="w-full glass-input px-3 py-2 rounded focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs th-text-faint mb-1">
                {t("descriptionLabel")}
              </label>
              <textarea
                value={agentData.agent_description || ""}
                onChange={(e) =>
                  handleChange("agent_description", e.target.value)
                }
                placeholder={t("descriptionPlaceholder")}
                rows={2}
                className="w-full glass-input px-3 py-2 rounded focus:outline-none resize-none"
              />
            </div>
            <div>
              <label className="block text-xs th-text-faint mb-1">
                {t("instructionLabel")}
              </label>
              <textarea
                value={agentData.agent_instruction || ""}
                onChange={(e) =>
                  handleChange("agent_instruction", e.target.value)
                }
                placeholder={t("instructionPlaceholder")}
                rows={2}
                className="w-full glass-input px-3 py-2 rounded focus:outline-none resize-none"
              />
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs th-text-faint mb-1">{t("toolsLabel")}</label>
              <div className="flex flex-wrap gap-2 p-2 th-bg-surface rounded border th-border max-h-24 overflow-y-auto">
                {availableTools.length === 0 ? (
                  <span className="th-text-muted text-sm">
                    {t("noToolsAvailable")}
                  </span>
                ) : (
                  availableTools.map((tool) => {
                    const selected = (agentData.agent_tools || []).includes(
                      tool,
                    );
                    return (
                      <button
                        key={tool}
                        onClick={() => {
                          const current = agentData.agent_tools || [];
                          handleChange(
                            "agent_tools",
                            selected
                              ? current.filter((t) => t !== tool)
                              : [...current, tool],
                          );
                        }}
                        className={`px-2 py-1 rounded text-xs transition-colors ${
                          selected
                            ? "bg-brand text-white"
                            : "th-bg-surface-hover th-text-secondary hover:th-text"
                        }`}
                      >
                        {tool}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
