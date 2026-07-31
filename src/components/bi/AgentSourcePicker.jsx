"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "use-intl";
import { listAgentsForBi } from "@/lib/api";
import { Bot, Search, Check } from "lucide-react";

export default function AgentSourcePicker({ selectedIds = [], onChange }) {
  const t = useTranslations("AgentSourcePicker");
  const [agents, setAgents] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listAgentsForBi()
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.agents || [];
        setAgents(list);
      })
      .catch(() => setAgents([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = agents.filter((a) =>
    (a.agent_name || "").toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id) => {
    const numId = Number(id);
    const next = selectedIds.includes(numId)
      ? selectedIds.filter((x) => x !== numId)
      : [...selectedIds, numId];
    onChange(next);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 th-text-muted">
        {t("loadingAgents")}
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="text-center py-8 th-text-muted">
        <Bot className="mx-auto mb-2 h-8 w-8" />
        <p>{t("noAgentsAvailable")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 th-text-faint" />
        <input
          type="text"
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="glass-input w-full pl-9 pr-3 py-2 rounded-lg text-sm"
        />
      </div>

      <div className="max-h-60 overflow-y-auto space-y-1">
        {filtered.map((agent) => {
          const id = Number(agent.agent_id);
          const selected = selectedIds.includes(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => toggle(id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                selected
                  ? "bg-brand/10 border-brand/40 th-text"
                  : "th-bg-surface th-border th-text-secondary hover:th-bg-surface-hover hover:th-border-hover"
              }`}
            >
              <Bot className="h-4 w-4 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{agent.agent_name}</div>
                {agent.agent_description && (
                  <div className="text-xs th-text-muted truncate">
                    {agent.agent_description}
                  </div>
                )}
              </div>
              {selected && <Check className="h-4 w-4 text-brand shrink-0" />}
            </button>
          );
        })}
      </div>

      {selectedIds.length > 0 && (
        <p className="text-xs th-text-muted">
          {t("selectedCount", { count: selectedIds.length })}
        </p>
      )}
    </div>
  );
}
