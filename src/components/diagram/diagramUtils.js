/**
 * Pure utilities + constants for the DiagramEditor.
 *
 * Extracted from the monolithic DiagramEditor.jsx during the B9 refactor so
 * parsing logic can be unit-tested in isolation and reused across smaller
 * sub-components (header panel, hook, modals) without pulling React in.
 */

export const categoryColors = {
  Base: "bg-blue-500",
  Parallel: "bg-blue-500",
  Sequential: "bg-purple-500",
  Loop: "bg-purple-500",
  Router: "bg-blue-400",
};

export const typeToCategory = {
  base: "Base",
  parallel: "Parallel",
  sequential: "Sequential",
  loop: "Loop",
  router: "Router",
};

export function parseSubAgents(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    // Handle Python None string
    if (raw === "None" || raw === "null" || raw.trim() === "") return [];
    try {
      // Replace both Python-style single quotes and unicode escaped quotes
      const jsonStr = raw.replace(/'/g, '"').replace(/\\u0027/g, '"');
      const parsed = JSON.parse(jsonStr);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error("[parseSubAgents] failed to parse:", raw, e);
      return [];
    }
  }
  return [];
}

export function parseTools(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    if (raw === "None" || raw === "null" || raw.trim() === "" || raw === "[]")
      return [];
    try {
      const jsonStr = raw.replace(/'/g, '"').replace(/\\u0027/g, '"');
      const parsed = JSON.parse(jsonStr);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function parseOutputSchema(raw) {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return null;
}

export function parseMcpServers(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function mapApiAgent(a) {
  const category = typeToCategory[a.agent_type] || "Base";
  const subAgents = parseSubAgents(a.sub_agents);
  const tools = parseTools(a.agent_tools);
  const agentId = a.agent_id != null ? `agent${a.agent_id}` : a.agent_name;

  // Extract model_api_key from agent_model_params (may arrive as JSON string)
  let parsedParams = a.agent_model_params || {};
  if (typeof parsedParams === "string") {
    try {
      parsedParams = JSON.parse(parsedParams);
    } catch {
      parsedParams = {};
    }
  }
  const modelApiKey = parsedParams.model_api_key || "";
  // Preserve non-key params (e.g. temperature) for round-trip on update
  const { model_api_key: _key, ...templateModelParams } = parsedParams;

  return {
    id: agentId,
    agent_id: a.agent_id,
    label: a.agent_name,
    x: 0,
    y: 0,
    color: categoryColors[category] || "bg-gray-500",
    selectedTool: (tools && tools[0]) || "",
    category,
    subAgents: [...new Set(subAgents)],
    agent_model: a.agent_model || "",
    model_api_key: modelApiKey,
    agent_description: a.agent_description || "",
    agent_instruction: a.agent_instruction || "",
    agent_tools: tools,
    hub_origin_id: a.hub_origin_id || null,
    organization_id: a.organization_id || "",
    owner_id: a.owner_id || "",
    memory_enabled: !!a.memory_enabled,
    superagent_template_id: a.superagent_template_id || null,
    template_model_params:
      Object.keys(templateModelParams).length > 0 ? templateModelParams : null,
    loop_max_iterations: a.loop_max_iterations || null,
    loop_exit_instruction: a.loop_exit_instruction || null,
    output_schema: parseOutputSchema(a.output_schema),
    mcp_servers: parseMcpServers(a.mcp_servers),
  };
}

export function createEmptyAgentData() {
  return {
    agent_name: "",
    agent_model: "",
    model_api_key: "",
    agent_description: "",
    agent_instruction: "",
    agent_tools: [],
    organization_id: "",
    owner_id: "",
    agent_type: "sequential",
    memory_enabled: false,
    artifacts_enabled: false,
    guardrails_config: null,
    superagent_template_id: null,
    loop_max_iterations: null,
    loop_exit_instruction: null,
    output_schema: null,
    mcp_servers: [],
  };
}
