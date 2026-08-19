/**
 * Le lien partagé doit porter son identifiant.
 *
 * `params` est une Promise : `params.shareId` rendait `undefined`, et l'appel
 * partait vers `/api/conversations/share/undefined`. Même défaut que le proxy
 * du panneau de contrôle — trouvé en auditant tous les handlers après lui.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const proxyToBackend = vi.fn(() => new Response("ok"));
vi.mock("@/lib/proxy", () => ({ proxyToBackend: (...a) => proxyToBackend(...a) }));

const { GET } = await import("../share/[shareId]/route.js");

describe("proxy des conversations partagées", () => {
  beforeEach(() => proxyToBackend.mockClear());

  it("transmet l'identifiant de partage", async () => {
    await GET(new Request("http://x/api/conversations/share/abc123"), {
      params: Promise.resolve({ shareId: "abc123" }),
    });
    expect(proxyToBackend.mock.calls[0][1]).toBe("/api/conversations/share/abc123");
  });

  it("n'envoie jamais `undefined` à la place", async () => {
    await GET(new Request("http://x/api/conversations/share/abc123"), {
      params: Promise.resolve({ shareId: "abc123" }),
    });
    expect(proxyToBackend.mock.calls[0][1]).not.toContain("undefined");
  });
});
