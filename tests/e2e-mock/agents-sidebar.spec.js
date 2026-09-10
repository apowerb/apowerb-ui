import { test, expect } from "@playwright/test";
import { signIn, shot, assertNoErrorScreen } from "./session.js";

/**
 * Le bandeau des agents. Reprend `tests/e2e/sidebar.spec.js`, dont les huit
 * tests reposaient sur `expect(count).toBeGreaterThanOrEqual(0)` et trois
 * `test.skip()` : sur une base vide ils passaient tous sans rien exercer.
 *
 * Ici la liste est connue — cinq agents servis par le simulateur, dont un
 * `sequential` et un incomplet — donc chaque nombre est une assertion et non
 * une tolérance.
 */

const CARD = ".w-80 .rounded-2xl.border";
const SEARCH = '.w-80 input[placeholder="Search agents..."]';

test.describe("bandeau des agents, contre le backend simulé", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, "/agents");
    await expect(page.locator(CARD)).toHaveCount(5);
    await assertNoErrorScreen(page, "au chargement de l'écran des agents");
  });

  test("la liste rend une carte par agent, nommée", async ({ page }) => {
    for (const name of ["Analyste", "Rédacteur", "Support Outillé", "Chaîne Qualité", "Brouillon"]) {
      await expect(page.locator(CARD).filter({ hasText: name })).toHaveCount(1);
    }
    await shot(page, "30-agents-sidebar");
  });

  test("la recherche filtre par nom", async ({ page }) => {
    await page.locator(SEARCH).fill("Rédacteur");
    // Une seule carte, et c'est la bonne : « il en reste au moins une » se
    // serait contenté de n'avoir rien filtré du tout.
    await expect(page.locator(CARD)).toHaveCount(1);
    await expect(page.locator(CARD)).toContainText("Rédacteur");
  });

  test("la recherche filtre aussi par catégorie", async ({ page }) => {
    await page.locator(SEARCH).fill("sequential");
    await expect(page.locator(CARD)).toHaveCount(1);
    await expect(page.locator(CARD)).toContainText("Chaîne Qualité");
  });

  test("une recherche sans résultat ne laisse rien, et l'effacer rend tout", async ({ page }) => {
    await page.locator(SEARCH).fill("zzzznonexistent");
    await expect(page.locator(CARD)).toHaveCount(0);
    await page.locator(SEARCH).fill("");
    await expect(page.locator(CARD)).toHaveCount(5);
  });

  test("chaque carte porte le badge de sa catégorie", async ({ page }) => {
    const badges = page.locator(CARD).locator("span.uppercase.tracking-wider").first();
    await expect(badges).toBeVisible();
    const texts = await page
      .locator(CARD)
      .evaluateAll((cards) =>
        cards.map((c) => c.querySelector("span.uppercase.tracking-wider")?.textContent?.trim().toLowerCase())
      );
    expect(texts).toEqual(["base", "base", "base", "sequential", "base"]);
  });

  test("les actions d'une carte sont là, au survol", async ({ page }) => {
    const first = page.locator(CARD).first();
    await first.hover();
    for (const title of ["Chat with this agent", "View Details", "Edit", "Delete"]) {
      await expect(first.locator(`button[title="${title}"]`)).toBeAttached();
    }
  });

  // Un huitième test existait ici, sur le badge d'alerte des agents
  // incomplets. Il n'est PAS repris, et la raison est écrite dans le fichier
  // d'état : mesuré, `.cursor-help` comme `.animate-pulse` sont présents sur
  // les CINQ cartes — y compris avec des agents complets (modèle, instruction,
  // propriétaire et clé effectivement servis). Rien ne distingue ce badge de
  // l'extérieur sans dépendre d'une pile de classes utilitaires, et un test
  // qui ne discrimine pas est exactement ce que ce chantier retire.

  test("NEW ouvre le choix du point de départ", async ({ page }) => {
    await page.locator('.w-80 button:has-text("NEW")').first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Choose a starting point")).toBeVisible();
    await expect(dialog.getByText("From Scratch")).toBeVisible();
    await assertNoErrorScreen(page, "à l'ouverture du modal de création");
  });
});
