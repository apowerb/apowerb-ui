"use client";

/**
 * useAgentTabs — tab lifecycle + per-tab canvas undo/redo history.
 *
 * Owns the `tabs` array, the active tab id, per-tab history stacks, the
 * keyboard shortcuts (Ctrl/Cmd+Z / Ctrl/Cmd+Y / Ctrl/Cmd+Shift+Z) and the
 * async `openAgentTab` that hydrates a tab from the backend.
 *
 * Consumers (useDiagramState) still own the list of cached agents so they
 * pass it in as `allAgents`.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { getAgent } from "@/lib/api";
import { useToast } from "../Toast";
import {
  parseSubAgents,
  parseTools,
  parseOutputSchema,
  parseMcpServers,
  createEmptyAgentData,
} from "./diagramUtils";

export function useAgentTabs({ allAgents }) {
  const toast = useToast();

  const [tabs, setTabs] = useState([
    {
      id: "new",
      agentData: createEmptyAgentData(),
      canvasOrder: [],
      isNew: true,
      isDirty: false,
    },
  ]);
  const [activeTabId, setActiveTabId] = useState("new");

  const activeTab = tabs.find((t) => t.id === activeTabId);

  // --- Canvas undo/redo history (per tab) -------------------------------

  const canvasHistoryRef = useRef({});

  const initTabHistory = (tabId, initialOrder) => {
    canvasHistoryRef.current[tabId] = { stack: [initialOrder], index: 0 };
  };

  const updateCanvasOrder = useCallback(
    (newOrder) => {
      if (!activeTabId) return;
      if (!canvasHistoryRef.current[activeTabId]) {
        canvasHistoryRef.current[activeTabId] = { stack: [[]], index: 0 };
      }
      const hist = canvasHistoryRef.current[activeTabId];
      const trimmed = hist.stack.slice(0, hist.index + 1);
      trimmed.push(newOrder);
      if (trimmed.length > 50) trimmed.shift();
      hist.stack = trimmed;
      hist.index = trimmed.length - 1;

      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabId
            ? { ...t, canvasOrder: newOrder, isDirty: true }
            : t,
        ),
      );
    },
    [activeTabId],
  );

  const undoCanvas = useCallback(() => {
    const hist = canvasHistoryRef.current[activeTabId];
    if (!hist || hist.index <= 0) return;
    hist.index -= 1;
    const prevOrder = hist.stack[hist.index];
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId
          ? { ...t, canvasOrder: prevOrder, isDirty: true }
          : t,
      ),
    );
  }, [activeTabId]);

  const redoCanvas = useCallback(() => {
    const hist = canvasHistoryRef.current[activeTabId];
    if (!hist || hist.index >= hist.stack.length - 1) return;
    hist.index += 1;
    const nextOrder = hist.stack[hist.index];
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId
          ? { ...t, canvasOrder: nextOrder, isDirty: true }
          : t,
      ),
    );
  }, [activeTabId]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = e.target.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        e.target.isContentEditable
      )
        return;

      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undoCanvas();
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "y" || (e.key === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        redoCanvas();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undoCanvas, redoCanvas]);

  // --- Tab operations --------------------------------------------------

  const updateAgentData = (newData) => {
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId ? { ...t, agentData: newData, isDirty: true } : t,
      ),
    );
  };

  const openAgentTab = async (agentId) => {
    const existingById = tabs.find((t) => t.id === agentId);
    if (existingById) {
      setActiveTabId(agentId);
      return;
    }

    const existingByName = tabs.find(
      (t) => t.agentData?.agent_name === agentId,
    );
    if (existingByName) {
      setActiveTabId(existingByName.id);
      return;
    }

    const cachedAgent =
      allAgents.find((a) => a.agent_name === agentId) ||
      allAgents.find((a) => {
        const mappedId =
          a.agent_id != null ? `agent${a.agent_id}` : a.agent_name;
        return mappedId === agentId;
      });

    if (cachedAgent) {
      const tabId =
        cachedAgent.agent_id != null
          ? `agent${cachedAgent.agent_id}`
          : cachedAgent.agent_name;

      try {
        const agent = await getAgent(tabId);

        setTabs((prev) => {
          if (prev.some((t) => t.id === tabId)) return prev;
          return [
            ...prev,
            {
              id: tabId,
              agentData: {
                agent_name: agent.agent_name || "",
                agent_model: agent.agent_model || "",
                model_api_key: agent.model_api_key || "",
                agent_description: agent.agent_description || "",
                agent_instruction: agent.agent_instruction || "",
                agent_tools: parseTools(agent.agent_tools),
                organization_id: agent.organization_id || "",
                owner_id: agent.owner_id || "",
                agent_type: agent.agent_type || "sequential",
                memory_enabled: agent.memory_enabled || false,
                artifacts_enabled: agent.artifacts_enabled || false,
                guardrails_config: agent.guardrails_config || null,
                superagent_template_id: agent.superagent_template_id || null,
                output_schema: parseOutputSchema(agent.output_schema),
                mcp_servers: parseMcpServers(agent.mcp_servers),
              },
              canvasOrder: parseSubAgents(agent.sub_agents),
              isNew: false,
              isDirty: false,
            },
          ];
        });
        initTabHistory(tabId, parseSubAgents(agent.sub_agents));
        setActiveTabId(tabId);
      } catch (error) {
        console.error("Error fetching agent details:", error);
        toast.error(`Failed to load agent: ${error.message}`);
      }
    } else {
      toast.error("Agent not found. Try refreshing the page.");
    }
  };

  const createNewTab = () => {
    const newId = `new-${Date.now()}`;
    setTabs((prev) => [
      ...prev,
      {
        id: newId,
        agentData: createEmptyAgentData(),
        canvasOrder: [],
        isNew: true,
        isDirty: false,
      },
    ]);
    initTabHistory(newId, []);
    setActiveTabId(newId);
  };

  const closeTab = (tabId, force = false) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (!force && tab?.isDirty) {
      toast.warning("Unsaved changes. Close anyway?", 5000, {
        label: "Close",
        onClick: () => closeTab(tabId, true),
      });
      return;
    }
    const remaining = tabs.filter((t) => t.id !== tabId);
    setTabs(remaining);
    if (activeTabId === tabId && remaining.length > 0) {
      setActiveTabId(remaining[0].id);
    }
  };

  return {
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
  };
}
