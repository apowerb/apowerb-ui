"use client";

/**
 * useAgentCrud — create/edit/publish agent workflows that live behind the
 * AgentModal and the Publish-to-Hub modal.
 *
 * These are the heaviest payload builders in the DiagramEditor and were
 * extracted verbatim from the old monolith. The hook keeps all the UI state
 * (newAgent form, modal visibility, publish form, publishing flag) and the
 * async handlers that talk to the API.
 */

import { useState } from "react";
import {
  getAgent,
  createAgent as apiCreateAgent,
  updateAgent as apiUpdateAgent,
  reloadAgent as apiReloadAgent,
  createToolConfig,
  publishToHub,
} from "@/lib/api";
import { useToast } from "../Toast";
import {
  typeToCategory,
  parseSubAgents,
  parseTools,
  parseOutputSchema,
  parseMcpServers,
} from "./diagramUtils";

const DEFAULT_NEW_AGENT = {
  name: "",
  category: "Base",
  agent_model: "",
  model_api_key: "",
  agent_description: "",
  agent_instruction: "",
  agent_tools: [],
  organization_id: "",
  owner_id: "",
  subAgents: [],
  memory_enabled: false,
  artifacts_enabled: false,
  guardrails_config: null,
  superagent_template_id: null,
  output_schema: null,
  mcp_servers: [],
  agent_skills: [],
};

const CATEGORY_TO_TYPE = {
  Base: "base",
  Sequential: "sequential",
  Parallel: "parallel",
  Loop: "loop",
  Router: "router",
};

