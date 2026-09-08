"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "use-intl";
import { getDefaultLlmUsage } from "@/lib/api";
import { formatTokens } from "@/lib/quota";
import { registerRunObserver } from "@/extensions/registry";

// Un seul observateur de run pour tous les compteurs montés : le registre ne
// sait pas désinscrire, un observateur par montage fuirait à chaque navigation.
const listeners = new Set();
let observing = false;
function subscribe(fn) {
  listeners.add(fn);
  if (!observing) {
    observing = true;
    registerRunObserver(() => {
      for (const l of listeners) l();
    });
  }
  return () => listeners.delete(fn);
}

const LEVEL_BAR = { ok: "bg-brand", warning: "bg-amber-400", exceeded: "bg-red-500" };
const LEVEL_TEXT = { ok: "th-text-secondary", warning: "text-amber-400", exceeded: "text-red-400" };

/**
 * Compteur du modèle mutualisé « thaink2/default » en pied de barre latérale.
 *
 * Le cœur compte, une brique plafonne : sans limite servie, le compteur du
 * mois et la date de remise à zéro — pas de barre, un remplissage sans
 * maximum ne dirait rien. Avec une limite (brique de plafond installée), la
 * barre se remplit du consommé et le chiffre annonce le restant, comme la
 * jauge de crédit commerciale. Tenu à jour à chaque fin de run.
 */
export default function DefaultLlmUsageMeter({ collapsed = false }) {
  const t = useTranslations("DefaultLlmUsageMeter");
  const [usage, setUsage] = useState(null);

  const refresh = useCallback(() => {
    getDefaultLlmUsage()
      .then((data) => setUsage(data))
      .catch(() => setUsage(null));
  }, []);

  useEffect(() => {
    refresh();
    return subscribe(refresh);
  }, [refresh]);

  if (!usage || usage.enabled === false) return null;

  const hasLimit = Number.isFinite(usage.limit_tokens) && usage.limit_tokens > 0;
  const used = formatTokens(usage.used_tokens);
  const resetsAt = usage.resets_at ? new Date(usage.resets_at).toLocaleDateString() : null;

  if (!hasLimit) {
    const title = `${t("title")} — ${t("thisMonth", { used })}${resetsAt ? ` · ${t("resets", { date: resetsAt })}` : ""}`;
    return (
      <div className={collapsed ? "px-2 text-center" : "px-2 py-1.5"} title={title} aria-label={title} data-testid="default-llm-usage-meter" data-mode="counter">
        {!collapsed && (
          <div className="flex items-baseline justify-between mb-0.5">
            <span className="text-[11px] font-medium th-text-faint truncate">{t("title")}</span>
            <span className="text-[11px] font-semibold tabular-nums th-text-secondary">{t("thisMonth", { used })}</span>
          </div>
        )}
        {collapsed ? (
          <span className="text-[10px] font-semibold tabular-nums th-text-secondary">{used}</span>
        ) : (
          resetsAt && <div className="text-[10px] th-text-ghost">{t("resets", { date: resetsAt })}</div>
        )}
      </div>
    );
  }

  const usedPercent = Math.min(100, Math.max(0, Math.round(usage.percent_used ?? 0)));
  const remaining = 100 - usedPercent;
  const level = usage.exceeded ? "exceeded" : usage.warning ? "warning" : "ok";
  const label = t("remaining", { percent: remaining });
  const title = `${label} — ${used} / ${formatTokens(usage.limit_tokens)}`;

  return (
    <div className={collapsed ? "px-2" : "px-2 py-1.5"} title={title} aria-label={title} data-testid="default-llm-usage-meter" data-mode="meter" data-level={level}>
      {!collapsed && (
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-[11px] font-medium th-text-faint truncate">{t("title")}</span>
          <span className={`text-[11px] font-semibold tabular-nums ${LEVEL_TEXT[level]}`}>{label}</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={usedPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={title}
        className="h-1.5 w-full rounded-full overflow-hidden th-bg-surface"
      >
        <div className={`h-full rounded-full transition-[width] duration-500 ease-out ${LEVEL_BAR[level]}`} style={{ width: `${usedPercent}%` }} />
      </div>
      {!collapsed && (
        <div className="mt-1 text-[10px] th-text-ghost tabular-nums">
          {used} / {formatTokens(usage.limit_tokens)}
        </div>
      )}
    </div>
  );
}
