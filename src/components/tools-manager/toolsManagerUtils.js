import { Sparkles, Settings2, Database, Zap, Globe, Terminal, BookOpen } from "lucide-react";

/** Top-level tab definitions for ToolsManager. */
export const TABS = [
  { key: "available-tools",   label: "Available Tools",   icon: Sparkles  },
  { key: "my-configurations", label: "My Configurations", icon: Settings2 },
  { key: "mcp-servers",       label: "MCP Servers",       icon: Database  },
  { key: "skills",            label: "Skills",            icon: Zap       },
  { key: "help",              label: "Help",              icon: BookOpen  },
];

/** Templates shown in the "Add MCP Server" picker. */
export const MCP_TEMPLATES = [
  {
    id: "toolbox-db",
    label: "MCP Toolbox for Databases",
    desc: "Connect to PostgreSQL, MySQL, BigQuery and 20+ databases",
    icon: Database,
    color: "orange",
    defaults: { transport: "http", url: "http://localhost:5000", name: "Database Toolbox" },
  },
  {
    id: "tavily",
    label: "Tavily Web Search",
    desc: "Give your agent the ability to search the web",
    icon: Globe,
    color: "cyan",
    defaults: { transport: "http", url: "https://mcp.tavily.com/mcp/?tavilyApiKey=YOUR_API_KEY", name: "Tavily Search" },
  },
  {
    id: "custom-http",
    label: "Custom HTTP Server",
    desc: "Any MCP server reachable via URL",
    icon: Globe,
    color: "blue",
    defaults: { transport: "http", url: "", name: "" },
  },
  {
    id: "custom-stdio",
    label: "Local Process (Stdio)",
    desc: "Run an MCP server as a local command",
    icon: Terminal,
    color: "purple",
    defaults: { transport: "stdio", command: "npx", args: "-y @modelcontextprotocol/server-everything", name: "" },
  },
];

/** Skills-tab source filter options. */
export const SKILL_FILTERS = [
  { key: "all", label: "All" },
  { key: "portfolio", label: "Built-in" },
  { key: "custom", label: "Custom" },
];

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

/** Build the category filter pill list from the map returned by listTools(). */
export function buildFilterOptions(availableTools) {
  const allCategories = Object.keys(availableTools || {}).sort();
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

/** Human-facing leaf name of a fully-qualified tool string (mirrors the UI display). */
export function toolLeafName(tool) {
  return String(tool).split(".").pop().replace(/^tool_/, "");
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
