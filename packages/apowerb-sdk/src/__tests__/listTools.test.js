import { afterEach, describe, expect, it, vi } from "vitest";

import { listTools } from "../api.js";

function mockFetch(payload = {}) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  });
  globalThis.fetch = fetchMock;
  return fetchMock;
}

describe("listTools", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps the plain catalogue request by default", async () => {
    const fetchMock = mockFetch({});
    await listTools();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/tools");
  });

  it("asks the core for needs_config when includeStatus is set", async () => {
    const fetchMock = mockFetch({});
    await listTools({ includeStatus: true });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/tools?include_status=true");
  });
});
