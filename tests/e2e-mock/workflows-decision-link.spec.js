import { test, expect } from "@playwright/test";
import { signIn, shot, assertNoErrorScreen, DEMO_USER } from "./session.js";

/**
 * Le lien d'un avis de décision humaine (mail, Teams) :
 * `/workflows?decision=<run_id>`, joué dans un vrai navigateur.
 *
 * Le simulateur ne connaît pas les workflows : les trois routes de la page
 * sont servies ici (`page.route`). Ce qui est vérifié, c'est le parcours
 * entier côté navigateur — session, page, liste, fenêtre ouverte toute seule,
 * réponse envoyée — que les tests Vitest ne jouent qu'en jsdom.
 */

const WAITING = {
  run_id: "r2",
  workflow_id: "w2",
  workflow_name: "Congés",
  node_id: "d2",
  question: "Accorder trois jours à Bob ?",
  mode: "text",
  choices: [],
  assignee: DEMO_USER.email,
  mine: false,
  paused_at: "2026-10-21T11:00:00+00:00",
  expires_at: "2026-10-28T11:00:00+00:00",
};

async function serveWorkflows(page, { awaiting }) {
  const answers = [];
  await page.route("**/api/workflows/defs", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/workflows/runs/awaiting", (route) => route.fulfill({ json: awaiting }));
  await page.route("**/api/workflows/runs/*/resume", (route) => {
    answers.push({ url: route.request().url(), body: route.request().postDataJSON() });
    const events = [{ event: "run_started", wid: "r2" }, { event: "done", output: "ok" }];
    return route.fulfill({
      status: 200,
      headers: { "content-type": "text/event-stream" },
      body: events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(""),
    });
  });
  return answers;
}

test.describe("lien d'un avis de décision, contre le backend simulé", () => {
  test("le lien ouvre la décision, la réponse part et la liste se vide", async ({ page }) => {
    const answers = await serveWorkflows(page, { awaiting: [WAITING] });
    await signIn(page, "/workflows?decision=r2");

    const dialog = page.getByRole("dialog");
    await expect(dialog, "la fenêtre de la décision ne s'est pas ouverte").toBeVisible();
    await expect(dialog.getByText("Accorder trois jours à Bob ?")).toBeVisible();
    await assertNoErrorScreen(page, "à l'ouverture depuis le lien");
    await shot(page, "decision-link-1-ouverte");

    await page.unroute("**/api/workflows/runs/awaiting");
    await page.route("**/api/workflows/runs/awaiting", (route) => route.fulfill({ json: [] }));
    await dialog.getByRole("textbox").fill("Oui, accordé");
    await dialog.getByRole("button", { name: "Send" }).click();

    await expect(page.getByText("Answer sent: the workflow finished.")).toBeVisible();
    await expect(dialog).toBeHidden();
    expect(answers).toHaveLength(1);
    expect(answers[0].url).toContain("/api/workflows/runs/r2/resume");
    expect(answers[0].body).toEqual({ text: "Oui, accordé" });
    await shot(page, "decision-link-2-repondue");
  });

  test("un lien périmé le dit et n'ouvre rien", async ({ page }) => {
    await serveWorkflows(page, { awaiting: [] });
    await signIn(page, "/workflows?decision=r2");
    await expect(
      page.getByText("This decision is no longer waiting for you: it was answered, abandoned or it expired."),
    ).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await assertNoErrorScreen(page, "sur un lien périmé");
    await shot(page, "decision-link-3-perime");
  });
});
