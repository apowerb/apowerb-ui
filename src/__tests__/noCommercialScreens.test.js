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
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join } from "path";

const SRC = join(process.cwd(), "src");
const PAGES = join(SRC, "app", "(dashboard)");

// Livrés par une brique commerciale, et par elle seule. `/billing` n'en est
// pas : sa page est dans ce dépôt, donc le noyau a le droit d'y envoyer.
const SCREENS_THAT_ARE_SOLD = ["/supervision", "/usage", "/admin"];

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
