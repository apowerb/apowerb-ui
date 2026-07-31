"use client";

import { useTranslations } from "use-intl";
import { Move, Eye, Edit, X, Play } from "lucide-react";

export default function AgentCompositeCard({
  box,
  boxes,
  draggedBox,
  onMouseDown,
  onRun,
  onViewDetails,
  onEdit,
  onRemoveFromCanvas,
}) {
  const t = useTranslations("AgentCompositeCard");
  const subAgentsList = box.subAgents
    .map((subId) => boxes.find((b) => b.id === subId))
    .filter(Boolean);

  const isParallel = box.category === "Parallel";
  const isSequential = box.category === "Sequential";

  return (
    <div
      className={`absolute ${box.color} text-white rounded-xl shadow-2xl cursor-move transition-transform hover:scale-105`}
      style={{
        left: `${box.x}px`,
        top: `${box.y}px`,
        width: "360px",
        height: "320px",
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

        <p className="font-bold text-xl text-center mt-6 mb-1">{box.label}</p>
        <p className="text-sm text-center opacity-90 mb-3 font-semibold">
          {box.category}
        </p>

        <div className="bg-white/20 rounded-lg p-3 mb-3 flex-1 overflow-auto">
          <p className="text-xs font-semibold mb-3 opacity-90 text-center">
            {t("subAgentsLabel")}
          </p>

          {isParallel && (
            <div className="flex flex-wrap gap-2 justify-center items-start">
              {subAgentsList.map((subAgent, index) => (
                <div
                  key={subAgent.id}
                  className="flex flex-col items-center relative group"
                >
                  <div
                    className={`${subAgent.color} rounded-lg px-3 py-2 text-xs font-semibold shadow-md min-w-[90px] text-center`}
                  >
                    <div className="text-[10px] opacity-60 mb-1">
                      #{index + 1}
                    </div>
                    <div className="truncate">{subAgent.label}</div>
                    <div className="text-[10px] opacity-75 mt-1">
                      {subAgent.category}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewDetails(subAgent.id);
                    }}
                    className="absolute -top-1 -right-1 th-bg-elevated th-text-secondary rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                    title={t("viewDetailsTooltip")}
                  >
                    <Eye size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {isSequential && (
            <div className="flex flex-col items-center gap-2">
              {subAgentsList.map((subAgent, index) => (
                <div
                  key={subAgent.id}
                  className="flex flex-col items-center w-full"
                >
                  <div className="relative w-full max-w-[280px] group">
                    <div
                      className={`${subAgent.color} rounded-lg px-3 py-2 text-xs font-semibold shadow-md text-center`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-white/70">
                          {index + 1}.
                        </span>
                        <div className="flex-1">
                          <div className="truncate">{subAgent.label}</div>
                          <div className="text-[10px] opacity-75 mt-1">
                            {subAgent.category}
                          </div>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewDetails(subAgent.id);
                      }}
                      className="absolute -top-1 -right-1 th-bg-elevated th-text-secondary rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                      title={t("viewDetailsTooltip")}
                    >
                      <Eye size={12} />
                    </button>
                  </div>
                  {index < subAgentsList.length - 1 && (
                    <div className="text-white text-xl font-bold my-1">↓</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onRun(box);
          }}
          className="w-full bg-white/20 hover:bg-white/30 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 border-2 border-white/30"
        >
          <Play size={16} />
          {t("runButton", { category: box.category })}
        </button>
      </div>
    </div>
  );
}
