/**
 * Configuration du client d'API th2agent.
 *
 * Avant, `api.js` codait `const BASE = ""` : chaque appel partait en
 * relatif vers `/api/...`, ce qui suppose d'être servi par l'application
 * Next qui proxie ces routes. La couche d'accès au backend était donc
 * inutilisable ailleurs.
 *
 * Tout passe désormais par ce module. Les valeurs par défaut reproduisent
 * exactement l'ancien comportement — base vide, jeton dans localStorage,
 * évènement `auth:unauthorized` sur le window — donc l'application Next
 * ne change pas d'un octet. Un autre consommateur appelle
 * `configureClient()` et pointe le backend de son choix.
 */

import { authStorage } from "./authStorage.js";

const DEFAULTS = Object.freeze({
  // Vide = requêtes relatives, comme historiquement.
  baseUrl: "",
  storage: authStorage,
  // Laissé configurable pour les consommateurs sans DOM (Node, CLI, tests).
  onUnauthorized: defaultOnUnauthorized,
});

let config = { ...DEFAULTS };

function defaultOnUnauthorized() {
  // Le front écoute cet évènement pour rediriger vers la page de connexion.
  // Hors navigateur, il n'y a rien à notifier : on ne casse pas pour autant.
  if (typeof window !== "undefined" && typeof CustomEvent !== "undefined") {
    window.dispatchEvent(new CustomEvent("auth:unauthorized"));
  }
}

/**
 * Configure le client. Les clés omises gardent leur valeur courante.
 *
 * @param {object} options
 * @param {string} [options.baseUrl]  Racine du backend th2agent, ex.
 *   `https://agent.example.com`. Vide = relatif.
 * @param {object} [options.storage]  Doit exposer `getToken()`, et
 *   idéalement `setToken()` / `clear()`.
 * @param {Function} [options.onUnauthorized] Appelé sur un 401 définitif.
 */
export function configureClient(options = {}) {
  config = { ...config, ...options };
  return getClientConfig();
}

export function getClientConfig() {
  return { ...config };
}

/** Rétablit les valeurs par défaut — utile entre deux tests. */
export function resetClientConfig() {
  config = { ...DEFAULTS };
}

/**
 * Construit l'URL absolue d'un chemin d'API.
 *
 * Le slash final éventuel de `baseUrl` est retiré : `.../` + `/api/x`
 * donnerait `//api/x`, que certains reverse proxies traitent comme un
 * hôte protocole-relatif.
 */
export function apiUrl(path) {
  const base = config.baseUrl || "";
  return base ? `${base.replace(/\/+$/, "")}${path}` : path;
}

export function getAuthToken() {
  return config.storage?.getToken?.() ?? null;
}

export function setAuthToken(token) {
  config.storage?.setToken?.(token);
}

export function clearAuth() {
  config.storage?.clear?.();
}

export function notifyUnauthorized() {
  config.onUnauthorized?.();
}
