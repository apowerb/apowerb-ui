import { test, expect } from "@playwright/test";
import { signIn, shot, assertNoErrorScreen } from "./session.js";

/**
 * Le canevas et ses onglets. Reprend `tests/e2e/diagram.spec.js` — 176 lignes,
 * dix tests, **une** assertion réelle, sept `test.skip()` et dix
 * `waitForTimeout`. Quatre de ses tests se réduisaient à
 * `expect(count).toBeGreaterThanOrEqual(0)`, et un à
 * `expect(typeof panelVisible).toBe("boolean")`, qui est vrai de tout.
 *
 * Ce qui est repris ici est ce qu'on peut affirmer : le canevas est rendu, ses
 * contrôles sont là, un double-clic ouvre un onglet nommé, deux double-clics
 * en ouvrent deux, on passe de l'un à l'autre.
 *
 * Ce qui ne l'est pas — glisser-déposer vers le canevas, les arêtes, le
 * panneau au clic sur un nœud — est écarté et la raison est écrite dans le
 * fichier d'état du chantier, pas laissée à un `skip` muet.
 */

const CARD = ".w-80 .rounded-2xl.border";

// ⚠️ La barre d'onglets ne porte AUCUN rôle ARIA : ni `tablist`, ni `tab`, et
// aucun attribut stable. `getByRole("tab")` n'y trouve rien — un lecteur
// d'écran non plus, et c'est noté comme constat dans le fichier d'état.
//
// Plutôt que de viser une pile de classes utilitaires, qu'un changement de
// style casserait sans que rien ne soit cassé, on compte les occurrences
// EXACTES du nom : la carte en porte une, l'onglet en ajoute une seconde.
const named = (page, name) => page.getByText(name, { exact: true });

test.describe("canevas et onglets, contre le backend simulé", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, "/agents");
    await expect(page.locator(CARD)).toHaveCount(5);
    await expect(page.locator(".react-flow")).toBeVisible();
  });

  test("le canevas et ses contrôles sont rendus", async ({ page }) => {
    await expect(page.locator(".react-flow__controls, .react-flow__minimap")).not.toHaveCount(0);
    await assertNoErrorScreen(page, "au chargement du canevas");
    await shot(page, "36-canvas");
  });

  test("un double-clic sur un agent ouvre un onglet à son nom", async ({ page }) => {
    await expect(named(page, "Analyste")).toHaveCount(1); // la carte, seule
    await page.locator(CARD).filter({ hasText: "Analyste" }).dblclick();
    // Une occurrence de plus : l'onglet. L'ancienne version comptait des
    // éléments ressemblant à des onglets et se contentait d'au moins un, ce
    // que la barre par défaut satisfaisait déjà.
    await expect(named(page, "Analyste")).toHaveCount(2);
    await assertNoErrorScreen(page, "après le double-clic");
  });

  test("deux agents ouvrent deux onglets distincts, et on passe de l'un à l'autre", async ({ page }) => {
    await page.locator(CARD).filter({ hasText: "Analyste" }).dblclick();
    await page.locator(CARD).filter({ hasText: "Rédacteur" }).dblclick();
    await expect(named(page, "Analyste")).toHaveCount(2);
    await expect(named(page, "Rédacteur")).toHaveCount(2);

    // Revenir sur le premier onglet : c'est la seconde occurrence du nom,
    // celle qui n'est pas la carte du bandeau.
    await named(page, "Analyste").last().click();
    await expect(named(page, "Analyste")).toHaveCount(2);
    await assertNoErrorScreen(page, "après le changement d'onglet");
  });

  test("le bouton d'enregistrement du canevas est là", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /^(Save|Create)$/ }).first()
    ).toBeVisible();
  });
});
