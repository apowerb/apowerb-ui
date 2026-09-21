/**
 * URL d'API d'un modèle (`agent_model_params.model_api_base`).
 *
 * Optionnelle : vide, le fournisseur garde son URL par défaut. Renseignée, le
 * backend appelle cette URL en mode OpenAI-compatible (Azure AI Foundry,
 * modèle hébergé chez le client, passerelle LiteLLM…).
 */

/** Valeur nettoyée : on stocke ce qu'on a validé, pas un espace collé en trop. */
export function normalizeModelApiBase(value) {
  return typeof value === "string" ? value.trim() : "";
}

/** true si vide (champ optionnel) ou URL http(s) absolue. */
export function isValidModelApiBase(value) {
  const v = normalizeModelApiBase(value);
  if (!v) return true;
  try {
    const url = new URL(v);
    return (url.protocol === "http:" || url.protocol === "https:") && !!url.hostname;
  } catch {
    return false;
  }
}

/**
 * Params à envoyer : l'URL nettoyée, ou pas de clé du tout si le champ est
 * vide — le PUT remplace `agent_model_params` en entier, c'est donc ainsi
 * qu'on efface une URL enregistrée.
 */
export function withModelApiBase(params) {
  const { model_api_base: raw, ...rest } = params || {};
  const v = normalizeModelApiBase(raw);
  return v ? { ...rest, model_api_base: v } : rest;
}
