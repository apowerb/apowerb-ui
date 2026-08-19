/**
 * L'open source ne nomme que ce qu'il contient.
 *
 * Le menu applique cette règle depuis 0.1.8 via le registre. Mais un écran
 * commercial peut être promis ailleurs qu'au menu : le bouton « Tout voir »
 * du tableau de bord emmenait sur `/supervision`, parti en brique le
 * 18/08/2026. Même 404 que l'entrée `/usage` d'avant 0.1.8 — mais celui-là
 * ne se voyait pas dans la barre latérale.
 *
 * Le test relit le code source, seul endroit où un lien mort se glisse, et
 * il vérifie d'abord que la liste qu'il garde correspond encore au dépôt :
 * le jour où l'un de ces écrans arrive vraiment ici, c'est la liste qui est
 * périmée, et le test doit le dire plutôt que de garder le vide.
 *
 * 19/08/2026 — un lien mort n'est pas la seule façon de promettre ce qu'on n'a
 * pas. Trois écrans APPELAIENT une brique commerciale sans jamais lier vers
 * elle : la tuile Credits du tableau de bord, la page `/billing` et le modal
 * d'onboarding de prospection. Le second bloc ci-dessous garde les appels.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join } from "path";

const SRC = join(process.cwd(), "src");
const PAGES = join(SRC, "app", "(dashboard)");

// Livrés par une brique commerciale, et par elle seule.
//
// `/billing` a rejoint la liste le 19/08/2026 : sa page vivait ici alors que
// `/api/billing/*` n'est servi par aucune route du noyau. L'écran rendait 200
// et ses appels 404 — un écran de paiement qui s'affiche et ne peut rien
// faire. Un absent volontaire demeure, `/admin` : le panneau de contrôle est
// passé en open source le 18/08/2026 — la liste a été mise à jour parce que
// ce test a échoué en disant que la page existait, pas l'inverse.
const SCREENS_THAT_ARE_SOLD = ["/supervision", "/usage", "/billing"];

// Préfixes d'URL servis par une brique commerciale, et par elle seule.
//
// On garde les PRÉFIXES plutôt que les noms de fonctions : une liste de noms
// serait périmée au premier ajout au SDK, alors qu'un préfixe est une décision
// de découpage, rare et explicite. Les symboles concernés se déduisent en
// lisant le client.
//
// Relevé le 19/08/2026 dans les briques elles-mêmes (`registry.register_router`
// + le `prefix` de chaque `APIRouter`) : billing, prospection, campaigns,
// usage, evaluations, supervision.
//
// `/api/admin` n'y est pas : le panneau de contrôle est du noyau, MFA et
// organisations compris — vérifié route par route, pas supposé.
const COMMERCIAL_API_PREFIXES = [
  "/api/billing",
  "/api/prospection",
  "/api/campaigns",
  "/api/usage",
  "/api/evaluations",
  "/api/supervision",
];

// Ceux d'entre eux que le client open source décrit aujourd'hui.
//
// La liste est plus courte que la précédente, et c'est normal : une brique
// peut être commerciale sans que ce dépôt en connaisse la moindre route —
// `/api/evaluations` n'apparaît nulle part dans le SDK. Figer l'état permet
// au test de se dénoncer DANS LES DEUX SENS : une brique qui entre dans le
// client (à vérifier : est-ce voulu ?) comme une brique qui en sort (le
// garde ne protège plus de rien, il faut le dire).
const PREFIXES_DESCRIBED_BY_SDK = [
  "/api/billing",
  "/api/prospection",
  "/api/campaigns",
  "/api/usage",
  "/api/supervision",
];

const SDK = join(process.cwd(), "packages", "apowerb-sdk", "src", "api.js");

/** `export const nom = … "/api/…"` → les symboles qui tapent une brique. */
function commercialSymbols() {
  const sdk = readFileSync(SDK, "utf8");
  const found = [];
  for (const m of sdk.matchAll(/export const (\w+) = [^;]*?["'`](\/api\/[^"'`?\s]*)/g)) {
    const [, nom, route] = m;
    if (COMMERCIAL_API_PREFIXES.some((p) => route.startsWith(p))) {
      found.push({ nom, route });
    }
  }
  return found;
}

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      // Les tests citent ces chemins pour de bonnes raisons — celui-ci le
      // premier, et navRegistry en fait son exemple d'entrée de brique.
      return entry === "__tests__" ? [] : sourceFiles(full);
    }
    return /\.(js|jsx)$/.test(entry) ? [full] : [];
  });
}

describe("aucun écran commercial promis par l'open source", () => {
  const files = sourceFiles(SRC);

  it("lit un nombre plausible de fichiers source", () => {
    // Sans ce contrôle, un scan qui ne lirait RIEN passerait vert.
    expect(files.length).toBeGreaterThan(50);
  });

  it.each(SCREENS_THAT_ARE_SOLD)("%s n'a effectivement pas de page ici", (route) => {
    expect(existsSync(join(PAGES, route.slice(1)))).toBe(false);
  });

  it.each(SCREENS_THAT_ARE_SOLD)("aucune source n'envoie vers %s", (route) => {
    const guilty = files
      .filter((f) => readFileSync(f, "utf8").includes(`"${route}"`))
      .map((f) => f.replace(`${process.cwd()}/`, ""));
    expect(guilty).toEqual([]);
  });
});

describe("aucun écran open source n'appelle une brique commerciale", () => {
  const files = sourceFiles(SRC);
  const symbols = commercialSymbols();

  it("trouve les symboles commerciaux dans le SDK", () => {
    // Sans ce contrôle, une regex qui ne capture RIEN passerait vert : le test
    // vérifierait alors l'absence d'une liste vide, ce qui est toujours vrai.
    expect(symbols.length).toBeGreaterThan(5);
  });

  it("décrit exactement les briques attendues, sinon cette liste est périmée", () => {
    // Le jour où une brique est reversée à l'open source, ou au contraire
    // décrite ici alors qu'elle ne l'était pas, c'est CETTE ligne qui doit le
    // dire — pas un garde muet qui continue de protéger contre rien.
    const described = COMMERCIAL_API_PREFIXES.filter((p) =>
      symbols.some((s) => s.route.startsWith(p)),
    );
    expect(described).toEqual(PREFIXES_DESCRIBED_BY_SDK);
  });

  it.each(symbols)("aucune source n'appelle $nom", ({ nom }) => {
    const guilty = files
      .filter((f) => new RegExp(`\\b${nom}\\b`).test(readFileSync(f, "utf8")))
      .map((f) => f.replace(`${process.cwd()}/`, ""));
    expect(guilty).toEqual([]);
  });
});
