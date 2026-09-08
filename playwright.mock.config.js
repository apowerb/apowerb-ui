import { defineConfig } from "@playwright/test";

/**
 * End-to-end run of the chat against the mock backend — no real API, no LLM,
 * no credentials. Start the two servers first:
 *
 *   node tests/mock-backend/server.mjs 8100
 *   API_URL=http://127.0.0.1:8100 NEXT_PUBLIC_API_URL=http://localhost:8100 npx next dev -p 3100
 *
 * then: npx playwright test -c playwright.mock.config.js
 */
export default defineConfig({
  testDir: "./tests/e2e-mock",
  timeout: 90_000,
  retries: 0,
  workers: 1,
  outputDir: "tests/e2e-mock/.results",
  use: {
    baseURL: process.env.E2E_MOCK_BASE_URL || "http://127.0.0.1:3100",
    headless: true,
    viewport: { width: 1440, height: 900 },
    screenshot: "only-on-failure",
  },
  webServer: undefined,
});
