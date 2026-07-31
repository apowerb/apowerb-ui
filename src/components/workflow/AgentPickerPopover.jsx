"use client";

import { useState, useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { useTranslations } from "use-intl";

const categoryBadgeColors = {
  Base: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  Sequential: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  Parallel: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  Loop: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  Router: "bg-blue-400/20 text-blue-400 border-blue-400/30",
};

/**
 * AgentPickerPopover - Glassmorphism popover to select an agent to insert.
 *
 * Props:
 *  - visible: boolean
 *  - x, y: position
 *  - agents: all available agents (array of { id, label, category })
 *  - existingAgentIds: agents already on the canvas (greyed out)
 *  - onSelect(agentId): called when an agent is picked
 *  - onClose(): called on Escape / outside click
 */
export default function AgentPickerPopover({
  visible,
  x,
  y,
  agents = [],
  existingAgentIds = [],
  onSelect,
  onClose,
}) {
  const t = useTranslations("AgentPickerPopover");
  const [search, setSearch] = useState("");
  const popoverRef = useRef(null);
  const inputRef = useRef(null);

  // Close on outside click or Escape
  useEffect(() => {
    if (!visible) return;

    const handleClick = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose?.();
      }
    };
    const handleKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [visible, onClose]);

  // Reset search and focus input when popover opens
  const [prevVisible, setPrevVisible] = useState(visible);
  if (visible && !prevVisible) {
    setSearch("");
  }
  if (visible !== prevVisible) {
    setPrevVisible(visible);
  }
  useEffect(() => {
    if (visible) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [visible]);

  if (!visible) return null;

  const existingSet = new Set(existingAgentIds);

  const filtered = agents.filter((agent) => {
    const q = search.toLowerCase();
    return (
      agent.label?.toLowerCase().includes(q) ||
      agent.category?.toLowerCase().includes(q) ||
      agent.id?.toLowerCase().includes(q)
    );
  });

  // Boundary check — flip if too close to viewport edge
  const popoverW = 260;
  const popoverH = 340;
  const safeX = x + popoverW > window.innerWidth ? x - popoverW : x;
  const safeY = y + popoverH > window.innerHeight ? y - popoverH : y;

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 w-65 max-h-85 flex flex-col rounded-xl shadow-2xl backdrop-blur-xl glass-modal"
      style={{ left: safeX, top: safeY }}
    >
      {/* Search input */}
      <div className="px-3 pt-3 pb-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 th-text-ghost" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchAgentsPlaceholder")}
            className="glass-input w-full pl-8 pr-3 py-1.5 text-xs rounded-lg focus:outline-none"
          />
        </div>
      </div>

      {/* Agent list */}
      <div className="flex-1 overflow-y-auto px-1.5 pb-2 scrollbar-thin">
        {filtered.length === 0 ? (
          <div className="px-3 py-4 text-xs th-text-ghost text-center">
            {t("noAgentsAvailable")}
          </div>
        ) : (
          filtered.map((agent) => {
            const isOnCanvas = existingSet.has(agent.id);
            const badgeColor =
              categoryBadgeColors[agent.category] || "bg-gray-500/20 text-gray-400 border-gray-500/30";

            return (
              <button
                key={agent.id}
                disabled={isOnCanvas}
                onClick={() => {
                  if (!isOnCanvas) onSelect?.(agent.id);
                }}
                className={`w-full px-2.5 py-2 text-left rounded-lg flex items-center gap-2 transition-colors ${
                  isOnCanvas
                    ? "opacity-35 cursor-not-allowed"
                    : "hover:th-bg-surface-hover cursor-pointer"
                }`}
              >
                {/* Category badge */}
                <span
                  className={`shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded border ${badgeColor}`}
                >
                  {agent.category || "Base"}
                </span>
                {/* Agent name */}
                <span className="text-xs th-text-secondary truncate">
                  {agent.label || agent.id}
                </span>
                {/* Already on canvas indicator */}
                {isOnCanvas && (
                  <span className="ml-auto text-[10px] th-text-whisper shrink-0">
                    {t("onCanvasBadge")}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
