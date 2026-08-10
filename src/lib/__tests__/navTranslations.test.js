/**
 * Les libellés de navigation doivent être réellement traduits.
 *
 * « Webhooks » et « BI & Reporting » sont restés en anglais dans l'UI
 * française jusqu'au 28/07/26 — invisibles pour qui relit le code, mais
 * évidents pour l'utilisateur. Ce test attrape toute NOUVELLE entrée de
 * menu ajoutée sans traduction.
 */
import { describe, it, expect } from "vitest";

import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";

// Libellés légitimement identiques dans les deux langues : nom du produit
// et mots qui s'écrivent pareil en français.
const IDENTICAL_ON_PURPOSE = new Set([
  "studioTitle", // « apowerb » — the product name
  "groupAdmin", // « Admin » est français
  "supervision", // idem
  // « AgentOps » nomme une discipline, comme « DevOps » : le traduire
  // ferait perdre le terme que Farid a demandé (10/08/26).
  "groupAgentOps",
]);

describe("libellés de navigation", () => {
  it("couvre exactement les mêmes clés en EN et FR", () => {
    expect(Object.keys(fr.Nav).sort()).toEqual(Object.keys(en.Nav).sort());
  });

  it("ne laisse aucun libellé en anglais dans la version française", () => {
    const untranslated = Object.keys(en.Nav).filter(
      (k) => !IDENTICAL_ON_PURPOSE.has(k) && en.Nav[k] === fr.Nav[k]
    );
    expect(untranslated).toEqual([]);
  });

  it("traduit les deux entrées qui étaient restées en anglais", () => {
    expect(fr.Nav.webhooks).toBe("Déclencheurs web");
    expect(fr.Nav.bi).toBe("BI & Rapports");
  });

  it("garde des libellés assez courts pour la barre latérale", () => {
    // Au-delà, le libellé est tronqué et devient illisible une fois replié
    // puis déplié — le remède serait pire que le mal.
    for (const [key, label] of Object.entries(fr.Nav)) {
      if (key.startsWith("open") || key === "studioTitle") continue;
      expect(label.length, `Nav.${key} = ${label}`).toBeLessThanOrEqual(24);
    }
  });
});
