/**
 * Le noyau ne publie pas l'identité de son éditeur.
 *
 * L'écran de connexion a été corrigé le 10/09/2026 : il liait
 * `agent-dev.<éditeur>/legal` en dur, et toute installation renvoyait ses
 * visiteurs vers les conditions d'un tiers. Le même défaut vivait deux étages
 * plus loin, sans que personne le cherche :
 *
 *   * `/legal` servait les mentions légales COMPLÈTES de l'éditeur — raison
 *     sociale, capital, RCS, adresse postale, hébergeur — depuis le domaine de
 *     celui qui installe, et le pied de la page d'accueil y menait en trois
 *     liens ;
 *   * le modal « connecter cet agent » proposait un extrait de code visant
 *     l'instance de développement de l'éditeur : un utilisateur qui copiait
 *     l'exemple appelait l'API de quelqu'un d'autre.
 *
 * Ce que ce test garde n'est pas le mot de la marque — le produit peut se
 * nommer, et le modèle mutualisé porte le nom de l'éditeur dans son
 * identifiant. Ce sont les CONTACTS et les ADRESSES : une URL, un courriel,
 * un numéro d'immatriculation. Eux désignent un opérateur, et l'opérateur
 * d'une installation est celui qui l'installe.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");

// Ce qui désigne un opérateur, par opposition au nom du produit.
const IDENTITY = [
  { nom: "URL du domaine de l'éditeur", motif: /https?:\/\/[a-z0-9.-]*thaink2\.[a-z]+/i },
  { nom: "courriel de l'éditeur", motif: /[a-z0-9._%+-]+@thaink2\.[a-z]+/i },
  { nom: "immatriculation ou capital social", motif: /(RCS|Trade Register|capital of|capital de)\b/i },
  { nom: "siège social", motif: /\b(26,? Avenue Foch|Avenue Foch, 57000)\b/i },
];

// Le scan lit les sources du noyau ET les catalogues de traduction : le texte
// légal ne vivait pas dans le JSX, il vivait dans `messages/`.
function scannedFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      // Les tests citent ces motifs pour les décrire — celui-ci le premier.
      return entry === "__tests__" ? [] : scannedFiles(full);
    }
    return /\.(js|jsx|json)$/.test(entry) ? [full] : [];
  });
}

const files = [...scannedFiles(SRC), ...scannedFiles(join(ROOT, "messages"))];

describe("le noyau ne nomme pas l'opérateur de l'instance", () => {
  it("lit un nombre plausible de fichiers", () => {
    // Sans ce contrôle, un scan qui ne lirait RIEN passerait vert.
    expect(files.length).toBeGreaterThan(50);
  });

  it.each(IDENTITY)("$nom : le détecteur reconnaît un cas positif", ({ motif }) => {
    // Un motif trop étroit ne dit pas « rien » : il dit « rien de ce que j'ai
    // cherché ». On l'éprouve donc sur un échantillon fabriqué.
    const echantillon = [
      "https://agent-dev.thaink2.fr/legal#privacy",
      "contact@thaink2.com",
      "capital of 238,800 EUR, Trade Register 953540242",
      "THAINK2, 26 Avenue Foch, 57000 Metz",
    ].join("\n");
    expect(motif.test(echantillon)).toBe(true);
  });

  it.each(IDENTITY)("aucun fichier du noyau ne porte : $nom", ({ motif }) => {
    const guilty = files
      .filter((f) => motif.test(readFileSync(f, "utf8")))
      .map((f) => f.replace(`${ROOT}/`, ""));
    expect(guilty).toEqual([]);
  });

  it("la page des mentions légales ne fait pas partie du noyau", () => {
    // Elle ne peut pas être « vidée » : un gabarit de conditions générales
    // reste un texte que l'éditeur n'a pas rédigé pour l'installateur.
    expect(existsSync(join(SRC, "app", "(marketing)", "legal"))).toBe(false);
  });

  it("aucune source n'envoie vers /legal", () => {
    const guilty = files
      .filter((f) => /["'`]\/legal(#[a-z]*)?["'`]/.test(readFileSync(f, "utf8")))
      .map((f) => f.replace(`${ROOT}/`, ""));
    expect(guilty).toEqual([]);
  });
});
