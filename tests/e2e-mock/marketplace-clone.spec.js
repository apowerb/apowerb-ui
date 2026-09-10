import { test, expect } from "@playwright/test";
import { signIn, shot, assertNoErrorScreen } from "./session.js";

/**
 * L'assistant de clonage, jusqu'à la requête qu'il envoie.
 *
 * Reprend `tests/e2e/clone-provider.spec.js`, la meilleure des six : elle
 * vérifiait déjà une charge utile réelle. Ce qu'elle avait contre elle, c'est
 * qu'elle exigeait un vrai backend, un compte de test et quatre
 * `waitForTimeout` — dont un de 2 secondes avant même le premier clic.
 *
 * Toutes les attentes portent désormais sur un état observable : le titre de
 * l'étape, la valeur d'un champ, la requête sortante.
 */

async function openProviderStep(page) {
  await signIn(page, "/marketplace");
  await page.getByRole("button", { name: /^Clone$/ }).first().click();

  const nameInput = page.getByPlaceholder("my_agent_clone");
  await expect(nameInput).toBeVisible();
  await nameInput.fill("e2e_clone");
  await page.getByRole("button", { name: "Clone Agent" }).click();

  // Le titre de l'étape suivante : le clonage est parti, le serveur a répondu,
  // et le modal a lu sa réponse.
  await expect(page.getByText("Configure Provider & API Key")).toBeVisible();
}

test.describe("assistant de clonage, contre le backend simulé", () => {
  test("l'étape fournisseur propose modèle, URL de base et clé", async ({ page }) => {
    await openProviderStep(page);
    await expect(page.locator('input[placeholder*="e.g. openai"]')).toBeVisible();
    await expect(page.locator('input[placeholder*="api.openai"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByText("Saved configurations")).toBeVisible();
    await assertNoErrorScreen(page, "à l'étape fournisseur");
    await shot(page, "35-clone-provider");
  });

  test("le modèle est pré-rempli avec celui de l'agent source", async ({ page }) => {
    await openProviderStep(page);
    // Pas « non vide » : la valeur exacte que le hub publie pour cet agent.
    // Une pré-remplissage au hasard passait l'ancienne version du test.
    await expect(page.locator('input[placeholder*="e.g. openai"]'))
      .toHaveValue("google/gemini-2.0-flash");
  });

  test("le modèle reste modifiable", async ({ page }) => {
    await openProviderStep(page);
    const model = page.locator('input[placeholder*="e.g. openai"]');
    await model.fill("openai/gpt-4o");
    await expect(model).toHaveValue("openai/gpt-4o");
  });

  test("le modèle choisi est bien celui qui part au serveur", async ({ page }) => {
    await openProviderStep(page);
    await page.locator('input[placeholder*="e.g. openai"]').fill("google/gemini-2.0-flash-exp");
    await page.locator('input[type="password"]').fill("fake-test-key-12345");

    // Le cœur du test : ce que l'utilisateur a tapé doit se retrouver dans la
    // requête, pas seulement dans le champ. C'est la seule assertion des six
    // spécifications d'origine qui regardait une charge utile.
    const [request] = await Promise.all([
      page.waitForRequest(
        (req) => req.method() === "PUT" && /\/api\/agents\/\d+$/.test(new URL(req.url()).pathname)
      ),
      page.getByRole("button", { name: /^Next$/ }).click(),
    ]);
    expect(JSON.parse(request.postData()).agent_model).toBe("google/gemini-2.0-flash-exp");
  });

  test("l'agent cloné existe ensuite dans la liste des agents", async ({ page }) => {
    await openProviderStep(page);
    await page.getByRole("button", { name: /Skip this step/i }).click();

    // Le clonage n'a de sens que s'il laisse quelque chose derrière lui.
    // Aucune des six spécifications d'origine ne vérifiait cela.
    //
    // ⚠️ `goto` et surtout pas `signIn` : celui-ci remet l'état du simulateur
    // à zéro, ce qui effacerait justement le clone qu'on vient de créer. La
    // session est déjà ouverte, il n'y a qu'à changer d'écran.
    await page.goto("/agents");
    await expect(page.locator(".w-80 .rounded-2xl.border").filter({ hasText: "e2e_clone" }))
      .toHaveCount(1);
    await assertNoErrorScreen(page, "après le clonage");
  });
});
