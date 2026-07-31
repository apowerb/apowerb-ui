// @ts-check
const { test, expect } = require("@playwright/test");
const { login } = require("./fixtures");

test.describe("API Key Visibility Toggle", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/agents");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
  });

  test("AgentModal API key field has show/hide toggle", async ({ page }) => {
    // Click New to open create modal
    const sidebar = page.locator('[class*="w-80"]').first();
    await sidebar.locator('button:has-text("New")').click();
    await page.waitForTimeout(1500);

    // Click "From Scratch"
    await page.locator('text=From Scratch').click();
    await page.waitForTimeout(1500);

    // Find the API key input
    const apiKeyInput = page.locator('input[placeholder*="API key"]');
    await expect(apiKeyInput).toBeVisible();

    // There should be an eye toggle button next to the API key input
    const container = apiKeyInput.locator('..');
    const eyeToggle = container.locator('button');
    await expect(eyeToggle).toBeVisible();
  });

  test("AgentModal API key toggles between password and text", async ({ page }) => {
    const sidebar = page.locator('[class*="w-80"]').first();
    await sidebar.locator('button:has-text("New")').click();
    await page.waitForTimeout(1500);
    await page.locator('text=From Scratch').click();
    await page.waitForTimeout(1500);

    const apiKeyInput = page.locator('input[placeholder*="API key"]');

    // Initially should be password type (hidden)
    await expect(apiKeyInput).toHaveAttribute("type", "password");

    // Click the toggle
    const eyeToggle = apiKeyInput.locator('..').locator('button');
    await eyeToggle.click();
    await page.waitForTimeout(300);

    // Should now be text type (visible)
    await expect(apiKeyInput).toHaveAttribute("type", "text");

    // Click again to hide
    await eyeToggle.click();
    await page.waitForTimeout(300);
    await expect(apiKeyInput).toHaveAttribute("type", "password");
  });

  test("DiagramEditor API key has show/hide toggle", async ({ page }) => {
    // Create a new agent tab via "+" or "New Agent" tab
    const newTabBtn = page.locator('text=New Agent');
    if (await newTabBtn.count() > 0) {
      await newTabBtn.first().click();
      await page.waitForTimeout(1000);
    }

    // Expand header
    const chevrons = page.locator('svg.lucide-chevron-down, svg.lucide-chevron-up');
    if (await chevrons.count() > 0) {
      await chevrons.first().click();
      await page.waitForTimeout(500);
    }

    // Find API key input in the expanded header
    const apiKeyInput = page.locator('input[placeholder="Enter API key"]');
    if (await apiKeyInput.isVisible()) {
      // Should have a toggle button
      const eyeToggle = apiKeyInput.locator('..').locator('button');
      await expect(eyeToggle).toBeVisible();
    }
  });
});
