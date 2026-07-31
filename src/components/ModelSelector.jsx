"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "use-intl";
import { getModels } from "@/lib/api";
import ProviderIcon, { extractProvider, PROVIDERS } from "./ProviderIcon";

// ---------------------------------------------------------------------------
// Static registry — popular models per LiteLLM provider
// ---------------------------------------------------------------------------

const FALLBACK_PROVIDER_MODELS = {
  anthropic: [
    { id: "claude-sonnet-4-6",          name: "Claude Sonnet 4.6", tag: "Latest" },
    { id: "claude-opus-4-6",            name: "Claude Opus 4.6",   tag: "Powerful" },
    { id: "claude-haiku-4-5-20251001",  name: "Claude Haiku 4.5",  tag: "Fast" },
    { id: "claude-sonnet-4-5-20250929", name: "Claude Sonnet 4.5", tag: null },
    { id: "claude-opus-4-0-20250514",   name: "Claude Opus 4",     tag: null },
  ],
  openai: [
    { id: "o3",           name: "o3",           tag: "Reasoning" },
    { id: "o4-mini",      name: "o4-mini",      tag: "Fast reasoning" },
    { id: "o3-pro",       name: "o3 Pro",       tag: "Deep reasoning" },
    { id: "gpt-4.1",      name: "GPT-4.1",      tag: "Coding" },
    { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", tag: "Fast" },
    { id: "gpt-4.1-nano", name: "GPT-4.1 Nano", tag: "Fastest" },
  ],
  mistral: [
    { id: "mistral-large-latest",  name: "Mistral Large 3",  tag: "Recommended" },
    { id: "devstral-small-latest", name: "Devstral Small 2", tag: "Code" },
    { id: "mistral-small-latest",  name: "Mistral Small 3",  tag: "Fast" },
    { id: "codestral-latest",      name: "Codestral",        tag: "Code" },
    { id: "open-mistral-nemo",     name: "Mistral Nemo",     tag: "Open" },
  ],
  gemini: [
    { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro", tag: "Latest" },
    { id: "gemini-3-pro",           name: "Gemini 3 Pro",   tag: "Powerful" },
    { id: "gemini-2.0-flash",       name: "Gemini 2.0 Flash", tag: "Fast" },
    { id: "gemini-2.0-pro",         name: "Gemini 2.0 Pro",   tag: null },
  ],
  deepseek: [
    { id: "deepseek-chat",     name: "DeepSeek V3.2",     tag: "Recommended" },
    { id: "deepseek-reasoner", name: "DeepSeek V3.2 R1",  tag: "Reasoning" },
  ],
  groq: [
    { id: "meta-llama/llama-4-maverick-17b-128e-instruct", name: "Llama 4 Maverick", tag: "Powerful" },
    { id: "meta-llama/llama-4-scout-17b-16e-instruct",     name: "Llama 4 Scout",    tag: "Fast" },
    { id: "openai/gpt-oss-120b",                           name: "GPT-OSS 120B",     tag: "Open" },
    { id: "qwen/qwen-3-32b",                               name: "Qwen 3 32B",       tag: "Preview" },
    { id: "llama-3.3-70b-versatile",                        name: "Llama 3.3 70B",    tag: null },
  ],
};

// `thaink2` en tête : c'est le choix par défaut recommandé (aucune clé à
// saisir). Il n'apparaît que si le backend le sert vraiment — GET /models
// ne renvoie ce provider que lorsque DEFAULT_LLM_MODEL/API_KEY sont
// configurés côté serveur, et il est absent du fallback statique.
const PROVIDER_ORDER = ["thaink2", "anthropic", "openai", "mistral", "gemini", "deepseek", "groq"];

export const DEFAULT_LLM_PROVIDER = "thaink2";
export const DEFAULT_LLM_MODEL_ID = "thaink2/default";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ModelSelector({ value, onChange }) {
  const t = useTranslations("ModelSelector");
  const [providerModels, setProviderModels] = useState(FALLBACK_PROVIDER_MODELS);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [wantsCustom, setWantsCustom] = useState(false);

  const providerKey = extractProvider(value);
  const modelSuffix = value && providerKey ? value.substring(providerKey.length + 1) : "";
  const knownModels = providerKey ? providerModels[providerKey] : null;
  const isKnownModel = knownModels?.some((m) => m.id === modelSuffix);
  const isKnownProvider = !!(providerKey && providerModels[providerKey]);
  const availableProviders = PROVIDER_ORDER.filter((prov) => providerModels[prov]?.length);

  useEffect(() => {
    async function loadModels() {
      try {
        const data = await getModels();
        const mapped = {};

        for (const group of data.providers || []) {
          mapped[group.provider] = (group.models || []).map((model) => ({
            id: model.id.startsWith(`${group.provider}/`)
              ? model.id.substring(group.provider.length + 1)
              : model.id,
            name: model.name,
            tag: model.tag ?? null,
          }));
        }

        if (Object.keys(mapped).length > 0) {
          setProviderModels(mapped);
        } else {
          setProviderModels(FALLBACK_PROVIDER_MODELS);
        }
      } catch (error) {
        console.error("Failed to load models, using fallback:", error);
        setProviderModels(FALLBACK_PROVIDER_MODELS);
      } finally {
        setIsLoadingModels(false);
      }
    }

    loadModels();
  }, []);



  // Modèle mutualisé : un seul modèle, choisi par thaink2. On n'affiche ni
  // liste ni champ libre — laisser l'utilisateur éditer « thaink2/... » ne
  // produirait qu'un modèle invalide (le backend rejette tout autre suffixe).
  const isDefaultLlm = providerKey === DEFAULT_LLM_PROVIDER;

  // should we show the dropdown or the free-text input?
  // When isKnownModel is true, wantsCustom is overridden to false
  const effectiveWantsCustom = isKnownModel ? false : wantsCustom;
  const showDropdown =
    !isDefaultLlm && isKnownProvider && !effectiveWantsCustom && (isKnownModel || !modelSuffix);
  const showCustomInput = !isDefaultLlm && !showDropdown;

  // --- handlers ---

  const handleProviderClick = (prov) => {
    setWantsCustom(false);
    if (prov === DEFAULT_LLM_PROVIDER) {
      onChange(DEFAULT_LLM_MODEL_ID);
      return;
    }
    const models = providerModels[prov];
    if (models?.length) {
      onChange(`${prov}/${models[0].id}`);
    }
  };

  const handleOtherClick = () => {
    setWantsCustom(true);
    if (!providerKey || isKnownProvider) onChange("");
  };

  const handleModelSelect = (e) => {
    const id = e.target.value;
    if (id === "__custom__") {
      setWantsCustom(true);
      onChange(`${providerKey}/`);
    } else {
      onChange(`${providerKey}/${id}`);
    }
  };

  const handleCustomInput = (e) => onChange(e.target.value);

  const handleBackToList = () => {
    setWantsCustom(false);
    const models = providerModels[providerKey];
    if (models?.length) onChange(`${providerKey}/${models[0].id}`);
  };

  // --- render ---

  return (
    <div className="space-y-4">
      {/* ---- Provider selector ---- */}
      <div>
        <label className="block text-sm font-medium th-text-muted mb-2 pl-1">
          {t("providerLabel")}
        </label>
        <div className="flex flex-wrap gap-2">
          {availableProviders.map((prov) => {
            const selected = providerKey === prov;
            return (
              <button
                key={prov}
                type="button"
                onClick={() => handleProviderClick(prov)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border transition-all text-sm ${
                  selected
                    ? "th-border-hover th-bg-surface th-text shadow-lg"
                    : "th-border-secondary bg-white/3 th-text-faint hover:bg-white/6 hover:th-text-secondary"
                }`}
              >
                <ProviderIcon provider={prov} size={14} />
                <span>{PROVIDERS[prov]?.name || prov}</span>
              </button>
            );
          })}
          {/* Other / custom provider */}
          <button
            type="button"
            onClick={handleOtherClick}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border transition-all text-sm ${
              providerKey && !isKnownProvider
                ? "th-border-hover th-bg-surface th-text shadow-lg"
                : "th-border-secondary bg-white/3 th-text-faint hover:bg-white/6 hover:th-text-secondary"
            }`}
          >
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-md th-bg-surface th-text-faint text-xs font-bold">+</span>
            <span>{t("otherLabel")}</span>
          </button>
        </div>
          {isLoadingModels && (
          <p className="text-xs th-text-ghost mt-2 pl-1">{t("loadingModels")}</p>
        )}
      </div>

      {/* ---- Modèle mutualisé thaink2 : rien à configurer ---- */}
      {isDefaultLlm && (
        <div className="flex items-start gap-2 p-3 rounded-lg border th-border-secondary th-bg-surface text-xs th-text-secondary">
          <ProviderIcon provider={DEFAULT_LLM_PROVIDER} size={14} />
          <p>{t("defaultModelHint")}</p>
        </div>
      )}

      {/* ---- Model dropdown (known provider) ---- */}
      {showDropdown && (
        <div>
          <label className="block text-sm font-medium th-text-muted mb-2 pl-1">
            {t("modelLabel")} <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <ProviderIcon provider={providerKey} size={14} />
            </div>
            <select
              value={isKnownModel ? modelSuffix : ""}
              onChange={handleModelSelect}
              className="glass-input w-full pl-11 pr-4 py-3 rounded-xl text-sm appearance-none"
            >
              {!isKnownModel && !modelSuffix && (
                <option value="" disabled className="th-bg-modal">
                  {t("selectModelOption")}
                </option>
              )}
              {(knownModels || []).map((m) => (
                <option key={m.id} value={m.id} className="th-bg-modal">
                  {m.name}
                  {m.tag ? ` — ${m.tag}` : ""}
                </option>
              ))}
              <option value="__custom__" className="th-bg-modal">
                {t("customModelOption")}
              </option>
            </select>
            {/* dropdown chevron */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none th-text-ghost">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 4.5L6 7.5L9 4.5" />
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* ---- Custom model input ---- */}
      {showCustomInput && (
        <div>
          <label className="flex items-center gap-2 text-sm font-medium th-text-muted mb-2 pl-1">
            <span>{t("modelLabel")} <span className="text-red-400">*</span></span>
            <ProviderIcon model={value} size={14} showName />
          </label>
          <div className="relative">
            {providerKey && (
              <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <ProviderIcon provider={providerKey} size={14} />
              </div>
            )}
            <input
              type="text"
              value={value || ""}
              onChange={handleCustomInput}
              placeholder={t("customModelPlaceholder")}
              className={`glass-input w-full py-3 rounded-xl pr-4 ${providerKey ? "pl-11" : "px-4"}`}
            />
          </div>
          <p className="text-xs th-text-ghost mt-1.5 pl-1">
            {t("formatPrefix")}{" "}
            <span className="text-purple-300 font-mono">provider/model-name</span>
            <br />
            {t("egPrefix")} mistral/mistral-large-latest, ovhcloud/Mistral-Nemo-Instruct-2407
          </p>
          {isKnownProvider && (
            <button
              type="button"
              onClick={handleBackToList}
              className="text-xs text-blue-400 hover:text-blue-300 mt-1.5 pl-1"
            >
              {t("backToList")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export { FALLBACK_PROVIDER_MODELS, PROVIDER_ORDER };
