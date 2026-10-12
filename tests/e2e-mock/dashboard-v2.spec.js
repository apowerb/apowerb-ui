import { test, expect } from "@playwright/test";
import { signIn, shot, assertNoErrorScreen } from "./session.js";

/**
 * Tableau de bord v2 « Pilotage stocks emballage », joué contre le backend
 * simulé : la spec vient de tests/mock-backend/fixtures/dashboard-v2-stock.json
 * et les données (synthétiques) sont recalculées par le simulateur à chaque
 * état des filtres, comme le fait le vrai moteur.
 */

const PATH = "/bi/v2-stock";

const kpiValue = (page, n) => page.getByTestId("kpi-value").nth(n);

test.describe("dashboard v2 : filtres, croisement, sources", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, PATH);
    await expect(page.getByRole("heading", { name: "Pilotage stocks emballage" })).toBeVisible();
    await expect(page.getByTestId("kpi-tile")).toHaveCount(6);
  });

  test("affiche la synthèse et les six KPI colorés", async ({ page }) => {
    const text = page.getByTestId("v2-text");
    await expect(text).toContainText("Toutes familles");
    await expect(page.getByRole("radio", { name: "Last 26 weeks" })).toHaveAttribute("aria-checked", "true");
    // les chiffres de la phrase sont en gras
    await expect(text.locator("strong").first()).toBeVisible();
    // le taux de service porte la couleur de son statut (good / warn / bad)
    await expect(kpiValue(page, 1)).toHaveAttribute("data-status", /good|warn|bad/);
    await assertNoErrorScreen(page, "au chargement du dashboard v2");
    await shot(page, "20-dashboard-v2-dark");
  });

  test("changer la famille recalcule la synthèse et se retrouve dans l'URL", async ({ page }) => {
    const text = page.getByTestId("v2-text");
    const before = await text.innerText();
    await page.getByRole("combobox", { name: "Famille" }).selectOption("Bravo");
    await expect(text).toContainText("Bravo, semaine du");
    expect(await text.innerText()).not.toBe(before);
    await expect(page).toHaveURL(/f_famille=Bravo/);

    // la période : 13 dernières semaines
    await page.getByRole("radio", { name: "Last 13 weeks" }).click();
    await expect(page).toHaveURL(/f_periode=13w/);
    await expect(page.getByRole("radio", { name: "Last 13 weeks" })).toHaveAttribute("aria-checked", "true");
  });

  test("un lien partageable restaure les filtres", async ({ page }) => {
    await page.goto(`${PATH}?f_famille=Charlie&f_periode=52w`);
    await expect(page.getByTestId("v2-text")).toContainText("Charlie, semaine du");
    await expect(page.getByRole("radio", { name: "Last 52 weeks" })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("combobox", { name: "Famille" })).toHaveValue("Charlie");
  });

  test("cliquer une ligne du tableau filtre le reste, re-cliquer le retire, Réinitialiser remet tout", async ({ page }) => {
    const stockBefore = (await kpiValue(page, 0).textContent()) ?? "";
    const table = page.getByTestId("v2-table");
    await table.getByRole("row", { name: /Bravo/ }).click();

    const chip = page.getByTestId("v2-filter-chip");
    await expect(chip).toHaveCount(1);
    await expect(chip).toContainText("Bravo");
    await expect(page.getByTestId("v2-text")).toContainText("Bravo, semaine du");
    await expect(kpiValue(page, 0)).not.toHaveText(stockBefore);
    // la ligne cliquée est mise en évidence, le tableau garde toutes les familles
    await expect(table.getByRole("row", { name: /Bravo/ })).toHaveAttribute("data-highlight", "true");
    await expect(table.getByRole("row", { name: /Alpha/ })).toBeVisible();
    await shot(page, "21-dashboard-v2-crossfilter");

    // même ligne : le filtre est retiré
    await table.getByRole("row", { name: /Bravo/ }).click();
    await expect(chip).toHaveCount(0);
    await expect(kpiValue(page, 0)).toHaveText(stockBefore);

    // puce + Réinitialiser
    await table.getByRole("row", { name: /Charlie/ }).click();
    await expect(chip).toHaveCount(1);
    await page.getByRole("button", { name: "Remove filter Famille" }).click();
    await expect(chip).toHaveCount(0);

    await page.getByRole("combobox", { name: "Famille" }).selectOption("Alpha");
    await page.getByRole("radio", { name: "Last 13 weeks" }).click();
    await page.getByRole("button", { name: "Reset" }).click();
    await expect(page.getByRole("combobox", { name: "Famille" })).toHaveValue("");
    await expect(page.getByRole("radio", { name: "Last 26 weeks" })).toHaveAttribute("aria-checked", "true");
    await expect(kpiValue(page, 0)).toHaveText(stockBefore);
    await expect(page).not.toHaveURL(/f_famille|f_periode/);
  });

  test("le bouton Sources d'un KPI détaille la formule, les filtres et les lignes", async ({ page }) => {
    const tile = page.getByTestId("kpi-tile").nth(1).locator("xpath=ancestor::section[1]");
    await tile.hover();
    await tile.getByRole("button", { name: "Sources" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("SUM(stock_fin)");
    await expect(dialog).toContainText("periode");
    await expect(dialog).toContainText("stocks");
    await shot(page, "22-dashboard-v2-sources");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });

  test("en mode édition, le panneau de l'éditeur s'ouvre et sélectionne un bloc", async ({ page }) => {
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(page.getByTestId("v2-editor-panel")).toBeVisible();
    await page.locator('[data-testid^="v2-block-"]', { hasText: "Comparatif par famille" }).click();
    await expect(page.locator('[data-testid^="v2-block-"]', { hasText: "Comparatif par famille" })).toHaveClass(/ring-2/);
    await assertNoErrorScreen(page, "en mode édition");
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await expect(page.getByTestId("v2-editor-panel")).toHaveCount(0);
  });
});

test.describe("dashboard v2 : thèmes et mobile", () => {
  test("clair, bureau", async ({ page }) => {
    await signIn(page, PATH);
    await page.evaluate(() => localStorage.setItem("theme", "light"));
    await page.reload();
    await expect(page.getByTestId("kpi-tile")).toHaveCount(6);
    await expect(page.locator("html")).toHaveClass(/light/);
    await expect(page.getByTestId("v2-table")).toBeVisible();
    await shot(page, "23-dashboard-v2-light");
  });

  test("mobile 390 px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page, PATH);
    await expect(page.getByTestId("kpi-tile")).toHaveCount(6);
    await expect(page.getByTestId("v2-text")).toBeVisible();
    // pas de défilement horizontal de la page
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    await shot(page, "24-dashboard-v2-mobile");
  });
});
