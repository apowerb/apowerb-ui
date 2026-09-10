/**
 * Ce qui est masqué avant qu'une capture d'écran quitte le navigateur.
 *
 * La capture part avec tout ce que l'utilisateur avait sous les yeux. Le
 * masquage a lieu dans le DOM *cloné* que html2canvas fabrique : masquer
 * la vraie page ferait clignoter l'interface, et une capture qui échoue
 * au milieu laisserait l'écran de l'utilisateur masqué.
 */

import { describe, expect, it } from "vitest";
import { BUG_REPORT_MASK_ATTRIBUTE, maskSensitiveNodes } from "@/lib/bugScreenshot";

function fragment(html) {
  const root = document.createElement("div");
  root.innerHTML = html;
  return root;
}

describe("masquage de la capture", () => {
  it("masque les champs de mot de passe sans qu'on ait à les annoter", () => {
    const root = fragment('<input type="password" value="secret-de-lutilisateur" />');
    expect(maskSensitiveNodes(root)).toBe(1);

    const champ = root.querySelector("input");
    expect(champ.style.filter).toContain("blur");
    expect(champ.getAttribute("value")).not.toContain("secret-de-lutilisateur");
  });

  it("masque ce qui porte l'attribut prévu pour ça", () => {
    const root = fragment(`<div ${BUG_REPORT_MASK_ATTRIBUTE}>chiffre d'affaires</div>`);
    expect(maskSensitiveNodes(root)).toBe(1);
    expect(root.querySelector("div").style.filter).toContain("blur");
  });

  it("laisse le reste net — c'est le défaut qu'on veut voir", () => {
    const root = fragment('<button id="run">Exécuter</button>');
    maskSensitiveNodes(root);
    expect(root.querySelector("#run").style.filter).toBe("");
  });

  it("floute plutôt que de remplacer le texte : la mise en page reste exacte", () => {
    // Un remplacement par des puces changerait la largeur du champ, donc
    // la mise en page — et pourrait faire disparaître le défaut d'affichage
    // que la capture devait montrer.
    const root = fragment('<div data-sensitive>Client ACME</div>');
    maskSensitiveNodes(root);
    const noeud = root.querySelector("div");
    expect(noeud.textContent).toBe("Client ACME");
    expect(noeud.style.filter).toContain("blur");
  });

  it("ne lève pas sur une racine absente", () => {
    expect(maskSensitiveNodes(null)).toBe(0);
  });
});
