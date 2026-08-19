/**
 * Le sous-chemin doit arriver au backend.
 *
 * `params` est une **Promise** dans cette version de Next. La déstructurer
 * directement rend `undefined`, un `?? []` transforme ça en tableau vide, et
 * l'URL construite devient `/api/admin/` — que le backend refuse en 404.
 *
 * Le symptôme est trompeur : les quatre routes du panneau rendent le MÊME 404,
 * ce qui se lit comme « le backend n'a pas ces routes » alors qu'il les a.
 * Mesuré sur l'image publiée 0.2.5 : `/api/admin/` → 404, `/api/admin/users`
 * → 401. Le handler voisin `tools/[...path]` faisait déjà `params.then(...)`.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const proxyToBackend = vi.fn(() => new Response("ok"));
vi.mock("@/lib/proxy", () => ({ proxyToBackend: (...a) => proxyToBackend(...a) }));

const { GET, POST, DELETE } = await import("../[...path]/route.js");

describe("proxy du panneau de contrôle", () => {
  beforeEach(() => proxyToBackend.mockClear());

  it("transmet un sous-chemin simple", async () => {
    await GET(new Request("http://x/api/admin/users"), {
      params: Promise.resolve({ path: ["users"] }),
    });
    expect(proxyToBackend.mock.calls[0][1]).toBe("/api/admin/users");
  });

  it("transmet un sous-chemin imbriqué", async () => {
    await DELETE(new Request("http://x/api/admin/groups/7/members/3"), {
      params: Promise.resolve({ path: ["groups", "7", "members", "3"] }),
    });
    expect(proxyToBackend.mock.calls[0][1]).toBe("/api/admin/groups/7/members/3");
  });

  it("n'envoie JAMAIS `/api/admin/` tout court", async () => {
    // Le bug exact : c'est ce que produisait la déstructuration synchrone.
    await POST(new Request("http://x/api/admin/users"), {
      params: Promise.resolve({ path: ["users"] }),
    });
    expect(proxyToBackend.mock.calls[0][1]).not.toBe("/api/admin/");
  });
});
