import { test as setup, expect } from "@playwright/test";
import { login } from "./fixtures.js";

const AUTH_STATE_PATH = "tests/e2e/.auth-state.json";

setup("authenticate and save state", async ({ page }) => {
  await login(page);

  await expect(page).not.toHaveURL(/\/login/);

  await page.context().storageState({ path: AUTH_STATE_PATH });
});
