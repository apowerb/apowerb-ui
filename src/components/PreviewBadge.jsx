"use client";

import { useTranslations } from "use-intl";

/**
 * Interrupteur unique de la fonctionnalité (roadmap apowerb#100) : le
 * passer à `false` retire le badge des trois écrans qui l'utilisent (menu
 * latéral, liste des workflows, barre du studio) sans toucher à leur code.
 */
export const WORKFLOWS_PREVIEW_ENABLED = true;

/**
 * Pastille ambre "Preview" + infobulle, pour signaler une fonctionnalité en
 * préversion. `title`/`aria-label` couvrent survol ET lecteur d'écran ; le
 * badge reste focusable (`tabIndex={0}`) pour que le clavier révèle aussi
 * l'infobulle native du navigateur.
 */
export default function PreviewBadge({ enabled = WORKFLOWS_PREVIEW_ENABLED, className = "" }) {
  const t = useTranslations("PreviewBadge");
  if (!enabled) return null;

  const tooltip = t("tooltip");

  return (
    <span
      data-testid="preview-badge"
      tabIndex={0}
      title={tooltip}
      aria-label={tooltip}
      className={`inline-flex items-center shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/40 ${className}`}
    >
      {t("label")}
    </span>
  );
}
