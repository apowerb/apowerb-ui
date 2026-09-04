/**
 * Les routes `/api/v1/*` doivent atteindre le backend.
 *
 * Ce préfixe n'avait AUCUN handler. Les appels tombaient donc sur le rewrite
 * `fallback` de `next.config.mjs`, dont la destination est figée au build par
 * `output: "standalone"` : `http://localhost:8000`. Dans le conteneur du front,
 * c'est le conteneur lui-même, où rien n'écoute.
 *
 * Mesuré le 04/09 sur la paire publiée `apowerb-ui:0.1.12` + `apowerb:0.2.8` :
 *
 *   backend seul   /api/v1/dashboards        401   (la route existe)
 *                  /api/v1/nope-invente      404   (témoin négatif)
 *   via le front   /api/v1/dashboards        500   "Internal Server Error"
 *                  /api/v1/nope-invente      500   (même un chemin inventé)
 *                  /api/agents               401   (le préfixe /api/ marche)
 *
 * et dans les journaux du front :
 *   Failed to proxy http://localhost:8000/api/v1/dashboards
 *   AggregateError: ECONNREFUSED ::1:8000, 127.0.0.1:8000
 *
 * Conséquence : sur TOUTE installation où le front et le backend ne sont pas
 * dans le même conteneur -- donc tout déploiement Compose -- l'intégralité des
 * écrans BI est morte : tableaux de bord, graphiques, jeux de données,
 * import CSV. « On ne peut pas créer de tableau de bord » était ceci.
 *
 * ⚠️ Le piège se reproduira pour le PROCHAIN préfixe ajouté au backend : tant
 * que le rewrite `fallback` existe, un préfixe sans handler ne rend pas 404,
 * il rend 500 -- une panne qui ressemble à un backend cassé alors que l'appel
 * n'est jamais parti.
 *
 * `params` est une Promise dans cette version de Next : la déstructurer
 * directement rend `undefined` et l'URL perd son sous-chemin
 * (cf `admin/__tests__/adminProxyPath.test.js`).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const proxyToBackend = vi.fn(() => new Response("ok"));
vi.mock("@/lib/proxy", () => ({ proxyToBackend: (...a) => proxyToBackend(...a) }));

const { GET, POST, PUT, PATCH, DELETE } = await import("../[...path]/route.js");

describe("proxy des routes /api/v1", () => {
  beforeEach(() => proxyToBackend.mockClear());

  it("transmet un sous-chemin simple", async () => {
    await GET(new Request("http://x/api/v1/dashboards"), {
      params: Promise.resolve({ path: ["dashboards"] }),
    });
    expect(proxyToBackend.mock.calls[0][1]).toBe("/api/v1/dashboards");
  });

  it("transmet la création d'un tableau de bord", async () => {
    await POST(new Request("http://x/api/v1/dashboards"), {
      params: Promise.resolve({ path: ["dashboards"] }),
    });
    expect(proxyToBackend.mock.calls[0][1]).toBe("/api/v1/dashboards");
  });

  it("transmet un sous-chemin imbriqué", async () => {
    await DELETE(new Request("http://x/api/v1/dashboards/7/components/3"), {
      params: Promise.resolve({ path: ["dashboards", "7", "components", "3"] }),
    });
    expect(proxyToBackend.mock.calls[0][1]).toBe("/api/v1/dashboards/7/components/3");
  });

  it("couvre les autres familles BI, pas seulement les tableaux de bord", async () => {
    await GET(new Request("http://x/api/v1/bi/stats"), {
      params: Promise.resolve({ path: ["bi", "stats"] }),
    });
    expect(proxyToBackend.mock.calls[0][1]).toBe("/api/v1/bi/stats");

    await PUT(new Request("http://x/api/v1/charts/9"), {
      params: Promise.resolve({ path: ["charts", "9"] }),
    });
    expect(proxyToBackend.mock.calls[1][1]).toBe("/api/v1/charts/9");
  });

  it("n'envoie JAMAIS `/api/v1/` tout court", async () => {
    // Le bug exact que produirait une déstructuration synchrone de `params`.
    await PATCH(new Request("http://x/api/v1/dashboards/7"), {
      params: Promise.resolve({ path: ["dashboards", "7"] }),
    });
    expect(proxyToBackend.mock.calls[0][1]).not.toBe("/api/v1/");
    expect(proxyToBackend.mock.calls[0][1]).toBe("/api/v1/dashboards/7");
  });

  it("expose les cinq verbes dont le backend a besoin", () => {
    // POST crée, PATCH renomme, DELETE retire un composant : un handler qui
    // n'exporterait que GET laisserait la lecture marcher et l'écriture non.
    for (const verb of [GET, POST, PUT, PATCH, DELETE]) {
      expect(typeof verb).toBe("function");
    }
  });
});
