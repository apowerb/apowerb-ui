"use client";

import { useState } from "react";
import { PlayCircle } from "lucide-react";
import {
  listTools,
  getToolExpectedParams,
  createToolConfig,
  updateToolConfig,
  getOutlookAuthUrl,
} from "@/lib/api";
import AddToolPanel from "./AddToolPanel";
import ConfigurableToolsList from "./ConfigurableToolsList";
import {
  splitNativeTools,
  EmailConnectionsBlock,
  NativeToolsList,
} from "./NativeToolsBlock";

/**
 * Tool configuration section of AgentModal.
 * Handles: native tools (SuperAgent template), email connections, configurable
 * tools (with conflict detection + inline edit), and the Add Tool panel.
 */
export default function ToolsSection({
  newAgent,
  setNewAgent,
  toolConfigs,
  templateNativeTools,
  toolConfigConflicts,
  outlookConnected,
  outlookLoading,
  setOutlookConnected,
  setOutlookLoading,
  onRefreshTools,
  onToast,
  user,
}) {
  // Add Tool panel state
  const [showAddTool, setShowAddTool] = useState(false);
  const [allTools, setAllTools] = useState({});
  const [toolSearch, setToolSearch] = useState("");
  const [selectedNewTool, setSelectedNewTool] = useState(null);
  const [newToolParams, setNewToolParams] = useState([]);
  const [newToolValues, setNewToolValues] = useState({});
  const [newToolConfigName, setNewToolConfigName] = useState("");
  const [addingTool, setAddingTool] = useState(false);
  const [addToolError, setAddToolError] = useState("");

  // Edit Tool Config state
  const [editingToolConfig, setEditingToolConfig] = useState(null);
  const [editToolValues, setEditToolValues] = useState({});
  const [editToolName, setEditToolName] = useState("");
  const [editToolExpectedParams, setEditToolExpectedParams] = useState([]);
  const [savingToolConfig, setSavingToolConfig] = useState(false);
  const [editToolError, setEditToolError] = useState("");

  const resetAddTool = () => {
    setShowAddTool(false);
    setSelectedNewTool(null);
    setToolSearch("");
    setNewToolParams([]);
    setNewToolValues({});
    setNewToolConfigName("");
    setAddToolError("");
  };

  const handleShowAddTool = async () => {
    setShowAddTool(true);
    setAddToolError("");
    if (Object.keys(allTools).length === 0) {
      try {
        const tools = await listTools();
        setAllTools(tools || {});
      } catch (err) {
        console.error("[AgentModal] Failed to list tools:", err);
        setAddToolError("Failed to load tools.");
      }
    }
  };

  const handleSelectNewTool = async (toolName) => {
    setSelectedNewTool(toolName);
    setNewToolConfigName(toolName.split(".").pop());
    setAddToolError("");
    try {
      const params = await getToolExpectedParams(toolName);
      setNewToolParams(Array.isArray(params) ? params : []);
      setNewToolValues({});
    } catch (err) {
      console.error("[AgentModal] Failed to get tool params:", err);
      setNewToolParams([]);
      setNewToolValues({});
    }
  };

  const handleCreateToolConfig = async () => {
    setAddingTool(true);
    setAddToolError("");
    try {
      const category = selectedNewTool.split(".")[0];
      const emailDomain = user?.email?.split("@")[1] || "default";
      await createToolConfig({
        tool_config_name: newToolConfigName,
        tool_name: selectedNewTool,
        tool_config_params: newToolValues,
        tool_category: category,
        owner_id: user?.email || "current_user",
        organization_id: emailDomain,
      });
      if (onRefreshTools) await onRefreshTools();
      setTimeout(() => {
        const match = toolConfigs.find(
          (c) => c.tool_config_name === newToolConfigName
        );
        if (match) {
          const configId = String(match.tool_config_id);
          setNewAgent((prev) => {
            const current = prev.agent_tools || [];
            if (!current.includes(configId)) {
              return { ...prev, agent_tools: [...current, configId] };
            }
            return prev;
          });
        }
      }, 500);
      resetAddTool();
    } catch (err) {
      console.error("[AgentModal] Failed to create tool config:", err);
      setAddToolError(err?.message || "Failed to create tool configuration.");
    } finally {
      setAddingTool(false);
    }
  };

  const handleEditToolConfig = async (config) => {
    const configId = String(config.tool_config_id);
    setEditingToolConfig(configId);
    setEditToolName(config.tool_config_name || "");
    setEditToolError("");

    const existingParams = config.tool_config_params || {};
    setEditToolValues({ ...existingParams });

    try {
      const toolName = config.tool_name || "";
      let paramToolName = toolName;
      try {
        if (toolName.startsWith("[")) paramToolName = JSON.parse(toolName)[0];
      } catch {}
      const expected = await getToolExpectedParams(paramToolName);
      setEditToolExpectedParams(Array.isArray(expected) ? expected : []);
    } catch {
      setEditToolExpectedParams(
        Object.keys(existingParams).map((k) => ({ key: k, default: null }))
      );
    }
  };

  const handleSaveToolConfig = async () => {
    setSavingToolConfig(true);
    setEditToolError("");
    try {
      await updateToolConfig(editingToolConfig, {
        tool_config_name: editToolName,
        tool_config_params: editToolValues,
      });
      if (onRefreshTools) await onRefreshTools();
      setEditingToolConfig(null);
    } catch (err) {
      setEditToolError(err?.message || "Failed to save");
    } finally {
      setSavingToolConfig(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingToolConfig(null);
    setEditToolValues({});
    setEditToolName("");
    setEditToolExpectedParams([]);
    setEditToolError("");
  };

  const handleConnectOutlook = async () => {
    try {
      setOutlookLoading(true);
      setOutlookConnected(false);
      const data = await getOutlookAuthUrl();
      if (data.auth_url) {
        const popup = window.open(data.auth_url, "outlook-auth", "width=600,height=700,popup=yes");
        if (popup) {
          const pollTimer = setInterval(() => {
            if (popup.closed) { clearInterval(pollTimer); setOutlookLoading(false); }
          }, 500);
        } else {
          onToast?.("The popup was blocked by the browser.");
          setOutlookLoading(false);
        }
      } else {
        setOutlookLoading(false);
      }
    } catch (err) {
      onToast?.("Failed to start Outlook connection: " + (err.message || "error"));
      setOutlookLoading(false);
    }
  };

  const handleToggleSelect = (configId, selected) => {
    setNewAgent((prev) => {
      const current = prev.agent_tools || [];
      const updated = selected
        ? current.filter((t) => t !== configId)
        : [...current, configId];
      return { ...prev, agent_tools: updated };
    });
  };

  const { emailTools, otherTools } = splitNativeTools(templateNativeTools);
  // MCP server configs (mcp_category) are surfaced in their own section
  // (McpServersSection — "+ saved config" badge), so we exclude them here
  // to avoid duplication. Toggling a checkbox on an mcp_server tool_config
  // had no real effect anyway: attaching an MCP to an agent goes through
  // the mcp_servers JSON column, not agent_tools.
  const configurableTools = toolConfigs.filter(
    (tc) => tc.tool_category !== "native" && tc.tool_category !== "mcp_server",
  );

  return (
    <div className="space-y-4">
      <label className="text-sm font-medium th-text-muted mb-0 pl-1 flex items-center gap-2">
        <PlayCircle size={14} /> Tool Configurations
      </label>

      {emailTools.length > 0 && (
        <EmailConnectionsBlock
          outlookConnected={outlookConnected}
          outlookLoading={outlookLoading}
          onConnectOutlook={handleConnectOutlook}
        />
      )}

      {otherTools.length > 0 && <NativeToolsList otherTools={otherTools} />}

      <div>
        <ConfigurableToolsList
          configurableTools={configurableTools}
          selectedIds={newAgent.agent_tools || []}
          onToggleSelect={handleToggleSelect}
          editingToolConfig={editingToolConfig}
          editToolName={editToolName}
          setEditToolName={setEditToolName}
          editToolValues={editToolValues}
          setEditToolValues={setEditToolValues}
          editToolExpectedParams={editToolExpectedParams}
          editToolError={editToolError}
          savingToolConfig={savingToolConfig}
          onSave={handleSaveToolConfig}
          onCancelEdit={handleCancelEdit}
          onEdit={handleEditToolConfig}
          toolConfigConflicts={toolConfigConflicts}
        />

        {!showAddTool ? (
          <button
            onClick={handleShowAddTool}
            className="w-full mt-2 p-2 rounded-lg border border-dashed th-border-hover th-text-faint text-sm hover:border-white/40 hover:th-text-muted transition-all flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Tool
          </button>
        ) : (
          <div className="mt-2 p-3 rounded-xl border th-border th-bg-surface space-y-3">
            <AddToolPanel
              allTools={allTools}
              addToolError={addToolError}
              toolSearch={toolSearch}
              setToolSearch={setToolSearch}
              selectedNewTool={selectedNewTool}
              newToolParams={newToolParams}
              newToolValues={newToolValues}
              setNewToolValues={setNewToolValues}
              newToolConfigName={newToolConfigName}
              setNewToolConfigName={setNewToolConfigName}
              addingTool={addingTool}
              onSelectNewTool={handleSelectNewTool}
              onBack={() => {
                setSelectedNewTool(null);
                setNewToolParams([]);
                setNewToolValues({});
                setNewToolConfigName("");
                setAddToolError("");
              }}
              onCancel={resetAddTool}
              onCreate={handleCreateToolConfig}
            />
          </div>
        )}
      </div>
    </div>
  );
}
