"use client";

import { useTranslations } from "use-intl";
import { Bold, Italic, Code, Link, List, Quote, Eye, EyeOff } from "lucide-react";

const BUTTON_CONFIG = [
  { action: "bold", icon: Bold, labelKey: "bold", shortcut: "Ctrl+B" },
  { action: "italic", icon: Italic, labelKey: "italic", shortcut: "Ctrl+I" },
  { action: "code", icon: Code, labelKey: "inlineCode", shortcut: "Ctrl+E" },
  { action: "link", icon: Link, labelKey: "link", shortcut: "Ctrl+K" },
  { action: "ul", icon: List, labelKey: "bulletList" },
  { action: "quote", icon: Quote, labelKey: "quote", shortcut: "Ctrl+Shift+." },
];

export default function MarkdownToolbar({
  onAction,
  previewMode = false,
  onTogglePreview,
  disabled = false,
}) {
  const t = useTranslations("MarkdownToolbar");
  return (
    <div
      className="flex items-center gap-0.5 mb-1.5 px-1"
      role="toolbar"
      aria-label={t("markdownFormatting")}
    >
      {BUTTON_CONFIG.map(({ action, icon: Icon, labelKey, shortcut }) => {
        const label = t(labelKey);
        return (
          <button
            key={action}
            type="button"
            onClick={() => onAction?.(action)}
            disabled={disabled || previewMode}
            title={shortcut ? `${label} (${shortcut})` : label}
            aria-label={label}
            className="w-7 h-7 flex items-center justify-center rounded-md th-text-faint hover:th-text-secondary hover:th-bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
          >
            <Icon size={13} />
          </button>
        );
      })}

      {onTogglePreview && (
        <>
          <div className="w-px h-4 th-border mx-1" aria-hidden="true" />
          <button
            type="button"
            onClick={onTogglePreview}
            disabled={disabled}
            title={previewMode ? t("backToEditor") : t("preview")}
            aria-label={previewMode ? t("backToEditor") : t("preview")}
            aria-pressed={previewMode}
            className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand ${
              previewMode
                ? "bg-brand/15 text-brand"
                : "th-text-faint hover:th-text-secondary hover:th-bg-surface-hover"
            }`}
          >
            {previewMode ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        </>
      )}
    </div>
  );
}
