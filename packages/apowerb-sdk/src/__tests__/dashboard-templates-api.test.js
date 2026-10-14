import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetClientConfig } from "../config.js";
import { listDashboardTemplates } from "../api.js";

function mockFetchOnce(payload) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(payload),
  });
  globalThis.fetch = fetchMock;
  return fetchMock;
}

beforeEach(() => {
  resetClientConfig();
});

afterEach(() => {
  resetClientConfig();
  vi.restoreAllMocks();
});

describe("listDashboardTemplates", () => {
  it("asks for the templates in the requested language", async () => {
    const fetchMock = mockFetchOnce([]);
    await listDashboardTemplates("en");
    expect(fetchMock.mock.calls[0][0]).toContain("/api/v1/dashboard-templates?lang=en");
  });

  it("defaults to French", async () => {
    const fetchMock = mockFetchOnce([]);
    await listDashboardTemplates();
    expect(fetchMock.mock.calls[0][0]).toContain("/api/v1/dashboard-templates?lang=fr");
  });
});
