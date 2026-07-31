"use client";

import { useEffect, useRef } from "react";
import { Pencil, Trash2, ArrowLeftToLine, ArrowRightFromLine } from "lucide-react";

const categoryDotColors = {
  Base: "bg-blue-500",
  Sequential: "bg-purple-500",
  Parallel: "bg-blue-500",
  Loop: "bg-purple-500",
  Router: "bg-blue-400",
};

export default function ContextMenu({
  visible,
  x,
  y,
  agentId,
  agentLabel,
  agentCategory,
  onEdit,
  onDelete,
  onInsertBefore,
  onInsertAfter,
  onClose,
}) {
  const menuRef = useRef(null);

  useEffect(() => {
    if (!visible) return;

    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
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

  if (!visible) return null;

  // Boundary check — flip if too close to edge
  const menuW = 200;
  const menuH = 220;
  const safeX = x + menuW > window.innerWidth ? x - menuW : x;
  const safeY = y + menuH > window.innerHeight ? y - menuH : y;

  const items = [
    { icon: Pencil, label: "Edit", onClick: () => { onEdit?.(agentId); onClose?.(); } },
    { icon: ArrowLeftToLine, label: "Insert before", onClick: () => { onInsertBefore?.(agentId); onClose?.(); } },
    { icon: ArrowRightFromLine, label: "Insert after", onClick: () => { onInsertAfter?.(agentId); onClose?.(); } },
    "separator",
    { icon: Trash2, label: "Delete", danger: true, onClick: () => { onDelete?.(agentId); onClose?.(); } },
  ];

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-45 py-2 rounded-xl shadow-2xl backdrop-blur-xl glass-modal"
      style={{ left: safeX, top: safeY }}
    >
      {/* Header with category dot + label */}
      <div className="px-3 pb-2 mb-1 border-b th-border-secondary flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${categoryDotColors[agentCategory] || "bg-gray-500"}`} />
        <span className="text-xs th-text-muted truncate max-w-35">{agentLabel || agentId}</span>
      </div>

      {items.map((item, i) =>
        item === "separator" ? (
          <hr key={i} className="my-1 th-border-secondary" />
        ) : (
          <button
            key={i}
            onClick={item.onClick}
            className={`w-full px-3 py-2 text-sm flex items-center gap-2.5 transition-colors cursor-pointer ${
              item.danger
                ? "text-red-400 hover:text-red-300 hover:bg-red-500/10"
                : "th-text-secondary hover:th-text hover:th-bg-surface-hover"
            }`}
          >
            <item.icon size={14} />
            {item.label}
          </button>
        ),
      )}
    </div>
  );
}
