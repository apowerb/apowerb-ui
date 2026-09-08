"use client";

import { useCallback, useEffect, useState } from "react";
import { getSetupStatus } from "@/lib/api";

/**
 * L'état de configuration du serveur, partagé par tous les écrans.
 *
 * Un seul appel réseau pour tous les consommateurs montés : le badge de la
 * barre latérale, l'onglet Configuration et les bandeaux des écrans posent la
 * même question. Sans ce cache, ouvrir une page en déclenchait trois.
 *
 * En cas d'échec (réseau, 401 pendant une reconnexion), `status` reste `null`
 * et les helpers de `@/lib/setup` répondent « configuré » : un écran qui
 * marchait ne doit pas se verrouiller parce que la checklist n'a pas répondu.
 */

let cache = null;
let inflight = null;
const listeners = new Set();

function publish(value) {
  cache = value;
  for (const listener of listeners) listener(value);
}

function load(force = false) {
  if (!force && cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = getSetupStatus()
      .then((data) => {
        publish(data);
        return data;
      })
      .catch(() => {
        publish(null);
        return null;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Repose la question au prochain montage — après avoir posé une variable. */
export function invalidateSetupStatus() {
  cache = null;
  return load(true);
}

export function useSetupStatus() {
  const [status, setStatus] = useState(cache);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    let alive = true;
    const listener = (value) => alive && setStatus(value);
    listeners.add(listener);
    load().then(() => {
      if (alive) setLoading(false);
    });
    return () => {
      alive = false;
      listeners.delete(listener);
    };
  }, []);

  const refresh = useCallback(() => {
    setLoading(true);
    return invalidateSetupStatus().finally(() => setLoading(false));
  }, []);

  return { status, loading, refresh };
}
