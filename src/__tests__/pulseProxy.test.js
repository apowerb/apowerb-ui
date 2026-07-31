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

  it("forces the verified user's scope for non-admins, overriding client input", async () => {
    fetch
      .mockResolvedValueOnce(jsonResponse({ email: "alice@x.io", role: "user" }))
      .mockResolvedValueOnce(jsonResponse({ count: 0, logs: [] }));

    const res = await pulseProxy(
      req("/api/logging/logs?user_id=victim@x.io&conversation_id=c1"),
      "/logs",
    );
    expect(res.status).toBe(200);
    const target = new URL(fetch.mock.calls[1][0]);
    expect(target.searchParams.get("user_id")).toBe("alice@x.io");
    expect(target.searchParams.get("conversation_id")).toBe("c1");
  });

  it("does not scope admins", async () => {
    fetch
      .mockResolvedValueOnce(jsonResponse({ email: "root@x.io", role: "ADMIN" }))
      .mockResolvedValueOnce(jsonResponse({ count: 0, logs: [] }));

    await pulseProxy(req("/api/logging/conversations"), "/conversations");
    const target = new URL(fetch.mock.calls[1][0]);
    expect(target.searchParams.get("user_id")).toBeNull();
  });

  it("denies non-admin identities without an email", async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ role: "user" }));
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
    fetch
      .mockResolvedValueOnce(jsonResponse({ email: "alice@x.io", role: "user" }))
      .mockResolvedValueOnce(jsonResponse({ id: 1 }));

    const res = await pulseProxyWrite(
      writeReq({ conversation_id: "c1", note: "hi", author: "spoof@x.io" }),
      "/annotations",
    );
    expect(res.status).toBe(200);
    const [target, init] = fetch.mock.calls[1];
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body).author).toBe("alice@x.io");
    expect(new URL(target).searchParams.get("user_id")).toBe("alice@x.io");
  });

  it("rejects invalid JSON bodies", async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ email: "a@x.io", role: "user" }));
    const bad = new Request("http://front.local/api/logging/annotations", {
      method: "POST",
      headers: { authorization: "Bearer tok" },
      body: "{oops",
    });
    expect((await pulseProxyWrite(bad, "/annotations")).status).toBe(400);
  });
});
