"use client";

import { useEffect, useMemo, useState } from "react";
import {
  listSuperAgents,
  getSuperAgent,
  getOutlookStatus,
  listSkills,
} from "@/lib/api";

/**
 * Encapsulates all the side-effect hooks + derived state used by AgentModal.
 *
 * Returns the state values and setters needed by the modal JSX.
 */
export function useAgentModalState({
  show,
  editingAgent,
  newAgent,
  setNewAgent,
  toolConfigs,
  user,
  onRefreshTools,
}) {
  const [step, setStep] = useState(editingAgent ? "form" : "choose");
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templateNativeTools, setTemplateNativeTools] = useState([]);
  const [readme, setReadme] = useState("");
  const [readmeExpanded, setReadmeExpanded] = useState(false);

  const [availableSkills, setAvailableSkills] = useState([]);
  const [showApiKey, setShowApiKey] = useState(false);

  const [outlookConnected, setOutlookConnected] = useState(false);
  const [outlookLoading, setOutlookLoading] = useState(false);

  // Detect param key overlaps across selected tool configs
  const toolConfigConflicts = useMemo(() => {
    const selectedConfigs = (newAgent.agent_tools || [])
      .map((id) => toolConfigs.find((c) => String(c.tool_config_id) === String(id)))
      .filter(Boolean);

    const keyMap = {};
    for (const config of selectedConfigs) {
      const params = config.tool_config_params || {};
      for (const key of Object.keys(params)) {
        if (!keyMap[key]) keyMap[key] = [];
        keyMap[key].push(config.tool_config_name || `Config ${config.tool_config_id}`);
      }
    }

    return Object.entries(keyMap)
      .filter(([, names]) => names.length > 1)
      .map(([key, names]) => ({ key, configs: names }));
  }, [newAgent.agent_tools, toolConfigs]);

  // Outlook connection status
  useEffect(() => {
    if (!show) return;
    let cancelled = false;
    getOutlookStatus()
      .then((data) => { if (!cancelled) setOutlookConnected(!!data.connected); })
      .catch(() => { if (!cancelled) setOutlookConnected(false); });
    return () => { cancelled = true; };
  }, [show]);

  // postMessage listener for OAuth popup
  useEffect(() => {
    if (!show) return;
    const handler = (event) => {
      if (event.data?.type === "outlook-connected" && event.data?.success) {
        setOutlookConnected(true);
        setOutlookLoading(false);
        onRefreshTools?.();
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [show, onRefreshTools]);

  // Auto-populate owner/org from user
  useEffect(() => {
    if (user && !editingAgent) {
      const emailDomain = user.email?.split("@")[1] || "default";
      setNewAgent((prev) => ({
        ...prev,
        owner_id: prev.owner_id || user.email,
        organization_id: prev.organization_id || emailDomain,
      }));
    }
  }, [user, editingAgent, setNewAgent]);

  // Reset modal state + fetch template list when the modal opens. Splitting
  // this off from the template-id watcher avoids the "click twice to select
  // a superagent" bug: previously, handleSelectTemplate's setStep("form")
  // was undone on the very next render because changing
  // newAgent.superagent_template_id re-ran this effect and it unconditionally
  // called setStep("choose").
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!show) return;
    if (editingAgent) {
      setStep("form");
    } else {
      setStep("choose");
      setTemplateNativeTools([]);
      setReadme("");
      setReadmeExpanded(false);
      setLoadingTemplates(true);
      listSuperAgents()
        .then((data) => setTemplates(Array.isArray(data) ? data : []))
        .catch(() => setTemplates([]))
        .finally(() => setLoadingTemplates(false));
    }
  }, [show, editingAgent]);

  // Refresh recommended-tools list + readme + template-driven form flags
  // (requires_onedrive_file, placeholders, raw instruction) when editing an
  // agent derived from a superagent. Creation mode updates all of this
  // synchronously in handleSelectTemplate, so an extra roundtrip there would
  // be wasted work.
  useEffect(() => {
    if (!show || !editingAgent) return;
    const templateId = newAgent.superagent_template_id;
    if (!templateId) {
      setTemplateNativeTools([]);
      setReadme("");
      return;
    }
    let cancelled = false;
    getSuperAgent(templateId)
      .then((t) => {
        if (cancelled) return;
        setTemplateNativeTools(t.recommended_tools || []);
        setReadme(t.readme || "");
        // Hydrate template-driven flags + raw instruction so sections that
        // depend on them (OneDrive picker) render in edit the same way they
        // do in create, and so the save handler can re-substitute
        // placeholders if the user swaps the file.
        setNewAgent((prev) => ({
          ...prev,
          requires_onedrive_file: !!t.requires_onedrive_file,
          onedrive_placeholder: t.onedrive_placeholder || "<ITEM_PATH>",
          email_column_placeholder:
            t.email_column_placeholder || "<EMAIL_COLUMN>",
          template_instruction_raw: t.agent_instruction || "",
        }));
      })
      .catch(() => {
        if (cancelled) return;
        setTemplateNativeTools([]);
        setReadme("");
      });
    return () => {
      cancelled = true;
    };
  }, [show, editingAgent, newAgent.superagent_template_id, setNewAgent]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Fetch available skills
  useEffect(() => {
    if (!show) return;
    let cancelled = false;
    listSkills()
      .then((data) => {
        if (!cancelled) setAvailableSkills(Array.isArray(data) ? data : data?.skills || []);
      })
      .catch((err) => {
        console.error("Failed to load skills:", err);
        if (!cancelled) setAvailableSkills([]);
      });
    return () => { cancelled = true; };
  }, [show]);

  return {
    step, setStep,
    templates,
    loadingTemplates,
    templateNativeTools, setTemplateNativeTools,
    readme, setReadme,
    readmeExpanded, setReadmeExpanded,
    availableSkills,
    showApiKey, setShowApiKey,
    outlookConnected, setOutlookConnected,
    outlookLoading, setOutlookLoading,
    toolConfigConflicts,
  };
}

/**
 * Computes which agents can be added as sub-agents (excluding self, already-selected, circular refs)
 */
export function getAvailableSubAgents(boxes, newAgent, editingAgent) {
  const getDescendants = (agentId, visited = new Set()) => {
    if (visited.has(agentId)) return visited;
    visited.add(agentId);
    const agent = boxes.find((b) => b.id === agentId);
    if (agent?.subAgents) {
      for (const subId of agent.subAgents) getDescendants(subId, visited);
    }
    return visited;
  };

  const wouldCreateCircularRef = (agentId) => {
    if (editingAgent && agentId === editingAgent) return true;
    if (editingAgent) {
      const descendants = getDescendants(agentId);
      if (descendants.has(editingAgent)) return true;
    }
    return false;
  };

  return boxes.filter((b) => {
    if (newAgent.subAgents.includes(b.id)) return false;
    if (editingAgent && b.id === editingAgent) return false;
    if (wouldCreateCircularRef(b.id)) return false;
    return true;
  });
}

export function wouldCreateCircularRef(boxes, agentId, editingAgent) {
  if (editingAgent && agentId === editingAgent) return true;
  if (!editingAgent) return false;
  const visited = new Set();
  const walk = (id) => {
    if (visited.has(id)) return;
    visited.add(id);
    const agent = boxes.find((b) => b.id === id);
    if (agent?.subAgents) {
      for (const subId of agent.subAgents) walk(subId);
    }
  };
  walk(agentId);
  return visited.has(editingAgent);
}
