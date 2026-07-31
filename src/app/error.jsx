"use client";

import { useTranslations } from "use-intl";
import { AlertCircle, RotateCcw, Home } from "lucide-react";

export default function Error({ error, reset }) {
  const t = useTranslations("Error");
  return (
    <div className="flex items-center justify-center h-full min-h-[50vh] p-6">
      <div className="glass-card p-8 max-w-md w-full text-center">
        <div className="w-14 h-14 rounded-full bg-[var(--color-error,#7c3aed)]/10 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-7 h-7 text-[var(--color-error,#7c3aed)]" />
        </div>
        <h2 className="text-lg font-semibold th-text mb-2">{t("title")}</h2>
        <p className="text-sm th-text-muted mb-6">
          {error?.message || t("defaultMessage")}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-brand,#013DFF)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <RotateCcw className="w-4 h-4" />
            {t("tryAgain")}
          </button>
          <a
            href="/agents"
            className="flex items-center gap-2 px-4 py-2 rounded-xl th-bg-surface th-text text-sm font-medium hover:opacity-80 transition-opacity"
          >
            <Home className="w-4 h-4" />
            {t("goHome")}
          </a>
        </div>
      </div>
    </div>
  );
}
