/**
 * Session check errors carry the HTTP status. Without it the app cannot tell
 * a refused token (401/403, sign in again) from an API that is briefly down
 * (5xx, the session stays).
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { realAuthApi } from "../authStorage.js";

function respondWith(status) {
  global.fetch = vi.fn(async () => ({ ok: false, status, json: async () => ({}) }));
}

afterEach(() => {
  vi.restoreAllMocks();
  delete global.fetch;
});

async function statusOf(promise) {
  try {
    await promise;
  } catch (err) {
    return err.status;
  }
  throw new Error("the promise should have been rejected");
}

describe("HTTP status of session errors", () => {
  it.each([401, 403, 502, 503])("getProfile %i", async (status) => {
    respondWith(status);
    expect(await statusOf(realAuthApi.getProfile("tok"))).toBe(status);
  });

  it.each([401, 503])("refreshToken %i", async (status) => {
    respondWith(status);
    expect(await statusOf(realAuthApi.refreshToken())).toBe(status);
  });
});
