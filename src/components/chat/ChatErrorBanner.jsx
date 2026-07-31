"use client";

import { useState, useRef } from "react";
import { useTranslations } from "use-intl";
import { AlertCircle, Check, Copy, X } from "lucide-react";

export default function ChatErrorBanner({ error, onClear }) {
  const t = useTranslations("ChatErrorBanner");
  const [copied, setCopied] = useState(false);
  const copyTimeout = useRef(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(error);
      setCopied(true);
      clearTimeout(copyTimeout.current);
      copyTimeout.current = setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className="mx-4 mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-xl flex items-center gap-3"
    >
      <AlertCircle size={18} className="text-red-400 shrink-0" />
      <p className="text-sm text-red-200 flex-1">{error}</p>
      <button
        onClick={handleCopy}
        className="p-1 hover:th-bg-surface-hover rounded"
        title={t("copyError")}
        aria-label={t("copyErrorMessage")}
      >
        {copied ? (
          <Check size={14} className="text-blue-400" />
        ) : (
          <Copy size={14} className="text-red-300" />
        )}
      </button>
      <button
        onClick={onClear}
        className="p-1 hover:th-bg-surface-hover rounded"
        aria-label={t("dismissError")}
      >
        <X size={16} className="text-red-300" />
      </button>
    </div>
  );
}
