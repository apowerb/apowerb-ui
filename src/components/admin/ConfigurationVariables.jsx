"use client";

import { useState } from "react";
import { Check, Lock, Trash2 } from "lucide-react";

/**
 * Les champs qui posent les variables d'une capacité, sous sa ligne de
 * checklist.
 *
 * Purement présentationnel : la liste, l'état d'occupation et les deux
 * actions viennent de `ConfigurationTab`, qui charge tout en un appel. Un
 * composant qui serait allé chercher ses propres données aurait produit sept
 * requêtes pour sept capacités.
 *
 * Ce qui ne s'affiche JAMAIS : une valeur. Le cœur n'en sert aucune — il n'y
 * a pas de route pour ça — et l'écran n'en garde aucune : le champ est vidé
 * dès que l'enregistrement a réussi. On montre « posé le {date} par {qui} »,
 * d'où vient la variable, et rien d'autre.
 */

/** Trois provenances, trois conduites. `env` est la seule qui interdise
 *  d'écrire — pas par manque de droit, mais parce que la valeur posée serait
 *  inerte : le déploiement gagne, et le dire vaut mieux que l'accepter. */
const SOURCE_ICON = {
  env: { Icon: Lock, className: "th-text-faint" },
  database: { Icon: Check, className: "text-emerald-400" },
  unset: { Icon: null, className: "" },
};

function Variable({ t, item, busy, onSave, onClear }) {
  const [draft, setDraft] = useState("");
  const impose = item.source === "env";
  const pose = item.source === "database";
  const { Icon, className } = SOURCE_ICON[item.source] ?? SOURCE_ICON.unset;

  const save = async () => {
    // Le brouillon n'est vidé qu'après un succès : sur un refus (valeur mal
    // formée, 409), le retaper à l'aveugle serait la pire des invites.
    if (await onSave(item.name, draft)) setDraft("");
  };

  return (
    <div
      className="py-2.5 border-b th-border last:border-b-0"
      data-testid={`config-var-${item.name}`}
      data-source={item.source}
      data-pending={item.pending_restart ? "1" : "0"}
    >
      <div className="flex flex-wrap items-center gap-2">
        <code className="px-1.5 py-0.5 rounded th-bg-input th-text-secondary text-[11px]">
          {item.name}
        </code>
        {Icon && <Icon size={13} className={className} />}
        <span className="text-[11px] th-text-faint">{t(`source.${item.source}`)}</span>
        {item.pending_restart && (
          <span className="text-[11px] text-amber-400">{t("pendingRestart")}</span>
        )}
      </div>

      {pose && item.updated_at && (
        <p className="text-[11px] th-text-ghost mt-0.5">
          {t("setOn", {
            date: new Date(item.updated_at).toLocaleString(),
            who: item.updated_by ?? "?",
          })}
        </p>
      )}

      {impose ? (
        <p className="text-[11px] th-text-muted mt-1">{t("heldByDeployment")}</p>
      ) : (
        <div className="flex flex-wrap gap-2 mt-1.5">
          <input
            // `password` même pour un non-secret : le champ ne réaffiche
            // jamais rien, et une URL tapée à côté d'une clé sur un écran
            // partagé n'a pas davantage à se lire.
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t("placeholder")}
            aria-label={item.name}
            className="flex-1 min-w-[12rem] px-2.5 py-1.5 rounded-lg border th-border th-bg-input th-text text-xs"
          />
          <button
            type="button"
            disabled={busy || !draft.trim()}
            onClick={save}
            className="px-3 py-1.5 rounded-lg btn-brand text-xs font-medium disabled:opacity-40"
          >
            {t("save")}
          </button>
          {pose && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onClear(item.name)}
              title={t("clearHint")}
              aria-label={t("clear")}
              className="px-2.5 py-1.5 rounded-lg border th-border th-text-secondary text-xs disabled:opacity-40"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function ConfigurationVariables({ t, items, busy, onSave, onClear }) {
  if (!items?.length) return null;
  return (
    <div className="mt-2 pl-7">
      {items.map((item) => (
        <Variable
          key={item.name}
          t={t}
          item={item}
          busy={busy}
          onSave={onSave}
          onClear={onClear}
        />
      ))}
    </div>
  );
}
