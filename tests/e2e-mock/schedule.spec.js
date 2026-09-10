import { test, expect } from "@playwright/test";
import { signIn, shot, assertNoErrorScreen } from "./session.js";

/**
 * Planifier une exécution, joué contre le backend simulé.
 *
 * C'est le parcours qui a cassé le 08/09/2026. Un correctif de sécurité avait
 * remplacé `generateSessionId` à un seul de ses trois appels ; l'un des deux
 * restants était dans l'effet joué à l'OUVERTURE du modal, donc l'écran rouge
 * « Something went wrong » tombait avant que l'écran s'affiche. Ni le lint (la
 * règle n'était pas activée), ni un test (le composant n'était pas couvert),
 * ni le build ne l'ont vu.
 *
 * Le garde `no-undef` attrape ce défaut-là. Celui-ci attrape la CLASSE : le
 * modal s'ouvre, ou il ne s'ouvre pas — quelle qu'en soit la raison.
 *
 * Éprouvé contre le commit cassé (`76a0c10^`) : rouge, sur l'ouverture.
 */

test.describe("planifier une exécution, contre le backend simulé", () => {
  test.beforeEach(async ({ page }) => {
    // Le simulateur accepte n'importe quel jeton ; le SDK n'a besoin que des
    // deux clés.
    await signIn(page, "/orchestrator");
  });

  test("l'écran liste les planifications, en crée une, et l'affiche", async ({ page }) => {
    // L'écran est enveloppé dans `RequiresSetup capability="orchestration"` :
    // s'il n'était pas configuré, rien de ce qui suit n'existerait.
    await expect(page.getByRole("heading", { name: "Orchestrator" })).toBeVisible();
    await expect(page.getByText("Analyste").first()).toBeVisible();
    await assertNoErrorScreen(page, "au chargement de l'écran");
    await shot(page, "10-orchestrator");

    // ── L'ouverture du modal : le geste exact qui rendait l'écran rouge ──
    // Portée à l'en-tête : « Schedule » apparaît aussi sur chaque ligne
    // d'agent, et un sélecteur ambigu choisirait au hasard.
    await page.locator("header").getByRole("button", { name: "Schedule", exact: true }).click();
    const modal = page.getByRole("dialog");
    await expect(modal, "le modal de planification ne s'est pas ouvert").toBeVisible();
    await assertNoErrorScreen(page, "à l'ouverture du modal");
    await expect(modal.getByText("Schedule Agent Run")).toBeVisible();

    // L'identifiant de session est justement ce que l'effet d'ouverture
    // calcule : non vide, il prouve que l'effet est allé au bout.
    const sessionInput = modal.locator('input[type="text"]').last();
    const firstId = await sessionInput.inputValue();
    expect(firstId, "l'identifiant de session est vide").not.toBe("");

    // Et le bouton qui en réclame un autre était le second appel survivant.
    await modal.getByTitle("Generate new session ID").click();
    await expect(sessionInput).not.toHaveValue(firstId);
    await assertNoErrorScreen(page, "après avoir régénéré l'identifiant de session");
    await shot(page, "11-schedule-modal");

    await modal.locator("select").first().selectOption({ label: "Analyste (1)" });
    await modal.locator("textarea").fill("Résume les ventes de la semaine");
    await modal.locator("select").nth(1).selectOption("@daily");

    await modal.getByRole("button", { name: "Schedule Run" }).click();

    // La confirmation lit `schedule_id` sur la réponse : elle prouve que la
    // requête est partie, qu'elle a été comprise, et que le retour est lu.
    await expect(modal.getByText("Schedule created successfully!")).toBeVisible();
    await expect(modal.getByText("Schedule ID:")).toBeVisible();
    await expect(modal.getByText("@daily")).toBeVisible();
    await shot(page, "12-schedule-created");

    // Le modal se referme seul, et l'écran se rafraîchit avec la nouvelle.
    await expect(modal).toBeHidden({ timeout: 10_000 });
    await assertNoErrorScreen(page, "après la création");
  });

  test("lancer un agent maintenant", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Orchestrator" })).toBeVisible();

    await page.locator("header").getByRole("button", { name: "Run Now", exact: true }).click();
    const modal = page.getByRole("dialog");
    await expect(modal, "le modal « lancer maintenant » ne s'est pas ouvert").toBeVisible();
    await expect(modal.getByText("Run Agent Now")).toBeVisible();
    await assertNoErrorScreen(page, "à l'ouverture du modal « lancer maintenant »");

    await modal.locator("select").first().selectOption({ label: "Rédacteur (2)" });
    await modal.locator("textarea").fill("Rédige le compte rendu");
    await modal.getByRole("button", { name: "Run Now", exact: true }).click();

    await expect(modal.getByText("Agent run completed!")).toBeVisible();
    await shot(page, "13-run-now");
    await assertNoErrorScreen(page, "après le lancement");
  });
});
