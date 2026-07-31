"use client";

import {
  Plus,
  Eye,
  Edit,
  Trash2,
  AlertTriangle,
  Box,
  Search,
  Cable,
  Upload,
  GitFork,
  Brain,
  Layers,
  Repeat,
  Route,
  Cpu,
  Filter as FilterIcon,
  X as XIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "use-intl";
import { useRouter, usePathname } from "@/lib/navigation";
import EntityJumpButton from "@/components/EntityJumpButton";
import { toAgentId } from "@/lib/jumps";
import { PROVIDER_TO_TOOL_CATEGORIES } from "@/lib/providerMap";
import { DEFAULT_LLM_MODEL_ID } from "@/components/ModelSelector";

const FILTER_LABEL_KEYS = {
  uses:         "filterUses",
  cloned_from:  "filterClonedFrom",
};

/**
 * Normalize a tool_config reference (either a bare id like 42, or a
 * "tool_config42" string) to the numeric id.
 */
function normalizeToolConfigId(ref) {
  if (ref === null || ref === undefined) return null;
  const str = String(ref);
  const m = str.match(/(\d+)/);
  return m ? m[1] : null;
}

const CATEGORY_CONFIG = {
  Base:       { icon: Cpu,    gradient: "from-brand to-brand-secondary", bg: "bg-brand/10", text: "text-brand", border: "border-brand/20" },
  Sequential: { icon: Layers, gradient: "from-purple-500 to-purple-700", bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20" },
  Parallel:   { icon: GitFork, gradient: "from-blue-500 to-blue-600", bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
  Loop:       { icon: Repeat, gradient: "from-purple-500 to-purple-600", bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20" },
  Router:     { icon: Route,  gradient: "from-blue-400 to-blue-500", bg: "bg-blue-400/10", text: "text-blue-400", border: "border-blue-400/20" },
};
const DEFAULT_CATEGORY = { icon: Brain, gradient: "from-gray-500 to-gray-600", bg: "bg-gray-500/10", text: "text-gray-400", border: "border-gray-500/20" };

export default function AgentSidebar({
  agents,
  canvasOrder = [],
  categoryColors,
  toolConfigs = [],
  selectedAgentId = null,
  activeFilter = null,
  onAddAgent,
  onViewDetails,
  onEdit,
  onDoubleClick,
  onRemove,
  onConnect,
  onPublish,
}) {
  const t = useTranslations("AgentSidebar");
  const [searchTerm, setSearchTerm] = useState("");
  const canvasSet = new Set(canvasOrder);

  // Build: tool_config_id -> tool_category
  const toolConfigCategories = useMemo(() => {
    const map = new Map();
    for (const cfg of toolConfigs || []) {
      const id = normalizeToolConfigId(cfg?.tool_config_id);
      if (id && cfg?.tool_category) map.set(id, cfg.tool_category);
    }
    return map;
  }, [toolConfigs]);

  // Resolve the incoming filter into a predicate against an agent object.
  // Returns null when the filter is well-formed but not applicable
  // (e.g. unknown provider), so the UI can explain it instead of silently
  // showing everything.
  const { filterPredicate, filterStatus } = useMemo(() => {
    if (!activeFilter) return { filterPredicate: null, filterStatus: "none" };

    if (activeFilter.kind === "uses") {
      const cats = PROVIDER_TO_TOOL_CATEGORIES[activeFilter.value];
      if (!cats || cats.length === 0) {
        return { filterPredicate: null, filterStatus: "unsupported" };
      }
      const catSet = new Set(cats);
      return {
        filterPredicate: (agent) => {
          const tools = Array.isArray(agent.agent_tools) ? agent.agent_tools : [];
          for (const ref of tools) {
            const id = normalizeToolConfigId(ref);
            if (id && catSet.has(toolConfigCategories.get(id))) return true;
          }
          return false;
        },
        filterStatus: "applied",
      };
    }

    if (activeFilter.kind === "cloned_from") {
      const target = activeFilter.value;
      return {
        filterPredicate: (agent) => agent.hub_origin_id === target,
        filterStatus: "applied",
      };
    }

    return { filterPredicate: null, filterStatus: "unsupported" };
  }, [activeFilter, toolConfigCategories]);
  const router = useRouter();
  const pathname = usePathname();
  const cardRefs = useRef(new Map());

  // Scroll the selected agent into view on mount and whenever it changes
  useEffect(() => {
    if (!selectedAgentId) return;
    const el = cardRefs.current.get(selectedAgentId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [selectedAgentId]);

  const clearFilter = () => {
    router.replace(pathname);
  };

  const handleDragStart = (e, agentId) => {
    e.dataTransfer.setData("agent-id", agentId.toString());
    e.dataTransfer.effectAllowed = "copy";
  };

  const filteredAgents = agents.filter((agent) => {
    if (filterPredicate && !filterPredicate(agent)) return false;
    const term = searchTerm.toLowerCase();
    if (!term) return true;
    return (
      agent.label.toLowerCase().includes(term) ||
      agent.category.toLowerCase().includes(term)
    );
  });

  // Detect issues with an agent
  const getAgentIssues = (agent) => {
    const issues = [];
    const isOrchestrator = agent.category === "Sequential" || agent.category === "Parallel" || agent.category === "Loop" || agent.category === "Router";

    // Check for missing sub-agents references
    if (agent.subAgents && agent.subAgents.length > 0) {
      const missingSubs = agent.subAgents.filter(
        (subId) => !agents.find((a) => a.id === subId),
      );
      if (missingSubs.length > 0) {
        issues.push(t("missingSubAgents", { ids: missingSubs.join(", ") }));
      }
    }

    // Check for missing model
    if (!agent.agent_model || agent.agent_model.trim() === "") {
      issues.push(t("modelNotSet"));
    }

    // Check for missing instruction (important for base/router agents)
    if (!isOrchestrator && (!agent.agent_instruction || agent.agent_instruction.trim() === "")) {
      issues.push(t("instructionNotSet"));
    }

    // Check for missing owner
    if (!agent.owner_id || agent.owner_id.trim() === "") {
      issues.push(t("ownerNotAssigned"));
    }

    // Check if orchestrator has no sub-agents
    if (isOrchestrator && (!agent.subAgents || agent.subAgents.length === 0)) {
      issues.push(t("categoryNoSubAgents", { category: agent.category }));
    }

    // Check if Router has no sub-agents
    if (agent.category === "Router" && (!agent.subAgents || agent.subAgents.length === 0)) {
      issues.push(t("routerNoSubAgents"));
    }

    // Check for missing API key — sans objet pour le modèle mutualisé
    // thaink2, dont la clé vit côté serveur (l'agent n'en porte aucune).
    if (
      agent.agent_model !== DEFAULT_LLM_MODEL_ID &&
      (!agent.model_api_key || agent.model_api_key.trim() === "")
    ) {
      issues.push(t("apiKeyNotConfigured"));
    }

    // Check backend integrity
    if (agent.integrity_errors && agent.integrity_errors.length > 0) {
      issues.push(...agent.integrity_errors);
    }

    return issues;
  };

  return (
    <div className="w-80 flex flex-col h-full th-bg-sidebar backdrop-blur-xl border-r th-border-secondary shadow-2xl z-10 animate-fade-in relative transition-all duration-300">
      {/* Glow Effect */}
      <div className="absolute inset-y-0 left-0 w-1 bg-linear-to-b from-blue-500/50 via-purple-500/50 via-blue-400/50 to-purple-500/50 blur opacity-50" />

      {/* Header */}
      <div className="p-6 pb-4 border-b th-border-secondary">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-linear-to-br from-blue-500/20 to-purple-600/20 rounded-lg border th-border shadow-inner">
              <Box size={20} className="th-text" />
            </div>
            <h2 className="text-lg font-bold th-text tracking-wide">
              {t("title")}
            </h2>
          </div>
          <button
            onClick={onAddAgent}
            className="flex items-center gap-1.5 bg-linear-to-r from-brand to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-3 py-2 rounded-lg transition-all shadow-lg hover:shadow-blue-500/20 text-xs font-bold uppercase tracking-wider transform hover:scale-105"
          >
            <Plus size={14} />
            {t("newButton")}
          </button>
        </div>

        {/* Search */}
        <div className="relative group">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 th-text-ghost group-focus-within:th-text-secondary transition-colors"
          />
          <input
            type="text"
            placeholder={t("searchPlaceholder")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full glass-input rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none transition-all"
          />
        </div>
      </div>

      {activeFilter && (
        <div
          className={`mx-4 mt-3 flex items-center gap-2 px-3 py-2 rounded-lg border text-[11px] ${
            filterStatus === "applied"
              ? "border-brand/30 bg-brand/10"
              : "border-amber-500/30 bg-amber-500/10"
          }`}
        >
          <FilterIcon
            size={11}
            className={`shrink-0 ${
              filterStatus === "applied" ? "text-brand" : "text-amber-400"
            }`}
          />
          <span
            className={`truncate ${
              filterStatus === "applied" ? "th-text-secondary" : "text-amber-200"
            }`}
          >
            {filterStatus === "applied"
              ? <>{t("filterPrefix")} <b>{t(FILTER_LABEL_KEYS[activeFilter.kind]) || activeFilter.kind}</b>{" "}
                 <span className="th-text-muted">{activeFilter.value}</span></>
              : <>{t("unsupportedFilterPrefix")} <b>{activeFilter.raw}</b></>}
          </span>
          <span className="ml-auto th-text-faint text-[10px]">
            {filteredAgents.length}/{agents.length}
          </span>
          <button
            type="button"
            onClick={clearFilter}
            className={`shrink-0 p-1 rounded ${
              filterStatus === "applied"
                ? "hover:bg-brand/20 text-brand"
                : "hover:bg-amber-500/20 text-amber-300"
            }`}
            title={t("clearFilter")}
            aria-label={t("clearFilter")}
          >
            <XIcon size={11} />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
        {agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 th-text-ghost space-y-2">
            <Box size={32} className="opacity-20" />
            <p className="text-sm">{t("noAgentsAvailable")}</p>
          </div>
        ) : filteredAgents.length === 0 ? (
          <p className="th-text-ghost text-sm text-center mt-4">
            {t("noMatchingAgents")}
          </p>
        ) : (
          filteredAgents.map((agent) => {
            const isOnCanvas = canvasSet.has(agent.id);
            const issues = getAgentIssues(agent);
            const hasIssues = issues.length > 0;
            const cat = CATEGORY_CONFIG[agent.category] || DEFAULT_CATEGORY;
            const CatIcon = cat.icon;

            const isSelected = selectedAgentId === agent.id;
            return (
              <div
                key={agent.id}
                ref={(el) => {
                  if (el) cardRefs.current.set(agent.id, el);
                  else cardRefs.current.delete(agent.id);
                }}
                draggable={!isOnCanvas}
                onDragStart={(e) => handleDragStart(e, agent.id)}
                onDoubleClick={() => onDoubleClick && onDoubleClick(agent)}
                className={`group relative rounded-2xl border transition-all duration-300 overflow-hidden ${
                  isSelected
                    ? "border-brand bg-brand/10 shadow-lg shadow-brand/20 ring-2 ring-brand/40 cursor-grab active:cursor-grabbing"
                    : isOnCanvas
                    ? "th-border th-bg-surface opacity-50 cursor-default"
                    : hasIssues
                      ? "border-purple-400/30 bg-purple-400/5 hover:bg-purple-400/10 cursor-grab active:cursor-grabbing hover:scale-[1.02] hover:shadow-xl"
                      : "th-border th-bg-surface hover:th-bg-surface-hover hover:th-border-hover cursor-grab active:cursor-grabbing hover:scale-[1.02] hover:shadow-xl"
                }`}
              >
                {/* Colored top accent bar */}
                <div className={`h-0.5 w-full bg-linear-to-r ${cat.gradient}`} />

                <div className="p-3.5">
                  {/* Top row: avatar + info + warning */}
                  <div className="flex items-start gap-3">
                    {/* Avatar with category icon */}
                    <div className={`shrink-0 w-9 h-9 rounded-xl bg-linear-to-br ${cat.gradient} flex items-center justify-center shadow-md`}>
                      <CatIcon size={16} className="text-white" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <span className="th-text text-sm font-bold truncate block group-hover:text-brand transition-colors">
                        {agent.label}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-md ${cat.bg} ${cat.text} ${cat.border} border`}>
                          {agent.category}
                        </span>
                        {agent.subAgents && agent.subAgents.length > 0 && (
                          <span className="th-text-whisper text-[10px] flex items-center gap-0.5">
                            <GitFork size={9} /> {agent.subAgents.length}
                          </span>
                        )}
                        {agent.superagent_template_id && (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-blue-500/15 text-blue-400 rounded-md border border-blue-500/25">
                            {agent.superagent_template_id.replace(/_/g, " ")}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Warning badge */}
                    {hasIssues && (
                      <div className="relative group/tooltip shrink-0">
                        <div className="p-1 bg-purple-400/20 border border-purple-400/50 rounded-full cursor-help animate-pulse">
                          <AlertTriangle size={11} className="text-purple-300" />
                        </div>
                        <div className="absolute right-0 top-full mt-2 z-50 hidden group-hover/tooltip:block w-max max-w-56 animate-fade-in">
                          <div className="bg-zinc-900 text-zinc-100 text-xs rounded-lg p-3 shadow-2xl border border-purple-400/30">
                            <p className="font-bold text-purple-300 mb-1 flex items-center gap-1">
                              <AlertTriangle size={10} /> {t("issuesLabel")}
                            </p>
                            <ul className="list-disc list-inside space-y-0.5 th-text-secondary">
                              {issues.map((issue, i) => (
                                <li key={i} className="text-[10px]">{issue}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions bar */}
                  <div
                    className={`flex items-center justify-end gap-0.5 mt-3 pt-2.5 border-t th-border-secondary transition-all duration-200 ${isOnCanvas ? "opacity-30" : "opacity-0 group-hover:opacity-100"}`}
                  >
                    <EntityJumpButton
                      to="chat"
                      params={{ agent: toAgentId(agent.id) }}
                      title={t("chatWithAgentTooltip")}
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); onViewDetails(agent.id); }}
                      className="p-1.5 rounded-lg th-text-faint hover:text-brand hover:bg-brand/10 transition-colors"
                      title={t("viewDetailsTooltip")}
                    >
                      <Eye size={13} />
                    </button>
                    {onConnect && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onConnect(agent); }}
                        className="p-1.5 rounded-lg th-text-faint hover:text-blue-400 hover:bg-blue-400/10 transition-colors"
                        title={t("connectTooltip")}
                      >
                        <Cable size={13} />
                      </button>
                    )}
                    {onPublish && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onPublish(agent); }}
                        className="p-1.5 rounded-lg th-text-faint hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                        title={t("publishTooltip")}
                      >
                        <Upload size={13} />
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); onEdit(agent); }}
                      className="p-1.5 rounded-lg th-text-faint hover:text-purple-400 hover:bg-purple-500/10 transition-colors"
                      title={t("editTooltip")}
                    >
                      <Edit size={13} />
                    </button>
                    <div className="w-px h-4 th-border-secondary mx-0.5" />
                    <button
                      onClick={(e) => { e.stopPropagation(); onRemove(agent.id); }}
                      className="p-1.5 rounded-lg th-text-faint hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title={t("deleteTooltip")}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {isOnCanvas && (
                  <div className="absolute inset-0 flex items-center justify-center th-bg-overlay backdrop-blur-[1px] rounded-2xl pointer-events-none">
                    <span className="text-[10px] font-bold uppercase tracking-widest th-text-muted border th-border px-2.5 py-1 rounded-lg th-bg-surface shadow-sm">
                      {t("onCanvasBadge")}
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="p-4 border-t th-border-secondary text-[10px] text-center th-text-whisper">
        {t("dragDropFooter")}
      </div>
    </div>
  );
}
