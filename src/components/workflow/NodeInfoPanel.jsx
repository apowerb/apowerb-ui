"use client";

import { Box, Layers, GitBranch, Repeat, Network, X } from "lucide-react";

const categoryConfig = {
  Base: { icon: Box, color: "text-blue-400", bg: "bg-blue-500/20", badge: "bg-blue-500/20 text-blue-300" },
  Sequential: { icon: Layers, color: "text-purple-400", bg: "bg-purple-500/20", badge: "bg-purple-500/20 text-purple-300" },
  Parallel: { icon: GitBranch, color: "text-blue-400", bg: "bg-blue-500/20", badge: "bg-blue-500/20 text-blue-300" },
  Loop: { icon: Repeat, color: "text-purple-400", bg: "bg-purple-500/20", badge: "bg-purple-500/20 text-purple-300" },
  Router: { icon: Network, color: "text-blue-400", bg: "bg-blue-400/20", badge: "bg-blue-400/20 text-blue-300" },
};

function resolveNames(subAgents, resolveAgentName) {
  if (!subAgents || subAgents.length === 0) return [];
  return subAgents.map((id) => resolveAgentName?.(id) || id);
}

function BaseInfo({ agent }) {
  return (
    <div className="flex items-center gap-3 text-xs th-text-muted">
      {agent.agent_model && (
        <span className="px-2 py-0.5 rounded-full bg-white/5 th-text-muted">{agent.agent_model}</span>
      )}
      {(agent.agent_tools?.length || 0) > 0 && (
        <span>{agent.agent_tools.length} tools</span>
      )}
      {agent.agent_description && (
        <span className="truncate max-w-50 th-text-faint">
          {agent.agent_description.slice(0, 80)}
        </span>
      )}
    </div>
  );
}

function SequentialInfo({ agent, resolveAgentName }) {
  const names = resolveNames(agent.subAgents, resolveAgentName);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">
        {names.length} steps
      </span>
      <span className="th-text-muted truncate max-w-75">
        {names.map((n, i) => (
          <span key={i}>
            {i > 0 && <span className="text-purple-400 mx-1">→</span>}
            <span className="th-text-secondary">{n}</span>
          </span>
        ))}
      </span>
    </div>
  );
}

function ParallelInfo({ agent, resolveAgentName }) {
  const names = resolveNames(agent.subAgents, resolveAgentName);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">
        {names.length} branches
      </span>
      <span className="th-text-muted truncate max-w-75">
        {names.join(" ∥ ")}
      </span>
    </div>
  );
}

function LoopInfo({ agent, resolveAgentName }) {
  const names = resolveNames(agent.subAgents, resolveAgentName);
  const isFixed = agent.loop_max_iterations != null && agent.loop_max_iterations > 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">
        {isFixed ? `Fixed: ${agent.loop_max_iterations} iterations` : "LLM Conditional"}
      </span>
      {names.length > 0 && (
        <span className="th-text-muted truncate max-w-50">
          ↻ {names.join(" → ")}
        </span>
      )}
    </div>
  );
}

function RouterInfo({ agent, resolveAgentName }) {
  const names = resolveNames(agent.subAgents, resolveAgentName);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="px-2 py-0.5 rounded-full bg-blue-400/20 text-blue-300">
        {names.length} routes
      </span>
      {names.length > 0 && (
        <span className="th-text-muted truncate max-w-75">
          {names.map((n, i) => (
            <span key={i}>
              {i > 0 && <span className="text-blue-400 mx-1">|</span>}
              <span className="th-text-secondary">⟶ {n}</span>
            </span>
          ))}
        </span>
      )}
    </div>
  );
}

const infoComponents = {
  Base: BaseInfo,
  Sequential: SequentialInfo,
  Parallel: ParallelInfo,
  Loop: LoopInfo,
  Router: RouterInfo,
};

export default function NodeInfoPanel({ agent, resolveAgentName, onClose }) {
  if (!agent) return null;

  const config = categoryConfig[agent.category] || categoryConfig.Base;
  const Icon = config.icon;
  const InfoComponent = infoComponents[agent.category] || BaseInfo;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 min-w-100 max-w-2xl backdrop-blur-xl glass-modal rounded-xl shadow-2xl px-4 py-3 animate-in slide-in-from-bottom-2 fade-in duration-200">
      <button
        onClick={onClose}
        className="absolute top-2 right-2 p-1 th-text-ghost hover:th-text-secondary transition-colors"
      >
        <X size={14} />
      </button>

      <div className="flex items-center gap-4">
        {/* Left: icon + label + category */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className={`p-1.5 rounded-lg ${config.bg}`}>
            <Icon size={16} className={config.color} />
          </div>
          <div>
            <div className="text-sm font-semibold th-text">{agent.label}</div>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${config.badge}`}>
              {agent.category}
            </span>
          </div>
        </div>

        {/* Separator */}
        <div className="w-px h-8 th-border shrink-0" style={{ backgroundColor: "var(--border-primary)" }} />

        {/* Right: type-specific info */}
        <div className="flex-1 overflow-hidden">
          <InfoComponent agent={agent} resolveAgentName={resolveAgentName} />
        </div>
      </div>
    </div>
  );
}
