/**
 * Cross-entity navigation helpers.
 *
 * Centralises the URL-building logic so that every "jump button" in the app
 * targets the same routes. Edit once here, every jump updates.
 */

export const JUMP_PATHS = {
  chat:          "/chat",
  agents:        "/agents",
  integrations:  "/integrations",
  tools:         "/tool-box",
  webhooks:      "/webhooks",
  bi:            "/bi",
  marketplace:   "/marketplace",
};

/**
 * Build a target URL for a lateral jump.
 *
 * @param {string} kind — "chat" | "agents" | "integrations" | "tools" | "webhooks" | "bi" | "marketplace"
 * @param {object} [params] — optional query string parameters
 * @returns {string} absolute path, e.g. "/chat?agent=agent42"
 */
export function buildJumpUrl(kind, params = {}) {
  const base = JUMP_PATHS[kind];
  if (!base) throw new Error(`[jumps] unknown kind: ${kind}`);
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== "",
  );
  if (entries.length === 0) return base;
  const qs = new URLSearchParams(entries).toString();
  return `${base}?${qs}`;
}

/**
 * Normalize an agent id (numeric or "agentNN") to "agentNN".
 */
export function toAgentId(id) {
  if (id === null || id === undefined) return "";
  const str = String(id);
  return str.startsWith("agent") ? str : `agent${str}`;
}
