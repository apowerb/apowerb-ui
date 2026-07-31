"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "use-intl";
import { X, Bot, Loader2, Search, AlertCircle } from "lucide-react";
import { listAgents } from "@/lib/api";
import { useChatSessions } from "@/hooks/useChatSessions";

export default function AgentSelector({ onClose, agentFilter, filterLabel }) {
  const t = useTranslations("AgentSelector");
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const { createSession } = useChatSessions();

  useEffect(() => {
    async function fetchAgents() {
      try {
        setLoading(true);
        setError(null);
        const result = await listAgents();
        setAgents(result || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchAgents();
  }, []);

  const handleSelectAgent = async (agent) => {
    const numericId = agent.agent_id;
    const agentId = numericId != null ? `agent${numericId}` : agent.agent_name;
    const agentName = agent.agent_name || agentId;

    // Parse tags safely    
    let tags = [];
    try {
      tags = agent.tags ? JSON.parse(agent.tags) : [];
    } catch { tags = []; }

    await createSession(agentId, agentName, null, {
      agentType: agent.agent_type || "base",
      superagentTemplateId: agent.superagent_template_id || null,
      tags,
    });
    onClose();
  };

  const filteredAgents = agents.filter((agent) => (agentFilter ? agentFilter(agent) : true)).filter((agent) => {
      const name = agent.label || agent.agent_name || "";
      const description = agent.agent_description || "";
      const searchLower = search.toLowerCase();
      return (
        name.toLowerCase().includes(searchLower) ||
        description.toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => {
      const nameA = (a.label || a.agent_name || "").toLowerCase();
      const nameB = (b.label || b.agent_name || "").toLowerCase();
      return nameA.localeCompare(nameB, "fr");
    });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
       className="absolute inset-0 th-bg-overlay backdrop-blur-sm"
       onClick={onClose}
      />

      {/* Modal */}
      <div className="relative glass-modal rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col animate-scale-up-center">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b th-border">
          <h2 className="text-lg font-semibold th-text">
            {filterLabel ? t("selectFilteredAgent", { filterLabel }) : t("selectAgent")}
          </h2>
          <button
           onClick={onClose}
          className="p-2 hover:th-bg-surface-hover rounded-lg transition-colors"
          >
            <X size={20} className="th-text-faint" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b th-border-secondary">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 th-text-faint"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchAgents")}
              className="w-full glass-input pl-10 pr-4 py-2 rounded-xl text-sm"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={24} className="animate-spin text-brand" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertCircle size={32} className="text-red-400 mb-2" />
              <p className="text-sm text-red-300">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 text-sm th-bg-surface hover:th-bg-surface-hover rounded-lg transition-colors"
              >
                {t("retry")}
              </button>
            </div>
          ) : filteredAgents.length === 0 ? (
            <div className="text-center th-text-faint py-8">
              {search
                ? t("noAgentsMatch")
                : filterLabel
                ? t("noFilteredAgents", { filterLabel })
                : t("noAgentsAvailable")}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredAgents.map((agent) => {
                const numericId = agent.agent_id;
                const agentId = numericId != null ? `agent${numericId}` : agent.agent_name;
                const agentName = agent.agent_name || agentId;
                const agentType = agent.agent_type || "base";

                return (
                  <button
                    key={agentId}
                    onClick={() => handleSelectAgent(agent)}
                    className="w-full flex items-start gap-3 p-3 rounded-xl hover:th-bg-surface-hover transition-colors text-left group"
                  >
                    <div className="shrink-0 w-10 h-10 rounded-lg bg-linear-to-br from-purple-500 to-violet-600 flex items-center justify-center">
                      <Bot size={20} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium th-text-secondary truncate group-hover:th-text transition-colors">
                        {agentName}
                      </p>
                      <p className="text-xs th-text-faint truncate">
                        {agent.agent_description || t("agentTypeFallback", { agentType })}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
