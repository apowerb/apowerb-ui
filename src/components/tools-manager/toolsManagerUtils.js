import {
  Sparkles, Settings2, Database, Zap, Globe, Terminal, BookOpen, Search,
  Mail, ChartColumn, Image, Brain, FileText, Calendar, HardDrive, Sheet,
  MessageSquare, Wrench, KeyRound, Cloud, Megaphone, ListChecks, Code2, Workflow,
} from "lucide-react";

/**
 * Top-level tab definitions for ToolsManager. `labelKey` / `hintKey` live
 * in the `ToolsManager` i18n namespace; `action` names the primary action
 * the header offers while the tab is active.
 */
export const TABS = [
  { key: "available-tools",   labelKey: "tabTools",   hintKey: "hintTools",   icon: Sparkles,  action: null },
  { key: "my-configurations", labelKey: "tabConfigs", hintKey: "hintConfigs", icon: Settings2, action: "newConfig" },
  { key: "mcp-servers",       labelKey: "tabMcp",     hintKey: "hintMcp",     icon: Database,  action: "newMcp" },
  { key: "skills",            labelKey: "tabSkills",  hintKey: "hintSkills",  icon: Zap,       action: "newSkill" },
  { key: "help",              labelKey: "tabHelp",    hintKey: "hintHelp",    icon: BookOpen,  action: null },
];

/**
 * Templates shown in the "Add MCP Server" picker. Labels come from the
 * `McpServerForm.templates.<id>` i18n keys. Tailwind only compiles class
 * names it can read literally, so each accent is spelled out in full here
 * rather than built from a colour name at render time.
 */
export const MCP_TEMPLATES = [
  {
    id: "toolbox-db",
    icon: Database,
    accent: { tile: "bg-amber-500/15 text-amber-400", active: "border-amber-500/50 bg-amber-500/8 ring-1 ring-amber-500/30" },
    defaults: { transport: "http", url: "http://localhost:5000", name: "Database Toolbox" },
  },
  {
    id: "tavily",
    icon: Search,
    accent: { tile: "bg-cyan-500/15 text-cyan-500", active: "border-cyan-500/50 bg-cyan-500/8 ring-1 ring-cyan-500/30" },
    defaults: { transport: "http", url: "https://mcp.tavily.com/mcp/?tavilyApiKey=YOUR_API_KEY", name: "Tavily Search" },
  },
  {
    id: "custom-http",
    icon: Globe,
    accent: { tile: "bg-blue-500/15 text-blue-400", active: "border-blue-500/50 bg-blue-500/8 ring-1 ring-blue-500/30" },
    defaults: { transport: "http", url: "", name: "" },
  },
  {
    id: "custom-stdio",
    icon: Terminal,
    accent: { tile: "bg-purple-500/15 text-purple-400", active: "border-purple-500/50 bg-purple-500/8 ring-1 ring-purple-500/30" },
    defaults: { transport: "stdio", command: "npx", args: "-y @modelcontextprotocol/server-everything", name: "" },
  },
];

/** Skills-tab source filter options (labels: `SkillsTab.<labelKey>`). */
export const SKILL_FILTERS = [
  { key: "all", labelKey: "filterAll" },
  { key: "portfolio", labelKey: "builtInBadge" },
  { key: "custom", labelKey: "customBadge" },
];

/** tool_category under which the backend stores MCP servers as tool configs. */
export const MCP_CATEGORY = "mcp_server";

/**
 * Icon per portfolio category, matched on keywords so that a category added
 * later still gets a sensible icon instead of the generic wrench.
 */
const CATEGORY_ICON_RULES = [
  [/mail|outlook|gmail/, Mail],
  [/calendar/, Calendar],
  [/sheet/, Sheet],
  [/drive|s3|onedrive|file/, HardDrive],
  [/docs?$|document/, FileText],
  [/sql|database|db_|_db/, Database],
  [/search|web/, Search],
  [/visual|chart|intelligence|report/, ChartColumn],
  [/image/, Image],
  [/memory|rag/, Brain],
  [/teams|chat|slack|message/, MessageSquare],
  [/auth/, KeyRound],
  [/marketing|campaign/, Megaphone],
  [/tracker|followup/, ListChecks],
  [/api|code/, Code2],
  [/workflow/, Workflow],
  [/cloud|aws|gcp/, Cloud],
];

export function categoryIcon(category) {
  const key = String(category || "").toLowerCase().replace(/^tools_/, "");
  const rule = CATEGORY_ICON_RULES.find(([re]) => re.test(key));
  return rule ? rule[1] : Wrench;
}

