"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "use-intl";
import {
  CheckCircle2,
  CircleAlert,
  CircleDashed,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { Skeleton } from "@/components/Skeleton";
import { useSetupStatus, invalidateSetupStatus } from "@/hooks/useSetupStatus";
import ConfigurationVariables from "@/components/admin/ConfigurationVariables";
import {
  clearConfigVariable,
  listConfigVariables,
  setConfigVariable,
} from "@/lib/api";

/**
 * La configuration du serveur, pour un administrateur.
 *
 * Une ligne par capacité servie par `GET /api/config/setup` : ce qui marche,
 * ce qui manque, les NOMS des variables à poser et le lien de documentation.
 *
 * Depuis que le cœur sait les recevoir, un **superadministrateur** peut aussi
 * les poser ici, sous la ligne qui les nomme — le prolongement de la
 * checklist, pas un second écran. Un administrateur d'organisation garde la
 * checklist seule, à l'identique.
 *
 * L'invariant tient des deux côtés : le cœur ne rend jamais une valeur, et
 * cet écran n'en demande, n'en garde et n'en affiche aucune.
 *
 * Trois états de capacité, pas deux : configuré, manquant, et « optionnel » —
 * le stockage marche sur un dossier local tant que S3 n'est pas configuré, ce
 * n'est pas un défaut à corriger mais un mode à connaître.
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

function Row({ t, item, variables, busy, onSave, onClear }) {
  const state = stateOf(item);
  const { Icon, className } = ROW_ICON[state];
  const description = describe(t, item.key);
  // Les noms sous forme de puces ne servent qu'à celui qui ne peut pas les
  // poser : quand les champs sont là, ils portent déjà les mêmes noms.
  const showNames = item.missing?.length > 0 && variables.length === 0;

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
        {showNames && (
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
        <ConfigurationVariables
          t={t}
          items={variables}
          busy={busy}
          onSave={onSave}
          onClear={onClear}
        />
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

export default function ConfigurationTab({ superadmin = false }) {
  const t = useTranslations("Setup");
  const { status, loading, refresh } = useSetupStatus();

  // Les variables modifiables. `null` tant qu'on ne les a pas — ou pour
  // toujours si cet administrateur n'y a pas droit : l'écran retombe alors
  // exactement sur la checklist d'avant.
  const [config, setConfig] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const loadConfig = useCallback(async () => {
    // On ne demande rien quand on sait que ce sera refusé : un 403 garanti
    // à chaque ouverture de l'onglet est du bruit dans les journaux du
    // serveur, pas une garde.
    if (!superadmin) return;
    try {
      setConfig(await listConfigVariables());
      setError(null);
    } catch (err) {
      // Un rang peut être révoqué pendant que cet onglet reste ouvert : le
      // 403 n'est pas une panne, c'est la réponse juste. On repasse en
      // lecture seule sans crier.
      setConfig(null);
      if (err?.status !== 403) setError(err?.message || String(err));
    }
  }, [superadmin]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  /** Rend `true` quand l'action a réussi — le champ ne se vide qu'alors. */
  const run = useCallback(
    async (action) => {
      setBusy(true);
      setError(null);
      try {
        await action();
        await loadConfig();
        // La checklist du cœur ne bougera qu'au redémarrage pour une valeur
        // posée, mais elle doit suivre un retrait immédiatement.
        await invalidateSetupStatus();
        return true;
      } catch (err) {
        setError(err?.message || String(err));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [loadConfig],
  );

  const save = useCallback(
    (name, value) => run(() => setConfigVariable(name, value)),
    [run],
  );
  const clear = useCallback((name) => run(() => clearConfigVariable(name)), [run]);

  // Une seule passe pour ranger les variables sous leur capacité, plutôt
  // qu'un filtre par ligne.
  const byCapability = useMemo(() => {
    const grouped = {};
    for (const item of config?.items ?? []) {
      (grouped[item.capability] ??= []).push(item);
    }
    return grouped;
  }, [config]);

  if (loading && !status) return <Skeleton className="h-64 w-full rounded-2xl" />;

  const items = status?.items ?? [];
  const missingCount = status?.missing_count ?? 0;
  const pending = config?.pending_restart ?? [];

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
          onClick={() => {
            refresh();
            loadConfig();
          }}
          disabled={loading || busy}
          className="ml-auto shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-xl border th-border th-bg-surface th-text text-xs font-medium hover:th-bg-surface-hover disabled:opacity-50"
        >
          <RefreshCw size={13} />
          {t("refresh")}
        </button>
      </div>

      {/* Le verrou d'amorçage du cœur, annoncé avant qu'on le rencontre :
          tant qu'aucun superadministrateur n'est nommé, tout administrateur
          en serait un, et le cœur refuse d'écrire pour cette raison. */}
      {config && !config.superadmin_named && (
        <p
          className="mb-3 px-4 py-2.5 rounded-xl border border-amber-500/40 text-xs text-amber-300"
          data-testid="config-no-superadmin"
        >
          {t("noSuperadminNamed")}
        </p>
      )}

      {pending.length > 0 && (
        <p
          className="mb-3 px-4 py-2.5 rounded-xl border border-amber-500/40 text-xs text-amber-300"
          data-testid="config-pending-restart"
        >
          {t("restartNeeded", { names: pending.join(", ") })}
        </p>
      )}

      {error && (
        <p className="mb-3 text-xs text-amber-400" role="alert">
          {error}
        </p>
      )}

      {/* Une installation qui ne répond pas est un fait à dire, pas une
          checklist vide qui laisserait croire que tout est en ordre. */}
      {!status ? (
        <p className="px-4 py-3 rounded-xl border th-border th-bg-surface text-sm th-text-muted">
          {t("unavailable")}
        </p>
      ) : (
        <ul className="rounded-xl border th-border th-bg-surface overflow-hidden">
          {items.map((item) => (
            <Row
              key={item.key}
              t={t}
              item={item}
              variables={byCapability[item.key] ?? []}
              busy={busy}
              onSave={save}
              onClear={clear}
            />
          ))}
        </ul>
      )}

      <p className="text-[11px] th-text-ghost mt-3">{t("noValuesEver")}</p>
    </div>
  );
}