export function useAgentCrud({ allAgents, fetchData, tabs, setTabs }) {
  const toast = useToast();

  // Create / Edit modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAgentId, setEditingAgentId] = useState(null);
  const [newAgent, setNewAgent] = useState(DEFAULT_NEW_AGENT);

  // Publish modal state
  const [publishAgent, setPublishAgent] = useState(null);
  const [publishForm, setPublishForm] = useState({
    hub_name: "",
    hub_description: "",
    hub_tags: "",
  });
  const [publishing, setPublishing] = useState(false);

  const openCreateModal = () => {
    setNewAgent({ ...DEFAULT_NEW_AGENT });
    setEditingAgentId(null);
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setEditingAgentId(null);
  };

  const openEditModal = async (agent) => {
    try {
      const full = await getAgent(agent.id);

      let parsedParams = full.agent_model_params || {};
      if (typeof parsedParams === "string") {
        try {
          parsedParams = JSON.parse(parsedParams);
        } catch {
          parsedParams = {};
        }
      }
      const {
        model_api_key: apiKey,
        onedrive_file_ref: onedriveRef,
        ...templateParams
      } = parsedParams;

      // Rehydrate the OneDrive picker from the ref stashed at create time
      // so the user sees the file currently wired into the agent and can
      // swap it without retyping the path.
      const onedriveFile = onedriveRef?.item_path
        ? {
            item_path: onedriveRef.item_path,
            email_column: onedriveRef.email_column || "",
            filename: onedriveRef.filename || null,
          }
        : null;

      setNewAgent({
        name: full.agent_name || "",
        category: typeToCategory[full.agent_type] || "Base",
        agent_model: full.agent_model || "",
        model_api_key: apiKey || "",
        agent_description: full.agent_description || "",
        agent_instruction: full.agent_instruction || "",
        agent_tools: parseTools(full.agent_tools),
        organization_id: full.organization_id || "",
        owner_id: full.owner_id || "",
        subAgents: parseSubAgents(full.sub_agents),
        memory_enabled: !!full.memory_enabled,
        artifacts_enabled: !!full.artifacts_enabled,
        guardrails_config: full.guardrails_config || null,
        superagent_template_id: full.superagent_template_id || null,
        template_model_params:
          Object.keys(templateParams).length > 0 ? templateParams : null,
        loop_max_iterations: full.loop_max_iterations || null,
        loop_exit_instruction: full.loop_exit_instruction || null,
        output_schema: parseOutputSchema(full.output_schema),
        mcp_servers: parseMcpServers(full.mcp_servers),
        agent_skills: (() => {
          try {
            const raw = full.agent_skills;
            if (Array.isArray(raw)) return raw;
            if (typeof raw === "string") return JSON.parse(raw);
            return [];
          } catch {
            return [];
          }
        })(),
        onedrive_file: onedriveFile,
      });
      console.log(
        "[openEditModal] agent_tools from API:",
        full.agent_tools,
        "→ parsed:",
        parseTools(full.agent_tools),
      );
      setEditingAgentId(agent.id);
      setShowCreateModal(true);
    } catch (err) {
      console.error("Failed to load agent for editing:", err);
      toast.error(`Failed to load agent: ${err.message}`);
    }
  };

  const buildBaseModalPayload = (src) => {
    const payload = {
      agent_name: src.name,
      agent_model: src.agent_model,
      agent_description: src.agent_description,
      agent_instruction: src.agent_instruction,
      agent_tools: Array.isArray(src.agent_tools) ? src.agent_tools : [],
      agent_type: CATEGORY_TO_TYPE[src.category] || "base",
      sub_agents: Array.isArray(src.subAgents) ? src.subAgents : [],
      organization_id: src.organization_id,
      owner_id: src.owner_id,
      memory_enabled: src.memory_enabled || false,
      artifacts_enabled: src.artifacts_enabled || false,
      guardrails_config: src.guardrails_config || null,
      superagent_template_id: src.superagent_template_id || null,
      output_schema: src.output_schema || null,
      mcp_servers: Array.isArray(src.mcp_servers) ? src.mcp_servers : [],
      agent_skills: Array.isArray(src.agent_skills) ? src.agent_skills : [],
      tags: Array.isArray(src.tags) ? src.tags : [],
    };

    const templateParams = src.template_model_params || {};
    const params = { ...templateParams };
    if (src.model_api_key && src.model_api_key.trim()) {
      params.model_api_key = src.model_api_key;
    }
    if (Object.keys(params).length > 0) {
      payload.agent_model_params = params;
    }

    if (
      src.propagateApiKey &&
      src.model_api_key &&
      src.model_api_key.trim()
    ) {
      payload.propagate_api_key = true;
    }

    return payload;
  };

  const handleCreateFromModal = async () => {
    if (!newAgent.name.trim()) {
      toast.warning("Please enter an agent name");
      return;
    }
    const duplicate = allAgents.find(
      (a) =>
        a.agent_name?.toLowerCase() === newAgent.name.trim().toLowerCase(),
    );
    if (duplicate) {
      toast.error("An agent with this name already exists");
      return;
    }
    // Gate: templates that require a OneDrive file must have one picked
    // before we submit, otherwise the placeholder stays in the instruction.
    if (newAgent.requires_onedrive_file && !newAgent.onedrive_file?.item_path) {
      toast.warning("Please pick the OneDrive Excel file for this agent.");
      return;
    }

    try {
      const payload = buildBaseModalPayload(newAgent);

      // Substitute the template's OneDrive + email-column placeholders
      // with the actual values so the LLM never has to ask the user for
      // them at runtime. Also stash the file ref in agent_model_params so
      // the edit flow can rehydrate the picker and regenerate the
      // instruction if the user picks a different file later.
      if (
        newAgent.requires_onedrive_file &&
        newAgent.onedrive_file?.item_path &&
        typeof payload.agent_instruction === "string"
      ) {
        const pathPlaceholder = newAgent.onedrive_placeholder || "<ITEM_PATH>";
        payload.agent_instruction = payload.agent_instruction
          .split(pathPlaceholder)
          .join(newAgent.onedrive_file.item_path);
        const emailPlaceholder =
          newAgent.email_column_placeholder || "<EMAIL_COLUMN>";
        const emailColumn = newAgent.onedrive_file.email_column || "Email";
        payload.agent_instruction = payload.agent_instruction
          .split(emailPlaceholder)
          .join(emailColumn);

        payload.agent_model_params = {
          ...(payload.agent_model_params || {}),
          onedrive_file_ref: {
            item_path: newAgent.onedrive_file.item_path,
            email_column: emailColumn,
            filename: newAgent.onedrive_file.filename || null,
          },
        };
      }

      // DB tool-config auto-creation (legacy behaviour preserved).
      if (newAgent.db_credentials) {
        const dbCreds = newAgent.db_credentials;

        if (dbCreds.tool_config_id) {
          if (!payload.agent_tools.includes(dbCreds.tool_config_id)) {
            payload.agent_tools = [
              ...payload.agent_tools,
              dbCreds.tool_config_id,
            ];
          }
        } else if (
          Object.entries(dbCreds).some(([k, v]) => k.startsWith("DB_") && v)
        ) {
          try {
            const cleanCreds = Object.fromEntries(
              Object.entries(dbCreds).filter(
                ([k, v]) => k.startsWith("DB_") && v,
              ),
            );
            const configName =
              dbCreds.save_connector && dbCreds.connector_name
                ? dbCreds.connector_name.trim()
                : `${newAgent.name}_db`;
            const configData = {
              tool_config_name: configName,
              tool_name: "database.tool_run_sql",
              tool_config_params: cleanCreds,
              tool_category: "database",
              organization_id: newAgent.organization_id || "",
              owner_id: newAgent.owner_id || "",
              status: "active",
              tool_config_type: "active",
            };
            const created = await createToolConfig(configData);
            if (
              created?.tool_config_id &&
              !payload.agent_tools.includes(created.tool_config_id)
            ) {
              payload.agent_tools = [
                ...payload.agent_tools,
                created.tool_config_id,
              ];
            }
          } catch (configErr) {
            console.error(
              "[handleCreateFromModal] DB config creation failed:",
              configErr,
            );
            toast.error(
              "Failed to save database connection. The agent will be created without DB access.",
            );
          }
        }
      }

      await apiCreateAgent(payload);
      setShowCreateModal(false);
      fetchData();
      // th2prospect : declenche l'onboarding (etape 0 - profil emetteur) a la
      // creation d'un agent issu du template th2prospect. Le modal auto-contenu
      // ne s'affiche que si le profil est absent.
      if (
        payload.superagent_template_id === "th2prospect_outbound" &&
        typeof window !== "undefined"
      ) {
        window.dispatchEvent(new CustomEvent("th2prospect:agent-created"));
      }
    } catch (err) {
      if (err.status === 409 || err.message?.includes("already exists")) {
        toast.warning(
          `Agent "${newAgent.name}" already exists. Please choose a different name.`,
        );
      } else {
        toast.error(`Failed to create agent: ${err.message}`);
      }
    }
  };

  const handleEditFromModal = async () => {
    if (!editingAgentId) return;
    if (!newAgent.name.trim()) {
      toast.warning("Please enter an agent name");
      return;
    }
    const duplicate = allAgents.find((a) => {
      const aid = a.agent_id != null ? `agent${a.agent_id}` : a.agent_name;
      return (
        aid !== editingAgentId &&
        a.agent_name?.toLowerCase() === newAgent.name.trim().toLowerCase()
      );
    });
    if (duplicate) {
      toast.error("An agent with this name already exists");
      return;
    }
    // Gate: templates that require a OneDrive file must keep one picked
    // before submit — same rule as create.
    if (
      newAgent.requires_onedrive_file &&
      !newAgent.onedrive_file?.item_path
    ) {
      toast.warning("Please pick the OneDrive Excel file for this agent.");
      return;
    }

    try {
      const payload = buildBaseModalPayload(newAgent);

      if (newAgent.loop_max_iterations) {
        payload.loop_max_iterations = newAgent.loop_max_iterations;
      }
      if (newAgent.loop_exit_instruction) {
        payload.loop_exit_instruction = newAgent.loop_exit_instruction;
      }

      // Regenerate agent_instruction from the raw template (with placeholders)
      // whenever we have one on hand — this covers both "user swapped the
      // file" and "user edited nothing but we want the stored instruction to
      // stay in sync with the picked file". If no raw template is available
      // (e.g. agent was not created from a template, or template fetch
      // failed), leave the instruction as the user edited it.
      if (
        newAgent.requires_onedrive_file &&
        newAgent.onedrive_file?.item_path &&
        typeof newAgent.template_instruction_raw === "string" &&
        newAgent.template_instruction_raw.length > 0
      ) {
        const pathPlaceholder =
          newAgent.onedrive_placeholder || "<ITEM_PATH>";
        const emailPlaceholder =
          newAgent.email_column_placeholder || "<EMAIL_COLUMN>";
        const emailColumn =
          newAgent.onedrive_file.email_column || "Email";
        payload.agent_instruction = newAgent.template_instruction_raw
          .split(pathPlaceholder)
          .join(newAgent.onedrive_file.item_path)
          .split(emailPlaceholder)
          .join(emailColumn);

        payload.agent_model_params = {
          ...(payload.agent_model_params || {}),
          onedrive_file_ref: {
            item_path: newAgent.onedrive_file.item_path,
            email_column: emailColumn,
            filename: newAgent.onedrive_file.filename || null,
          },
        };
      }

      console.log(
        "[handleEditFromModal] payload.agent_tools:",
        payload.agent_tools,
      );
      await apiUpdateAgent(editingAgentId, payload);
      // Hot-reload the ADK runtime so open chat sessions pick up the edit
      // without requiring a "New chat". Best-effort: never block the save.
      apiReloadAgent(editingAgentId).catch((err) =>
        console.warn("[agent-reload] failed:", err?.message || err),
      );
      setShowCreateModal(false);
      setEditingAgentId(null);
      fetchData();
      toast.success(`Agent "${newAgent.name}" updated`);

      const openTab = tabs.find((t) => t.id === editingAgentId);
      if (openTab) {
        try {
          const refreshed = await getAgent(editingAgentId);
          setTabs((prev) =>
            prev.map((t) =>
              t.id === editingAgentId
                ? {
                    ...t,
                    agentData: {
                      agent_name: refreshed.agent_name || "",
                      agent_model: refreshed.agent_model || "",
                      model_api_key: refreshed.model_api_key || "",
                      agent_description: refreshed.agent_description || "",
                      agent_instruction: refreshed.agent_instruction || "",
                      agent_tools: parseTools(refreshed.agent_tools),
                      organization_id: refreshed.organization_id || "",
                      owner_id: refreshed.owner_id || "",
                      agent_type: refreshed.agent_type || "sequential",
                      memory_enabled: refreshed.memory_enabled || false,
                      artifacts_enabled: refreshed.artifacts_enabled || false,
                      guardrails_config: refreshed.guardrails_config || null,
                      superagent_template_id:
                        refreshed.superagent_template_id || null,
                      output_schema: parseOutputSchema(refreshed.output_schema),
                      mcp_servers: parseMcpServers(refreshed.mcp_servers),
                    },
                    isDirty: false,
                  }
                : t,
            ),
          );
        } catch {
          /* tab will be stale but usable */
        }
      }
    } catch (err) {
      toast.error(`Failed to update agent: ${err.message}`);
    }
  };

  // --- Publish to Hub ----------------------------------------------------

  const openPublishModal = (agent) => {
    setPublishForm({
      hub_name: agent.label || "",
      hub_description: agent.agent_description || "",
      hub_tags: "",
    });
    setPublishAgent(agent);
  };

  const closePublishModal = () => setPublishAgent(null);

  const handlePublish = async () => {
    if (!publishAgent) return;
    setPublishing(true);
    try {
      const tags = publishForm.hub_tags
        ? publishForm.hub_tags.split(",").map((t) => t.trim()).filter(Boolean)
        : [];
      await publishToHub({
        agent_id: publishAgent.id,
        hub_name: publishForm.hub_name || publishAgent.label,
        hub_description:
          publishForm.hub_description || publishAgent.agent_description || "",
        hub_tags: tags,
      });
      toast.success("Agent published to Hub!");
      setPublishAgent(null);
    } catch (err) {
      toast.error(`Publish failed: ${err.message}`);
    }
    setPublishing(false);
  };

  return {
    // Create / Edit modal
    showCreateModal,
    editingAgentId,
    newAgent,
    setNewAgent,
    openCreateModal,
    closeCreateModal,
    openEditModal,
    handleCreateFromModal,
    handleEditFromModal,

    // Publish modal
    publishAgent,
    openPublishModal,
    closePublishModal,
    publishForm,
    setPublishForm,
    publishing,
    handlePublish,
  };
}
