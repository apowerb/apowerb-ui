"use client";

import { useState } from "react";
import { useTranslations } from "use-intl";
import { Shield, ChevronDown, ChevronRight, Plus, X } from "lucide-react";

export default function GuardrailsSection({
  guardrailsConfig = {},
  toolConfigs = [],
  selectedTools = [],
  onChange,
}) {
  const t = useTranslations("GuardrailsSection");
  const [isOpen, setIsOpen] = useState(false);
  const config = guardrailsConfig || {};

  const blockedTerms = config.blocked_terms || [];
  const blockedTools = config.blocked_tools || [];
  const maxInputLength = config.max_input_length || "";
  const maxOutputLength = config.max_output_length || "";

  const [newTerm, setNewTerm] = useState("");
  const [newBlockedTool, setNewBlockedTool] = useState("");

  const update = (patch) => onChange({ ...config, ...patch });

  const addTerm = () => {
    if (newTerm.trim()) {
      update({ blocked_terms: [...blockedTerms, newTerm.trim()] });
      setNewTerm("");
    }
  };

  const removeTerm = (index) => {
    update({ blocked_terms: blockedTerms.filter((_, i) => i !== index) });
  };

  const addBlockedTool = () => {
    if (newBlockedTool.trim() && !blockedTools.includes(newBlockedTool.trim())) {
      update({ blocked_tools: [...blockedTools, newBlockedTool.trim()] });
      setNewBlockedTool("");
    }
  };

  const removeBlockedTool = (index) => {
    update({ blocked_tools: blockedTools.filter((_, i) => i !== index) });
  };

  // Get tool names from selected tools for the dropdown
  const availableToolNames = selectedTools.map((tool) =>
    typeof tool === "string" ? tool.split(".").pop() : tool
  );

  return (
    <div className="border th-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 th-bg-surface hover:th-bg-surface-hover transition-colors"
      >
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-red-400" />
          <span className="text-sm font-bold th-text">{t("title")}</span>
          {(blockedTerms.length > 0 || blockedTools.length > 0 || maxInputLength || maxOutputLength) && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/20 text-red-400">
              {t("activeBadge")}
            </span>
          )}
        </div>
        {isOpen ? <ChevronDown size={16} className="th-text-faint" /> : <ChevronRight size={16} className="th-text-faint" />}
      </button>

      {isOpen && (
        <div className="p-4 space-y-4 th-bg-overlay">
          {/* Blocked Terms */}
          <div>
            <label className="block text-xs font-medium th-text-muted mb-2">
              {t("blockedTermsLabel")}
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newTerm}
                onChange={(e) => setNewTerm(e.target.value)}
                placeholder={t("addBlockedTermPlaceholder")}
                className="glass-input flex-1 px-3 py-2 rounded-lg text-sm"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTerm(); } }}
              />
              <button
                type="button"
                onClick={addTerm}
                className="px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-all border border-red-500/20"
              >
                <Plus size={14} />
              </button>
            </div>
            {blockedTerms.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {blockedTerms.map((term, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-red-500/15 text-red-400 border border-red-500/20">
                    {term}
                    <button type="button" onClick={() => removeTerm(i)} className="hover:text-red-300">
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Max Lengths */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium th-text-muted mb-2">
                {t("maxInputLengthLabel")}
              </label>
              <input
                type="number"
                value={maxInputLength}
                onChange={(e) => update({ max_input_length: e.target.value ? parseInt(e.target.value) : null })}
                placeholder={t("noLimitPlaceholder")}
                className="glass-input w-full px-3 py-2 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium th-text-muted mb-2">
                {t("maxOutputLengthLabel")}
              </label>
              <input
                type="number"
                value={maxOutputLength}
                onChange={(e) => update({ max_output_length: e.target.value ? parseInt(e.target.value) : null })}
                placeholder={t("noLimitPlaceholder")}
                className="glass-input w-full px-3 py-2 rounded-lg text-sm"
              />
            </div>
          </div>

          {/* Blocked Tools */}
          <div>
            <label className="block text-xs font-medium th-text-muted mb-2">
              {t("blockedToolsLabel")}
            </label>
            <div className="flex gap-2 mb-2">
              {availableToolNames.length > 0 ? (
                <select
                  value={newBlockedTool}
                  onChange={(e) => setNewBlockedTool(e.target.value)}
                  className="glass-input flex-1 px-3 py-2 rounded-lg text-sm"
                >
                  <option value="" className="th-bg-modal">{t("selectToolToBlockOption")}</option>
                  {availableToolNames.filter((tool) => !blockedTools.includes(tool)).map((tool) => (
                    <option key={tool} value={tool} className="th-bg-modal">{tool}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={newBlockedTool}
                  onChange={(e) => setNewBlockedTool(e.target.value)}
                  placeholder={t("toolNamePlaceholder")}
                  className="glass-input flex-1 px-3 py-2 rounded-lg text-sm"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addBlockedTool(); } }}
                />
              )}
              <button
                type="button"
                onClick={addBlockedTool}
                className="px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-all border border-red-500/20"
              >
                <Plus size={14} />
              </button>
            </div>
            {blockedTools.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {blockedTools.map((tool, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-purple-500/15 text-purple-400 border border-purple-500/20">
                    {tool}
                    <button type="button" onClick={() => removeBlockedTool(i)} className="hover:text-purple-300">
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
