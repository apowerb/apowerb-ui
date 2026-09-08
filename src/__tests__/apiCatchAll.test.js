/**
 * The `/api/[...path]` catch-all: every path no dedicated handler claims is
 * proxied at runtime, never left to the build-frozen rewrite.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const proxyToBackend = vi.fn(async () => new Response("ok", { status: 200 }));
vi.mock("@/lib/proxy", () => ({ proxyToBackend: (...a) => proxyToBackend(...a) }));

import * as route from "@/app/api/[...path]/route";

describe("/api/[...path] catch-all", () => {
  beforeEach(() => proxyToBackend.mockClear());

  it("forwards the full sub-path, for every method", async () => {
    for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
      const req = new Request("http://front/api/tools_config/3?x=1", { method, body: method === "GET" ? undefined : "{}" });
      const res = await route[method](req, { params: Promise.resolve({ path: ["tools_config", "3"] }) });
      expect(res.status).toBe(200);
      expect(proxyToBackend).toHaveBeenLastCalledWith(req, "/api/tools_config/3");
    }
    expect(proxyToBackend).toHaveBeenCalledTimes(5);
  });

  it("keeps mcp_configs and artifacts on the runtime proxy", async () => {
    await route.GET(new Request("http://front/api/mcp_configs"), { params: Promise.resolve({ path: ["mcp_configs"] }) });
    expect(proxyToBackend).toHaveBeenLastCalledWith(expect.anything(), "/api/mcp_configs");
    await route.POST(new Request("http://front/api/artifacts/a/u/s", { method: "POST", body: "{}" }), { params: Promise.resolve({ path: ["artifacts", "a", "u", "s"] }) });
    expect(proxyToBackend).toHaveBeenLastCalledWith(expect.anything(), "/api/artifacts/a/u/s");
  });
});
