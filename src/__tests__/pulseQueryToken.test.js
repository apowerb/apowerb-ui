import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The ingest is not the loopback-only service this proxy was written against.
 *
 * th2pulse binds 0.0.0.0 inside its container and refuses to start without
 * TH2PULSE_QUERY_TOKEN; the read endpoints answer 401 to anyone who does not
 * present it. Measured on 04/09/2026 against apowerb/th2pulse:0.1.4 — with
 * PULSE_API_URL correctly set, the Logging screen still got
 * `401 missing or invalid query token`, because this proxy sent no token at all.
 *
 * The header is `x-th2pulse-query-token`. Do not confuse it with
 * `x-th2pulse-token`, which authenticates the *write* side (OTLP ingest) and
 * is the collector's business, not the front's.
 */

function req(path = "/api/logging/logs", auth = "Bearer tok") {
  const headers = auth ? { authorization: auth } : {};
  return new Request(`http://front.local${path}`, { headers });
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const ADMIN = { email: "a@example.com", role: "ADMIN" };

/** Headers the proxy sent on its Nth fetch call (0 = the identity check). */
function sentHeaders(callIndex = 1) {
  const init = fetch.mock.calls[callIndex]?.[1] || {};
  return new Headers(init.headers || {});
}

describe("pulse proxy: query token", () => {
  let pulse;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn());
    process.env.PULSE_QUERY_TOKEN = "s3cret-query";
    pulse = await import("@/lib/pulse");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PULSE_QUERY_TOKEN;
  });

  it("sends the query token to the ingest on reads", async () => {
    fetch.mockResolvedValueOnce(jsonResponse(ADMIN));
    fetch.mockResolvedValueOnce(jsonResponse({ count: 0, logs: [] }));

    await pulse.pulseProxy(req(), "/logs");

    expect(sentHeaders().get("x-th2pulse-query-token")).toBe("s3cret-query");
  });

  it("sends the query token on writes too", async () => {
    fetch.mockResolvedValueOnce(jsonResponse(ADMIN));
    fetch.mockResolvedValueOnce(jsonResponse({ ok: true }));

    const request = new Request("http://front.local/api/logging/annotations", {
      method: "POST",
      headers: { authorization: "Bearer tok", "content-type": "application/json" },
      body: JSON.stringify({ note: "hello" }),
    });
    await pulse.pulseProxyWrite(request, "/annotations");

    expect(sentHeaders().get("x-th2pulse-query-token")).toBe("s3cret-query");
  });

  it("never leaks the query token to the application backend", async () => {
    // The identity check goes to the FastAPI backend, a different service.
    fetch.mockResolvedValueOnce(jsonResponse(ADMIN));
    fetch.mockResolvedValueOnce(jsonResponse({ count: 0, logs: [] }));

    await pulse.pulseProxy(req(), "/logs");

    expect(sentHeaders(0).get("x-th2pulse-query-token")).toBeNull();
  });

  it("does not send the ingest write token under any name", async () => {
    // `x-th2pulse-token` authenticates OTLP ingestion. A read proxy holding it
    // could forge telemetry; it has no business carrying it.
    fetch.mockResolvedValueOnce(jsonResponse(ADMIN));
    fetch.mockResolvedValueOnce(jsonResponse({ count: 0, logs: [] }));

    await pulse.pulseProxy(req(), "/logs");

    expect(sentHeaders().get("x-th2pulse-token")).toBeNull();
  });
});

describe("pulse proxy: no query token configured", () => {
  let pulse;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn());
    delete process.env.PULSE_QUERY_TOKEN;
    pulse = await import("@/lib/pulse");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("still forwards the request, so an unauthenticated ingest keeps working", async () => {
    // An ingest started without a token accepts reads. Refusing here would
    // break a working deployment to protect it from a service that does not
    // ask for protection.
    fetch.mockResolvedValueOnce(jsonResponse(ADMIN));
    fetch.mockResolvedValueOnce(jsonResponse({ count: 0, logs: [] }));

    const res = await pulse.pulseProxy(req(), "/logs");

    expect(res.status).toBe(200);
    expect(sentHeaders().has("x-th2pulse-query-token")).toBe(false);
  });
});
