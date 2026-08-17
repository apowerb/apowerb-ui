import { describe, expect, it, vi, afterEach } from "vitest";

import { proxyToBackend } from "../proxy";

/**
 * Signing up through the interface answered 502 and failed silently. The cause
 * was not the network:
 *
 *   TypeError: Cannot perform ArrayBuffer.prototype.slice on a detached
 *              ArrayBuffer
 *
 * The backend answers `307` on `POST /api/users` and redirects to
 * `/api/users/`. fetch follows the redirect, which means REPLAYING the body --
 * and a bare `ArrayBuffer` has been detached by the first send, so the replay
 * throws. `/api/auth/token` never redirects, which is why login worked and
 * sign-up did not.
 *
 * A view (Buffer / Uint8Array) survives the replay. These tests pin the shape
 * of the forwarded body, because passing `arrayBuffer()` straight through looks
 * equivalent and breaks every redirected POST.
 */
afterEach(() => {
  vi.unstubAllGlobals();
});

function capture(status = 200) {
  const seen = {};
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, init) => {
      seen.url = url;
      seen.init = init;
      return new Response("{}", {
        status,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
  return seen;
}

describe("proxyToBackend body forwarding", () => {
  it("forwards a replayable body, not a bare ArrayBuffer", async () => {
    const seen = capture();
    const request = new Request("http://front/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "a@b.c" }),
    });

    await proxyToBackend(request, "/api/users/");

    const { body } = seen.init;
    expect(body).not.toBeNull();
    // The regression: an ArrayBuffer cannot be replayed on a redirect.
    expect(body instanceof ArrayBuffer).toBe(false);
    expect(ArrayBuffer.isView(body)).toBe(true);
    expect(Buffer.from(body).toString()).toBe(JSON.stringify({ email: "a@b.c" }));
  });

  it("survives being read twice, the way a redirect replay does", async () => {
    const seen = capture();
    const request = new Request("http://front/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "a@b.c" }),
    });

    await proxyToBackend(request, "/api/users/");

    const { body } = seen.init;
    const first = Buffer.from(body).toString();
    const second = Buffer.from(body).toString();
    expect(second).toBe(first);
    expect(second).not.toBe("");
  });

  it("still sends no body on GET", async () => {
    const seen = capture();
    const request = new Request("http://front/api/users/me", { method: "GET" });

    await proxyToBackend(request, "/api/users/me");

    expect(seen.init.body).toBeNull();
  });
});

describe("proxyToBackend redirect handling", () => {
  it("follows the backend's 307 itself, with the body intact", async () => {
    const bodies = [];
    const urls = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url, init) => {
        urls.push(String(url));
        bodies.push(init.body ? Buffer.from(init.body).toString() : null);
        // First hop: what the backend really answers on POST /api/users.
        if (urls.length === 1) {
          return new Response(null, {
            status: 307,
            headers: { location: "http://localhost:8000/api/users/" },
          });
        }
        return new Response('{"user_id":1}', {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );

    const payload = JSON.stringify({ email: "a@b.c", password: "secret" });
    const request = new Request("http://front/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    });

    const res = await proxyToBackend(request, "/api/users");

    expect(res.status).toBe(201);
    expect(urls).toEqual([
      "http://localhost:8000/api/users",
      "http://localhost:8000/api/users/",
    ]);
    // The whole point: the replayed body is intact, not empty and not detached.
    expect(bodies[1]).toBe(payload);
  });

  it("refuses to follow a redirect off the backend", async () => {
    const urls = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        urls.push(String(url));
        return new Response(null, {
          status: 307,
          headers: { location: "http://evil.example.com/steal" },
        });
      }),
    );

    const request = new Request("http://front/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "secret" }),
    });

    await proxyToBackend(request, "/api/users");

    // One call only: a redirect is attacker-influencable, so leaving the
    // backend's origin must never be followed -- that would make this proxy an
    // open relay carrying the caller's credentials.
    expect(urls).toEqual(["http://localhost:8000/api/users"]);
  });
});
