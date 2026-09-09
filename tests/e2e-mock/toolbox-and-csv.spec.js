import { test, expect } from "@playwright/test";
import fs from "node:fs";

/**
 * Deux parcours que personne ne jouait : configurer un outil, et importer un
 * CSV.
 *
 * Le second mérite d'être joué pour une raison précise. L'import CSV a été
 * porté 24 h comme en panne, et il ne l'était pas : deux traces voisines du
 * même journal avaient été lues comme une seule cause. Un parcours qui
 * TÉLÉVERSE vraiment un fichier et lit ce que l'écran en dit tranche cette
 * question en quinze secondes, là où deux relectures de journal se sont
 * trompées.
 *
 * ⚠️ Les formes de réponse du simulateur viennent du CŒUR, pas d'une
 * intuition : `/api/tools` rend {catégorie: [noms]} et non un tableau
 * d'objets, `/bi/datasets` rend {datasets: [...]} avec `columns_count` et
 * `row_count`. Les avoir devinées faisait tomber la Tool Box sur
 * « tools.map is not a function » et affichait zéro dataset -- un simulateur
 * qui invente sa forme rend un parcours vert contre une fiction.
 */

const SHOTS = process.env.E2E_SHOTS_DIR || "tests/e2e-mock/shots";
fs.mkdirSync(SHOTS, { recursive: true });
const shot = (page, name) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });

const DEMO_USER = {
  id: "user_demo", email: "demo@th2.ai", username: "demo",
  firstName: "Elom", lastName: "Demo", avatar: null, role: "user",
  createdAt: "2026-01-15T00:00:00.000Z",
};

async function signIn(page, path) {
  await page.goto("/login");
  await page.evaluate((user) => {
    localStorage.clear();
    localStorage.setItem("th2_auth_token", "mock_token_e2e");
    localStorage.setItem("th2_auth_user", JSON.stringify(user));
  }, DEMO_USER);
  await page.goto(path);
}

async function assertNoErrorScreen(page, when) {
  await expect(
    page.getByText(/Something went wrong|Application error|Unhandled Runtime Error/i),
    `écran d'erreur ${when}`
  ).toHaveCount(0);
}

test.describe("configurer un outil, contre le backend simulé", () => {
  test("l'écran lit le catalogue du cœur et enregistre une configuration", async ({ page }) => {
    await signIn(page, "/tool-box");

    // Le catalogue arrive en {catégorie: [noms]} : l'écran compte 4 outils
    // dans 3 catégories. Ces nombres prouvent qu'il a su lire la forme.
    await expect(page.getByRole("heading", { name: "Tool Box & MCP" })).toBeVisible();
    await assertNoErrorScreen(page, "au chargement de la Tool Box");
    await expect(page.getByText("3 categories")).toBeVisible();
    await expect(page.getByRole("cell", { name: "2 tools" })).toBeVisible();
    await shot(page, "20-toolbox");

    await page.getByRole("button", { name: "New Tool Config" }).click();
    const modal = page.getByText("Create Tool Config").locator("xpath=ancestor::*[self::div][1]");
    await expect(page.getByText("Create Tool Config")).toBeVisible();
    await assertNoErrorScreen(page, "à l'ouverture du modal de configuration");

    await page.getByPlaceholder(/prefix for all configs|my_config/i).first()
      .fill("outils_ventes");

    // « 1. Choose a category » : les catégories du modal viennent du même
    // catalogue que le tableau ci-dessus.
    const categorySelect = page.locator("select").filter({ hasText: "database" }).first();
    await categorySelect.selectOption("database");

    // Choisir une catégorie coche TOUS ses outils, et le bouton le dit :
    // « Create 2 Configs » pour les deux outils de `database`. C'est le
    // parcours réel, on le suit plutôt que de le contourner -- et ce libellé
    // est lui-même une assertion : il vient du catalogue lu plus haut.
    const createBtn = page.getByRole("button", { name: /^Create 2 Configs$/ });
    await expect(createBtn).toBeEnabled();
    await shot(page, "21-tool-config-modal");
    await createBtn.click();

    // La configuration est enregistrée : elle repart du serveur simulé, et
    // l'onglet des configurations la montre. Le nom compte autant que la
    // présence : il voyage sous `tool_config_name`, et un simulateur lisant
    // une autre clé enregistrait « sans nom » sans que rien ne s'en plaigne.
    await expect(page.getByText("Create Tool Config")).toBeHidden({ timeout: 10_000 });
    await page.getByRole("button", { name: /My Configurations/ }).first().click();
    await expect(page.getByText("base_ventes")).toBeVisible();
    await expect(page.getByText("outils_ventes").first()).toBeVisible({ timeout: 10_000 });
    await assertNoErrorScreen(page, "après l'enregistrement");
    await shot(page, "22-tool-config-created");
  });
});

test.describe("importer un CSV, contre le backend simulé", () => {
  test("le fichier part, le serveur le reçoit, l'écran l'affiche", async ({ page }) => {
    await signIn(page, "/bi/data");

    await expect(page.getByRole("heading", { name: "Data Pool" })).toBeVisible();
    await assertNoErrorScreen(page, "au chargement de la réserve de données");
    // Le jeu de départ, servi avec les champs du cœur (`columns_count`,
    // `row_count`) : l'écran sait les formater.
    await expect(page.getByText("ventes-2025.csv")).toBeVisible();
    await expect(page.getByText("1,240 rows")).toBeVisible();
    await shot(page, "23-data-pool");

    // Un vrai téléversement, en multipart, et vers le backend DIRECTEMENT :
    // `uploadBiCsv` court-circuite le proxy Next pour la limite de taille, donc
    // la requête est aussi inter-origine. Deux choses que seul un parcours joué
    // exerce.
    await page.locator('input[type="file"]').setInputFiles({
      name: "trimestre.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        "mois,region,montant\njanvier,Est,1200\nfévrier,Est,1450\nmars,Ouest,980\n",
        "utf8"
      ),
    });

    await expect(page.getByText("trimestre.csv")).toBeVisible({ timeout: 20_000 });
    await assertNoErrorScreen(page, "après le téléversement");
    await shot(page, "24-csv-uploaded");
  });
});
