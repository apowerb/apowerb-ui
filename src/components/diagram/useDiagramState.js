"use client";

/**
 * useDiagramState — composition root for the DiagramEditor.
 *
 * Owns only what is inherently shared: query params, the cached agents
 * list, availability (tools / tool configs / MCP configs), loading flag,
 * the details / delete modals, and the authenticated save flow.
 *
 * Everything else is delegated:
 *   - useAgentTabs        → tab lifecycle + canvas undo/redo + keybinds
 *   - useCanvasHandlers   → drag/drop/insert/connect graph editing
 *   - useWorkflowRunner   → SSE + legacy workflow execution
 *   - useAgentCrud        → AgentModal create/edit + Publish-to-Hub
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "@/lib/navigation";
import { useToast } from "../Toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  listAgents,
  listTools,
  listToolConfigs,
  listMcpConfigs,
  createAgent as apiCreateAgent,
  updateAgent as apiUpdateAgent,
  deleteAgent as apiDeleteAgent,
} from "@/lib/api";
import { mapApiAgent } from "./diagramUtils";
import { useAgentTabs } from "./useAgentTabs";
import { useCanvasHandlers } from "./useCanvasHandlers";
import { useWorkflowRunner } from "./useWorkflowRunner";
import { useAgentCrud } from "./useAgentCrud";

export function useDiagramState() {
  const toast = useToast();
  const { isAuthenticated, user } = useAuth();
  const searchParams = useSearchParams();
  const selectParam = searchParams.get("select");
  const filterParam = searchParams.get("filter");
  const activeFilter = useMemo(() => {
    if (!filterParam) return null;
    const [kind, value] = filterParam.split(":", 2);
    return kind && value ? { kind, value, raw: filterParam } : null;
  }, [filterParam]);

  const [allAgents, setAllAgents] = useState([]);
  const [availableTools, setAvailableTools] = useState([]);
  const [toolConfigs, setToolConfigs] = useState([]);
  const [mcpConfigs, setMcpConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedHeader, setExpandedHeader] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Details / delete / connect modals live here because they're bound to
  // the cached agents list.
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [viewingAgent, setViewingAgent] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [connectAgent, setConnectAgent] = useState(null);

  const boxes = useMemo(() => allAgents.map(mapApiAgent), [allAgents]);

  // --- Data fetching ------------------------------------------------------

  const fetchData = useCallback(async () => {
    const [agentsResult, toolsResult, toolConfigsResult, mcpConfigsResult] =
      await Promise.allSettled([
        listAgents(),
        listTools(),
        listToolConfigs(),
        listMcpConfigs(),
      ]);

    if (agentsResult.status === "fulfilled") {
      setAllAgents(Array.isArray(agentsResult.value) ? agentsResult.value : []);
    } else {
      console.error("Failed to fetch agents:", agentsResult.reason);
    }

    if (toolsResult.status === "fulfilled") {
      const tools = toolsResult.value;
      let toolNames = [];
      if (Array.isArray(tools)) {
        toolNames = tools.map((t) => t.tool_name || t.name || t);
      } else if (tools && typeof tools === "object") {
        toolNames = Object.values(tools).flat();
      }
      setAvailableTools(toolNames);
    } else {
      console.error("Failed to fetch tools:", toolsResult.reason);
    }

    if (toolConfigsResult.status === "fulfilled") {
      const configs = Array.isArray(toolConfigsResult.value)
        ? toolConfigsResult.value
        : [];
      setToolConfigs(configs);
    } else {
      console.error("Failed to fetch tool configs:", toolConfigsResult.reason);
      setToolConfigs([]);
    }

    if (mcpConfigsResult.status === "fulfilled") {
      setMcpConfigs(
        Array.isArray(mcpConfigsResult.value) ? mcpConfigsResult.value : [],
      );
    } else {
      console.error("Failed to fetch MCP configs:", mcpConfigsResult.reason);
      setMcpConfigs([]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [fetchData, isAuthenticated]);

  // --- Tabs + canvas history ----------------------------------------------

  const tabsApi = useAgentTabs({ allAgents });
  const {
    tabs,
    setTabs,
    activeTab,
    activeTabId,
    setActiveTabId,
    updateAgentData,
    openAgentTab,
    createNewTab,
    closeTab,
    updateCanvasOrder,
    undoCanvas,
    redoCanvas,
  } = tabsApi;

  // --- Canvas handlers (drag/drop/insert/connect) -------------------------

  const canvas = useCanvasHandlers({
    activeTab,
    activeTabId,
    boxes,
    updateCanvasOrder,
    openAgentTab,
  });

  // --- Save current tab ----------------------------------------------------

  const handleSave = async () => {
    if (!activeTab) return;
    const { agentData, canvasOrder } = activeTab;

    if (!agentData.agent_name.trim()) {
      toast.warning("Please enter an agent name");
      return;
    }
    if (!agentData.agent_model.trim()) {
      toast.warning("Please enter a model");
      return;
    }

    const emailDomain = user?.email?.split("@")[1] || "default";
    const orgId = agentData.organization_id?.trim() || emailDomain;
    const ownerId = agentData.owner_id?.trim() || user?.email || "";

    setIsSaving(true);
    try {
      const payload = {
        agent_name: agentData.agent_name,
        agent_model: agentData.agent_model,
        agent_description: agentData.agent_description,
        agent_instruction: agentData.agent_instruction,
        agent_tools: Array.isArray(agentData.agent_tools)
          ? agentData.agent_tools
          : [],
        agent_type: agentData.agent_type || "sequential",
        sub_agents: Array.isArray(canvasOrder) ? canvasOrder : [],
        organization_id: orgId,
        owner_id: ownerId,
        memory_enabled: agentData.memory_enabled || false,
        artifacts_enabled: agentData.artifacts_enabled || false,
        guardrails_config: agentData.guardrails_config || null,
        superagent_template_id: agentData.superagent_template_id || null,
        output_schema: agentData.output_schema || null,
        mcp_servers: agentData.mcp_servers || [],
        agent_skills: Array.isArray(agentData.agent_skills)
          ? agentData.agent_skills
          : [],
      };

      {
        const templateParams = agentData.template_model_params || {};
        const params = { ...templateParams };
        if (agentData.model_api_key && agentData.model_api_key.trim()) {
          params.model_api_key = agentData.model_api_key;
        }
        if (Object.keys(params).length > 0) {
          payload.agent_model_params = params;
        }
      }

      if (
        agentData.propagateApiKey &&
        agentData.model_api_key &&
        agentData.model_api_key.trim()
      ) {
        payload.propagate_api_key = true;
      }

      let result;
      let newId;

      if (activeTab.isNew) {
        const duplicate = allAgents.find(
          (a) =>
            a.agent_name?.toLowerCase() ===
            agentData.agent_name.trim().toLowerCase(),
        );
        if (duplicate) {
          toast.error("An agent with this name already exists");
          setIsSaving(false);
          return;
        }
        result = await apiCreateAgent(payload);
        newId = result.agent_id || agentData.agent_name;
      } else {
        result = await apiUpdateAgent(activeTabId, payload);
        newId = activeTabId;
      }

      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabId
            ? { ...t, id: newId, isNew: false, isDirty: false }
            : t,
        ),
      );
      if (activeTabId !== newId) {
        setActiveTabId(newId);
      }
      fetchData();
      toast.success(
        activeTab.isNew
          ? "Agent created successfully"
          : "Agent saved successfully",
      );
    } catch (err) {
      if (err.status === 409 || err.message?.includes("already exists")) {
        toast.warning(
          `Agent "${agentData.agent_name}" already exists. Please choose a different name.`,
        );
      } else {
        toast.error(`Failed to save agent: ${err.message}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // --- Details / Delete modals --------------------------------------------

  const openDetailsModal = (agentId) => {
    const agent = boxes.find((b) => b.id === agentId);
    setViewingAgent(agent);
    setShowDetailsModal(true);
  };

  const closeDetailsModal = () => {
    setShowDetailsModal(false);
    setViewingAgent(null);
  };

  const requestDelete = (id) => {
    const agent = boxes.find((b) => b.id === id);
    setDeleteConfirm({ id, label: agent?.label || "this agent" });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    const id = deleteConfirm.id;
    try {
      await apiDeleteAgent(id);
      if (activeTab) {
        updateCanvasOrder(activeTab.canvasOrder.filter((cid) => cid !== id));
      }
      fetchData();
    } catch (err) {
      console.error("Failed to delete agent:", err);
    }
    setDeleteConfirm(null);
  };

  const cancelDelete = () => setDeleteConfirm(null);

  // --- Delegated hooks ---------------------------------------------------

  const workflow = useWorkflowRunner({ activeTab, boxes });
  const crud = useAgentCrud({ allAgents, fetchData, tabs, setTabs });

  return {
    // Query params
    selectParam,
    activeFilter,

    // Loading + boxes
    loading,
    boxes,
    allAgents,
    availableTools,
    toolConfigs,
    mcpConfigs,

    // Tabs
    tabs,
    activeTab,
    activeTabId,
    setActiveTabId,
    updateAgentData,
    openAgentTab,
    createNewTab,
    closeTab,

    // Header
    expandedHeader,
    setExpandedHeader,
    showApiKey,
    setShowApiKey,

    // Save
    isSaving,
    handleSave,

    // Canvas
    undoCanvas,
    redoCanvas,
    ...canvas,

    // Details / Delete / Connect modals
    showDetailsModal,
    viewingAgent,
    openDetailsModal,
    closeDetailsModal,
    deleteConfirm,
    requestDelete,
    confirmDelete,
    cancelDelete,
    connectAgent,
    setConnectAgent,

    // Data
    fetchData,

    // Delegated — workflow
    ...workflow,

    // Delegated — create/edit + publish
    ...crud,
  };
}
