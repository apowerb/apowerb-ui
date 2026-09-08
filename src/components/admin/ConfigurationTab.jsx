"use client";

import { useTranslations } from "use-intl";
import {
  CheckCircle2,
  CircleAlert,
  CircleDashed,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { Skeleton } from "@/components/Skeleton";
import { useSetupStatus } from "@/hooks/useSetupStatus";

/**
 * La checklist de configuration du serveur, pour un administrateur.
 *
 * Une ligne par capacité servie par `GET /api/config/setup` : ce qui marche,
 * ce qui manque, les NOMS des variables à poser (le cœur ne sert jamais une
 * valeur, et cet écran n'en demande aucune) et le lien de documentation.
 *
 * Trois états, pas deux : configuré, manquant, et « optionnel » — le stockage
 * marche sur un dossier local tant que S3 n'est pas configuré, ce n'est pas un
 * défaut à corriger mais un mode à connaître.
 */

const ROW_ICON = {
  ok: { Icon: CheckCircle2, className: "text-emerald-400" },
  optional: { Icon: CircleDashed, className: "th-text-faint" },
  missing: { Icon: CircleAlert, className: "text-amber-400" },
};

function stateOf(item) {
  // Une capacité optionnelle marche toujours, mais pas forcément dans le mode
  // que l'administrateur croit : le stockage sur dossier local répond « oui »
  // tout en listant les variables S3 qui manquent. La marquer « ok » cacherait
  // ce repli ; elle n'est pas « manquante » pour autant.
  if (item.optional && (item.missing?.length > 0 || !item.configured)) {
    return "optional";
  }
  return item.configured ? "ok" : "missing";
}

/** Nom lisible d'une capacité, avec repli sur la clé si le cœur en ajoute une
 *  que cette version de l'interface ne connaît pas encore. */
function labelFor(t, key) {
  const label = t(`capability.${key}`);
  return label === `capability.${key}` ? key : label;
}

function describe(t, key) {
  const text = t(`description.${key}`);
  return text === `description.${key}` ? null : text;
}

function Row({ t, item }) {
  const state = stateOf(item);
  const { Icon, className } = ROW_ICON[state];
  const description = describe(t, item.key);

  return (
    <li
      className="flex gap-3 px-4 py-3 border-b th-border last:border-b-0"
      data-testid={`setup-row-${item.key}`}
      data-state={state}
    >
      <Icon size={18} className={`shrink-0 mt-0.5 ${className}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="th-text font-medium text-sm">{labelFor(t, item.key)}</span>
          {item.mode && (
            <span className="px-1.5 py-0.5 rounded th-bg-input th-text-secondary text-[11px]">
              {t(`mode.${item.mode}`) === `mode.${item.mode}` ? item.mode : t(`mode.${item.mode}`)}
            </span>
          )}
          <span className={`text-[11px] ${state === "missing" ? "text-amber-400" : "th-text-faint"}`}>
            {t(`state.${state}`)}
          </span>
        </div>
        {description && <p className="text-xs th-text-muted mt-0.5">{description}</p>}
        {item.missing?.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {item.missing.map((name) => (
              <code
                key={name}
                className="px-1.5 py-0.5 rounded th-bg-input th-text-secondary text-[11px]"
              >
                {name}
              </code>
            ))}
          </div>
        )}
      </div>
      {item.docs_url && (
        <a
          href={item.docs_url}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 self-start inline-flex items-center gap-1 text-xs th-text-secondary hover:th-text underline"
        >
          {t("docs")}
          <ExternalLink size={12} />
        </a>
      )}
    </li>
  );
}

export default function ConfigurationTab() {
  const t = useTranslations("Setup");
  const { status, loading, refresh } = useSetupStatus();

  if (loading && !status) return <Skeleton className="h-64 w-full rounded-2xl" />;

  const items = status?.items ?? [];
  const missingCount = status?.missing_count ?? 0;

  return (
    <div data-testid="configuration-tab" data-missing={missingCount}>
      <div className="flex items-start gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="text-sm font-bold th-text">
            {missingCount === 0 ? t("allSet") : t("summary", { count: missingCount })}
          </h2>
          <p className="text-xs th-text-muted mt-0.5">{t("subtitle")}</p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="ml-auto shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-xl border th-border th-bg-surface th-text text-xs font-medium hover:th-bg-surface-hover disabled:opacity-50"
        >
          <RefreshCw size={13} />
          {t("refresh")}
        </button>
      </div>

      {/* Une installation qui ne répond pas est un fait à dire, pas une
          checklist vide qui laisserait croire que tout est en ordre. */}
      {!status ? (
        <p className="px-4 py-3 rounded-xl border th-border th-bg-surface text-sm th-text-muted">
          {t("unavailable")}
        </p>
      ) : (
        <ul className="rounded-xl border th-border th-bg-surface overflow-hidden">
          {items.map((item) => (
            <Row key={item.key} t={t} item={item} />
          ))}
        </ul>
      )}

      <p className="text-[11px] th-text-ghost mt-3">{t("noValuesEver")}</p>
    </div>
  );
}
