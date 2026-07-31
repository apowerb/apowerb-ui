"use client";

import { useTranslations } from "use-intl";
import {
  Box,
  Layers,
  Brain,
  ChevronRight,
  ChevronDown,
  FileCode,
  BookOpen,
  Eye,
  EyeOff,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import SavedApiKeySelector from "../SavedApiKeySelector";
import ModelSelector, { DEFAULT_LLM_MODEL_ID } from "../ModelSelector";
import { MASKED_API_KEY } from "@/lib/apiKeyMask";
import GuardrailsSection from "./GuardrailsSection";
import OutputFormatSection from "./OutputFormatSection";
import McpServersSection from "./McpServersSection";
import DatabaseConnectionSection from "./DatabaseConnectionSection";
import ToolsSection from "./ToolsSection";
import SubAgentsPicker from "./SubAgentsPicker";
import LoopConfigBlock from "./LoopConfigBlock";
import SkillsList from "./SkillsList";
import OneDriveFileField from "./OneDriveFileField";
import TemplateDriftBanner from "./TemplateDriftBanner";

const CATEGORY_BORDER = {
  Base: "border-brand/40",
  Sequential: "border-purple-400/40",
  Parallel: "border-blue-400/40",
  Loop: "border-purple-400/40",
  Router: "border-blue-400/40",
};

/**
 * The "form" step of AgentModal — renders all configuration fields for an agent.
 */
export default function AgentFormStep({
  newAgent,
  setNewAgent,
  categories,
  boxes,
  editingAgent,
  toolConfigs,
  mcpConfigs,
  availableAgents,
  onSubAgentToggle,
  onMoveSubAgentUp,
  onMoveSubAgentDown,
  onDragStart,
  onDragOver,
  templateNativeTools,
  toolConfigConflicts,
  outlookConnected,
  outlookLoading,
  setOutlookConnected,
  setOutlookLoading,
  onRefreshTools,
  onToast,
  user,
  readme,
  readmeExpanded,
  setReadmeExpanded,
  availableSkills,
  showApiKey,
  setShowApiKey,
}) {
  const t = useTranslations("AgentFormStep");

  // Modèle mutualisé : ni clé ni configuration enregistrée à présenter.
  const usesDefaultLlm = newAgent.agent_model === DEFAULT_LLM_MODEL_ID;
  // Clé déjà enregistrée côté serveur : l'API renvoie le masque, pas la valeur.
  const hasStoredApiKey = newAgent.model_api_key === MASKED_API_KEY;

  const CATEGORY_DESCRIPTION = {
    Base: t("categoryDescBase"),
    Parallel: t("categoryDescParallel"),
    Sequential: t("categoryDescSequential"),
    Loop: t("categoryDescLoop"),
    Router: t("categoryDescRouter"),
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-6">
      {/* Template drift banner — only renders when an agent is being
          edited (editingAgent has an id) AND its source template has
          drifted since creation. No-op in create mode. */}
      {editingAgent?.agent_id && (
        <TemplateDriftBanner
          agentId={editingAgent.agent_id}
          onResynced={(updated) => {
            if (typeof onRefreshTools === "function") {
              onRefreshTools();
            }
            if (typeof onToast === "function") {
              onToast({
                type: "success",
                message: t("agentResyncedToast", { templateId: updated.template_id }),
              });
            }
          }}
        />
      )}

      {/* Readme Panel */}
      {readme && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 overflow-hidden">
          <button
            type="button"
            onClick={() => setReadmeExpanded(!readmeExpanded)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-100/60 transition-colors"
          >
            <div className="flex items-center gap-2">
              <BookOpen size={16} className="text-blue-600" />
              <span className="text-sm font-semibold text-blue-800">{t("howToUseThisAgent")}</span>
            </div>
            {readmeExpanded
              ? <ChevronDown size={16} className="text-blue-400" />
              : <ChevronRight size={16} className="text-blue-400" />
            }
          </button>
          {readmeExpanded && (
            <div className="px-4 pb-4">
              <div className="prose prose-sm prose-blue max-w-none text-gray-700
                prose-headings:text-blue-900 prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-1
                prose-p:my-1 prose-ul:my-1 prose-li:my-0
                prose-strong:text-blue-800
                prose-code:bg-blue-100 prose-code:text-blue-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{readme}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Agent Name */}
      <div>
        <label className="block text-sm font-medium th-text-muted mb-2 pl-1">
          {t("agentNameLabel")} <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={newAgent.name}
          onChange={(e) => setNewAgent((prev) => ({ ...prev, name: e.target.value }))}
          placeholder={t("agentNamePlaceholder")}
          className="glass-input w-full px-4 py-3 rounded-xl focus:ring-2 focus:ring-white/20"
        />
      </div>

      {/* OneDrive file (only when the selected template declares one) */}
      {newAgent.requires_onedrive_file && (
        <OneDriveFileField
          value={newAgent.onedrive_file}
          onChange={(file) =>
            setNewAgent((prev) => ({ ...prev, onedrive_file: file }))
          }
        />
      )}

      {/* Category */}
      <div>
        <label className="block text-sm font-medium th-text-muted mb-2 pl-1">
          {t("categoryLabel")} <span className="text-red-400">*</span>
        </label>
        <div className="relative">
          <select
            value={newAgent.category}
            onChange={(e) =>
              setNewAgent((prev) => ({ ...prev, category: e.target.value, subAgents: [] }))
            }
            className={`glass-input w-full px-4 py-3 rounded-xl appearance-none cursor-pointer ${CATEGORY_BORDER[newAgent.category] || ""}`}
          >
            <option value="" className="th-bg-modal th-text">{t("selectCategoryOption")}</option>
            {categories.map((cat) => (
              <option key={cat} value={cat} className="th-bg-modal th-text">{cat}</option>
            ))}
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/50">
            <Layers size={16} />
          </div>
        </div>
        {newAgent.category && (
          <div className="mt-3 p-3 rounded-lg border th-border-secondary th-bg-surface text-xs th-text-secondary flex items-start gap-2">
            <Box size={14} className="mt-0.5 shrink-0" />
            <p>{CATEGORY_DESCRIPTION[newAgent.category]}</p>
          </div>
        )}
      </div>

      {/* Loop Configuration */}
      {newAgent.category === "Loop" && (
        <LoopConfigBlock newAgent={newAgent} setNewAgent={setNewAgent} />
      )}

      {/* Saved API Key — sans objet pour le modèle mutualisé thaink2 */}
      <div className={usesDefaultLlm ? "hidden" : undefined}>
        <label className="block text-sm font-medium th-text-muted mb-2 pl-1">{t("savedConfigurationLabel")}</label>
        <SavedApiKeySelector
          currentValue={newAgent.model_api_key || ""}
          currentModel={newAgent.agent_model || ""}
          currentModelApiBase={newAgent.template_model_params?.model_api_base || ""}
          onSelect={(selection) =>
            setNewAgent((prev) => {
              const update = { ...prev, model_api_key: selection.api_key_value };
              if (selection.model) update.agent_model = selection.model;
              if (selection.model_api_base) {
                update.template_model_params = {
                  ...(prev.template_model_params || {}),
                  model_api_base: selection.model_api_base,
                };
              }
              return update;
            })
          }
        />
      </div>

      {/* Provider + Model selector */}
      <ModelSelector
        value={newAgent.agent_model || ""}
        onChange={(model) => setNewAgent((prev) => ({ ...prev, agent_model: model }))}
      />

      {/* API Key — masquée pour thaink2 : l'utilisateur n'a aucune clé à saisir,
          et surtout aucune à lire (la clé mutualisée ne quitte pas le serveur). */}
      <div className={usesDefaultLlm ? "hidden" : undefined}>
        <label className="block text-sm font-medium th-text-muted mb-2 pl-1">{t("apiKeyLabel")}</label>
        <div className="relative">
          <input
            type={showApiKey && !hasStoredApiKey ? "text" : "password"}
            value={hasStoredApiKey ? MASKED_API_KEY : newAgent.model_api_key || ""}
            onChange={(e) => setNewAgent((prev) => ({ ...prev, model_api_key: e.target.value }))}
            placeholder={hasStoredApiKey ? t("apiKeyStoredPlaceholder") : t("apiKeyPlaceholder")}
            className="glass-input w-full px-4 py-3 pr-11 rounded-xl font-mono text-sm"
          />
          {/* Œil neutralisé quand la valeur est le masque : il n'y a rien à révéler. */}
          <button
            type="button"
            disabled={hasStoredApiKey}
            onClick={() => setShowApiKey((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 th-text-ghost hover:th-text-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {showApiKey && !hasStoredApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {hasStoredApiKey && (
          <p className="text-xs th-text-ghost mt-1.5 pl-1">{t("apiKeyStoredHint")}</p>
        )}
        {newAgent.subAgents?.length > 0 &&
          ["Sequential", "Parallel", "Loop", "Router"].includes(newAgent.category) && (
            <div className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                id="propagate-api-key"
                checked={newAgent.propagateApiKey ?? true}
                onChange={(e) =>
                  setNewAgent((prev) => ({ ...prev, propagateApiKey: e.target.checked }))
                }
                className="rounded border-gray-300"
              />
              <label htmlFor="propagate-api-key" className="text-sm th-text-muted">
                {t("propagateApiKeyLabel")}
              </label>
            </div>
          )}
      </div>

      {/* Description & Instruction */}
      <div className="grid grid-cols-1 gap-6">
        <div>
          <label className="block text-sm font-medium th-text-muted mb-2 pl-1">
            {t("descriptionLabel")} <span className="text-red-400">*</span>
          </label>
          <textarea
            value={newAgent.agent_description || ""}
            onChange={(e) =>
              setNewAgent((prev) => ({ ...prev, agent_description: e.target.value }))
            }
            placeholder={t("descriptionPlaceholder")}
            rows={2}
            className="glass-input w-full px-4 py-3 rounded-xl resize-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium th-text-muted mb-2 pl-1">
            {t("instructionLabel")} <span className="text-red-400">*</span>
          </label>
          <textarea
            value={newAgent.agent_instruction || ""}
            onChange={(e) =>
              setNewAgent((prev) => ({ ...prev, agent_instruction: e.target.value }))
            }
            placeholder={t("instructionPlaceholder")}
            rows={3}
            className="glass-input w-full px-4 py-3 rounded-xl resize-none font-mono text-sm"
          />
        </div>
      </div>

      {/* Tool Configs */}
      <ToolsSection
        newAgent={newAgent}
        setNewAgent={setNewAgent}
        toolConfigs={toolConfigs}
        templateNativeTools={templateNativeTools}
        toolConfigConflicts={toolConfigConflicts}
        outlookConnected={outlookConnected}
        outlookLoading={outlookLoading}
        setOutlookConnected={setOutlookConnected}
        setOutlookLoading={setOutlookLoading}
        onRefreshTools={onRefreshTools}
        onToast={onToast}
        user={user}
      />

      {/* Database Connection — data templates */}
      {["text_to_sql_agent", "data_analyst_agent", "dashboard_agent"].includes(
        newAgent.superagent_template_id
      ) && (
        <DatabaseConnectionSection
          dbCredentials={newAgent.db_credentials}
          onChange={(creds) => setNewAgent((prev) => ({ ...prev, db_credentials: creds }))}
        />
      )}

      {/* Memory Toggle */}
      {["Base", "Router"].includes(newAgent.category) && (
        <ToggleRow
          icon={<Brain size={14} />}
          label={t("memoryLabel")}
          title={t("memoryTitle")}
          description={t("memoryDescription")}
          checked={!!newAgent.memory_enabled}
          onToggle={() =>
            setNewAgent((prev) => ({ ...prev, memory_enabled: !prev.memory_enabled }))
          }
        />
      )}

      {/* Artifacts Toggle */}
      {["Base", "Router"].includes(newAgent.category) && (
        <ToggleRow
          icon={<FileCode size={14} />}
          label={t("artifactsLabel")}
          title={t("artifactsTitle")}
          description={t("artifactsDescription")}
          checked={!!newAgent.artifacts_enabled}
          onToggle={() =>
            setNewAgent((prev) => ({ ...prev, artifacts_enabled: !prev.artifacts_enabled }))
          }
        />
      )}

      {/* Guardrails */}
      {["Base", "Router"].includes(newAgent.category) && (
        <GuardrailsSection
          guardrailsConfig={newAgent.guardrails_config}
          toolConfigs={toolConfigs}
          selectedTools={newAgent.agent_tools || []}
          onChange={(config) => setNewAgent((prev) => ({ ...prev, guardrails_config: config }))}
        />
      )}

      {/* Output Format */}
      {["Base", "Router"].includes(newAgent.category) && (
        <OutputFormatSection
          outputSchema={newAgent.output_schema}
          onChange={(schema) => setNewAgent((prev) => ({ ...prev, output_schema: schema }))}
        />
      )}

      {/* MCP Servers */}
      {["Base", "Router"].includes(newAgent.category) && (
        <McpServersSection
          mcpServers={newAgent.mcp_servers}
          onChange={(servers) => setNewAgent((prev) => ({ ...prev, mcp_servers: servers }))}
          savedConfigs={mcpConfigs}
          onRefreshConfigs={onRefreshTools}
        />
      )}

      {/* Skills */}
      {newAgent.category && !["Sequential", "Parallel"].includes(newAgent.category) && (
        <SkillsList
          availableSkills={availableSkills}
          selectedSkills={newAgent.agent_skills || []}
          onChange={(skills) => setNewAgent((prev) => ({ ...prev, agent_skills: skills }))}
        />
      )}

      {/* Sub-agents */}
      {newAgent.category && newAgent.category !== "Base" && (
        <SubAgentsPicker
          category={newAgent.category}
          subAgents={newAgent.subAgents}
          availableAgents={availableAgents}
          boxes={boxes}
          onToggle={onSubAgentToggle}
          onMoveUp={onMoveSubAgentUp}
          onMoveDown={onMoveSubAgentDown}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
        />
      )}
    </div>
  );
}

function ToggleRow({ icon, label, title, description, checked, onToggle }) {
  return (
    <div>
      <label className="text-sm font-medium th-text-muted mb-2 pl-1 flex items-center gap-2">
        {icon} {label}
      </label>
      <div className="flex items-center justify-between glass-card rounded-xl px-4 py-3">
        <div>
          <p className="text-sm th-text-secondary">{title}</p>
          <p className="text-xs th-text-faint mt-0.5">{description}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={onToggle}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            checked ? "bg-purple-500" : "bg-white/10"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              checked ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
