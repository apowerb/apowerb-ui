/**
 * Le client d'API doit être utilisable hors de l'application Next.
 *
 * Historiquement, `src/lib/api.js` codait `const BASE = ""` : toutes les
 * requêtes partaient en relatif vers `/api/...`, ce qui ne fonctionne que
 * servi par l'app Next qui proxie ces routes. Résultat : la couche d'accès
 * au backend th2agent — 139 fonctions, la partie la plus réutilisable du
 * dépôt — était prisonnière du front.
 *
 * Ces tests verrouillent le contrat inverse :
 *   1. le comportement par défaut est *exactement* l'ancien (base vide) ;
 *   2. une base absolue peut être injectée, pour parler à n'importe quel
 *      backend th2agent depuis n'importe quelle application ;
 *   3. le stockage du jeton est injectable, donc le client tourne sans
 *      navigateur (Node, SSR, script CLI).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  configureClient,
  getClientConfig,
  resetClientConfig,
} from "../config.js";
import { listAgents } from "../api.js";

function mockFetchOnce(payload = {}, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status < 400,
    status,
    text: async () => JSON.stringify(payload),
  });
  globalThis.fetch = fetchMock;
  return fetchMock;
}

beforeEach(() => {
  resetClientConfig();
});

afterEach(() => {
  resetClientConfig();
  vi.restoreAllMocks();
});

describe("configuration par défaut", () => {
  it("garde une base vide, donc des requêtes relatives comme avant", async () => {
    const fetchMock = mockFetchOnce([]);

    await listAgents();

    expect(getClientConfig().baseUrl).toBe("");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/agents");
  });
});

describe("base configurable", () => {
  it("préfixe les requêtes avec la base fournie", async () => {
    const fetchMock = mockFetchOnce([]);
    configureClient({ baseUrl: "https://agent.example.com" });

    await listAgents();

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://agent.example.com/api/agents",
    );
  });

  it("tolère une base avec slash final sans doubler le séparateur", async () => {
    const fetchMock = mockFetchOnce([]);
    configureClient({ baseUrl: "https://agent.example.com/" });

    await listAgents();

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://agent.example.com/api/agents",
    );
  });
});

describe("stockage du jeton injectable", () => {
  it("utilise le stockage fourni, sans toucher à localStorage", async () => {
    const fetchMock = mockFetchOnce([]);
    const storage = {
      getToken: () => "jeton-de-test",
      setToken: vi.fn(),
      clear: vi.fn(),
    };
    configureClient({ baseUrl: "https://agent.example.com", storage });

    await listAgents();

    const { headers } = fetchMock.mock.calls[0][1];
    expect(headers.Authorization).toBe("Bearer jeton-de-test");
  });

  it("n'envoie pas d'en-tête d'autorisation quand il n'y a pas de jeton", async () => {
    const fetchMock = mockFetchOnce([]);
    configureClient({ storage: { getToken: () => null } });

    await listAgents();

    const { headers } = fetchMock.mock.calls[0][1];
    expect(headers.Authorization).toBeUndefined();
  });
});

describe("portabilité", () => {
  it("expose la surface publique depuis le point d'entrée du paquet", async () => {
    const pkg = await import("../index.js");

    expect(typeof pkg.configureClient).toBe("function");
    expect(typeof pkg.listAgents).toBe("function");
    expect(typeof pkg.authStorage).toBe("object");
  });
});
