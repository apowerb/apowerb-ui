"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listTools,
  listToolConfigs,
  listMcpConfigs,
  saveMcpConfig as apiSaveMcpConfig,
  updateMcpConfig as apiUpdateMcpConfig,
  createToolConfig as apiCreateToolConfig,
  deleteToolConfig as apiDeleteToolConfig,
  listSkills,
  createSkill,
  updateSkill,
  deleteSkill,
  importSkill,
} from "@/lib/api";
import { authStorage } from "@/lib/authStorage";
import { useToast } from "../Toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  TABS,
  DEFAULT_MCP,
  DEFAULT_DB_CONFIG,
  DEFAULT_SKILL,
  buildFilterOptions,
  flattenTools,
  filterAndSortTools,
  filterConfigs,
  filterMcp,
  filterSkills,
  parseSkillForEdit,
  buildMcpPayload,
  createEmptyConfig,
} from "./toolsManagerUtils";

/**
 * Composition root for ToolsManager — owns all remote state (tools,
 * configs, MCP, skills) plus UI state shared across tabs.
 *
 * Returns a plain object that the orchestrator spreads into each tab.
 */
export function useToolsManager() {
  const toast = useToast();
  const { user } = useAuth();

  // ── Active tab (synced to window.location.hash) ─────────────────────────
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== "undefined") {
      const h = window.location.hash.replace("#", "");
      return TABS.some((t) => t.key === h) ? h : "available-tools";
    }
    return "available-tools";
  });

  // ── Remote data ────────────────────────────────────────────────────────
  const [toolConfigs, setToolConfigs]       = useState([]);
  const [availableTools, setAvailableTools] = useState({});
  const [mcpConfigs, setMcpConfigs]         = useState([]);
  const [skills, setSkills]                 = useState([]);
  const [loading, setLoading]               = useState(true);

  // ── Tools tab local state ──────────────────────────────────────────────
  const [toolSearch, setToolSearch]             = useState("");
  const [categoryFilter, setCategoryFilter]     = useState("all");
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [toolSortKey, setToolSortKey]           = useState("name");
  const [toolSortAsc, setToolSortAsc]           = useState(true);

  // ── Configs tab local state ────────────────────────────────────────────
  const [configSearch, setConfigSearch]                 = useState("");
  const [configCategoryFilter, setConfigCategoryFilter] = useState("all");

  // ── Tool config modal state (shared by Tools + Configs tabs) ───────────
  const [showModal, setShowModal]         = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [newConfig, setNewConfig]         = useState(() =>
    createEmptyConfig({ organizationId: "", ownerEmail: "" }),
  );

  // ── MCP tab state ──────────────────────────────────────────────────────
  const [showMcpForm, setShowMcpForm]           = useState(false);
  const [mcpSearch, setMcpSearch]               = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [newMcp, setNewMcp]                     = useState(DEFAULT_MCP);
  const [dbConfig, setDbConfig]                 = useState(DEFAULT_DB_CONFIG);
  // mcp_config_id of the MCP currently being edited (null → creating new)
  const [editingMcp, setEditingMcp]             = useState(null);

  // ── Skills tab state ───────────────────────────────────────────────────
  const [skillSearch, setSkillSearch]           = useState("");
  const [skillFilter, setSkillFilter]           = useState("all");
  const [showSkillForm, setShowSkillForm]       = useState(false);
  const [editingSkill, setEditingSkill]         = useState(null);
  const [newSkill, setNewSkill]                 = useState(DEFAULT_SKILL);
  const [exportDropdownId, setExportDropdownId] = useState(null);

  // Close export dropdown on outside click
  useEffect(() => {
    if (!exportDropdownId) return;
    const handleClickOutside = (e) => {
      if (!e.target.closest("[data-export-dropdown]")) {
        setExportDropdownId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [exportDropdownId]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const tools = await listTools();
      setAvailableTools(tools);
      try {
        const configs = await listToolConfigs();
        setToolConfigs(Array.isArray(configs) ? configs : []);
      } catch (err) {
        console.warn("Failed to fetch tool configs:", err);
        setToolConfigs([]);
      }
      try {
        const mcps = await listMcpConfigs();
        setMcpConfigs(Array.isArray(mcps) ? mcps : []);
      } catch (err) {
        console.warn("Failed to fetch MCP configs:", err);
        setMcpConfigs([]);
      }
      try {
        const sk = await listSkills();
        setSkills(Array.isArray(sk) ? sk : []);
      } catch (err) {
        console.warn("Failed to fetch skills:", err);
        setSkills([]);
      }
    } catch (err) {
      console.error("Failed to fetch tools:", err);
      toast.error(`Failed to fetch tools: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const emailDomain = user?.email?.split("@")[1] || "default";

  // ── Derived data ───────────────────────────────────────────────────────
  const allTools           = flattenTools(availableTools);
  const filterOptions      = buildFilterOptions(availableTools);
  const sortedEntries      = filterAndSortTools(availableTools, { toolSearch, categoryFilter, toolSortAsc });
  const filteredConfigs    = filterConfigs(toolConfigs, allTools, { configSearch, configCategoryFilter });
  const filteredMcpConfigs = filterMcp(mcpConfigs, mcpSearch);
  const filteredSkills     = filterSkills(skills, { skillSearch, skillFilter });

  const stats = {
    totalTools:      allTools.length,
    totalCategories: Object.keys(availableTools).length,
    totalConfigs:    toolConfigs.length,
    totalMcp:        mcpConfigs.length,
    totalSkills:     skills.length,
  };

  const tabBadges = {
    "available-tools":   stats.totalTools,
    "my-configurations": stats.totalConfigs,
    "mcp-servers":       stats.totalMcp,
    "skills":            stats.totalSkills,
  };

  // ── Actions — tool configs ─────────────────────────────────────────────
  const changeTab = (key) => {
    if (typeof window !== "undefined") window.location.hash = key;
    setActiveTab(key);
  };

  const openCreateModal = (category = "") => {
    setNewConfig(createEmptyConfig({
      category,
      organizationId: emailDomain,
      ownerEmail: user?.email,
    }));
    setEditingConfig(null);
    setShowModal(true);
  };

  const openEditModal = (config) => {
    setEditingConfig(config.tool_config_id);
    let parsedConfig = { ...config };
    if (typeof config.tool_config_params === "string") {
      try { parsedConfig.tool_config_params = JSON.parse(config.tool_config_params); }
      catch (err) { console.error("Failed to parse tool_config_params:", err); parsedConfig.tool_config_params = {}; }
    } else if (!config.tool_config_params) {
      parsedConfig.tool_config_params = {};
    }
    setNewConfig(parsedConfig);
    setShowModal(true);
  };

  const handleSaveConfig = async (selectedTools) => {
    try {
      const tools = Array.isArray(selectedTools) ? selectedTools : [];
      const toolCategory = allTools.find((t) => t.name === tools[0])?.category || newConfig.tool_category;
      const toolName = tools.length === 1 ? tools[0] : JSON.stringify(tools);
      await apiCreateToolConfig({
        ...newConfig,
        tool_name: toolName,
        tool_category: toolCategory,
      });
      toast.success(
        editingConfig
          ? `Configuration updated with ${tools.length} tool${tools.length > 1 ? "s" : ""}`
          : `Configuration created with ${tools.length} tool${tools.length > 1 ? "s" : ""}`,
      );
      setShowModal(false);
      fetchData();
    } catch (err) {
      toast.error(`Failed to save tool config: ${err.message}`);
    }
  };

  const handleDeleteConfig = (configId) => {
    toast.warning("Delete this tool configuration?", 5000, {
      label: "Confirm",
      onClick: async () => {
        try {
          await apiDeleteToolConfig(configId);
          toast.success("Tool configuration deleted");
          fetchData();
        } catch (err) {
          toast.error(`Failed to delete tool config: ${err.message}`);
        }
      },
    });
  };

  // ── Actions — MCP ─────────────────────────────────────────────────────
  const resetMcpForm = () => {
    setShowMcpForm(false);
    setSelectedTemplate(null);
    setNewMcp(DEFAULT_MCP);
    setDbConfig(DEFAULT_DB_CONFIG);
    setEditingMcp(null);
  };

  const openMcpForm = () => {
    resetMcpForm();
    setShowMcpForm(true);
  };

  const applyMcpTemplate = (template) => {
    setSelectedTemplate(template.id);
    setNewMcp((p) => ({
      ...p,
      ...template.defaults,
      headers: {}, params: {}, env: {}, toolset: "",
    }));
    if (template.id === "toolbox-db") {
      setDbConfig(DEFAULT_DB_CONFIG);
    }
  };

  /**
   * Pre-fill the MCP form from a saved config and switch to edit mode.
   * Save will issue a PUT instead of POST.
   */
  const handleEditMcp = useCallback((mcp) => {
    if (!mcp) return;
    const isToolboxDb = mcp.mcp_type === "toolbox-db";
    setEditingMcp(mcp.mcp_config_id);
    setSelectedTemplate(isToolboxDb ? "toolbox-db" : "custom-http");
    setNewMcp({
      ...DEFAULT_MCP,
      name: mcp.name || "",
      transport: mcp.transport || "http",
      url: mcp.url || "",
      toolset: mcp.toolset || "",
      headers: mcp.headers || {},
      params: mcp.params || {},
      command: mcp.command || "",
      args: Array.isArray(mcp.args) ? mcp.args.join(" ") : (mcp.args || ""),
      env: mcp.env || {},
    });
    if (isToolboxDb && mcp.db_config) {
      setDbConfig({
        db_type: mcp.db_config.db_type || "postgres",
        host: mcp.db_config.host || "",
        port: mcp.db_config.port || "",
        database: mcp.db_config.database || "",
        user: mcp.db_config.user || "",
        password: "",
        sslmode: mcp.db_config.sslmode || "require",
      });
    }
    setShowMcpForm(true);
  }, []);

  const handleSaveMcp = async () => {
    try {
      const payload = buildMcpPayload({ newMcp, selectedTemplate, dbConfig });
      if (editingMcp) {
        await apiUpdateMcpConfig(editingMcp, payload);
        toast.success("MCP server configuration updated");
      } else {
        await apiSaveMcpConfig(payload);
        toast.success("MCP server configuration saved");
      }
      resetMcpForm();
      fetchData();
    } catch (err) {
      toast.error(`Failed to save MCP config: ${err.message}`);
    }
  };

  const handleDeleteMcp = (mcpConfigId) => {
    toast.warning("Delete this MCP server configuration?", 5000, {
      label: "Confirm",
      onClick: async () => {
        try {
          await apiDeleteToolConfig(mcpConfigId);
          toast.success("MCP server configuration deleted");
          fetchData();
        } catch (err) {
          toast.error(`Failed to delete MCP config: ${err.message}`);
        }
      },
    });
  };

  // Deep-link from agent modal: ?edit=<mcp_config_id> opens the editor on
  // that config once the list is loaded. Strips the param after handling
  // so a refresh doesn't re-trigger.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (loading || !mcpConfigs.length) return;
    const url = new URL(window.location.href);
    const editId = url.searchParams.get("edit");
    if (!editId) return;
    const target = mcpConfigs.find(
      (c) => String(c.mcp_config_id) === String(editId),
    );
    if (target) {
      changeTab("mcp-servers");
      handleEditMcp(target);
    }
    url.searchParams.delete("edit");
    window.history.replaceState({}, "", url.toString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, mcpConfigs.length]);

  // ── Actions — Skills ──────────────────────────────────────────────────
  const resetSkillForm = () => {
    setShowSkillForm(false);
    setEditingSkill(null);
    setNewSkill(DEFAULT_SKILL);
  };

  const openNewSkill = () => {
    resetSkillForm();
    setShowSkillForm(true);
  };

  const handleEditSkill = (skill) => {
    setEditingSkill(skill.skill_id || skill.id);
    setNewSkill(parseSkillForEdit(skill));
    setShowSkillForm(true);
  };

  const handleSaveSkill = async () => {
    try {
      if (editingSkill) {
        await updateSkill(editingSkill, newSkill);
        toast.success("Skill updated successfully");
      } else {
        await createSkill(newSkill);
        toast.success("Skill created successfully");
      }
      resetSkillForm();
      fetchData();
    } catch (err) {
      toast.error(`Failed to save skill: ${err.message}`);
    }
  };

  const handleDeleteSkill = (skillId) => {
    toast.warning("Delete this skill?", 5000, {
      label: "Confirm",
      onClick: async () => {
        try {
          await deleteSkill(skillId);
          toast.success("Skill deleted");
          fetchData();
        } catch (err) {
          toast.error(`Failed to delete skill: ${err.message}`);
        }
      },
    });
  };

  const handleExportSkill = (skill, format) => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    let url;
    if (skill.source === "portfolio") {
      url = `${baseUrl}/api/skills/portfolio/${skill.skill_name}/export?format=${format}`;
    } else {
      url = `${baseUrl}/api/skills/${skill.skill_id || skill.id}/export?format=${format}`;
    }
    const token = authStorage.getToken();
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (!res.ok) throw new Error("Export failed");
        return res.blob();
      })
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${skill.skill_name}.${format === "adk" ? "zip" : "json"}`;
        a.click();
        URL.revokeObjectURL(a.href);
        toast.success(`Skill exported as ${format === "adk" ? "ADK ZIP" : "JSON"}`);
      })
      .catch((err) => toast.error(`Export failed: ${err.message}`));
  };

  const handleImportSkill = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importSkill(file);
      toast.success(`Skill imported from ${file.name}`);
      fetchData();
    } catch (err) {
      toast.error(`Import failed: ${err.message}`);
    }
    e.target.value = "";
  };

  const handleToolSort = (key) => {
    if (toolSortKey === key) setToolSortAsc((v) => !v);
    else { setToolSortKey(key); setToolSortAsc(true); }
  };

  return {
    // Active tab
    activeTab, changeTab,

    // Loading + stats
    loading,
    stats,
    tabBadges,

    // Available tools tab
    toolSearch, setToolSearch,
    categoryFilter, setCategoryFilter,
    filterOptions,
    sortedEntries,
    toolSortKey,
    expandedCategory, setExpandedCategory,
    handleToolSort,

    // Configs tab
    configSearch, setConfigSearch,
    configCategoryFilter, setConfigCategoryFilter,
    filteredConfigs,

    // Tool config modal
    showModal, setShowModal,
    editingConfig,
    newConfig, setNewConfig,
    allTools,
    toolConfigs,
    openCreateModal,
    openEditModal,
    handleSaveConfig,
    handleDeleteConfig,

    // MCP tab
    mcpSearch, setMcpSearch,
    filteredMcpConfigs,
    showMcpForm,
    selectedTemplate,
    newMcp, setNewMcp,
    dbConfig, setDbConfig,
    openMcpForm,
    resetMcpForm,
    applyMcpTemplate,
    handleSaveMcp,
    handleDeleteMcp,
    handleEditMcp,
    editingMcp,

    // Skills tab
    skillSearch, setSkillSearch,
    skillFilter, setSkillFilter,
    filteredSkills,
    showSkillForm,
    editingSkill,
    newSkill, setNewSkill,
    exportDropdownId, setExportDropdownId,
    openNewSkill,
    resetSkillForm,
    handleEditSkill,
    handleSaveSkill,
    handleDeleteSkill,
    handleExportSkill,
    handleImportSkill,
  };
}
