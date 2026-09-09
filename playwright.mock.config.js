import { defineConfig } from "@playwright/test";

/**
 * End-to-end run of the chat against the mock backend — no real API, no LLM,
 * no credentials, nothing to install beyond this repository.
 *
 *   npx playwright test -c playwright.mock.config.js
 *
 * The two servers below are started by Playwright itself. They used to be
 * started by hand, which is why this ran nowhere: eight Playwright
 * specifications existed in this repository and the CI called Playwright zero
 * times. A suite whose first step is a paragraph of instructions is a suite
 * nobody runs.
 *
 * `next dev` and not `next build && next start`: `NEXT_PUBLIC_API_URL` is
 * inlined at BUILD time, so a build would have to be redone for the mock's
 * address and could not reuse the one the Build job already produces. The
 * screen under test is the same either way.
 */

const MOCK_PORT = 8100;
const APP_PORT = 3100;
// `localhost` and not `127.0.0.1`, everywhere. Next 16's dev server treats
// them as different origins and BLOCKS its own chunks when the browser asks
// on the address it did not announce -- the page then loads with no
// JavaScript at all, and every assertion fails on a screen that renders.
const API_URL = `http://localhost:${MOCK_PORT}`;

export default defineConfig({
  testDir: "./tests/e2e-mock",
  timeout: 90_000,
  retries: 0,
  workers: 1,
  outputDir: "tests/e2e-mock/.results",
  // On a fresh machine the first `next dev` compile is the slow part, and it
  // happens before the first assertion rather than during it.
  webServer: [
    {
      command: `node tests/mock-backend/server.mjs ${MOCK_PORT}`,
      url: `${API_URL}/api/agents`,
      timeout: 30_000,
      reuseExistingServer: !process.env.CI,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: `npx next dev -p ${APP_PORT}`,
      url: `http://localhost:${APP_PORT}/login`,
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        API_URL,
        NEXT_PUBLIC_API_URL: API_URL,
        NEXT_TELEMETRY_DISABLED: "1",
      },
    },
  ],
  use: {
    baseURL: process.env.E2E_MOCK_BASE_URL || `http://localhost:${APP_PORT}`,
    headless: true,
    viewport: { width: 1440, height: 900 },
    screenshot: "only-on-failure",
    trace: process.env.CI ? "retain-on-failure" : "off",
  },
});
