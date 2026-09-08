"use client";

import { useTranslations } from "use-intl";
import { useAuth } from "@/contexts/AuthContext";
import { isAdminUser } from "@/lib/roles";
import { useSetupStatus } from "@/hooks/useSetupStatus";

/**
 * La pastille de la barre latérale : combien de capacités restent à
 * configurer sur ce serveur.
 *
 * Réservée aux administrateurs — eux seuls peuvent y remédier, et un compteur
 * rouge chez un utilisateur qui ne peut rien faire n'est qu'une inquiétude.
 * Rien à afficher quand tout est configuré : une pastille « 0 » est du bruit.
 */
export default function SetupBadge({ collapsed = false }) {
  const t = useTranslations("Setup");
  const { user } = useAuth();
  const { status } = useSetupStatus();

  const count = status?.missing_count ?? 0;
  if (!isAdminUser(user) || count === 0) return null;

  const label = t("badge", { count });
  return (
    <span
      data-testid="setup-badge"
      title={label}
      aria-label={label}
      className={`shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-amber-500/90 text-white text-[11px] font-bold flex items-center justify-center ${
        collapsed ? "absolute top-1 right-1" : "ml-auto"
      }`}
    >
      {count}
    </span>
  );
}
