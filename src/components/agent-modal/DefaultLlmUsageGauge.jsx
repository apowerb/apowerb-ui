"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "use-intl";
import { getDefaultLlmUsage } from "@/lib/api";
import { formatTokens } from "@/lib/quota";

/**
 * Jauge affichée à la place de la clé API quand l'agent est en
 * `thaink2/default` : l'utilisateur n'a rien à saisir, mais il doit savoir
 * où il en est. Deux étages, comme le backend :
 *  - toujours : jetons du mois calendaire (Paris) et date de remise à zéro ;
 *  - si le serveur sert une limite (une brique de plafond est installée) :
 *    barre, pourcentage, alerte à partir de 80 %, dépassement.
 * Sans limite servie, aucune n'est affichée — un chiffre suggérerait un
 * quota qui n'existe pas.
 */
export default function DefaultLlmUsageGauge() {
  const t = useTranslations("AgentFormStep");
  const [usage, setUsage] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    getDefaultLlmUsage()
      .then((data) => alive && setUsage(data))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  if (failed) {
    return (
      <p className="text-xs th-text-ghost pl-1" data-testid="default-llm-usage-unavailable">
        {t("defaultLlmUsageUnavailable")}
      </p>
    );
  }
  if (!usage || usage.enabled === false) return null;

  const hasLimit = Number.isFinite(usage.limit_tokens) && usage.limit_tokens > 0;
  const percent = hasLimit ? Math.min(100, Math.max(0, usage.percent_used ?? 0)) : null;
  const tone = usage.exceeded ? "exceeded" : usage.warning ? "warning" : "ok";
  const barColor = { ok: "bg-emerald-500", warning: "bg-amber-500", exceeded: "bg-red-500" }[tone];
  const resetsAt = usage.resets_at ? new Date(usage.resets_at).toLocaleDateString() : null;

  return (
    <div
      className="rounded-lg border th-border-secondary p-3 space-y-2"
      data-testid="default-llm-usage"
      data-tone={tone}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium th-text-muted">{t("defaultLlmUsageTitle")}</span>
        <span className="text-sm font-semibold th-text">
          {hasLimit
            ? t("defaultLlmUsageOfLimit", {
                used: formatTokens(usage.used_tokens),
                limit: formatTokens(usage.limit_tokens),
              })
            : t("defaultLlmUsageTokens", { used: formatTokens(usage.used_tokens) })}
        </span>
      </div>
      {hasLimit && (
        <div
          className="h-2 w-full rounded-full bg-black/10 overflow-hidden"
          role="progressbar"
          aria-label={t("defaultLlmUsageTitle")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(percent)}
        >
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${percent}%` }} />
        </div>
      )}
      {usage.exceeded ? (
        <p className="text-xs text-red-600">{t("defaultLlmUsageExceeded")}</p>
      ) : usage.warning ? (
        <p className="text-xs text-amber-600">
          {t("defaultLlmUsageWarning", { percent: Math.round(percent) })}
        </p>
      ) : null}
      {resetsAt && <p className="text-xs th-text-ghost">{t("defaultLlmUsageResets", { date: resetsAt })}</p>}
    </div>
  );
}
