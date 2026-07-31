/**
 * Installation des briques — appelée une fois au démarrage de l'application.
 *
 * Idempotent : le module peut être importé par plusieurs entrées (layout,
 * tests, Storybook) sans réenregistrer.
 */

import { bricks } from "./installed";
import * as registry from "./registry";

let installées = false;

export function installExtensions() {
  if (installées) return [];
  installées = true;

  const noms = [];
  for (const brique of bricks) {
    if (typeof brique?.register !== "function") {
      throw new Error(
        `extension sans register(registry) : ${brique?.name ?? "anonyme"}`,
      );
    }
    brique.register(registry);
    noms.push(brique.name ?? "anonyme");
  }
  return noms;
}

/** Réservé aux tests : autorise une réinstallation après `resetRegistry()`. */
export function _resetInstallation() {
  installées = false;
}

export { registry };
