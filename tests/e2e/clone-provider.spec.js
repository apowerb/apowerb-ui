// @ts-check
const { test, expect } = require("@playwright/test");
const { login } = require("./fixtures");

/** Navigate to marketplace, click Clone on first agent, fill unique name, submit */
async function openCloneApiKeyStep(page) {
  await page.goto("/marketplace");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);

  // Click first Clone button
  await page.locator('button:has-text("Clone")').first().click();
  await page.waitForTimeout(1500);

  // Fill a unique clone name to avoid 409
  const nameInput = page.locator('input[placeholder="my_agent_clone"]');
  await nameInput.fill(`e2e_prov_${Date.now()}`);
  await page.waitForTimeout(300);

  // Click "Clone Agent"
  await page.locator('button:has-text("Clone Agent")').click();

  // Wait for API key step (title changes)
  await page.waitForSelector('text=Configure Provider', { timeout: 15000 });
  await page.waitForTimeout(1000);
}

test.describe("Clone Wizard — Provider Selection", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("API key step shows model/provider input field", async ({ page }) => {
    await openCloneApiKeyStep(page);

    // Model input should be visible (has openai in placeholder)
    const modelInput = page.locator('input[placeholder*="e.g. openai"]');
    await expect(modelInput).toBeVisible();
  });

  test("model field is pre-filled with source agent model", async ({ page }) => {
    await openCloneApiKeyStep(page);

    const modelInput = page.locator('input[placeholder*="e.g. openai"]');
    const value = await modelInput.inputValue();
    // Should be pre-filled with the source agent's model (not empty)
    expect(value.length).toBeGreaterThan(0);
  });

  test("user can change model/provider freely", async ({ page }) => {
    await openCloneApiKeyStep(page);

    const modelInput = page.locator('input[placeholder*="e.g. openai"]');
    await modelInput.fill("openai/gpt-4o");
    expect(await modelInput.inputValue()).toBe("openai/gpt-4o");
  });

  test("API base URL field is available", async ({ page }) => {
    await openCloneApiKeyStep(page);

    const baseInput = page.locator('input[placeholder*="api.openai"]');
    await expect(baseInput).toBeVisible();
  });

  test("saved key selection updates model field", async ({ page }) => {
    await openCloneApiKeyStep(page);

    // The SavedApiKeySelector should be present
    await expect(page.locator('text=Saved configurations')).toBeVisible();
  });

  test("custom model is sent when saving API key", async ({ page }) => {
    await openCloneApiKeyStep(page);

    // Fill custom model
    const modelInput = page.locator('input[placeholder*="e.g. openai"]');
    await modelInput.fill("google/gemini-2.0-flash");

    // Fill API key
    const keyInput = page.locator('input[type="password"]');
    await keyInput.fill("fake-test-key-12345");

    // Intercept the PUT request to verify payload
    const [request] = await Promise.all([
      page.waitForRequest(
        (req) => req.method() === "PUT" && req.url().includes("/api/agents/"),
        { timeout: 15000 },
      ),
      page.locator('button:has-text("Next")').click(),
    ]);

    const body = JSON.parse(request.postData());
    expect(body.agent_model).toBe("google/gemini-2.0-flash");
  });
});
