"use client";

import { Handle, Position } from "@xyflow/react";
import { Copy, X } from "lucide-react";
import { useTranslations } from "use-intl";

// Mirrors src/components/workflow/nodes/NodeWrapper.jsx's glassmorphism
// recipe, generalised to the Studio's own family palette (amber/brand/
// violet/emerald/blue) instead of the orchestrator's Base/Parallel/... set.
const COLOR_STYLES = {
  amber: { border: "border-amber-500/25", hover: "hover:border-amber-500/50", glow: "border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.35)] ring-1 ring-amber-400/30", accent: "from-amber-400 to-amber-600", chip: "bg-amber-500/10 text-amber-300 border-amber-500/20" },
  brand: { border: "border-brand/25", hover: "hover:border-brand/50", glow: "border-brand shadow-[0_0_20px_rgba(1,61,255,0.35)] ring-1 ring-brand/30", accent: "from-brand to-brand-secondary", chip: "bg-brand/10 text-[#5B8AFF] border-brand/20" },
  violet: { border: "border-violet-500/25", hover: "hover:border-violet-500/50", glow: "border-violet-400 shadow-[0_0_20px_rgba(139,92,246,0.35)] ring-1 ring-violet-400/30", accent: "from-violet-500 to-purple-600", chip: "bg-violet-500/10 text-violet-300 border-violet-500/20" },
  emerald: { border: "border-emerald-500/25", hover: "hover:border-emerald-500/50", glow: "border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.35)] ring-1 ring-emerald-400/30", accent: "from-emerald-500 to-teal-600", chip: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20" },
  blue: { border: "border-blue-500/25", hover: "hover:border-blue-500/50", glow: "border-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.35)] ring-1 ring-blue-400/30", accent: "from-blue-500 to-blue-600", chip: "bg-blue-500/10 text-blue-300 border-blue-500/20" },
};

const RUN_STATUS_STYLES = {
  running: "border-purple-300 shadow-[0_0_24px_rgba(168,130,255,0.4)] animate-pulse",
  done: "border-blue-400 shadow-[0_0_18px_rgba(59,130,246,0.3)]",
  error: "border-red-400 shadow-[0_0_18px_rgba(239,68,68,0.35)]",
};

export default function NodeShell({
  color = "brand",
  icon: Icon,
  title,
  subtitle,
  footer,
  selected,
  dimmed,
  errorCount = 0,
  runStatus,
  hasTarget = true,
  hasSource = true,
  soon = false,
  onDelete,
  onDuplicate,
  children,
}) {
  const t = useTranslations("WorkflowNode");
  const style = COLOR_STYLES[color] || COLOR_STYLES.brand;

  let borderClass;
  if (RUN_STATUS_STYLES[runStatus]) {
    borderClass = RUN_STATUS_STYLES[runStatus];
  } else if (selected) {
    borderClass = style.glow;
  } else {
    borderClass = `${style.border} ${style.hover}`;
  }

  return (
    <div
      className={`node-shell group relative backdrop-blur-xl bg-white/5 border rounded-2xl transition-all duration-300 hover:shadow-xl min-w-52 max-w-72 ${borderClass} ${dimmed ? "opacity-40" : ""} ${soon ? "opacity-70" : ""}`}
    >
      <div className={`absolute top-0 left-3 right-3 h-[2px] rounded-b bg-linear-to-r ${style.accent} opacity-60 group-hover:opacity-100 transition-opacity`} />

      {hasTarget && (
        <Handle
          type="target"
          position={Position.Left}
          className="bg-white! w-2.5! h-2.5! border-2! border-white/40!"
        />
      )}
      {hasSource && (
        <Handle
          type="source"
          position={Position.Right}
          className="bg-white! w-2.5! h-2.5! border-2! border-white/40!"
        />
      )}

      <div className="absolute -top-2.5 -right-2.5 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {onDuplicate && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
            title={t("duplicateTitle")}
            className="p-1 rounded-full th-bg-elevated border th-border th-text-secondary hover:th-text shadow-lg"
          >
            <Copy size={11} />
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            title={t("removeTitle")}
            className="p-1 rounded-full bg-red-500/90 text-white hover:bg-red-500 hover:scale-110 transition-transform shadow-lg"
          >
            <X size={11} />
          </button>
        )}
      </div>

      {errorCount > 0 && (
        <div
          className="absolute -top-2 -left-2 z-10 min-w-4.5 h-4.5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow-lg"
          title={t("errorBadge", { count: errorCount })}
        >
          {errorCount}
        </div>
      )}

      <div className="px-3.5 py-3 min-w-52 max-w-72">
        <div className="flex items-center gap-2.5 mb-1.5">
          {Icon && (
            <div className={`p-1.5 rounded-xl bg-linear-to-br ${style.accent} shadow-md shrink-0`}>
              <Icon size={14} className="text-white" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold th-text truncate leading-tight">
              {title || t("untitled")}
            </div>
            {subtitle && (
              <p className="text-[11px] th-text-ghost truncate leading-tight">{subtitle}</p>
            )}
          </div>
        </div>
        {children}
        {soon && (
          <span className={`inline-block mt-1.5 px-1.5 py-0.5 text-[10px] font-medium rounded-md border ${style.chip}`}>
            {t("soonBadge")}
          </span>
        )}
        {footer}
      </div>
    </div>
  );
}
