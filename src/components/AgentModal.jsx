"use client";

import { useEffect } from "react";
import { useTranslations } from "use-intl";
import { X, Sparkles, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import ChooseTemplateStep from "./agent-modal/ChooseTemplateStep";
import AgentFormStep from "./agent-modal/AgentFormStep";
import {
  useAgentModalState,
  getAvailableSubAgents,
  wouldCreateCircularRef,
} from "./agent-modal/useAgentModalState";

const CATEGORY_COLORS = {
  Base: "from-blue-500/80 to-brand/80",
  Parallel: "from-blue-500/80 to-blue-600/80",
  Sequential: "from-purple-500/80 to-purple-600/80",
  Loop: "from-purple-500/80 to-purple-600/80",
  Router: "from-blue-400/80 to-blue-500/80",
};

const CATEGORY_MAP = {
  base: "Base",
  sequential: "Sequential",
  parallel: "Parallel",
  loop: "Loop",
  router: "Router",
};

export default function AgentModal({
  show,
  editingAgent,
  newAgent,
  setNewAgent,
  boxes,
  categories,
  toolConfigs = [],
  onClose,
  onSave,
  onToast,
  onRefreshTools,
  mcpConfigs = [],
}) {
  const { user } = useAuth();
  const modalRef = useFocusTrap(show);
  const t = useTranslations("AgentModal");

  const {
    step, setStep,
    templates,
    loadingTemplates,
    templateNativeTools, setTemplateNativeTools,
    readme, setReadme,
    readmeExpanded, setReadmeExpanded,
    availableSkills,
    showApiKey, setShowApiKey,
    outlookConnected, setOutlookConnected,
    outlookLoading, setOutlookLoading,
    toolConfigConflicts,
  } = useAgentModalState({
    show,
    editingAgent,
    newAgent,
    setNewAgent,
    toolConfigs,
    user,
    onRefreshTools,
  });

  useEffect(() => {
    function handleEscape(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  if (!show) return null;

  const gradient = CATEGORY_COLORS[newAgent.category] || "from-gray-500/80 to-gray-600/80";
  const availableAgents = getAvailableSubAgents(boxes, newAgent, editingAgent);

  const handleSubAgentToggle = (agentId) => {
    if (newAgent.subAgents.includes(agentId)) {
      setNewAgent((prev) => ({
        ...prev,
        subAgents: prev.subAgents.filter((id) => id !== agentId),
      }));
      return;
    }

    if (wouldCreateCircularRef(boxes, agentId, editingAgent)) {
      onToast?.(t("circularRefError"));
      return;
    }
    if (
      ["Sequential", "Parallel"].includes(newAgent.category) &&
      newAgent.subAgents.length >= 6
    ) {
      onToast?.(t("maxSubAgentsError"));
      return;
    }

    const targetAgent = boxes.find((b) => b.id === agentId);
    if (targetAgent) {
      const orchestratorTypes = ["Sequential", "Parallel", "Loop", "Router"];
      const isCurrentOrchestrator = orchestratorTypes.includes(newAgent.category);
      const isTargetOrchestrator = orchestratorTypes.includes(targetAgent.category);
      if (isCurrentOrchestrator && isTargetOrchestrator) {
        const hasNestedOrchestrators = (targetAgent.subAgents || []).some((subId) => {
          const sub = boxes.find((b) => b.id === subId);
          return sub && orchestratorTypes.includes(sub.category);
        });
        if (hasNestedOrchestrators) {
          onToast?.(t("maxNestingError"));
          return;
        }
      }
    }
    setNewAgent((prev) => ({ ...prev, subAgents: [...prev.subAgents, agentId] }));
  };

  const moveSubAgentUp = (index) => {
    if (index === 0) return;
    const arr = [...newAgent.subAgents];
    [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
    setNewAgent((prev) => ({ ...prev, subAgents: arr }));
  };

  const moveSubAgentDown = (index) => {
    if (index === newAgent.subAgents.length - 1) return;
    const arr = [...newAgent.subAgents];
    [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
    setNewAgent((prev) => ({ ...prev, subAgents: arr }));
  };

  const handleDragStart = (e, index) => {
    e.dataTransfer.setData("subagent-index", index.toString());
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData("subagent-index"), 10);
    if (isNaN(fromIndex) || fromIndex === index) return;
    const arr = [...newAgent.subAgents];
    const dragged = arr[fromIndex];
    arr.splice(fromIndex, 1);
    arr.splice(index, 0, dragged);
    setNewAgent((prev) => ({ ...prev, subAgents: arr }));
    e.dataTransfer.setData("subagent-index", index.toString());
  };

  const handleSelectTemplate = (template) => {
    const recommended = template.recommended_tools || [];
    setNewAgent((prev) => ({
      ...prev,
      name: template.name || "",
      category: CATEGORY_MAP[template.category] || "Base",
      agent_model: template.agent_model || "",
      agent_description: template.agent_description || template.description || "",
      agent_instruction: template.agent_instruction || "",
      agent_tools: [],
      memory_enabled: template.memory_enabled || false,
      artifacts_enabled: template.artifacts_enabled || false,
      guardrails_config: template.guardrails_config || null,
      superagent_template_id: template.template_id || null,
      template_model_params: template.agent_model_params || null,
      tags: template.tags || [],
      agent_skills: template.agent_skills || [],
      // Templates can declare they need a OneDrive file path. The form step
      // surfaces a file picker and we substitute the placeholder in the
      // instruction right before the create call.
      requires_onedrive_file: !!template.requires_onedrive_file,
      onedrive_placeholder: template.onedrive_placeholder || "<ITEM_PATH>",
      email_column_placeholder:
        template.email_column_placeholder || "<EMAIL_COLUMN>",
      onedrive_file: null,
    }));
    setTemplateNativeTools(recommended);
    setReadme(template.readme || "");
    setReadmeExpanded(false);
    setStep("form");
  };

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
        aria-labelledby="agent-modal-title"
        className="relative w-full max-w-2xl mx-4 animate-scale-up-center max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`absolute -inset-1 bg-linear-to-r ${gradient} rounded-2xl blur-lg opacity-40 animate-pulse`}
        />

        <div className="relative flex flex-col glass-modal rounded-2xl shadow-2xl overflow-hidden h-full">
          {/* Header */}
          <div className={`shrink-0 h-28 bg-linear-to-br ${gradient} p-6 relative overflow-hidden`}>
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/20 rounded-full blur-3xl" />
            <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-white/20 rounded-full blur-2xl" />
            <div className="relative flex justify-between items-start z-10">
              <div className="flex items-center gap-3">
                {!editingAgent && step === "form" && (
                  <button
                    onClick={() => setStep("choose")}
                    className="p-2 bg-white/20 hover:bg-black/40 backdrop-blur-md rounded-xl border border-white/20 shadow-lg transition-all"
                    title={t("backToTemplate")}
                  >
                    <ArrowRight size={24} className="text-white rotate-180" />
                  </button>
                )}
                <div className="p-2 bg-white/20 backdrop-blur-md rounded-xl border border-white/20 shadow-lg">
                  <Sparkles size={24} className="text-white" />
                </div>
                <div>
                  <h2 id="agent-modal-title" className="text-2xl font-black text-white tracking-tight drop-shadow-md">
                    {editingAgent ? t("editTitle") : t("createTitle")}
                  </h2>
                  <p className="text-white/70 text-sm font-medium">
                    {step === "choose" ? t("chooseStartingPoint") : t("configureParams")}
                  </p>
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

          {step === "choose" && (
            <ChooseTemplateStep
              templates={templates}
              loadingTemplates={loadingTemplates}
              onFromScratch={() => setStep("form")}
              onSelectTemplate={handleSelectTemplate}
            />
          )}

          {step === "form" && (
            <AgentFormStep
              newAgent={newAgent}
              setNewAgent={setNewAgent}
              categories={categories}
              boxes={boxes}
              editingAgent={editingAgent}
              toolConfigs={toolConfigs}
              mcpConfigs={mcpConfigs}
              availableAgents={availableAgents}
              onSubAgentToggle={handleSubAgentToggle}
              onMoveSubAgentUp={moveSubAgentUp}
              onMoveSubAgentDown={moveSubAgentDown}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              templateNativeTools={templateNativeTools}
              toolConfigConflicts={toolConfigConflicts}
              outlookConnected={outlookConnected}
              outlookLoading={outlookLoading}
              setOutlookConnected={setOutlookConnected}
              setOutlookLoading={setOutlookLoading}
              onRefreshTools={onRefreshTools}
              onToast={onToast}
              user={user}
              readme={readme}
              readmeExpanded={readmeExpanded}
              setReadmeExpanded={setReadmeExpanded}
              availableSkills={availableSkills}
              showApiKey={showApiKey}
              setShowApiKey={setShowApiKey}
            />
          )}

          {/* Footer Actions */}
          {step === "form" && (
            <div className="shrink-0 p-6 th-bg-surface border-t th-border-secondary flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="glass-btn flex-1 px-4 py-3 border th-border th-text-secondary rounded-xl hover:th-bg-surface hover:th-text font-semibold transition-all"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                // Prevent mousedown from stealing focus before the active
                // input fires its onChange / commits its value. Without this,
                // clicking Save right after typing in "Name" reads a stale
                // newAgent and you need to click twice.
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  // Commit any pending input changes before reading state.
                  if (document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur();
                  }
                  onSave?.(e);
                }}
                className={`glass-btn flex-1 px-4 py-3 text-white rounded-xl font-bold transition-all shadow-lg hover:scale-[1.02] active:scale-[0.98] bg-linear-to-r ${gradient}`}
              >
                {editingAgent ? t("saveChanges") : t("createTitle")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