/** "google_sheets" → "Google sheets" — fallback when no translated label exists. */
export function humanizeCategory(category) {
  const s = String(category || "").replace(/^tools_/, "").replace(/[_-]+/g, " ").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

/** Tool configurations proper — MCP servers are listed in their own tab. */
export function isToolConfig(config) {
  return config?.tool_category !== MCP_CATEGORY;
}

/** A config's `tool_name` is either one tool or a JSON array of tools. */
export function parseToolNames(raw) {
  const str = String(raw || "");
  if (str.startsWith("[")) {
    try {
      const list = JSON.parse(str);
      if (Array.isArray(list)) return list.map(String);
    } catch { /* fall through to the raw value */ }
  }
  return str ? [str] : [];
}

/** Template id matching a saved MCP server, so the edit form highlights the right one. */
export function templateForMcp(mcp) {
  if (mcp?.mcp_type === "toolbox-db") return "toolbox-db";
  return mcp?.transport === "stdio" ? "custom-stdio" : "custom-http";
}

/** One-line endpoint shown on an MCP server card. */
export function mcpEndpoint(mcp) {
  if (mcp?.mcp_type === "toolbox-db" && mcp.db_config) {
    const { db_type, user, host, port, database } = mcp.db_config;
    return `${db_type}://${user ? `${user}@` : ""}${host}${port ? `:${port}` : ""}/${database}`;
  }
  if (mcp?.transport === "stdio") return [mcp.command, ...(mcp.args || [])].filter(Boolean).join(" ");
  // Query strings routinely carry API keys (e.g. ?tavilyApiKey=…): never show them.
  const url = String(mcp?.url || "");
  return url.split("?")[0];
}

/** Default MCP form state (new or reset). */
export const DEFAULT_MCP = {
  name: "", transport: "http", url: "", command: "", args: "",
  headers: {}, params: {}, env: {}, toolset: "",
};

/** Default DB config — used when selectedTemplate === "toolbox-db". */
export const DEFAULT_DB_CONFIG = {
  db_type: "postgres", host: "", port: "5432", database: "", user: "", password: "", sslmode: "require",
};

/** Default skill form state. */
export const DEFAULT_SKILL = {
  skill_name: "", description: "", instructions: "", references: {}, assets: {}, is_public: false,
};

/**
 * Categories qui contiennent au moins un outil.
 *
 * L'API en renvoie davantage que ce que la liste affiche : les categories
 * vides produisaient une puce de filtre menant a « No tools match », et
 * gonflaient le compteur de l'en-tete (32 annonces contre 28 listees).
 */
export function nonEmptyCategories(availableTools) {
  return Object.entries(availableTools || {})
    .filter(([, tools]) => Array.isArray(tools) && tools.length > 0)
    .map(([category]) => category);
}

/** Build the category filter options from the map returned by listTools(). */
export function buildFilterOptions(availableTools) {
  const allCategories = nonEmptyCategories(availableTools).sort();
  return [
    { key: "all", label: "All" },
    ...allCategories.map((c) => ({ key: c, label: c.replace(/^tools_/, "") })),
  ];
}

/** Flatten the { category: [tool, …] } map into a [{ name, category }, …] list. */
export function flattenTools(availableTools) {
  return Object.entries(availableTools || {}).flatMap(([category, tools]) =>
    tools.map((tool) => ({ name: tool, category })),
  );
}

/**
 * Human-facing leaf name of a fully-qualified tool string (mirrors the UI
 * display). Namespacing uses "." for most categories ("pkg.mod.tool_x")
 * and ":" for a published workflow tool ("workflow:send_report", T2) —
 * strip whichever separator appears last, so the leaf never repeats the
 * category badge shown next to it.
 */
export function toolLeafName(tool) {
  const str = String(tool);
  const cut = Math.max(str.lastIndexOf("."), str.lastIndexOf(":"));
  const leaf = cut >= 0 ? str.slice(cut + 1) : str;
  return leaf.replace(/^tool_/, "");
}

/** Filter + sort the category-grouped tools for the Available Tools tab. */
export function filterAndSortTools(availableTools, { toolSearch, categoryFilter, toolSortAsc }) {
  const filteredEntries = Object.entries(availableTools || {})
    .filter(([category]) => categoryFilter === "all" || category === categoryFilter)
    .map(([category, tools]) => {
      const filtered = toolSearch
        ? tools.filter((t) =>
            t.toLowerCase().includes(toolSearch.toLowerCase()) ||
            category.toLowerCase().includes(toolSearch.toLowerCase()),
          )
        : tools;
      const sortedTools = [...filtered].sort((a, b) =>
        toolLeafName(a).localeCompare(toolLeafName(b), undefined, { sensitivity: "base" }),
      );
      return [category, sortedTools];
    })
    .filter(([, tools]) => tools.length > 0);

  return [...filteredEntries].sort(([a], [b]) => {
    const cmp = a.localeCompare(b);
    return toolSortAsc ? cmp : -cmp;
  });
}

/** Filter saved tool configurations. Category lookup resolves via `allTools`. */
export function filterConfigs(toolConfigs, allTools, { configSearch, configCategoryFilter }) {
  return (toolConfigs || []).filter((c) => {
    const matchesSearch =
      !configSearch ||
      c.tool_config_name?.toLowerCase().includes(configSearch.toLowerCase()) ||
      c.tool_name?.toLowerCase().includes(configSearch.toLowerCase());
    const resolvedCategory =
      allTools.find((t) => t.name === c.tool_name)?.category ||
      c.tool_category ||
      "";
    const matchesCategory =
      configCategoryFilter === "all" || resolvedCategory === configCategoryFilter;
    return matchesSearch && matchesCategory;
  });
}

/** Filter MCP servers on name/url/command. */
export function filterMcp(mcpConfigs, mcpSearch) {
  return (mcpConfigs || []).filter((c) =>
    !mcpSearch ||
    c.name?.toLowerCase().includes(mcpSearch.toLowerCase()) ||
    c.url?.toLowerCase().includes(mcpSearch.toLowerCase()) ||
    c.command?.toLowerCase().includes(mcpSearch.toLowerCase()),
  );
}

/** Filter skills on name/description + source. */
export function filterSkills(skills, { skillSearch, skillFilter }) {
  return (skills || []).filter((s) => {
    const matchesSearch = !skillSearch ||
      (s.skill_name || "").toLowerCase().includes(skillSearch.toLowerCase()) ||
      (s.description || "").toLowerCase().includes(skillSearch.toLowerCase());
    const matchesFilter = skillFilter === "all" ||
      (skillFilter === "portfolio" && s.source === "portfolio") ||
      (skillFilter === "custom" && s.source === "custom");
    return matchesSearch && matchesFilter;
  });
}

/** Parse a skill coming from the API into the form shape used by the modal. */
export function parseSkillForEdit(skill) {
  let refs = skill.references_data || skill.references || {};
  if (typeof refs === "string") try { refs = JSON.parse(refs); } catch { refs = {}; }
  let assets = skill.assets_data || skill.assets || {};
  if (typeof assets === "string") try { assets = JSON.parse(assets); } catch { assets = {}; }
  return {
    skill_name: skill.skill_name || "",
    description: skill.description || "",
    instructions: skill.instructions || "",
    references: refs,
    assets: assets,
    is_public: skill.is_public === true || skill.is_public === "true",
  };
}

/** Build the MCP save payload from form state. */
export function buildMcpPayload({ newMcp, selectedTemplate, dbConfig }) {
  const payload = {
    name: newMcp.name,
    config_name: newMcp.name,
    transport: newMcp.transport,
    toolset: newMcp.toolset,
  };

  if (selectedTemplate === "toolbox-db") {
    payload.mcp_type = "toolbox-db";
    payload.db_config = dbConfig;
    payload.url = newMcp.url || "http://localhost:5000";
  } else if (newMcp.transport === "stdio") {
    payload.command = newMcp.command;
    payload.args = newMcp.args ? newMcp.args.split(" ").filter(Boolean) : [];
    payload.env = newMcp.env;
  } else {
    payload.url = newMcp.url;
    payload.headers = newMcp.headers;
    payload.params = newMcp.params;
  }
  return payload;
}

/** Whether the MCP save button should be disabled given the current form. */
export function isMcpSaveDisabled({ newMcp, selectedTemplate, dbConfig }) {
  if (!newMcp.name || !selectedTemplate) return true;
  if (selectedTemplate === "toolbox-db") {
    return !dbConfig.host || !dbConfig.database || !dbConfig.user;
  }
  if (newMcp.transport === "http") {
    return !newMcp.url || newMcp.url.includes("YOUR_API_KEY");
  }
  if (newMcp.transport === "stdio") {
    return !newMcp.command;
  }
  return false;
}

/** Initial config payload when clicking "New Tool Config". */
export function createEmptyConfig({ category = "", organizationId, ownerEmail }) {
  return {
    tool_config_name: "",
    tool_name: "",
    tool_config_params: {},
    tool_category: category,
    organization_id: organizationId,
    project_id: "thaink2",
    owner_id: ownerEmail || "",
    status: "active",
    tool_config_type: "active",
    tags: [],
  };
}
