import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pulseProxy, pulseProxyWrite } from "@/lib/pulse";

function req(path = "/api/logging/logs?conversation_id=c1", auth = "Bearer tok") {
  const headers = auth ? { authorization: auth } : {};
  return new Request(`http://front.local${path}`, { headers });
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("pulseProxy", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects requests without a bearer token", async () => {
    const res = await pulseProxy(req("/x", null), "/logs");
    expect(res.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("propagates auth failures from the backend", async () => {
    fetch.mockResolvedValueOnce(jsonResponse({}, 401));
    const res = await pulseProxy(req(), "/logs");
    expect(res.status).toBe(401);
  });

  it("maps backend outages to 502, not an auth error", async () => {
    fetch.mockResolvedValueOnce(jsonResponse({}, 500));
    expect((await pulseProxy(req(), "/logs")).status).toBe(502);

    fetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    expect((await pulseProxy(req(), "/logs")).status).toBe(502);
  });

  it("refuses non-admins outright, and never reaches the ingest", async () => {
    // Was: scoped to their own user_id. That filter matched nothing, because
    // application logs carry no user attribute — every non-admin got an
    // empty 200 that read exactly like an outage.
    fetch.mockResolvedValueOnce(jsonResponse({ email: "alice@x.io", role: "user" }));

    const res = await pulseProxy(req(), "/logs");

    expect(res.status).toBe(403);
    expect(fetch).toHaveBeenCalledTimes(1); // identity check only
  });

  it("tells a refused user why, instead of showing them nothing", async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ email: "alice@x.io", role: "user" }));
    const body = await (await pulseProxy(req(), "/logs")).json();
    expect(body.detail).toMatch(/administrator/i);
  });

  it("passes an admin's query through untouched", async () => {
    fetch
      .mockResolvedValueOnce(jsonResponse({ email: "root@x.io", role: "ADMIN" }))
      .mockResolvedValueOnce(jsonResponse({ count: 0, logs: [] }));

    await pulseProxy(
      req("/api/logging/logs?user_id=someone@x.io&conversation_id=c1"),
      "/logs",
    );
    const target = new URL(fetch.mock.calls[1][0]);
    // An admin's own filters are theirs to set; nothing is forced or removed.
    expect(target.searchParams.get("user_id")).toBe("someone@x.io");
    expect(target.searchParams.get("conversation_id")).toBe("c1");
  });

  it("denies an identity carrying no role at all", async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ email: "nobody@x.io" }));
    expect((await pulseProxy(req(), "/logs")).status).toBe(403);
  });
});

describe("pulseProxyWrite", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function writeReq(body) {
    return new Request("http://front.local/api/logging/annotations", {
      method: "POST",
      headers: { authorization: "Bearer tok", "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("forces the verified identity as author, overriding any client value", async () => {
    // Only admins get here now, but an admin does not sign as someone else.
    fetch
      .mockResolvedValueOnce(jsonResponse({ email: "root@x.io", role: "ADMIN" }))
      .mockResolvedValueOnce(jsonResponse({ id: 1 }));

    const res = await pulseProxyWrite(
      writeReq({ conversation_id: "c1", note: "hi", author: "spoof@x.io" }),
      "/annotations",
    );
    expect(res.status).toBe(200);
    const [, init] = fetch.mock.calls[1];
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body).author).toBe("root@x.io");
  });

  it("refuses a non-admin write before reading the body", async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ email: "alice@x.io", role: "user" }));
    const res = await pulseProxyWrite(
      writeReq({ conversation_id: "c1", note: "hi" }),
      "/annotations",
    );
    expect(res.status).toBe(403);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid JSON bodies", async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ email: "a@x.io", role: "ADMIN" }));
    const bad = new Request("http://front.local/api/logging/annotations", {
      method: "POST",
      headers: { authorization: "Bearer tok" },
      body: "{oops",
    });
    expect((await pulseProxyWrite(bad, "/annotations")).status).toBe(400);
  });
});
