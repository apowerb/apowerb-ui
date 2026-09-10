import { test, expect } from "@playwright/test";
import { signIn, shot, assertNoErrorScreen } from "./session.js";

/**
 * Parcourir le marché. Reprend `tests/e2e/marketplace.spec.js`, dont les cinq
 * tests étaient soit `expect(count).toBeGreaterThanOrEqual(0)` — vrai de tout,
 * y compris d'un marché vide et d'un écran mort — soit `test.skip()` dès que
 * le marché ne rendait rien, c'est-à-dire précisément quand il fallait
 * s'inquiéter.
 *
 * L'ouverture de l'assistant, que trois de ces tests effleuraient, est
 * couverte de bout en bout par `marketplace-clone.spec.js`. Ce fichier-ci s'en
 * tient à ce que le catalogue affiche et à ce que ses filtres font.
 */

const CARD = 'button:has-text("Clone")';

test.describe("catalogue du marché, contre le backend simulé", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, "/marketplace");
    await expect(page.getByRole("heading", { name: "Marketplace" })).toBeVisible();
    await assertNoErrorScreen(page, "au chargement du marché");
  });

  test("chaque agent publié est affiché avec ce qui le décrit", async ({ page }) => {
    // Deux agents servis, deux boutons Clone : le compte est une assertion.
    await expect(page.getByRole("button", { name: /^Clone$/ })).toHaveCount(2);

    // Et le contenu vient bien du serveur, pas d'un gabarit : nom publié,
    // description, étiquettes et compteur de clones.
    await expect(page.getByText("Analyste de ventes")).toBeVisible();
    await expect(page.getByText("Lit un CSV et en tire trois graphiques.")).toBeVisible();
    await expect(page.getByText("#ventes")).toBeVisible();
    await expect(page.getByText("12")).toBeVisible();
    await expect(page.getByText("Rédacteur d'offres")).toBeVisible();
    await shot(page, "34-marketplace");
  });

  test("le filtre par catégorie ne garde que la sienne", async ({ page }) => {
    await page.getByRole("button", { name: "Writing" }).click();
    await expect(page.getByText("Rédacteur d'offres")).toBeVisible();
    await expect(page.getByText("Analyste de ventes")).toHaveCount(0);

    await page.getByRole("button", { name: "Analytics" }).click();
    await expect(page.getByText("Analyste de ventes")).toBeVisible();
    await expect(page.getByText("Rédacteur d'offres")).toHaveCount(0);

    await page.getByRole("button", { name: "All" }).click();
    await expect(page.getByRole("button", { name: /^Clone$/ })).toHaveCount(2);
  });

  test("la recherche filtre le catalogue", async ({ page }) => {
    const search = page.getByPlaceholder(/Search/i).first();
    await search.fill("Rédacteur");
    await expect(page.getByRole("button", { name: /^Clone$/ })).toHaveCount(1);
    await search.fill("");
    await expect(page.getByRole("button", { name: /^Clone$/ })).toHaveCount(2);
  });
});
