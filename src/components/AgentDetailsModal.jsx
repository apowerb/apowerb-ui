"use client";

import { useEffect } from "react";
import { useTranslations } from "use-intl";
import { X, Eye, Activity, Box, Layers, PlayCircle, Cpu, FileText, MessageSquare } from "lucide-react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

export default function AgentDetailsModal({
  agent,
  boxes,
  onClose,
  onViewSubAgent,
}) {
  const modalRef = useFocusTrap(!!agent);
  const t = useTranslations("AgentDetailsModal");

  useEffect(() => {
    function handleEscape(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  if (!agent) return null;

  const categoryColors = {
    Base: "from-blue-500/80 to-brand/80",
    Parallel: "from-blue-500/80 to-blue-600/80",
    Sequential: "from-purple-500/80 to-purple-600/80",
    Loop: "from-purple-500/80 to-purple-600/80",
  };

  const gradient =
    categoryColors[agent.category] || "from-gray-500/80 to-gray-600/80";

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[40] perspective-1000"
      onClick={onClose}
    >
      <div className="absolute inset-0 th-bg-overlay backdrop-blur-md animate-fade-in" />

      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="agent-details-modal-title"
        className="relative w-full max-w-2xl mx-4 animate-scale-up-center max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`absolute -inset-1 bg-linear-to-r ${gradient} rounded-2xl blur-lg opacity-40 animate-breathe`}
        />

        <div className="relative flex flex-col glass-modal rounded-2xl shadow-2xl overflow-hidden">
          <div
            className={`h-32 bg-linear-to-br ${gradient} p-8 relative overflow-hidden`}
          >
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/20 rounded-full blur-3xl" />
            <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-white/20 rounded-full blur-2xl" />

            <div className="relative flex justify-between items-start z-10">
              <div>
                <h2 id="agent-details-modal-title" className="text-3xl font-black text-white tracking-tight drop-shadow-md">
                  {agent.label}
                </h2>
                <div className="flex items-center gap-2 mt-2">
                  <span className="bg-black/30 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold text-white/90 border border-white/20 uppercase tracking-wider">
                    {agent.category}
                  </span>
                  <span className="text-white/60 text-sm flex items-center gap-1">
                    <Box size={14} />
                    {t("idPrefix")} {agent.id}
                  </span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="bg-white/20 hover:bg-black/40 text-white/80 hover:text-white p-2 rounded-full transition-all backdrop-blur-sm border border-white/20 ring-1 ring-transparent hover:ring-white/20"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-6">
            {/* Grid Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="th-bg-surface border th-border-secondary rounded-xl p-4 hover:th-bg-surface-hover transition-colors group">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-blue-500/20 rounded-lg text-brand group-hover:scale-110 transition-transform">
                    <Activity size={18} />
                  </div>
                  <h3 className="text-sm font-medium th-text-muted">{t("statusLabel")}</h3>
                </div>
                <p className="text-xl font-semibold th-text">{t("activeStatus")}</p>
              </div>
              <div className="th-bg-surface border th-border-secondary rounded-xl p-4 hover:th-bg-surface-hover transition-colors group">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400 group-hover:scale-110 transition-transform">
                    <Layers size={18} />
                  </div>
                  <h3 className="text-sm font-medium th-text-muted">
                    {t("subAgentsLabel")}
                  </h3>
                </div>
                <p className="text-xl font-semibold th-text">
                  {agent.subAgents?.length || 0}
                </p>
              </div>
              <div className="th-bg-surface border th-border-secondary rounded-xl p-4 hover:th-bg-surface-hover transition-colors group">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-blue-400/20 rounded-lg text-blue-400 group-hover:scale-110 transition-transform">
                    <Cpu size={18} />
                  </div>
                  <h3 className="text-sm font-medium th-text-muted">{t("modelLabel")}</h3>
                </div>
                <p className="text-sm font-semibold th-text truncate" title={agent.agent_model}>
                  {agent.agent_model || t("notSet")}
                </p>
              </div>
            </div>

            {/* Description */}
            {agent.agent_description && (
              <div className="th-bg-overlay rounded-xl border th-border-secondary p-5">
                <h3 className="th-text-secondary font-semibold mb-3 flex items-center gap-2">
                  <FileText size={16} className="text-blue-400" />
                  {t("descriptionHeading")}
                </h3>
                <p className="th-text-muted text-sm leading-relaxed">
                  {agent.agent_description}
                </p>
              </div>
            )}

            {/* Instructions */}
            {agent.agent_instruction && (
              <div className="th-bg-overlay rounded-xl border th-border-secondary p-5">
                <h3 className="th-text-secondary font-semibold mb-3 flex items-center gap-2">
                  <MessageSquare size={16} className="text-purple-400" />
                  {t("instructionsHeading")}
                </h3>
                <pre className="th-text-muted text-sm leading-relaxed whitespace-pre-wrap font-sans max-h-60 overflow-y-auto custom-scrollbar">
                  {agent.agent_instruction}
                </pre>
              </div>
            )}

            {/* Content Area */}
            <div className="space-y-4">
              {/* Tools */}
              <div className="th-bg-overlay rounded-xl border th-border-secondary p-5">
                <h3 className="th-text-secondary font-semibold mb-3 flex items-center gap-2">
                  <PlayCircle size={16} className="text-blue-400" />
                  {t("toolsHeading")}
                </h3>
                {agent.agent_tools && agent.agent_tools.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {agent.agent_tools.map((tool, i) => (
                      <span
                        key={i}
                        className="px-3 py-1.5 bg-blue-500/10 text-blue-400 text-xs font-mono rounded-lg border border-blue-500/20"
                      >
                        {tool}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="th-text-faint text-sm italic">{t("noToolsConfigured")}</p>
                )}
              </div>

              {/* Behavior */}
              <div className="th-bg-overlay rounded-xl border th-border-secondary p-5">
                <h3 className="th-text-secondary font-semibold mb-3">{t("behaviorHeading")}</h3>
                <p className="th-text-muted text-sm leading-relaxed">
                  {agent.category === "Base" && t("behaviorBase")}
                  {agent.category === "Parallel" && t("behaviorParallel")}
                  {agent.category === "Sequential" && t("behaviorSequential")}
                  {agent.category === "Loop" && t("behaviorLoop")}
                </p>
              </div>
            </div>

            {/* Sub-agents List */}
            {agent.subAgents && agent.subAgents.length > 0 && (
              <div className="pt-2">
                <h3 className="th-text-muted text-xs font-semibold uppercase tracking-wider mb-3 ml-1">
                  {t("subAgentsSequenceHeading")}
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                  {agent.subAgents.map((subId, index) => {
                    const subAgent = boxes.find((b) => b.id === subId);
                    if (!subAgent) return null;
                    return (
                      <div
                        key={subId}
                        className="group flex items-center justify-between th-bg-surface hover:th-bg-surface-hover border th-border-secondary hover:th-border-hover rounded-lg p-3 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 flex items-center justify-center th-bg-surface-hover rounded-full text-xs font-mono th-text-faint group-hover:bg-white/20 group-hover:th-text">
                            {index + 1}
                          </span>
                          <div>
                            <p className="text-sm font-medium th-text group-hover:text-blue-300 transition-colors">
                              {subAgent.label}
                            </p>
                            <p className="text-xs th-text-faint">
                              {subAgent.category}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => onViewSubAgent(subId)}
                          className="p-2 rounded-lg th-text-ghost hover:th-text hover:th-bg-surface-hover transition-all opacity-0 group-hover:opacity-100"
                          title={t("viewAgentTooltip")}
                        >
                          <Eye size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="p-6 th-bg-surface border-t th-border-secondary flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2.5 th-bg-surface hover:th-bg-surface-hover th-text rounded-lg font-medium transition-all hover:scale-[1.02] active:scale-95 border th-border-secondary hover:th-border-hover backdrop-blur-sm"
            >
              {t("closeDetails")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
