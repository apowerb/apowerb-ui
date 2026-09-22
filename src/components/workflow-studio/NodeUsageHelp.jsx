"use client";

import { useTranslations } from "use-intl";

/**
 * What a node does and what it gives downstream, at the top of the inspector.
 * `id` is the selected node's id, so the references shown are the ones to
 * paste. Collapsible: once known, it folds out of the way.
 */
export default function NodeUsageHelp({ type, id }) {
  const t = useTranslations("WorkflowNodeHelp");
  return (
    <details open className="mb-3 rounded-xl th-bg-surface border th-border-secondary p-2.5 text-[11px] leading-relaxed">
      <summary className="cursor-pointer font-semibold th-text-secondary">{t("title")}</summary>
      <p className="mt-1.5 th-text-secondary">{t(`${type}_what`)}</p>
      <p className="mt-1 th-text-ghost">
        <span className="font-semibold">{t("outputLabel")}</span> {t(`${type}_output`, { id })}
      </p>
    </details>
  );
}
