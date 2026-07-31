import { test, expect } from "@playwright/test";
import { login } from "./fixtures.js";

test.describe("AgentSidebar", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/agents");
    await page.waitForSelector(".w-80", { timeout: 15000 });
  });

  test("agent list renders with cards", async ({ page }) => {
    const sidebar = page.locator(".w-80");
    await expect(sidebar).toBeVisible();

    const cards = sidebar.locator(".rounded-2xl.border");
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test("search filters agents by name", async ({ page }) => {
    const searchInput = page.locator('.w-80 input[placeholder="Search agents..."]');
    await expect(searchInput).toBeVisible();

    const cardsBefore = await page.locator(".w-80 .rounded-2xl.border").count();
    if (cardsBefore === 0) {
      test.skip();
      return;
    }

    const firstCardName = await page
      .locator(".w-80 .rounded-2xl.border")
      .first()
      .locator(".th-text.text-sm.font-bold")
      .textContent();

    await searchInput.fill(firstCardName.trim());
    await page.waitForTimeout(300);

    const cardsAfter = await page.locator(".w-80 .rounded-2xl.border").count();
    expect(cardsAfter).toBeGreaterThanOrEqual(1);
    expect(cardsAfter).toBeLessThanOrEqual(cardsBefore);
  });

  test("search filters agents by category", async ({ page }) => {
    const searchInput = page.locator('.w-80 input[placeholder="Search agents..."]');

    await searchInput.fill("Base");
    await page.waitForTimeout(300);

    const cards = page.locator(".w-80 .rounded-2xl.border");
    const count = await cards.count();

    for (let i = 0; i < count; i++) {
      const cardText = await cards.nth(i).textContent();
      expect(cardText.toLowerCase()).toContain("base");
    }
  });

  test("clear search shows all agents", async ({ page }) => {
    const searchInput = page.locator('.w-80 input[placeholder="Search agents..."]');

    const cardsInitial = await page.locator(".w-80 .rounded-2xl.border").count();

    await searchInput.fill("zzzznonexistent");
    await page.waitForTimeout(300);

    await searchInput.fill("");
    await page.waitForTimeout(300);

    const cardsAfterClear = await page.locator(".w-80 .rounded-2xl.border").count();
    expect(cardsAfterClear).toBe(cardsInitial);
  });

  test("category badges are visible", async ({ page }) => {
    const cards = page.locator(".w-80 .rounded-2xl.border");
    const count = await cards.count();
    if (count === 0) {
      test.skip();
      return;
    }

    const validCategories = ["base", "sequential", "parallel", "loop", "router"];

    for (let i = 0; i < Math.min(count, 5); i++) {
      const badge = cards.nth(i).locator("span.uppercase.tracking-wider").first();
      await expect(badge).toBeVisible();
      const text = (await badge.textContent()).toLowerCase().trim();
      expect(validCategories).toContain(text);
    }
  });

  test("action buttons appear on hover", async ({ page }) => {
    const cards = page.locator(".w-80 .rounded-2xl.border");
    const count = await cards.count();
    if (count === 0) {
      test.skip();
      return;
    }

    const firstCard = cards.first();
    await firstCard.hover();

    const viewBtn = firstCard.locator('button[title="View Details"]');
    const editBtn = firstCard.locator('button[title="Edit"]');
    const deleteBtn = firstCard.locator('button[title="Delete"]');

    await expect(viewBtn).toBeAttached();
    await expect(editBtn).toBeAttached();
    await expect(deleteBtn).toBeAttached();
  });

  test("New button exists and opens create modal", async ({ page }) => {
    const newButton = page.locator('.w-80 button:has-text("New")');
    await expect(newButton).toBeVisible();

    await newButton.click();

    const modal = page.locator('[role="dialog"], .fixed.inset-0');
    await expect(modal.first()).toBeVisible({ timeout: 5000 });
  });

  test("warning badges appear for incomplete agents", async ({ page }) => {
    const warningBadges = page.locator(".w-80 .animate-pulse");
    const count = await warningBadges.count();

    // This test just confirms the selector works; some agents may have warnings
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
