/**
 * Maps integration provider keys (as stored in the `integrations.provider`
 * column, e.g. "microsoft_outlook") to the set of `tool_category` values
 * (as stored in `tool_configs.tool_category`) that belong to that provider.
 *
 * Used by AgentSidebar to filter agents by "uses:<providerKey>".
 */
export const PROVIDER_TO_TOOL_CATEGORIES = {
  microsoft_outlook:    ["outlook_mail"],
  microsoft_teams:      ["teams"],
  microsoft_onedrive:   ["onedrive", "onedrive_write"],
  microsoft_sharepoint: ["sharepoint"],
  google_gmail:         ["google_gmail"],
  google_calendar:      ["google_calendar"],
  google_drive:         ["google_drive"],
  google_sheets:        ["google_sheets"],
  google_docs:          ["google_docs"],
  github:               ["github"],
};

/**
 * Return true if the given provider has a tool-category mapping and therefore
 * can be used as an "uses:" filter target. Providers not in the map should
 * not surface "Used by" jumps.
 */
export function providerHasToolMapping(providerKey) {
  return Array.isArray(PROVIDER_TO_TOOL_CATEGORIES[providerKey])
    && PROVIDER_TO_TOOL_CATEGORIES[providerKey].length > 0;
}
