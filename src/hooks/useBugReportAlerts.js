"use client";

/**
 * Combien de signalements attendent, et combien sont bloquants.
 *
 * Deux compteurs et pas un seul, parce qu'ils n'appellent pas la même
 * réaction : « sept signalements » se regarde quand on a le temps, « un
 * bloquant » se regarde maintenant. Une pastille qui les additionnerait
 * ne dirait ni l'un ni l'autre.
 *
 * Aucun endpoint dédié : l'API sait déjà filtrer par statut et par
 * sévérité, et `limit=1` suffit — c'est `total` qu'on lit, pas les lignes.
 * Ajouter une route au serveur pour ça aurait coûté une release, un bump
 * de version et un déploiement, pour une valeur que deux requêtes de
 * quelques octets donnent déjà.
 */

import { useCallback, useEffect, useState } from "react";

import { listBugReports } from "@/lib/api";

// Une minute : assez pour qu'un bloquant remonte vite, assez peu pour ne
// pas marteler l'API depuis chaque onglet ouvert de chaque administrateur.
const INTERVALLE_MS = 60_000;

export function useBugReportAlerts({ enabled = true } = {}) {
  const [counts, setCounts] = useState({ news: 0, blockers: 0 });

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const [news, blockers] = await Promise.all([
        listBugReports({ status: "new", limit: 1 }),
        listBugReports({ status: "new", severity: "blocker", limit: 1 }),
      ]);
      setCounts({
        news: news?.total || 0,
        blockers: blockers?.total || 0,
      });
    } catch {
      // Un compteur indisponible n'a rien d'une urgence : on garde la
      // dernière valeur connue plutôt que d'afficher un zéro rassurant
      // et faux, ou une erreur dans une barre d'onglets.
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    refresh(); // eslint-disable-line react-hooks/set-state-in-effect -- chargement asynchrone, setState dans les callbacks
    const timer = setInterval(refresh, INTERVALLE_MS);
    return () => clearInterval(timer);
  }, [enabled, refresh]);

  return { ...counts, refresh };
}

export default useBugReportAlerts;
