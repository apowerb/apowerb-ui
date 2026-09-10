/**
 * Le maillon qui relie un signalement aux logs du serveur.
 *
 * Le serveur pose `X-Request-ID` sur chaque réponse ; le client doit le
 * relever et le rendre avec le signalement, sinon le serveur n'a aucun
 * moyen de retrouver les lignes de log de CET appel — et le rapport
 * repart avec « ça a planté » pour toute preuve.
 *
 * C'est testé sur le client d'API réel, pas sur une copie : la capture
 * est branchée dans `request()`, le point de passage unique des 75
 * modules qui appellent l'API.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listAgents, resetDiagnostics, snapshot } from "@/lib/api";

function reponse(body, { status = 200, requestId = null } = {}) {
  const headers = new Headers({ "content-type": "application/json" });
  if (requestId) headers.set("X-Request-ID", requestId);
  return new Response(JSON.stringify(body), { status, headers });
}

describe("corrélation client ↔ serveur", () => {
  beforeEach(() => {
    resetDiagnostics();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetDiagnostics();
  });

  it("relève le X-Request-ID de la réponse", async () => {
    fetch.mockResolvedValue(reponse([], { requestId: "abc123def456" }));
    await listAgents();

    const [appel] = snapshot().api_calls;
    expect(appel.request_id).toBe("abc123def456");
    expect(appel.status).toBe(200);
  });

  it("enregistre aussi l'appel qui a échoué — c'est celui qui compte", async () => {
    fetch.mockResolvedValue(
      reponse({ detail: "boom" }, { status: 500, requestId: "req-du-defaut" }),
    );
    await expect(listAgents()).rejects.toThrow();

    const [appel] = snapshot().api_calls;
    expect(appel.status).toBe(500);
    expect(appel.request_id).toBe("req-du-defaut");
  });

  it("enregistre un échec réseau, sans réponse ni code", async () => {
    fetch.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(listAgents()).rejects.toThrow();

    const [appel] = snapshot().api_calls;
    expect(appel.status).toBeNull();
    expect(appel.error).toContain("Failed to fetch");
  });

  it("ne casse rien quand le serveur ne pose pas l'en-tête", async () => {
    // Un déploiement plus ancien, ou un proxy qui filtre les en-têtes :
    // le signalement part sans identifiant plutôt que de ne pas partir.
    fetch.mockResolvedValue(reponse([]));
    await listAgents();
    expect(snapshot().api_calls[0].request_id).toBeNull();
  });

  it("laisse la réponse intacte : observer ne modifie pas", async () => {
    fetch.mockResolvedValue(reponse([{ id: "agent1" }], { requestId: "r" }));
    await expect(listAgents()).resolves.toEqual([{ id: "agent1" }]);
  });
});
