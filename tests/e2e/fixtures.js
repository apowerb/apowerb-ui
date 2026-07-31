import { expect } from "@playwright/test";

const TEST_EMAIL = process.env.E2E_TEST_EMAIL || "e2e-test@th2ai.com";
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;

if (!TEST_PASSWORD) {
  throw new Error("E2E_TEST_PASSWORD environment variable is required");
}

/**
 * Perform UI login and wait for redirect away from /login.
 */
export async function login(page) {
  await page.goto("/login");
  await page.waitForSelector('button:has-text("Sign In")');
  await page.click('button:has-text("Sign In")');

  await page.waitForSelector('input[type="email"]');
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');

  await page.waitForFunction(() => !window.location.pathname.startsWith("/login"), {
    timeout: 15000,
  });
}

/**
 * Create a test agent via the backend API.
 * Returns the created agent object.
 */
export async function createTestAgent(page, name) {
  const cookies = await page.context().cookies();
  const tokenCookie = cookies.find((c) => c.name === "th2_token");
  const token = tokenCookie ? tokenCookie.value : "";

  const response = await page.request.post("http://localhost:8000/api/agents", {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    data: {
      agent_name: name,
      agent_type: "base",
      agent_model: "gemini-2.0-flash",
      agent_description: `E2E test agent: ${name}`,
      agent_instruction: "You are a test agent.",
    },
  });

  expect(response.ok()).toBeTruthy();
  return response.json();
}

/**
 * Delete all agents belonging to the test user via API.
 */
export async function cleanupAgents(page) {
  const cookies = await page.context().cookies();
  const tokenCookie = cookies.find((c) => c.name === "th2_token");
  const token = tokenCookie ? tokenCookie.value : "";

  const listResponse = await page.request.get("http://localhost:8000/api/agents", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!listResponse.ok()) return;

  const agents = await listResponse.json();
  for (const agent of agents) {
    await page.request.delete(`http://localhost:8000/api/agents/${agent.agent_id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }
}
