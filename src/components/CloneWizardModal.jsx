"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { useTranslations } from "use-intl";
import {
  Download,
  Key,
  Wrench,
  CheckCircle,
  ChevronRight,
  Loader2,
  SkipForward,
  ExternalLink,
  MessageSquare,
  Eye,
  EyeOff,
  Users,
  Activity,
  Bot,
  X,
} from "lucide-react";
import { useRouter } from "@/lib/navigation";
import SavedApiKeySelector from "./SavedApiKeySelector";
import { cloneFromHub, updateAgent, createToolConfig, getAgent } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

const STEPS = [
  { id: "name", icon: Download },
  { id: "apikey", icon: Key },
  { id: "tools", icon: Wrench },
  { id: "done", icon: CheckCircle },
];

const STEP_LABEL_KEYS = {
  name: "stepClone",
  apikey: "stepApiKey",
  tools: "stepTools",
  done: "stepDone",
};

const TYPE_COLORS = {
  base: "from-blue-500 to-blue-600",
  sequential: "from-purple-500 to-purple-600",
  parallel: "from-blue-500 to-blue-600",
  loop: "from-purple-500 to-purple-600",
  router: "from-purple-500 to-purple-600",
};

function StepIndicator({ currentStep, steps, toolsRequired }) {
  const t = useTranslations("CloneWizardModal");
  const visibleSteps = toolsRequired
    ? steps
    : steps.filter((s) => s.id !== "tools");
  const currentIdx = visibleSteps.findIndex((s) => s.id === currentStep);

  return (
    <div className="flex items-center justify-center gap-1 px-6 py-3 border-b th-border">
      {visibleSteps.map((s, i) => {
        const Icon = s.icon;
        const isActive = s.id === currentStep;
        const isDone = i < currentIdx;
        return (
          <Fragment key={s.id}>
            {i > 0 && (
              <div
                className={`h-px w-8 ${isDone ? "bg-green-500" : "th-border"}`}
              />
            )}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                isActive
                  ? "bg-blue-500/20 text-blue-400"
                  : isDone
                    ? "bg-green-500/10 text-green-400"
                    : "th-text-ghost"
              }`}
            >
              <Icon size={14} />
              <span>{t(STEP_LABEL_KEYS[s.id])}</span>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}

function isSecretField(key) {
  const upper = key.toUpperCase();
  return (
    upper.includes("KEY") ||
    upper.includes("SECRET") ||
    upper.includes("PASSWORD") ||
    upper.includes("TOKEN")
  );
}

export default function CloneWizardModal({
  show,
  hubAgent,
  onClose,
  onComplete,
}) {
  const router = useRouter();
  const t = useTranslations("CloneWizardModal");
  const { user } = useAuth();
  const emailDomain = user?.email?.split("@")[1] || "default";

  const [step, setStep] = useState("name");
  const [cloneName, setCloneName] = useState("");
  const [cloning, setCloning] = useState(false);
  const [cloneResult, setCloneResult] = useState(null);
  const [error, setError] = useState(null);

  // API key step
  const [apiKey, setApiKey] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [customModelApiBase, setCustomModelApiBase] = useState("");
  const [selectedSavedKey, setSelectedSavedKey] = useState(null);
  const [propagateKey, setPropagateKey] = useState(true);
  const [savingKey, setSavingKey] = useState(false);
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // Tools step
  const [toolValues, setToolValues] = useState({});
  const [savingTools, setSavingTools] = useState(false);
  const [toolsConfigured, setToolsConfigured] = useState(false);
  const [showSecrets, setShowSecrets] = useState({});

  // Reset on open
  useEffect(() => {
    if (hubAgent) {
      setStep("name");
      setCloneName(
        hubAgent.agent_name
          ? `${hubAgent.agent_name}_clone`
          : hubAgent.hub_name
            ? `${hubAgent.hub_name}_clone`
            : "",
      );
      setCloning(false);
      setCloneResult(null);
      setError(null);
      setApiKey("");
      setCustomModel("");
      setCustomModelApiBase("");
      setSelectedSavedKey(null);
      setPropagateKey(true);
      setSavingKey(false);
      setApiKeyConfigured(false);
      setShowApiKey(false);
      setToolValues({});
      setSavingTools(false);
      setToolsConfigured(false);
      setShowSecrets({});
    }
  }, [hubAgent]);

  const toolsRequired =
    cloneResult?.tools_requiring_config &&
    cloneResult.tools_requiring_config.length > 0;

  const handleClone = useCallback(async () => {
    setCloning(true);
    setError(null);
    try {
      const result = await cloneFromHub({
        hub_agent_id: hubAgent.hub_id,
        clone_name: cloneName.trim() || undefined,
      });
      setCloneResult(result);
      setCustomModel(result.agent_model || hubAgent.agent_model || "");
      setStep("apikey");
    } catch (err) {
      setError(err.message || t("cloneFailedFallback"));
    } finally {
      setCloning(false);
    }
  }, [hubAgent, cloneName, t]);

  const handleApiKeyNext = useCallback(async () => {
    const effectiveKey = apiKey.trim();
    if (!effectiveKey) {
      setStep(toolsRequired ? "tools" : "done");
      return;
    }
    setSavingKey(true);
    setError(null);
    try {
      const currentAgent = await getAgent(cloneResult.agent_id);
      if (!currentAgent) throw new Error("Agent not found after clone");

      // Use the user-chosen model (customModel field), falling back to current
      const agentModel = customModel.trim() || currentAgent.agent_model;
      const modelParams = { model_api_key: effectiveKey };
      const effectiveBase = customModelApiBase.trim();
      if (effectiveBase) {
        modelParams.model_api_base = effectiveBase;
      }

      await updateAgent(cloneResult.agent_id, {
        agent_name: currentAgent.agent_name,
        agent_model: agentModel,
        agent_description: currentAgent.agent_description || "",
        agent_instruction: currentAgent.agent_instruction || "",
        agent_type: currentAgent.agent_type || "base",
        agent_tools: currentAgent.agent_tools || [],
        sub_agents: currentAgent.sub_agents || [],
        agent_model_params: modelParams,
        propagate_api_key:
          propagateKey && (cloneResult.sub_agents_cloned || 0) > 0,
      });
      setApiKeyConfigured(true);
      setStep(toolsRequired ? "tools" : "done");
    } catch (err) {
      setError(err.message || t("saveApiKeyFailedFallback"));
    } finally {
      setSavingKey(false);
    }
  }, [apiKey, cloneResult, propagateKey, toolsRequired, customModel, customModelApiBase, t]);

  const handleToolsSave = useCallback(async () => {
    if (!cloneResult?.tools_requiring_config) return;
    setSavingTools(true);
    setError(null);
    try {
      // Create tool configs for each category
      const createdConfigs = []; // { configId, category }
      for (const entry of cloneResult.tools_requiring_config) {
        const category = entry.category;
        const values = toolValues[category];
        if (!values || Object.keys(values).length === 0) continue;

        const configResult = await createToolConfig({
          tool_config_name: `${cloneResult.agent_name || "clone"}_${category}`,
          tool_name: entry.tools[0],
          tool_config_params: { ...values },
          tool_category: category,
          owner_id: user?.email || "",
          organization_id: emailDomain,
        });

        if (configResult?.tool_config_id) {
          createdConfigs.push({ configId: configResult.tool_config_id, category });
        }
      }

      // Helper to add tool configs to an agent
      const addConfigsToAgent = async (agentId) => {
        const agent = await getAgent(agentId);
        if (!agent) return;
        const agentTools = Array.isArray(agent.agent_tools) ? [...agent.agent_tools] : [];
        // Determine which categories this agent uses
        const agentCategories = new Set(
          agentTools.filter((t) => t.includes(".")).map((t) => t.split(".")[0])
        );
        let changed = false;
        for (const { configId, category } of createdConfigs) {
          if (agentCategories.has(category) && !agentTools.includes(configId)) {
            agentTools.push(configId);
            changed = true;
          }
        }
        if (changed) {
          await updateAgent(agentId, {
            agent_name: agent.agent_name,
            agent_model: agent.agent_model,
            agent_description: agent.agent_description || "",
            agent_instruction: agent.agent_instruction || "",
            agent_type: agent.agent_type || "base",
            agent_tools: agentTools,
          });
        }
      };

      // Update parent agent
      await addConfigsToAgent(cloneResult.agent_id);

      // Update sub-agents too
      if (cloneResult.sub_agent_ids?.length > 0) {
        for (const subId of cloneResult.sub_agent_ids) {
          await addConfigsToAgent(subId);
        }
      }

      setToolsConfigured(true);
      setStep("done");
    } catch (err) {
      setError(err.message || t("configureToolsFailedFallback"));
    } finally {
      setSavingTools(false);
    }
  }, [cloneResult, toolValues, user, emailDomain, t]);

  const handleToolValueChange = useCallback((category, paramKey, value) => {
    setToolValues((prev) => ({
      ...prev,
      [category]: {
        ...(prev[category] || {}),
        [paramKey]: value,
      },
    }));
  }, []);

  if (!show || !hubAgent) return null;

  const typeColor =
    TYPE_COLORS[hubAgent.agent_type?.toLowerCase()] || TYPE_COLORS.base;
  const tools = hubAgent.agent_tools
    ? Array.isArray(hubAgent.agent_tools)
      ? hubAgent.agent_tools
      : []
    : [];
  const subAgentsCount = hubAgent.sub_agents_snapshot?.length || 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl th-bg-surface border th-border rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Step indicator */}
        <StepIndicator
          currentStep={step}
          steps={STEPS}
          toolsRequired={!!toolsRequired}
        />

        {/* Content (scrollable) */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Error display */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Step 1: Clone */}
          {step === "name" && (
            <div className="space-y-5">
              {/* Agent info */}
              <div className="flex items-start gap-4">
                <div
                  className={`shrink-0 w-12 h-12 rounded-xl bg-linear-to-br ${typeColor} flex items-center justify-center shadow-md`}
                >
                  <Bot size={24} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="th-text font-bold text-lg">
                    {hubAgent.hub_name || hubAgent.agent_name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-linear-to-r ${typeColor} text-white`}
                    >
                      {hubAgent.agent_type || "base"}
                    </span>
                    {hubAgent.agent_model && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full th-bg-surface th-text-muted border th-border">
                        <Activity size={10} />
                        {hubAgent.agent_model}
                      </span>
                    )}
                    {subAgentsCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/25">
                        <Users size={10} />
                        {t("subAgentsCountBadge", { count: subAgentsCount })}
                      </span>
                    )}
                    {tools.length > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-purple-400/10 text-purple-400 border border-purple-400/20">
                        <Wrench size={10} />
                        {t("toolsCountBadge", { count: tools.length })}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Clone name input */}
              <div>
                <label className="block text-sm font-medium th-text-secondary mb-2">
                  {t("cloneNameLabel")}
                </label>
                <input
                  type="text"
                  value={cloneName}
                  onChange={(e) => setCloneName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !cloning && handleClone()}
                  placeholder={t("cloneNamePlaceholder")}
                  autoFocus
                  className="w-full px-4 py-2.5 rounded-xl glass-input text-sm focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all"
                />
              </div>

              {/* Clone button */}
              <button
                onClick={handleClone}
                disabled={cloning}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-brand text-white text-sm font-bold border border-brand/30 hover:bg-brand-hover transition-all disabled:opacity-50 shadow-lg shadow-blue-500/20"
              >
                {cloning ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Download size={16} />
                )}
                {t("cloneAgentButton")}
              </button>
            </div>
          )}

          {/* Step 2: API Key */}
          {step === "apikey" && cloneResult && (
            <div className="space-y-5">
              <div>
                <h3 className="th-text font-bold text-lg mb-1">
                  {t("configureProviderHeading")}
                </h3>
                <p className="th-text-faint text-sm">
                  {t("chooseProviderText")}
                </p>
              </div>

              {/* Model / Provider input */}
              <div>
                <label className="block text-xs font-semibold th-text-faint mb-1.5">
                  {t("modelProviderLabel")}
                </label>
                <input
                  type="text"
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  placeholder={t("modelProviderPlaceholder")}
                  className="w-full px-4 py-2.5 rounded-xl glass-input text-sm focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all font-mono"
                />
              </div>

              {/* API Base URL (optional) */}
              <div>
                <label className="block text-xs font-semibold th-text-faint mb-1.5">
                  {t("apiBaseUrlLabel")} <span className="th-text-ghost font-normal">{t("optional")}</span>
                </label>
                <input
                  type="text"
                  value={customModelApiBase}
                  onChange={(e) => setCustomModelApiBase(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className="w-full px-4 py-2.5 rounded-xl glass-input text-sm focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all font-mono"
                />
              </div>

              {/* Saved API Key Selector */}
              <div>
                <label className="block text-xs font-semibold th-text-faint mb-1.5">
                  {t("savedConfigurationsLabel")}
                </label>
                <SavedApiKeySelector
                  onSelect={(saved) => {
                    setSelectedSavedKey(saved);
                    setApiKey(saved.api_key_value || "");
                    if (saved.model) setCustomModel(saved.model);
                    if (saved.model_api_base) setCustomModelApiBase(saved.model_api_base);
                  }}
                />
              </div>

              {/* OR separator */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px th-border" />
                <span className="text-xs th-text-ghost font-medium uppercase">
                  {t("orSeparator")}
                </span>
                <div className="flex-1 h-px th-border" />
              </div>

              {/* Manual API key input */}
              <div>
                <label className="block text-xs font-semibold th-text-faint mb-1.5">
                  {t("enterApiKeyManuallyLabel")}
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      setSelectedSavedKey(null);
                    }}
                    placeholder="sk-..."
                    className="w-full px-4 py-2.5 pr-10 rounded-xl glass-input text-sm focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 th-text-ghost hover:th-text-secondary transition-colors"
                  >
                    {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Propagate checkbox */}
              {(cloneResult.sub_agents_cloned || 0) > 0 && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={propagateKey}
                    onChange={(e) => setPropagateKey(e.target.checked)}
                    className="rounded border-gray-600 bg-transparent text-brand focus:ring-brand/30"
                  />
                  <span className="text-sm th-text-secondary">
                    {t("propagateToSubAgents", { count: cloneResult.sub_agents_cloned })}
                  </span>
                </label>
              )}

              {/* Next button */}
              <button
                onClick={handleApiKeyNext}
                disabled={savingKey}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-brand text-white text-sm font-bold border border-brand/30 hover:bg-brand-hover transition-all disabled:opacity-50 shadow-lg shadow-blue-500/20"
              >
                {savingKey ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <ChevronRight size={16} />
                )}
                {t("nextButton")}
              </button>

              {/* Skip link */}
              <button
                onClick={() => setStep(toolsRequired ? "tools" : "done")}
                className="w-full text-center text-xs th-text-ghost hover:th-text-secondary transition-colors flex items-center justify-center gap-1"
              >
                <SkipForward size={12} />
                {t("skipThisStep")}
              </button>
            </div>
          )}

          {/* Step 3: Tools */}
          {step === "tools" && cloneResult?.tools_requiring_config && (
            <div className="space-y-5">
              <div>
                <h3 className="th-text font-bold text-lg mb-1">
                  {t("configureToolsHeading")}
                </h3>
                <p className="th-text-faint text-sm">
                  {t("configureToolsText")}
                </p>
              </div>

              {cloneResult.tools_requiring_config.map((entry) => (
                <div
                  key={entry.category}
                  className="p-4 rounded-xl th-bg-surface border th-border-secondary space-y-3"
                >
                  {/* Category header */}
                  <div>
                    <h4 className="th-text font-semibold text-sm capitalize">
                      {entry.category}
                    </h4>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {entry.tools.map((tool) => (
                        <span
                          key={tool}
                          className="px-2 py-0.5 text-[10px] th-text-faint rounded-lg th-bg-body border th-border font-mono"
                        >
                          {tool.split("/").pop() || tool}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Required params */}
                  {entry.required_params?.map((param) => {
                    const secret = isSecretField(param.key);
                    const showThis = showSecrets[`${entry.category}_${param.key}`];
                    return (
                      <div key={param.key}>
                        <label className="block text-xs font-medium th-text-faint mb-1">
                          {param.key}
                        </label>
                        <div className="relative">
                          <input
                            type={
                              secret && !showThis ? "password" : "text"
                            }
                            value={
                              toolValues[entry.category]?.[param.key] || ""
                            }
                            onChange={(e) =>
                              handleToolValueChange(
                                entry.category,
                                param.key,
                                e.target.value,
                              )
                            }
                            placeholder={param.default || t("requiredPlaceholder")}
                            className="w-full px-3 py-2 pr-10 rounded-lg glass-input text-sm focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all font-mono"
                          />
                          {secret && (
                            <button
                              type="button"
                              onClick={() =>
                                setShowSecrets((prev) => ({
                                  ...prev,
                                  [`${entry.category}_${param.key}`]:
                                    !prev[
                                      `${entry.category}_${param.key}`
                                    ],
                                }))
                              }
                              className="absolute right-3 top-1/2 -translate-y-1/2 th-text-ghost hover:th-text-secondary transition-colors"
                            >
                              {showThis ? (
                                <EyeOff size={12} />
                              ) : (
                                <Eye size={12} />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* Configure Tools button */}
              <button
                onClick={handleToolsSave}
                disabled={savingTools}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-brand text-white text-sm font-bold border border-brand/30 hover:bg-brand-hover transition-all disabled:opacity-50 shadow-lg shadow-blue-500/20"
              >
                {savingTools ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Wrench size={16} />
                )}
                {t("configureToolsButton")}
              </button>

              {/* Skip link */}
              <button
                onClick={() => setStep("done")}
                className="w-full text-center text-xs th-text-ghost hover:th-text-secondary transition-colors flex items-center justify-center gap-1"
              >
                <SkipForward size={12} />
                {t("skipThisStep")}
              </button>
            </div>
          )}

          {/* Step 4: Done */}
          {step === "done" && cloneResult && (
            <div className="space-y-5 text-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center">
                  <CheckCircle size={32} className="text-green-400" />
                </div>
                <h3 className="th-text font-bold text-xl">{t("agentReadyHeading")}</h3>
              </div>

              {/* Summary */}
              <div className="text-left p-4 rounded-xl th-bg-surface border th-border-secondary space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Bot size={14} className="th-text-faint shrink-0" />
                  <span className="th-text-faint">{t("nameLabel")}</span>
                  <span className="th-text font-medium">
                    {cloneResult.agent_name || cloneName}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Activity size={14} className="th-text-faint shrink-0" />
                  <span className="th-text-faint">{t("typeLabel")}</span>
                  <span className="th-text font-medium capitalize">
                    {cloneResult.agent_type || hubAgent.agent_type || "base"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Key size={14} className="th-text-faint shrink-0" />
                  <span className="th-text-faint">{t("apiKeyLabel")}</span>
                  <span
                    className={`font-medium ${apiKeyConfigured ? "text-green-400" : "text-yellow-400"}`}
                  >
                    {apiKeyConfigured ? t("configuredStatus") : t("notConfiguredStatus")}
                  </span>
                </div>
                {toolsRequired && (
                  <div className="flex items-center gap-2 text-sm">
                    <Wrench size={14} className="th-text-faint shrink-0" />
                    <span className="th-text-faint">{t("toolsLabel")}</span>
                    <span
                      className={`font-medium ${toolsConfigured ? "text-green-400" : "text-yellow-400"}`}
                    >
                      {toolsConfigured ? t("configuredStatus") : t("notConfiguredStatus")}
                    </span>
                  </div>
                )}
                {(cloneResult.sub_agents_cloned || 0) > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Users size={14} className="th-text-faint shrink-0" />
                    <span className="th-text-faint">{t("subAgentsLabel")}</span>
                    <span className="th-text font-medium">
                      {t("subAgentsClonedCount", { count: cloneResult.sub_agents_cloned })}
                    </span>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    onComplete?.();
                    router.push("/orchestrator");
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-brand text-white text-sm font-bold border border-brand/30 hover:bg-brand-hover transition-all shadow-lg shadow-blue-500/20"
                >
                  <ExternalLink size={16} />
                  {t("openInEditorButton")}
                </button>
                <button
                  onClick={() => {
                    onComplete?.();
                    router.push("/chatbot");
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl th-bg-surface th-text-secondary text-sm font-medium border th-border hover:th-bg-surface-hover transition-all"
                >
                  <MessageSquare size={16} />
                  {t("startChattingButton")}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Close button (top right) */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-lg hover:th-bg-surface-hover th-text-faint hover:th-text-secondary transition-colors z-10"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
