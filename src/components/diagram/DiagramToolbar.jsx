"use client";

/**
 * DiagramToolbar — the row at the top of the active tab: agent name input,
 * agent-type selector, Save/Create button and the expand/collapse chevron
 * for the header panel.
 */

import { ChevronDown, ChevronUp, Save } from "lucide-react";
import { useTranslations } from "use-intl";

export default function DiagramToolbar({
  agentData,
  updateAgentData,
  onSave,
  isSaving,
  isNewTab,
  expandedHeader,
  setExpandedHeader,
}) {
  const t = useTranslations("DiagramToolbar");
  const agentType = agentData.agent_type || "sequential";
  const typeClass =
    agentType === "parallel"
      ? "bg-blue-600"
      : agentType === "loop"
        ? "bg-purple-600"
        : agentType === "router"
          ? "bg-blue-500"
          : agentType === "base"
            ? "bg-brand"
            : "bg-purple-600";

  return (
    <div className="flex items-center justify-between px-4 py-2">
      <div className="flex items-center gap-3 flex-1">
        <input
          type="text"
          value={agentData.agent_name || ""}
          onChange={(e) =>
            updateAgentData({ ...agentData, agent_name: e.target.value })
          }
          placeholder={t("agentNamePlaceholder")}
          className="text-xl font-bold bg-transparent th-text border-b border-transparent hover:th-border-hover focus:border-brand/60 focus:outline-none px-1 transition-colors"
        />
        <select
          value={agentType}
          onChange={(e) =>
            updateAgentData({ ...agentData, agent_type: e.target.value })
          }
          className={`text-xs px-2 py-1 rounded text-white cursor-pointer border-none focus:outline-none ${typeClass}`}
        >
          <option value="base">{t("typeBase")}</option>
          <option value="sequential">{t("typeSequential")}</option>
          <option value="parallel">{t("typeParallel")}</option>
          <option value="loop">{t("typeLoop")}</option>
          <option value="router">{t("typeRouter")}</option>
        </select>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onSave}
          disabled={isSaving}
          className="glass-btn flex items-center gap-2 px-4 py-2 bg-linear-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 disabled:opacity-40 text-white rounded-xl font-semibold transition-all text-sm shadow-lg shadow-purple-500/20"
        >
          <Save size={16} />
          {isSaving ? "..." : isNewTab ? t("createAction") : t("saveAction")}
        </button>
        <button
          onClick={() => setExpandedHeader(!expandedHeader)}
          className="p-1.5 th-text-ghost hover:th-text hover:th-bg-surface-hover rounded-lg transition-all"
        >
          {expandedHeader ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>
    </div>
  );
}
