"use client";

import { installExtensions } from "./index";
import { getSlot } from "./registry";

// Installation au chargement du module plutôt que dans le layout : `Slot` est
// le seul consommateur du registre, donc l'appeler ici garantit que les briques
// sont enregistrées avant le premier rendu — côté serveur comme côté client,
// qui ont chacun leur propre instance du bundle. `installExtensions` est
// idempotent, l'appel répété ne coûte rien.
installExtensions();

/**
 * Rend le composant enregistré pour `name`, ou rien du tout.
 *
 * Toutes les props supplémentaires sont passées telles quelles au composant de
 * la brique. Le noyau n'a donc pas besoin de connaître sa signature — il décrit
 * un contrat (« ici, un pied de barre latérale, tu reçois `collapsed` ») et pas
 * une implémentation.
 *
 * Rendre `null` quand rien n'est enregistré est le comportement normal, pas une
 * erreur : c'est ce qui rend le noyau publiable seul.
 */
export default function Slot({ name, children = null, ...props }) {
  const Composant = getSlot(name);
  if (!Composant) return children;
  return <Composant {...props} />;
}
