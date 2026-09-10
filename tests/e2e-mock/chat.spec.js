import { test, expect } from "@playwright/test";
import { signIn, shot, DEMO_USER } from "./session.js";

// Every response state of the chat, reproduced against tests/mock-backend.
// Screenshots land in tests/e2e-mock/shots (or $E2E_SHOTS_DIR) as a visual
// record of the run.
async function goHome(page) {
  await signIn(page, "/chat");
  await expect(page.getByRole("heading", { name: /Elom/ })).toBeVisible();
}

async function startWith(page, agentName) {
  await page.getByRole("button", { name: /Choose an agent|All agents/ }).click();
  // The agent picker is a modal without a dialog role: pick the row by name.
  await page.locator("button", { hasText: agentName }).first().click();
  await expect(page.getByRole("textbox", { name: /Ask a question/ })).toBeVisible();
}

async function send(page, text) {
  const box = page.getByRole("textbox", { name: /Ask a question/ });
  await box.fill(text);
  await box.press("Enter");
}

test.describe("chat against the mock backend", () => {
  test("home, reasoning trail, chart and every response state", async ({ page }) => {
    await goHome(page);
    await shot(page, "01-home");

    await startWith(page, "Support Outillé");

    // Tools scenario: thinking → tool → SQL table → failed tool → chart.
    await send(page, "Montre-moi les ventes avec les outils");
    const trail = page.getByRole("region", { name: "Reasoning trail" });
    await expect(trail).toBeVisible();
    await expect(trail).toContainText(/Working/);
    await shot(page, "02-streaming-trail");
    await expect(trail).toContainText(/Reasoned for/, { timeout: 30_000 });
    await expect(trail).toContainText("2 tools");
    await expect(trail).toContainText("1 error");
    await expect(page.locator("figure[data-chart='bar']")).toBeVisible();
    await trail.getByRole("button", { name: /Reasoned for/ }).click();
    await expect(trail.getByText("query_sales_db")).toBeVisible();
    await expect(trail.getByText("targets service timed out after 5s")).toBeVisible();
    await shot(page, "03-trail-open-chart");
    await trail.getByRole("button", { name: /Reasoned for/ }).click();

    // Empty response.
    await send(page, "Donne-moi une réponse vide");
    const empty = page.locator("[role='status'][data-state='empty']");
    await expect(empty).toBeVisible({ timeout: 15_000 });
    await expect(empty).toContainText("No content returned");
    await expect(empty.getByRole("button", { name: "Regenerate" })).toBeVisible();
    await shot(page, "04-empty-response");

    // Partial response: stop it with Esc, then Continue.
    await send(page, "Donne-moi une réponse partielle");
    await expect(page.getByText("Rapport de synthèse")).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press("Escape");
    const interrupted = page.locator("[role='status'][data-state='interrupted']");
    await expect(interrupted).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Interrupted", { exact: true })).toBeVisible();
    await shot(page, "05-partial-interrupted");
    await interrupted.getByRole("button", { name: "Continue" }).click();
    await expect(page.locator("article[data-status='done']").last()).toBeVisible({ timeout: 30_000 });

    // Backend error mid-stream.
    await send(page, "Provoque une erreur");
    const errored = page.locator("[role='status'][data-state='error']");
    await expect(errored).toBeVisible({ timeout: 15_000 });
    await expect(errored).toContainText("Upstream model error (503)");
    await expect(errored.getByRole("button", { name: "Retry" })).toBeVisible();
    await shot(page, "06-error-retry");

    // Rate-limit pause surfaced in the status bar, then a normal answer.
    await send(page, "Réponse lente");
    await expect(page.getByRole("status").filter({ hasText: "Rate limited" })).toBeVisible({ timeout: 10_000 });
    await shot(page, "07-rate-limited");
    await expect(page.locator("article[data-status='done']").last()).toContainText("Merci d'avoir patienté", { timeout: 30_000 });

    // Regenerate from the palette → a second branch on the last answer.
    await page.keyboard.press("Meta+k");
    const palette = page.getByRole("dialog", { name: "Command palette" });
    await expect(palette).toBeVisible();
    await palette.getByRole("combobox").fill(">regen");
    await shot(page, "08-palette-commands");
    await page.keyboard.press("Enter");
    await expect(page.getByText("2/2")).toBeVisible({ timeout: 30_000 });
    await shot(page, "09-branches");

    // Slash menu, template, rename.
    const box = page.getByRole("textbox", { name: /Ask a question/ });
    await box.fill("/");
    await expect(page.getByRole("listbox", { name: "Commands" })).toContainText("/rename");
    await shot(page, "10-slash-menu");
    await box.fill("/trans");
    await box.press("Tab");
    await expect(box).toHaveValue(/Translate your last answer into «…»/);
    await box.fill("/rename Ventes Q3 (mock)");
    await box.press("Enter");
    await expect(page.getByTitle("Rename this conversation")).toContainText("Ventes Q3 (mock)");

    // @mention lists agents.
    await box.fill("Résume ça @réd");
    await expect(page.getByRole("listbox", { name: "Agents" })).toContainText("Rédacteur");
    await shot(page, "11-mention-menu");
    await page.keyboard.press("Escape");
    await box.fill("");

    // Find in thread.
    await page.keyboard.press("Meta+Shift+f");
    const search = page.getByRole("search");
    await search.getByRole("textbox").fill("erreur");
    await expect(search).toContainText(/1 \/ \d/);
    await page.keyboard.press("Escape");

    // Artifacts panel (the python fence of the default answer).
    await page.getByRole("button", { name: "Artifacts" }).click();
    await expect(page.getByText("python_1.py")).toBeVisible();
    await shot(page, "12-artifacts-panel");
    await page.getByRole("button", { name: "Close panel" }).click();

    // Shortcuts help + light theme.
    await page.keyboard.press("Meta+/");
    await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
    await shot(page, "13-shortcuts");
    await page.keyboard.press("Escape");
    await page.evaluate(() => {
      localStorage.setItem("theme", "light");
      document.documentElement.classList.add("light");
    });
    // Le seul délai fixe de la suite, et il ne synchronise rien : il laisse
    // la transition de thème s'achever avant la CAPTURE. Aucune assertion
    // n'en dépend.
    await page.waitForTimeout(400);
    await shot(page, "14-light-theme");
  });
});
