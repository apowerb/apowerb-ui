/**
 * SDK client for the `form`-kind workflow trigger's public page (T2):
 * `GET /api/hooks/forms/{token}` (definition) and `POST` (submission).
 * Both use `silent401`, like the other public-page endpoints below in
 * `api.js` (public dashboards, public chart data) — this page is never
 * wrapped in `AuthProvider`, so a stray 401 here must not clear another
 * tab's auth state or dispatch the app-wide `auth:unauthorized` event.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetClientConfig, configureClient } from "../config.js";
import { getWorkflowFormDefinition, submitWorkflowForm } from "../api.js";

function mockFetchOnce(payload = {}, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status < 400,
    status,
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

describe("getWorkflowFormDefinition", () => {
  it("GETs the public form definition by token", async () => {
    const fetchMock = mockFetchOnce({
      title: "Onboarding",
      description: null,
      fields: [{ name: "email", label: "Email", type: "text", required: true, options: null }],
      access: "public",
    });

    const def = await getWorkflowFormDefinition("tok123");

    expect(fetchMock.mock.calls[0][0]).toBe("/api/hooks/forms/tok123");
    expect(def.title).toBe("Onboarding");
  });

  it("throws with status 404 for an unknown or inactive token, without clearing auth", async () => {
    mockFetchOnce({}, 404);
    const onUnauthorized = vi.fn();
    configureClient({ onUnauthorized });

    await expect(getWorkflowFormDefinition("missing")).rejects.toMatchObject({ status: 404 });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("throws with status 401 when access is authenticated and no session is present, without clearing auth (silent401)", async () => {
    mockFetchOnce({}, 401);
    const onUnauthorized = vi.fn();
    configureClient({ onUnauthorized });

    await expect(getWorkflowFormDefinition("tok123")).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});

describe("submitWorkflowForm", () => {
  it("POSTs the field values as the JSON body and returns {run_id} on 202", async () => {
    const fetchMock = mockFetchOnce({ run_id: "run_1" }, 202);

    const result = await submitWorkflowForm("tok123", { email: "a@b.com" });

    expect(fetchMock.mock.calls[0][0]).toBe("/api/hooks/forms/tok123");
    const init = fetchMock.mock.calls[0][1];
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ email: "a@b.com" });
    expect(result.run_id).toBe("run_1");
  });

  it("throws with status 422 and the server detail on validation failure", async () => {
    mockFetchOnce({ detail: "email is required" }, 422);

    await expect(submitWorkflowForm("tok123", { email: "" })).rejects.toMatchObject({
      status: 422,
      message: "email is required",
    });
  });

  it("throws with status 401 without clearing auth (silent401)", async () => {
    mockFetchOnce({}, 401);
    const onUnauthorized = vi.fn();
    configureClient({ onUnauthorized });

    await expect(submitWorkflowForm("tok123", {})).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
