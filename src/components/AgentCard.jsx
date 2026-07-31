"use client";

import { useTranslations } from "use-intl";
import { Move, Eye, Edit, X, Play } from "lucide-react";

export default function AgentCard({
  box,
  availableTools,
  draggedBox,
  onMouseDown,
  onToolChange,
  onRun,
  onViewDetails,
  onEdit,
  onRemoveFromCanvas,
}) {
  const t = useTranslations("AgentCard");
  return (
    <div
      className={`absolute ${box.color} text-white rounded-xl shadow-2xl cursor-move transition-transform hover:scale-105`}
      style={{
        left: `${box.x}px`,
        top: `${box.y}px`,
        width: "220px",
        height: "220px",
        zIndex: draggedBox === box.id ? 10 : 2,
      }}
      onMouseDown={(e) => onMouseDown(e, box)}
    >
      <div className="h-full flex flex-col p-4 relative">
        <Move size={18} className="absolute top-3 left-3 opacity-50" />

        <div className="absolute top-3 right-3 flex gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails(box.id);
            }}
            className="hover:bg-white/20 rounded p-1.5 transition-colors"
            title={t("viewDetailsTooltip")}
          >
            <Eye size={16} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(box);
            }}
            className="hover:bg-white/20 rounded p-1.5 transition-colors"
            title={t("editAgentTooltip")}
          >
            <Edit size={16} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemoveFromCanvas(box.id);
            }}
            className="hover:bg-white/20 rounded p-1.5 transition-colors"
            title={t("removeFromCanvasTooltip")}
          >
            <X size={16} />
          </button>
        </div>

        <p className="font-bold text-lg text-center mt-6 mb-1">{box.label}</p>
        <p className="text-xs text-center opacity-75 mb-3 font-semibold">
          {box.category}
        </p>

        {/* Tool Configs */}
        {box.agent_tools && box.agent_tools.length > 0 && (
          <div className="mb-2 flex-1 overflow-hidden">
            <label className="block text-xs font-semibold mb-1 opacity-90">
              {t("toolsLabel")}
            </label>
            <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
              {box.agent_tools.map((toolConfigId) => (
                <span
                  key={toolConfigId}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-white/20 text-white border border-white/30"
                  title={toolConfigId}
                >
                  {toolConfigId.replace('tool_config', 'TC')}
                </span>
              ))}
            </div>
          </div>
        )}

        {box.category === "Loop" && box.subAgents.length > 0 && (
          <p className="text-xs text-center opacity-90 mb-2">
            🔗 {t("subAgentsCount", { count: box.subAgents.length })}
          </p>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            onRun(box);
          }}
          className="w-full bg-white/20 hover:bg-white/30 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 border-2 border-white/30"
        >
          <Play size={16} />
          {t("runAgentButton")}
        </button>
      </div>
    </div>
  );
}
