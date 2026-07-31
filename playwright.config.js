import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60000,
  retries: 1,
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
    viewport: { width: 1400, height: 900 },
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  webServer: undefined,
});
