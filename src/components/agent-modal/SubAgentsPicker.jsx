"use client";

import { useTranslations } from "use-intl";
import { Plus, X, ChevronDown } from "lucide-react";
import ChevronUp from "./ChevronUp";

const CATEGORY_BORDER = {
  Base: "border-brand/40",
  Sequential: "border-purple-400/40",
  Parallel: "border-blue-400/40",
  Loop: "border-purple-400/40",
  Router: "border-blue-400/40",
};

const CATEGORY_BG = {
  Base: "bg-blue-500/20",
  Sequential: "bg-purple-500/20",
  Parallel: "bg-blue-500/20",
  Loop: "bg-purple-500/20",
  Router: "bg-blue-400/20",
};

export default function SubAgentsPicker({
  category,
  subAgents,
  availableAgents,
  boxes,
  onToggle,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragOver,
}) {
  const t = useTranslations("SubAgentsPicker");

  return (
    <div>
      <label className="block text-sm font-bold th-text mb-3 pl-1 border-b th-border pb-2">
        {t("title")}
        <span className="th-text-faint font-normal ml-2 text-xs">
          {["Sequential", "Parallel"].includes(category) && t("twoToSixRequired")}
          {category === "Loop" && t("optionalHint")}
          {category === "Router" && t("routesToSubAgentsHint")}
        </span>
      </label>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-64">
        {/* Available */}
        <div className="flex flex-col h-full th-bg-overlay rounded-xl border th-border-secondary overflow-hidden">
          <div className="p-2.5 th-bg-surface border-b th-border-secondary text-xs font-semibold th-text-secondary">
            {t("availableAgentsHeading")}
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {availableAgents.length === 0 ? (
              <p className="th-text-ghost text-xs text-center mt-10">{t("allAgentsSelected")}</p>
            ) : (
              availableAgents.map((box) => (
                <button
                  key={box.id}
                  onClick={() => onToggle(box.id)}
                  className="w-full flex items-center p-2 rounded-lg hover:th-bg-surface-hover transition-colors group text-left"
                >
                  <div className="flex items-center gap-2 w-full">
                    <Plus
                      size={14}
                      className="th-text-ghost group-hover:th-text transition-colors"
                    />
                    <span className="text-sm th-text-secondary group-hover:th-text truncate flex-1">
                      {box.label}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded text-white ${box.color || "bg-gray-500"}`}
                    >
                      {box.category?.charAt(0)}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Selected */}
        <div
          className={`flex flex-col h-full rounded-xl border overflow-hidden ${CATEGORY_BORDER[category] || "border-white/10"} ${CATEGORY_BG[category] || "bg-white/5"}`}
        >
          <div className="p-2.5 border-b th-border text-xs font-semibold th-text flex justify-between">
            <span>{t("selectedCount", { count: subAgents.length })}</span>
            <span className="th-text-faint font-normal">{t("dragToReorder")}</span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {subAgents.length === 0 ? (
              <p className="th-text-ghost text-xs text-center mt-10">{t("noSubAgentsSelected")}</p>
            ) : (
              subAgents.map((subId, index) => {
                const subAgent = boxes.find((b) => b.id === subId);
                return (
                  <div
                    key={subId}
                    draggable
                    onDragStart={(e) => onDragStart(e, index)}
                    onDragOver={(e) => onDragOver(e, index)}
                    className="flex items-center p-2 rounded-lg th-bg-overlay hover:bg-black/30 border th-border-secondary cursor-move group"
                  >
                    <span className="text-xs th-text-ghost font-mono w-4 mr-1">{index + 1}</span>
                    <span className="text-sm th-text flex-1 truncate py-1">
                      {subAgent ? subAgent.label : subId}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onMoveUp(index)}
                        disabled={index === 0}
                        className="hover:th-text th-text-ghost p-0.5"
                      >
                        <ChevronUp size={12} />
                      </button>
                      <button
                        onClick={() => onMoveDown(index)}
                        disabled={index === subAgents.length - 1}
                        className="hover:th-text th-text-ghost p-0.5"
                      >
                        <ChevronDown size={12} />
                      </button>
                      <button
                        onClick={() => onToggle(subId)}
                        className="hover:text-red-400 th-text-ghost p-0.5"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
