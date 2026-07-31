"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Clock } from "lucide-react";
import { useTranslations } from "use-intl";

/**
 * Compact output preview shown on workflow nodes after execution.
 * Displays a truncated result or error message with a duration badge.
 * Click to expand a modal with the full content.
 */
function formatPreview(value, t) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    return value.length > 60 ? value.slice(0, 60) + "..." : value;
  }
  if (Array.isArray(value)) {
    return `[${t("arrayItemsCount", { count: value.length })}]`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value);
    return `{${t("objectFieldsCount", { count: keys.length })}}`;
  }
  return String(value);
}

function formatFull(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatDuration(ms) {
  if (ms === null || ms === undefined) return null;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function NodeOutputPreview({ result, error, duration, status }) {
  const t = useTranslations("NodeOutputPreview");
  const [showFull, setShowFull] = useState(false);

  // Close modal on Escape key
  useEffect(() => {
    if (!showFull) return;
    const handleKey = (e) => {
      if (e.key === "Escape") setShowFull(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [showFull]);

  if (status !== "done" && status !== "error") return null;

  const isError = status === "error";
  const displayValue = isError ? error : result;
  const preview = formatPreview(displayValue, t);

  if (!preview) return null;

  const durationLabel = formatDuration(duration);

  return (
    <>
      <button
        type="button"
        title={t("viewFullResultTitle")}
        onClick={(e) => {
          e.stopPropagation();
          setShowFull(true);
        }}
        className={`mt-1.5 w-full text-left px-2 py-1 rounded text-[10px] leading-tight truncate border cursor-pointer transition-colors ${
          isError
            ? "bg-purple-500/10 border-purple-500/20 text-purple-300/80 hover:bg-purple-500/20"
            : "bg-blue-500/10 border-blue-500/20 text-blue-300/80 hover:bg-blue-500/20"
        }`}
      >
        <span className="flex items-center gap-1">
          <span className="truncate flex-1">{preview}</span>
          {durationLabel && (
            <span className="flex items-center gap-0.5 shrink-0 text-white/40">
              <Clock size={7} />
              {durationLabel}
            </span>
          )}
        </span>
      </button>

      {/* Full content modal — rendered via portal to avoid z-index issues within React Flow */}
      {showFull && createPortal(
        <div
          className="fixed inset-0 z-9999 flex items-center justify-center th-bg-overlay backdrop-blur-sm"
          onClick={(e) => {
            e.stopPropagation();
            setShowFull(false);
          }}
        >
          <div
            className="relative glass-modal rounded-xl shadow-2xl max-w-lg w-full mx-4 max-h-[70vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b th-border">
              <span
                className={`text-sm font-semibold ${
                  isError ? "text-purple-400" : "text-blue-400"
                }`}
              >
                {isError ? t("errorLabel") : t("outputLabel")}
                {durationLabel && (
                  <span className="ml-2 text-xs th-text-faint font-normal">
                    {durationLabel}
                  </span>
                )}
              </span>
              <button
                onClick={() => setShowFull(false)}
                className="p-1 rounded-lg hover:th-bg-surface-hover th-text-muted hover:th-text transition-colors"
              >
                <X size={14} />
              </button>
            </div>
            <div className="p-4 overflow-auto custom-scrollbar flex-1">
              <pre className="text-xs th-text-secondary whitespace-pre-wrap wrap-break-word font-mono">
                {formatFull(displayValue)}
              </pre>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
