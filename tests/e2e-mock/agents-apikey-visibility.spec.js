import { test, expect } from "@playwright/test";
import { signIn, assertNoErrorScreen } from "./session.js";

/**
 * La clé API se cache et se montre. Reprend
 * `tests/e2e/apikey-visibility.spec.js`, dont les deux premiers tests étaient
 * déjà bons — ils n'avaient qu'un défaut, ne tourner nulle part — et dont le
 * troisième, sur l'éditeur de diagramme, était enveloppé dans deux `if` et un
 * `isVisible()` : il passait sans jamais rien vérifier.
 *
 * Le troisième n'est pas repris. La raison est dans le fichier d'état : le
 * champ qu'il visait n'apparaît qu'après avoir déplié un en-tête d'onglet du
 * diagramme, et ce chemin ne s'atteint pas sans les gestes de canevas dont la
 * spécification `diagram` a montré qu'ils ne sont pas reproductibles ici.
 */

async function openCreateForm(page) {
  await page.locator('.w-80 button:has-text("NEW")').first().click();
  await page.getByRole("dialog").getByText("From Scratch").click();
  const input = page.locator('input[placeholder*="API key" i]');
  await expect(input).toBeVisible();
  return input;
}

test.describe("visibilité de la clé API, contre le backend simulé", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, "/agents");
    await expect(page.locator(".w-80 .rounded-2xl.border")).toHaveCount(5);
  });

  test("le champ porte un bouton pour la révéler", async ({ page }) => {
    const apiKeyInput = await openCreateForm(page);
    await expect(apiKeyInput.locator("..").locator("button")).toBeVisible();
    await assertNoErrorScreen(page, "à l'ouverture du formulaire");
  });

  test("le bouton bascule entre masqué et lisible, dans les deux sens", async ({ page }) => {
    const apiKeyInput = await openCreateForm(page);
    const toggle = apiKeyInput.locator("..").locator("button");

    // Masquée par défaut : c'est la garantie, pas seulement la présence du
    // bouton.
    await expect(apiKeyInput).toHaveAttribute("type", "password");
    await toggle.click();
    await expect(apiKeyInput).toHaveAttribute("type", "text");
    await toggle.click();
    await expect(apiKeyInput).toHaveAttribute("type", "password");
  });

  test("la valeur saisie survit à la bascule", async ({ page }) => {
    const apiKeyInput = await openCreateForm(page);
    const toggle = apiKeyInput.locator("..").locator("button");
    await apiKeyInput.fill("sk-valeur-de-parcours");
    await toggle.click();
    await expect(apiKeyInput).toHaveValue("sk-valeur-de-parcours");
    await toggle.click();
    await expect(apiKeyInput).toHaveValue("sk-valeur-de-parcours");
  });
});
