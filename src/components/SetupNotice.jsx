"use client";

import { useTranslations } from "use-intl";
import { AlertTriangle, ExternalLink, Info, Settings2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { isAdminUser } from "@/lib/roles";
import { useSetupStatus } from "@/hooks/useSetupStatus";
import { missingCapabilities } from "@/lib/setup";
import EmptyState from "@/components/EmptyState";

/**
 * « Pas encore configuré » — le seul visage que doit avoir une fonctionnalité
 * absente de cette installation.
 *
 * Deux lectures d'une même vérité (`GET /api/config/setup`) :
 * - un utilisateur lit « pas encore configuré, contactez votre administrateur » ;
 * - un administrateur lit en plus les NOMS des variables à poser et le lien
 *   de documentation. Le cœur ne sert `missing` qu'aux administrateurs : cet
 *   écran ne fait que l'afficher, il ne le devine pas.
 */

/** Le nom lisible d'une capacité, avec repli sur sa clé technique. */
function labelFor(t, key) {
  const label = t(`capability.${key}`);
  return label === `capability.${key}` ? key : label;
}

/** Bandeau : l'écran fonctionne, une partie seulement est indisponible. */
export function SetupNotice({ capabilities: keys, tone = "warning", className = "" }) {
  const t = useTranslations("Setup");
  const { user } = useAuth();
  const { status } = useSetupStatus();
  const missing = missingCapabilities(status, keys);

  if (missing.length === 0) return null;

  const admin = isAdminUser(user);
  const Icon = tone === "info" ? Info : AlertTriangle;
  const toneClass =
    tone === "info"
      ? "th-bg-surface th-border"
      : "border-amber-500/40 bg-amber-500/10";

  return (
    <div
      data-testid="setup-notice"
      data-capabilities={missing.map((item) => item.key).join(",")}
      className={`flex gap-3 px-4 py-3 rounded-xl border text-sm ${toneClass} ${className}`}
    >
      <Icon size={18} className="shrink-0 mt-0.5 th-text-secondary" />
      <div className="min-w-0">
        <p className="th-text font-medium">
          {t("noticeTitle", {
            features: missing.map((item) => labelFor(t, item.key)).join(", "),
          })}
        </p>
        <p className="th-text-muted mt-0.5">
          {admin ? t("noticeAdmin") : t("noticeUser")}
        </p>
        {admin && (
          <ul className="mt-2 space-y-1">
            {missing.map((item) => (
              <li key={item.key} className="flex flex-wrap items-center gap-2">
                <span className="th-text-secondary">{labelFor(t, item.key)}</span>
                {item.missing?.length > 0 && (
                  <code className="px-1.5 py-0.5 rounded th-bg-input th-text-secondary text-xs">
                    {item.missing.join(" · ")}
                  </code>
                )}
                {item.docs_url && (
                  <a
                    href={item.docs_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs th-text-secondary hover:th-text underline"
                  >
                    {t("docs")}
                    <ExternalLink size={12} />
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Garde d'écran : quand la capacité manque, il n'y a rien à afficher du tout
 * (l'orchestrateur sans th2etl ne peut lister aucune tâche). L'écran est
 * remplacé, pas décoré — et sans jamais laisser passer un 503 brut.
 */
export function RequiresSetup({ capability: key, children }) {
  const t = useTranslations("Setup");
  const { user } = useAuth();
  const { status, loading } = useSetupStatus();
  const missing = missingCapabilities(status, [key]);

  // Tant que la réponse n'est pas là, l'écran reste tel qu'il était : une
  // checklist lente ne doit pas faire clignoter un écran qui marche.
  if (loading || missing.length === 0) return children;

  const item = missing[0];
  const admin = isAdminUser(user);

  return (
    <div className="p-6" data-testid="requires-setup" data-capability={key}>
      <EmptyState
        icon={Settings2}
        title={t("blockedTitle", { feature: labelFor(t, key) })}
        description={admin ? t("blockedAdmin") : t("noticeUser")}
      />
      {admin && (
        <div className="max-w-md mx-auto text-center text-sm">
          {item.missing?.length > 0 && (
            <code className="inline-block px-2 py-1 rounded th-bg-input th-text-secondary text-xs">
              {item.missing.join(" · ")}
            </code>
          )}
          {item.docs_url && (
            <a
              href={item.docs_url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1 th-text-secondary hover:th-text underline"
            >
              {t("docs")}
              <ExternalLink size={13} />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default SetupNotice;

/**
 * Le mode de stockage des fichiers, là où on en dépose : sans S3, les imports
 * vivent dans un dossier du conteneur et partent avec lui. Rien n'est cassé,
 * mais le dire évite la découverte après coup.
 *
 * Farid, 08/09/2026 : « local directory par défaut, avec possibilité de
 * configurer S3 » — c'est un choix assumé, donc une information, pas une
 * alerte.
 */
export function StorageModeNotice({ className = "" }) {
  const t = useTranslations("Setup");
  const { user } = useAuth();
  const { status } = useSetupStatus();
  const storage = (status?.items ?? []).find((item) => item.key === "object_storage");

  if (!storage || storage.mode !== "local") return null;

  return (
    <div
      data-testid="storage-mode-notice"
      className={`flex gap-3 px-4 py-3 rounded-xl border th-border th-bg-surface text-sm ${className}`}
    >
      <Info size={18} className="shrink-0 mt-0.5 th-text-faint" />
      <div className="min-w-0">
        <p className="th-text">{t("storageLocal")}</p>
        {isAdminUser(user) && storage.docs_url && (
          <a
            href={storage.docs_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 mt-1 text-xs th-text-secondary hover:th-text underline"
          >
            {t("storageConfigureS3")}
            <ExternalLink size={12} />
          </a>
        )}
      </div>
    </div>
  );
}
