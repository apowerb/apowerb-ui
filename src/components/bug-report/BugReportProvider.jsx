"use client";

/**
 * Le pont : n'importe quel écran du produit peut demander un signalement.
 *
 * Le bouton flottant ne suffit pas. Une brique — évaluations, supervision,
 * une extension cliente — sait des choses que le bouton ignore : *quel*
 * run a échoué, *quelle* pipeline, *quel* agent. Si elle doit renvoyer
 * l'utilisateur vers un bouton générique, ce contexte est perdu et le
 * rapport redevient « ça ne marche pas quelque part ».
 *
 * D'où un contexte React plutôt qu'un composant de plus :
 *
 *     const { report } = useBugReport();
 *     <button onClick={() => report({
 *       area: "evaluations",
 *       whereIWas: "Résultats du run #42",
 *       context: { runId: 42 },
 *     })}>
 *       Signaler ce problème
 *     </button>
 *
 * Le noyau expose le geste ; la brique fournit le contexte. C'est la même
 * logique que le registre de `Slot`, dans l'autre sens : là, le noyau offre
 * un emplacement ; ici, il offre une action.
 *
 * `report()` sans argument se comporte exactement comme le bouton flottant.
 */

import { createContext, useCallback, useContext, useMemo, useState } from "react";

const BugReportContext = createContext(null);

/**
 * Accès au signalement depuis n'importe où sous le fournisseur.
 *
 * Rend un objet inerte hors du fournisseur plutôt que de lever : une brique
 * montée dans un contexte inattendu (un test, un écran public) ne doit pas
 * casser l'application parce qu'elle a proposé de signaler un bug.
 */
export function useBugReport() {
  return (
    useContext(BugReportContext) || {
      report: () => {},
      available: false,
    }
  );
}

export function BugReportProvider({ children, onOpen }) {
  const [pending, setPending] = useState(null);

  const report = useCallback(
    (details = {}) => {
      setPending(details);
      if (onOpen) onOpen(details);
    },
    [onOpen],
  );

  const value = useMemo(
    () => ({ report, pending, clear: () => setPending(null), available: true }),
    [report, pending],
  );

  return (
    <BugReportContext.Provider value={value}>{children}</BugReportContext.Provider>
  );
}

export default BugReportProvider;
