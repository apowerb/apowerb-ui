"use client";

/**
 * DiagramHeaderPanel — the expandable header below the toolbar.
 *
 * It hosts the saved-API-key selector, Model + API-key inputs, the
 * "propagate API key" toggle, description / instruction fields, the tool
 * configs picker and the Memory / Artifacts switches.
 *
 * Formerly inlined inside DiagramEditor as `expandedHeader &&`.
 */

import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "use-intl";
import SavedApiKeySelector from "../SavedApiKeySelector";

function ToggleSwitch({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-1.5 cursor-pointer">
      <span className="text-xs th-text-faint">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          checked ? "bg-brand" : "th-bg-input"
        }`}
        style={!checked ? { border: "1px solid var(--border-primary)" } : {}}
      >
        <span
          className={`inline-block h-3 w-3 transform rounded-full transition-transform ${
            checked
              ? "translate-x-5 bg-white"
              : "translate-x-1 bg-(--text-ghost)"
          }`}
        />
      </button>
    </label>
  );
}

export default function DiagramHeaderPanel({
  agentData,
  updateAgentData,
  canvasOrderLength,
  showApiKey,
  setShowApiKey,
  toolConfigs,
}) {
  const t = useTranslations("DiagramHeaderPanel");
  const templateParams = agentData.template_model_params || {};
  const showPropagateToggle =
    canvasOrderLength > 0 &&
    ["sequential", "parallel", "loop", "router"].includes(agentData.agent_type);
  const showMemoryArtifactsToggles = ["base", "router"].includes(
    agentData.agent_type,
  );

  return (
    <div className="px-4 pb-3 text-sm space-y-2">
      {/* Saved API Key Configuration */}
      <div>
        <label className="block text-xs th-text-faint mb-1">
          {t("savedConfigurationLabel")}
        </label>
        <SavedApiKeySelector
          currentValue={agentData.model_api_key || ""}
          currentModel={agentData.agent_model || ""}
          currentModelApiBase={templateParams.model_api_base || ""}
          onSelect={(selection) => {
            const update = {
              ...agentData,
              model_api_key: selection.api_key_value,
            };
            if (selection.model) update.agent_model = selection.model;
            if (selection.model_api_base) {
              update.template_model_params = {
                ...(agentData.template_model_params || {}),
                model_api_base: selection.model_api_base,
              };
            }
            updateAgentData(update);
          }}
        />
      </div>

      {/* Row 1: Model + API Key */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs th-text-faint mb-1">
            {t("modelLabel")} <span className="text-red-400">*</span>
            <span className="th-text-whisper ml-2 font-mono">
              {t("modelFormatHint")}
            </span>
          </label>
          <input
            type="text"
            value={agentData.agent_model || ""}
            onChange={(e) =>
              updateAgentData({ ...agentData, agent_model: e.target.value })
            }
            placeholder={t("modelPlaceholder")}
            className="glass-input w-full px-3 py-1.5 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-xs th-text-faint mb-1">{t("apiKeyLabel")}</label>
          <div className="relative">
            <input
              type={showApiKey ? "text" : "password"}
              value={agentData.model_api_key || ""}
              onChange={(e) =>
                updateAgentData({
                  ...agentData,
                  model_api_key: e.target.value,
                })
              }
              placeholder={t("apiKeyPlaceholder")}
              className="glass-input w-full px-3 py-1.5 pr-9 rounded-lg font-mono text-xs"
            />
            <button
              type="button"
              onClick={() => setShowApiKey((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 th-text-ghost hover:th-text-secondary transition-colors"
            >
              {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
      </div>

      {/* Propagate API key toggle */}
      {showPropagateToggle && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="tab-propagate-api-key"
            checked={agentData.propagateApiKey ?? true}
            onChange={(e) =>
              updateAgentData({
                ...agentData,
                propagateApiKey: e.target.checked,
              })
            }
            className="rounded border-gray-300"
          />
          <label
            htmlFor="tab-propagate-api-key"
            className="text-xs th-text-muted"
          >
            {t("propagateApiKeyLabel")}
          </label>
        </div>
      )}

      {/* Row 2: Description + Instruction */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs th-text-faint mb-1">
            {t("descriptionLabel")}
          </label>
          <input
            type="text"
            value={agentData.agent_description || ""}
            onChange={(e) =>
              updateAgentData({
                ...agentData,
                agent_description: e.target.value,
              })
            }
            placeholder={t("describeAgentPlaceholder")}
            className="glass-input w-full px-3 py-1.5 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-xs th-text-faint mb-1">
            {t("instructionLabel")}
          </label>
          <input
            type="text"
            value={agentData.agent_instruction || ""}
            onChange={(e) =>
              updateAgentData({
                ...agentData,
                agent_instruction: e.target.value,
              })
            }
            placeholder={t("instructionPlaceholder")}
            className="glass-input w-full px-3 py-1.5 rounded-lg"
          />
        </div>
      </div>

      {/* Row 3: Tools + Toggles */}
      <div className="flex items-end gap-4">
        <div className="relative flex-1 max-w-xs">
          <label className="block text-xs th-text-faint mb-1">{t("toolsLabel")}</label>
          <details className="group">
            <summary className="glass-input w-full px-3 py-1.5 rounded-lg cursor-pointer list-none flex items-center justify-between">
              <span className="text-sm th-text-secondary">
                {(agentData.agent_tools || []).length > 0
                  ? t("toolsSelectedCount", { count: agentData.agent_tools.length })
                  : t("selectToolsPlaceholder")}
              </span>
              <svg
                className="w-4 h-4 th-text-muted transition-transform group-open:rotate-180"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </summary>
            <div className="absolute z-50 mt-1 w-full glass-modal backdrop-blur-xl rounded-xl shadow-2xl max-h-60 overflow-y-auto">
              {toolConfigs.length === 0 ? (
                <div className="px-3 py-2 text-xs th-text-faint">
                  {t("noToolConfigsAvailable")}
                </div>
              ) : (
                toolConfigs.map((config) => {
                  const configId = String(config.tool_config_id);
                  const selected = (agentData.agent_tools || []).includes(
                    configId,
                  );
                  return (
                    <label
                      key={configId}
                      className="flex items-center gap-2 px-3 py-2 hover:th-bg-surface-hover cursor-pointer border-b th-border-secondary last:border-0"
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(e) => {
                          const currentTools = agentData.agent_tools || [];
                          const newTools = e.target.checked
                            ? [...currentTools, configId]
                            : currentTools.filter((toolId) => toolId !== configId);
                          updateAgentData({
                            ...agentData,
                            agent_tools: newTools,
                          });
                        }}
                        className="accent-brand"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm th-text truncate">
                          {config.tool_config_name}
                        </div>
                        <div className="text-xs th-text-muted truncate">
                          {config.tool_name?.split(".").pop() || t("toolFallback")}
                        </div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </details>
        </div>

        {showMemoryArtifactsToggles && (
          <div className="flex items-center gap-5 pb-0.5">
            <ToggleSwitch
              label={t("memoryLabel")}
              checked={agentData.memory_enabled || false}
              onChange={() =>
                updateAgentData({
                  ...agentData,
                  memory_enabled: !agentData.memory_enabled,
                })
              }
            />
            <ToggleSwitch
              label={t("artifactsLabel")}
              checked={agentData.artifacts_enabled || false}
              onChange={() =>
                updateAgentData({
                  ...agentData,
                  artifacts_enabled: !agentData.artifacts_enabled,
                })
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
