/**
 * Session identifiers must be unpredictable, and must keep working where
 * `crypto.randomUUID` is not available.
 *
 * `Math.random()` used to build these, and they travel to the backend as
 * `session_id` (CodeQL: js/insecure-randomness). The backend scopes sessions
 * to the authenticated user, so this was never an access flaw -- but a
 * predictable identifier still collides, and there is no reason to keep one.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { newSessionId } from "../ids";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("newSessionId", () => {
  it("keeps the prefix the backend expects", () => {
    expect(newSessionId()).toMatch(/^sess_/);
  });

  it("carries 128 bits of randomness", () => {
    const token = newSessionId().slice("sess_".length);
    expect(token).toHaveLength(32);
    expect(token).toMatch(/^[0-9a-f]+$/);
  });

  it("does not repeat itself", () => {
    const ids = new Set(Array.from({ length: 500 }, () => newSessionId()));
    expect(ids.size).toBe(500);
  });

  it("never calls Math.random", () => {
    const spy = vi.spyOn(Math, "random");
    newSessionId();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("falls back to getRandomValues outside a secure context", () => {
    // `crypto.randomUUID` is undefined over plain http, which is exactly
    // where a silent fallback to a weak source would go unnoticed.
    const getRandomValues = vi.fn((bytes) => {
      bytes.forEach((_, i) => {
        bytes[i] = i;
      });
      return bytes;
    });
    vi.stubGlobal("crypto", { getRandomValues });

    const id = newSessionId();

    expect(getRandomValues).toHaveBeenCalledOnce();
    expect(id).toBe("sess_000102030405060708090a0b0c0d0e0f");
  });
});
