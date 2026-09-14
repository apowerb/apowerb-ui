/**
 * Écrans CACHÉS de la navigation, sans être retirés.
 *
 * apowerb/roadmap#2, réunion du 11/09/2026 — « on cache Marketplace. Pour
 * l'instant, on ne le retire pas. Ça ne veut pas dire qu'on supprime. »
 *
 * Seules les portes d'entrée disparaissent : barre latérale, palette de
 * commandes, encart de l'accueil. La route reste servie, donc un lien direct
 * ou un modèle partagé l'ouvre toujours. Réafficher un écran : retirer son
 * chemin de cette liste.
 */
export const HIDDEN_NAV_PATHS = Object.freeze(["/marketplace"]);

export function isNavVisible(path) {
  return !HIDDEN_NAV_PATHS.includes(path);
}
