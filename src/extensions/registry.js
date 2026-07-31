/**
 * Registre d'extensions du front — l'équivalent de
 * `th2agent/core/extensions/registry.py` côté back.
 *
 * Le noyau déclare des *emplacements* (`Slot`) et n'importe jamais ce qui
 * viendra les remplir. Une brique commerciale s'y enregistre au démarrage. Sans
 * brique, l'emplacement rend `null` et l'interface est complète — ce n'est pas
 * un mode dégradé, c'est le produit open source.
 *
 * Pourquoi un registre plutôt qu'un drapeau : `AuthScreen` cachait déjà ses
 * boutons de connexion via `NEXT_PUBLIC_OAUTH_EXCLUDE_PROVIDERS`. Le code
 * restait présent dans le bundle publié. Un drapeau masque, il ne retire pas.
 */

const emplacements = new Map();

/**
 * Enregistre un composant pour un emplacement nommé.
 * Le dernier enregistré gagne — une brique ne doit pas dépendre de l'ordre.
 */
export function registerSlot(nom, composant) {
  if (typeof nom !== "string" || !nom) {
    throw new Error("registerSlot: nom d'emplacement invalide");
  }
  emplacements.set(nom, composant);
}

/** Retourne le composant enregistré pour `nom`, ou `null` s'il n'y en a pas. */
export function getSlot(nom) {
  return emplacements.get(nom) ?? null;
}

/** Liste les emplacements pourvus — sert aux tests et au diagnostic. */
export function filledSlots() {
  return [...emplacements.keys()].sort();
}

/** Vide le registre. Réservé aux tests : le registre est global au bundle. */
export function resetRegistry() {
  emplacements.clear();
  detecteurDeDefi = null;
}

// ---------------------------------------------------------------------------
// Défi d'authentification
// ---------------------------------------------------------------------------
// Pendant exact de `register_second_factor` côté back. Le noyau authentifie
// (mot de passe ou fournisseur), puis demande au registre s'il reste une étape.
//
// Sans brique, aucun détecteur : la réponse d'authentification est acceptée
// telle quelle et l'utilisateur est connecté. C'est le comportement complet du
// noyau open source, pas un mode dégradé.
//
// Le noyau ignore volontairement ce qu'est un « second facteur » : il manipule
// un *défi* opaque, que seule la brique sait lire et résoudre.

let detecteurDeDefi = null;

/**
 * @param fn `(reponseAuth) => defi | null` — inspecte la réponse du backend et
 * renvoie un défi opaque, ou `null` pour laisser passer.
 */
export function registerAuthChallenge(fn) {
  detecteurDeDefi = fn;
}

/** Retourne le détecteur enregistré, ou `null`. */
export function getAuthChallenge() {
  return detecteurDeDefi;
}

// ---------------------------------------------------------------------------
// Observateurs de fin d'exécution
// ---------------------------------------------------------------------------
// Le noyau signale qu'un run d'agent vient de se terminer. Il ne dit pas ce
// qu'il faut en faire : la brique d'usage s'en sert pour rafraîchir la jauge de
// crédit, une autre pourrait journaliser. Sans brique, personne n'écoute et
// l'appel ne coûte rien.
//
// Avant, `useStreaming` importait `notifyQuotaMayHaveChanged` du magasin de
// quota — du code de streaming qui nommait une fonctionnalité vendue.

const observateursDeRun = [];

export function registerRunObserver(fn) {
  observateursDeRun.push(fn);
}

export function notifyRunFinished() {
  for (const observateur of observateursDeRun) {
    try {
      observateur();
    } catch {
      // Un observateur qui échoue ne doit jamais casser une conversation.
    }
  }
}

/** Réservé aux tests. */
export function resetRunObservers() {
  observateursDeRun.length = 0;
}
