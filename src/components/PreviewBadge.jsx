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
 * préversion. Pas de `tabIndex` : le badge vit dans des liens et boutons déjà
 * focusables, `title`/`aria-label` suffisent au survol et au lecteur d'écran.
 * Fond ambre plein + texte foncé : lisible en thème clair, en sombre et sur
 * l'entrée active du menu (fond de marque).
 *
 * `collapsed` : barre latérale repliée, le libellé est masqué — le badge se
 * réduit à un point ambre ancré dans le coin, comme `SetupBadge`.
 */
export default function PreviewBadge({ enabled = WORKFLOWS_PREVIEW_ENABLED, collapsed = false, className = "" }) {
  const t = useTranslations("PreviewBadge");
  if (!enabled) return null;

  const tooltip = t("tooltip");

  if (collapsed) {
    const name = `${t("label")} — ${tooltip}`;
    return (
      <span
        data-testid="preview-badge-dot"
        role="img"
        title={name}
        aria-label={name}
        className={`absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400 ${className}`}
      />
    );
  }

  return (
    <span
      data-testid="preview-badge"
      title={tooltip}
      aria-label={tooltip}
      className={`inline-flex items-center shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-400 text-amber-950 ${className}`}
    >
      {t("label")}
    </span>
  );
}
