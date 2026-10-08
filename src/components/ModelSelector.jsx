"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "use-intl";
import { getModels } from "@/lib/api";
import ProviderIcon, { extractProvider, PROVIDERS } from "./ProviderIcon";

// ---------------------------------------------------------------------------
// Static registry — popular models per LiteLLM provider. Mirror of the
// backend catalog (apowerb configs/models.py): same ids, first = recommended.
// ---------------------------------------------------------------------------

const FALLBACK_PROVIDER_MODELS = {
  anthropic: [
    { id: "claude-opus-5-5",   name: "Claude Opus 5.5",   tag: "Recommended" },
    { id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5", tag: "Balanced" },
    { id: "claude-haiku-5-5",  name: "Claude Haiku 5.5",  tag: "Fast" },
    { id: "claude-fable-5-1",  name: "Claude Fable 5.1",  tag: "Most capable" },
  ],
  openai: [
    { id: "gpt-6.1-sol", name: "GPT-6.1 Sol", tag: "Recommended" },
    { id: "gpt-6-astra", name: "GPT-6 Astra", tag: "Most capable" },
    { id: "gpt-6-luna",  name: "GPT-6 Luna",  tag: "Fast" },
  ],
  mistral: [
    { id: "mistral-large-latest",  name: "Mistral Large",  tag: "Recommended" },
    { id: "mistral-medium-latest", name: "Mistral Medium", tag: "Balanced" },
    { id: "mistral-small-latest",  name: "Mistral Small",  tag: "Fast" },
    { id: "codestral-latest",      name: "Codestral",      tag: "Code" },
  ],
  gemini: [
    { id: "gemini-3.8-flash",       name: "Gemini 3.8 Flash",      tag: "Recommended" },
    { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro",        tag: "Preview" },
    { id: "gemini-3.5-flash-lite",  name: "Gemini 3.5 Flash-Lite", tag: "Fastest" },
  ],
  deepseek: [
    { id: "deepseek-flash",  name: "DeepSeek V4.1 Flash", tag: "Recommended" },
    { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro",     tag: "Powerful" },
  ],
  groq: [
    { id: "openai/gpt-oss-120b",  name: "GPT-OSS 120B", tag: "Recommended" },
    { id: "openai/gpt-oss-20b",   name: "GPT-OSS 20B",  tag: "Fast" },
    { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B", tag: "Fastest" },
  ],
};

// Le modèle par défaut en tête : c'est le choix recommandé (aucune clé à
// saisir). Il n'apparaît que si le backend le sert vraiment — GET /models
// ne renvoie ce provider que lorsque DEFAULT_LLM_MODEL/API_KEY sont
// configurés côté serveur, et il est absent du fallback statique. La clé
// `thaink2` est l'identifiant apparié avec le backend, jamais un libellé.
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



  // Modèle par défaut : un seul modèle, choisi par l'exploitant du serveur.
  // On n'affiche ni liste ni champ libre — laisser l'utilisateur éditer ce
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

      {/* ---- Modèle fourni par le serveur : rien à configurer ---- */}
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
