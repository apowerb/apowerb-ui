import { test, expect } from "@playwright/test";
import { signIn, shot, assertNoErrorScreen } from "./session.js";

/**
 * « Créer depuis un modèle » : assistant à quatre étapes sur la page BI,
 * joué contre le backend simulé (le jeu ds-1 n'a PAS les noms par défaut du
 * modèle : les colonnes se choisissent à la main).
 */

async function reachColumns(page) {
  await signIn(page, "/bi");
  await page.getByRole("button", { name: "From a template" }).click();
  const dialog = page.getByRole("dialog", { name: "Create from a template" });
  await dialog.getByText("Pilotage stocks").click();
  await dialog.getByRole("button", { name: "Next" }).click();
  await dialog.getByText("ventes-2025.csv").click();
  await dialog.getByRole("button", { name: "Next" }).click();
  await expect(dialog.getByLabel("Semaine", { exact: true })).toBeVisible();
  return dialog;
}

async function mapByHand(dialog) {
  await expect(dialog.getByRole("button", { name: "Next" })).toBeDisabled();
  await dialog.getByLabel("Semaine", { exact: true }).selectOption("mois");
  await dialog.getByLabel("Famille", { exact: true }).selectOption("region");
  await dialog.getByLabel("Ventes", { exact: true }).selectOption("montant");
  await expect(dialog.getByRole("button", { name: "Next" })).toBeEnabled();
}

test.describe("créer un tableau de bord depuis un modèle", () => {
  test("desktop : colonnes choisies à la main, titre déjà pris, navigation", async ({ page }) => {
    const dialog = await reachColumns(page);
    await mapByHand(dialog);
    await shot(page, "30-template-columns-desktop");
    await dialog.getByRole("button", { name: "Next" }).click();
    await dialog.getByLabel("Title").fill("Ventes 2026");
    await dialog.getByRole("button", { name: "Create" }).click();
    // le toast dure 4 s et la première compilation de la page cible plus longtemps
    await expect(page.getByText(/Renamed to “Ventes 2026 \(\d+\)”/)).toBeVisible();
    await expect(page).toHaveURL(/\/bi\/v2-stock$/, { timeout: 30_000 });
    await assertNoErrorScreen(page, "après la création depuis un modèle");
  });

  test("mobile : l'assistant reste utilisable", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 780 });
    const dialog = await reachColumns(page);
    await mapByHand(dialog);
    await shot(page, "31-template-columns-mobile");
    await expect(dialog.getByRole("button", { name: "Next" })).toBeInViewport();
  });
});
