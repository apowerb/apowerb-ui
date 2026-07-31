"use client";

import { X } from "lucide-react";
import { useTranslations } from "use-intl";

/**
 * HOC wrapper for all workflow nodes.
 * Provides glassmorphism styling + colored accent + execution status border + delete button on hover.
 */
export default function NodeWrapper({ children, status, category, selected, dimmed, onDelete, className = "" }) {
  const t = useTranslations("NodeWrapper");
  const categoryConfig = {
    Base:       { border: "border-brand/25",  hoverBorder: "hover:border-brand/50",  glow: "border-brand shadow-[0_0_20px_rgba(1,61,255,0.35)] ring-1 ring-brand/30", accent: "from-brand to-brand-secondary" },
    Parallel:   { border: "border-blue-500/25",   hoverBorder: "hover:border-blue-500/50",   glow: "border-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.35)] ring-1 ring-blue-400/30", accent: "from-blue-500 to-blue-600" },
    Sequential: { border: "border-purple-500/25",  hoverBorder: "hover:border-purple-500/50",  glow: "border-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.35)] ring-1 ring-purple-400/30", accent: "from-purple-500 to-purple-700" },
    Loop:       { border: "border-purple-500/25",  hoverBorder: "hover:border-purple-500/50",  glow: "border-purple-400 shadow-[0_0_20px_rgba(168,130,255,0.35)] ring-1 ring-purple-400/30", accent: "from-purple-500 to-purple-600" },
    Router:     { border: "border-blue-400/25",    hoverBorder: "hover:border-blue-400/50",    glow: "border-blue-300 shadow-[0_0_20px_rgba(59,130,246,0.35)] ring-1 ring-blue-300/30", accent: "from-blue-400 to-blue-500" },
  };

  const statusStyles = {
    running: "border-purple-300 shadow-[0_0_24px_rgba(168,130,255,0.4)] animate-pulse",
    done: "border-blue-400 shadow-[0_0_18px_rgba(59,130,246,0.3)]",
    error: "border-red-400 shadow-[0_0_18px_rgba(239,68,68,0.3)]",
  };

  const config = categoryConfig[category] || categoryConfig.Base;

  let borderClass;
  if (statusStyles[status]) {
    borderClass = statusStyles[status];
  } else if (selected) {
    borderClass = config.glow;
  } else {
    borderClass = `${config.border} ${config.hoverBorder}`;
  }

  const dimClass = dimmed ? "opacity-35 scale-[0.97]" : "";

  return (
    <div
      className={`node-wrapper relative group backdrop-blur-xl bg-white/5 border rounded-2xl transition-all duration-300 hover:shadow-xl ${borderClass} ${dimClass} ${className}`}
    >
      {/* Colored accent bar */}
      <div className={`absolute top-0 left-3 right-3 h-[2px] rounded-b bg-linear-to-r ${config.accent} opacity-60 group-hover:opacity-100 transition-opacity`} />

      {/* Delete button on hover */}
      {onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="absolute -top-2.5 -right-2.5 z-10 p-1 rounded-full bg-purple-500/90 text-white opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-purple-500 hover:scale-110 shadow-lg shadow-purple-500/30"
          title={t("removeFromCanvasTitle")}
        >
          <X size={11} />
        </button>
      )}
      {children}
    </div>
  );
}
