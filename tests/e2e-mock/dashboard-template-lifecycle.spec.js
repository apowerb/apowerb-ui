import { test, expect } from "@playwright/test";
import { signIn, shot, assertNoErrorScreen } from "./session.js";

/**
 * Cycle de vie d'un tableau v2 issu d'un modèle : remplacer le fichier source,
 * passer à la dernière version du modèle, l'enregistrer comme modèle, puis
 * retrouver et supprimer ces modèles dans l'assistant. Joué contre le backend
 * simulé (le tableau « Pilotage stocks emballage » y porte une provenance en
 * version 1, le modèle intégré est en version 2).
 */

const PATH = "/bi/v2-stock";

async function openPage(page) {
  await signIn(page, PATH);
  await expect(page.getByRole("heading", { name: "Pilotage stocks emballage" })).toBeVisible();
  await expect(page.getByTestId("kpi-tile")).toHaveCount(6);
}

async function openMenuItem(page, name) {
  await page.getByRole("button", { name: "Template", exact: true }).click();
  await page.getByRole("menuitem", { name }).click();
}

async function openReplaceModal(page) {
  await openMenuItem(page, "Replace the source file");
  const dialog = page.getByRole("dialog", { name: "Replace the source file" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("searchbox", { name: "Search datasets" }).fill("ventes");
  await dialog.locator("label", { hasText: "ventes-2025.csv" }).click();
  await expect(dialog.getByLabel("Semaine", { exact: true })).toHaveValue("mois");
  return dialog;
}

test.describe("tableau v2 : fichier source, version du modèle, enregistrement", () => {
  test("remplacer le fichier source : colonnes préremplies, aperçu de 5 lignes, toast", async ({ page }) => {
    await openPage(page);
    const dialog = await openReplaceModal(page);
    await expect(dialog.getByLabel("Famille", { exact: true })).toHaveValue("region");
    await expect(dialog.getByLabel("Ventes", { exact: true })).toHaveValue("montant");
    await expect(dialog.getByRole("table", { name: /First rows of ventes-2025\.csv/ }).getByRole("row")).toHaveCount(6);
    await shot(page, "40-replace-source-desktop");
    await dialog.getByRole("button", { name: "Replace", exact: true }).click();
    await expect(page.getByText("Source file replaced")).toBeVisible();
    await expect(dialog).toHaveCount(0);
    await assertNoErrorScreen(page, "après le remplacement du fichier source");
  });

  test("mettre à jour vers la dernière version : avertissement, confirmation, l'action disparaît", async ({ page }) => {
    await openPage(page);
    await openMenuItem(page, "Update to the latest template version");
    const dialog = page.getByRole("dialog", { name: "Update to the latest template version" });
    await expect(dialog.getByText(/version 1 → 2/)).toBeVisible();
    await expect(dialog.getByRole("note")).toContainText("Manual edits");
    await shot(page, "41-upgrade-template-desktop");
    await dialog.getByRole("button", { name: "Replace and update" }).click();
    await expect(page.getByText("Dashboard updated to version 2")).toBeVisible();
    await expect(dialog).toHaveCount(0);
    await page.getByRole("button", { name: "Template", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: "Replace the source file" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /Update to the latest/ })).toHaveCount(0);
    await assertNoErrorScreen(page, "après la mise à jour du modèle");
  });

  test("enregistrer comme modèle : nom déjà pris, puis succès", async ({ page }) => {
    await openPage(page);
    await openMenuItem(page, "Save as a template");
    const dialog = page.getByRole("dialog", { name: "Save as a template" });
    await expect(dialog.getByLabel("Template name")).toHaveValue("Pilotage stocks emballage");
    await dialog.getByLabel("Template name").fill("Mon modèle");
    await dialog.getByRole("button", { name: "Save template" }).click();
    await expect(dialog.getByRole("alert")).toContainText("A template with this name already exists");
    await dialog.getByLabel("Template name").fill("Pilotage packaging");
    await dialog.getByLabel("Description").fill("Base du pilotage packaging");
    await dialog.getByRole("radio", { name: /Organization/ }).check();
    await shot(page, "42-save-template-desktop");
    await dialog.getByRole("button", { name: "Save template" }).click();
    await expect(page.getByText("Template “Pilotage packaging” saved")).toBeVisible();
    await expect(dialog).toHaveCount(0);
  });

  test("l'assistant liste les modèles utilisateur et supprime le mien après confirmation", async ({ page }) => {
    await signIn(page, "/bi");
    await page.getByRole("button", { name: "From a template" }).click();
    const dialog = page.getByRole("dialog", { name: "Create from a template" });
    await expect(dialog.getByText("My template")).toBeVisible();
    await expect(dialog.getByText("Organization", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: /^Delete template/ })).toHaveCount(1);
    await dialog.getByRole("button", { name: "Delete template Mon modèle" }).click();
    await shot(page, "43-delete-template-confirm-desktop");
    await dialog.getByRole("button", { name: "Keep" }).click();
    await expect(dialog.getByText("Mon modèle")).toBeVisible();
    await dialog.getByRole("button", { name: "Delete template Mon modèle" }).click();
    await dialog.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByText("Template deleted")).toBeVisible();
    await expect(dialog.getByText("Mon modèle")).toHaveCount(0);
  });

  test("l'assistant : recherche de jeu de données, aperçu et avertissement de type", async ({ page }) => {
    await signIn(page, "/bi");
    await page.getByRole("button", { name: "From a template" }).click();
    const dialog = page.getByRole("dialog", { name: "Create from a template" });
    await dialog.getByText("Pilotage stocks").click();
    await dialog.getByRole("button", { name: "Next" }).click();
    const search = dialog.getByRole("searchbox", { name: "Search datasets" });
    await search.fill("zzz");
    await expect(dialog.getByText(/No dataset matches/)).toBeVisible();
    await search.fill("VENTES");
    await dialog.getByText("ventes-2025.csv").click();
    await dialog.getByRole("button", { name: "Next" }).click();
    await dialog.getByLabel("Semaine", { exact: true }).selectOption("mois");
    await dialog.getByLabel("Ventes", { exact: true }).selectOption("region");
    await expect(dialog.getByText(/looks like text, but number is expected/)).toBeVisible();
    await expect(dialog.getByRole("table", { name: /First rows/ }).getByRole("row")).toHaveCount(6);
    await dialog.getByLabel("Famille", { exact: true }).selectOption("region");
    await dialog.getByLabel("Ventes", { exact: true }).selectOption("montant");
    await expect(dialog.getByRole("button", { name: "Next" })).toBeEnabled();
  });

  test("mobile : les modales restent utilisables", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 780 });
    await openPage(page);
    const replace = await openReplaceModal(page);
    await shot(page, "50-replace-source-mobile");
    await expect(replace.getByRole("button", { name: "Replace", exact: true })).toBeInViewport();
    await page.keyboard.press("Escape");
    await expect(replace).toHaveCount(0);

    await openMenuItem(page, "Save as a template");
    const save = page.getByRole("dialog", { name: "Save as a template" });
    await shot(page, "51-save-template-mobile");
    await expect(save.getByRole("button", { name: "Save template" })).toBeInViewport();
  });
});
