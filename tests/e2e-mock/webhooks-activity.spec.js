import { test, expect } from "@playwright/test";
import { signIn, shot, assertNoErrorScreen } from "./session.js";

/**
 * Webhooks > Activity : ce que l'écran dit quand il n'a rien, et quand il
 * n'a pas pu demander.
 *
 * Anis, 11/09/2026 : « une liste vide est rendue comme une erreur ».
 * Avant le correctif, un échec laissait `logs` à [] et l'écran affichait
 * « No webhook activity yet. » — le même écran qu'un compte qui n'a rien
 * reçu. Les tests unitaires pincent le composant ; celui-ci pince la page,
 * dans un vrai navigateur, avec l'API qui tombe pour de bon.
 */

const LOGS = "**/api/webhooks/logs*";

test.describe("Webhooks — Activity", () => {
  test("une liste vide est un état vide neutre", async ({ page }) => {
    await page.route(LOGS, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ total: 0, logs: [] }) }),
    );
    await signIn(page, "/webhooks?tab=activity");
    await expect(page.getByText("No webhook activity yet.")).toBeVisible();
    await expect(page.getByText("Could not load activity.")).toHaveCount(0);
    await assertNoErrorScreen(page, "sur l'onglet Activity vide");
    await shot(page, "webhooks-activity-vide");
  });

  test("un chargement en échec n'emprunte pas l'écran du vide", async ({ page }) => {
    await page.route(LOGS, (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ detail: "Internal Server Error" }) }),
    );
    await signIn(page, "/webhooks?tab=activity");
    await expect(page.getByText("Could not load activity.")).toBeVisible();
    // Le coeur du ticket : l'echec ne doit pas se faire passer pour un vide.
    await expect(page.getByText("No webhook activity yet.")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await assertNoErrorScreen(page, "sur l'onglet Activity en echec");
    await shot(page, "webhooks-activity-echec");
  });

  test("Réessayer repart du serveur et rend l'écran vide une fois qu'il répond", async ({ page }) => {
    let enPanne = true;
    await page.route(LOGS, (route) =>
      enPanne
        ? route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ detail: "Service Unavailable" }) })
        : route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ total: 0, logs: [] }) }),
    );
    await signIn(page, "/webhooks?tab=activity");
    await expect(page.getByText("Could not load activity.")).toBeVisible();

    enPanne = false;
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByText("No webhook activity yet.")).toBeVisible();
    await expect(page.getByText("Could not load activity.")).toHaveCount(0);
  });
});
