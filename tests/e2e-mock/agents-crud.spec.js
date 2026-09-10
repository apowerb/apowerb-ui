import { test, expect } from "@playwright/test";
import { signIn, shot, assertNoErrorScreen } from "./session.js";

/**
 * Créer, renommer, supprimer un agent. Reprend `tests/e2e/agent-crud.spec.js`,
 * dont les quatre tests cliquaient « si le bouton est visible », attendaient
 * une seconde et n'assèraient rien ensuite — ils passaient sur un écran
 * entièrement cassé. Le dernier se contentait de
 * `expect(count).toBeGreaterThanOrEqual(0)`, qui est vrai de tout.
 *
 * Ici chaque geste est suivi de son effet : la carte apparaît, le nom change,
 * la carte disparaît. Le journal du simulateur en porte la trace côté serveur.
 */

const CARD = ".w-80 .rounded-2xl.border";

const cardNames = (page) =>
  page.locator(CARD).evaluateAll((cards) =>
    cards.map((c) => c.querySelector(".th-text.text-sm.font-bold")?.textContent?.trim())
  );

async function openCreateForm(page) {
  await page.locator('.w-80 button:has-text("NEW")').first().click();
  await page.getByRole("dialog").getByText("From Scratch").click();
  await expect(page.getByRole("dialog").getByText("Configure your AI agent parameters")).toBeVisible();
}

test.describe("cycle de vie d'un agent, contre le backend simulé", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, "/agents");
    await expect(page.locator(CARD)).toHaveCount(5);
  });

  test("créer un agent l'ajoute à la liste", async ({ page }) => {
    await openCreateForm(page);
    const dialog = page.getByRole("dialog");

    await dialog.getByLabel(/Agent Name/i).or(dialog.locator("input").first()).fill("Agent E2E");
    await dialog.locator("select").first().selectOption({ label: "Base" });
    await dialog.locator('input[placeholder*="provider/model" i], input[placeholder*="mistral/" i]')
      .or(dialog.locator('input[placeholder*="Format" i]')).first().fill("mock/instant");
    await dialog.locator("textarea").first().fill("Un agent créé par le parcours");
    await dialog.locator("textarea").nth(1).fill("Tu es un agent d'essai.");
    await shot(page, "31-create-agent");

    await dialog.getByRole("button", { name: "Create Agent" }).click();

    // L'effet, pas le clic : la liste exacte, dans l'ordre. Un simple
    // comptage ne dirait pas QUI a été ajouté, et une assertion sur la seule
    // présence du nom laisserait passer un doublon.
    await expect
      .poll(() => cardNames(page), { timeout: 10_000 })
      .toEqual(["Analyste", "Rédacteur", "Support Outillé", "Chaîne Qualité", "Brouillon", "Agent E2E"]);
    await assertNoErrorScreen(page, "après la création");
  });

  test("renommer un agent change son nom dans la liste", async ({ page }) => {
    const card = page.locator(CARD).filter({ hasText: "Rédacteur" });
    await card.hover();
    await card.locator('button[title="Edit"]').click();

    // Le champ pré-rempli EST la preuve que l'agent a été relu depuis le
    // serveur : c'est ce chemin qui affichait « Failed to load agent » tant que
    // le simulateur servait des identifiants entiers.
    const nameInput = page.locator('input[value="Rédacteur"]');
    await expect(nameInput).toBeVisible();
    await nameInput.fill("Rédacteur renommé");
    // « Save Changes » en édition, « Create Agent » en création : le libellé
    // dit dans quel mode le modal est, c'est donc une assertion en soi.
    await page.locator('button:text-is("Save Changes")').click();

    await expect(page.locator(CARD).filter({ hasText: "Rédacteur renommé" })).toHaveCount(1);
    await expect(page.locator(CARD)).toHaveCount(5);
    await assertNoErrorScreen(page, "après le renommage");
  });

  test("supprimer un agent le retire de la liste, après confirmation", async ({ page }) => {
    const card = page.locator(CARD).filter({ hasText: "Brouillon" });
    await card.hover();
    await card.locator('button[title="Delete"]').click();

    // La confirmation existe vraiment : l'ancienne version se contentait de
    // compter les boutons portant « Delete » et de vérifier que ce nombre
    // était positif ou nul.
    // Le libellé exact, porté par la boîte de confirmation : chercher un
    // bouton « Delete » n'importe où retombait sur celui de la carte.
    await expect(page.getByText('Delete "Brouillon" permanently?')).toBeVisible();
    await expect(page.getByText("This action cannot be undone.")).toBeVisible();
    // `button:text-is("Delete")` et non le rôle : les cinq cartes portent un
    // bouton-icône `title="Delete"`, sans texte. Seule la confirmation en
    // contient réellement le mot.
    await page.locator('button:text-is("Delete")').click();

    await expect(page.locator(CARD)).toHaveCount(4);
    await expect(page.locator(CARD).filter({ hasText: "Brouillon" })).toHaveCount(0);
    await assertNoErrorScreen(page, "après la suppression");
  });
});
