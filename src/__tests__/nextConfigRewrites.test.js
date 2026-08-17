import { describe, expect, it } from "vitest";

import config from "../../next.config.mjs";

/**
 * The `/api/*` rewrite is the last-resort proxy to the backend, for paths that
 * have no route handler of their own.
 *
 * Returning it as a bare array makes it an `afterFiles` rewrite, and
 * `afterFiles` is checked BEFORE dynamic routes. Every dynamic handler was
 * therefore shadowed by the rewrite: in a Compose deployment the front proxied
 * `/api/users/me` to the build-time `localhost:8000` -- itself -- and answered
 * 500, so nobody could log in. Static handlers (`/api/agents`) were matched
 * first and worked, which is what made the breakage look random.
 *
 * `fallback` runs after every route, so the handlers win and the rewrite stays
 * available for paths none of them claims.
 */
describe("next.config rewrites", () => {
  it("keeps the /api proxy out of the way of dynamic route handlers", async () => {
    const rewrites = await config.rewrites();

    expect(Array.isArray(rewrites)).toBe(false);
    expect(rewrites.fallback).toEqual([
      expect.objectContaining({ source: "/api/:path*" }),
    ]);
  });

  it("declares nothing in afterFiles or beforeFiles", async () => {
    const rewrites = await config.rewrites();

    expect(rewrites.afterFiles ?? []).toEqual([]);
    expect(rewrites.beforeFiles ?? []).toEqual([]);
  });
});
