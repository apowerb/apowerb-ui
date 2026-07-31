/**
 * Masque de clé API.
 *
 * Le backend ne renvoie plus la valeur en clair d'une clé enregistrée : il
 * renvoie ce sentinelle. Le front l'affiche comme « une clé est enregistrée »
 * et le renvoie tel quel au PUT — le backend recolle alors la vraie valeur.
 *
 * Conséquence à respecter côté UI : ne jamais rendre ce sentinelle visible
 * dans un champ texte (le bouton œil doit être neutralisé), et ne jamais le
 * traiter comme une clé utilisable.
 */
export const MASKED_API_KEY = "__unchanged__";

/** true si la valeur est le masque renvoyé par l'API (clé enregistrée, non révélée). */
export function isMaskedApiKey(value) {
  return value === MASKED_API_KEY;
}

/** Valeur à afficher dans un champ : le masque ne doit jamais être lisible. */
export function displayableApiKey(value) {
  return isMaskedApiKey(value) ? "" : value || "";
}
