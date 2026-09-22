/**
 * Client pour /api/integrations/teams-webhook (apowerb#198) : enregistrement
 * du webhook entrant Microsoft Teams utilisé par le noeud notification du
 * studio (canal "teams"). L'URL n'est jamais renvoyée par le GET — ces
 * fonctions ne font que relayer le contrat déjà livré côté coeur.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetClientConfig } from "../config.js";
import {
  getTeamsWebhookStatus,
  saveTeamsWebhook,
  deleteTeamsWebhook,
} from "../api.js";

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

describe("getTeamsWebhookStatus", () => {
  it("GET /api/integrations/teams-webhook et renvoie configured", async () => {
    const fetchMock = mockFetchOnce({ configured: true });

    const result = await getTeamsWebhookStatus();

    expect(fetchMock.mock.calls[0][0]).toBe("/api/integrations/teams-webhook");
    expect(fetchMock.mock.calls[0][1].method).toBeUndefined();
    expect(result).toEqual({ configured: true });
  });
});

describe("saveTeamsWebhook", () => {
  it("PUT le corps {url} sur /api/integrations/teams-webhook", async () => {
    const fetchMock = mockFetchOnce({ configured: true });

    const result = await saveTeamsWebhook("https://prod.webhook.office.com/xyz");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/integrations/teams-webhook");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({
      url: "https://prod.webhook.office.com/xyz",
    });
    expect(result).toEqual({ configured: true });
  });

  it("relaie le detail lisible d'un 422 (URL refusée)", async () => {
    mockFetchOnce({ detail: "L'hôte n'est pas dans la liste blanche" }, 422);

    await expect(saveTeamsWebhook("https://evil.example.com")).rejects.toThrow(
      "L'hôte n'est pas dans la liste blanche",
    );
  });
});

describe("deleteTeamsWebhook", () => {
  it("DELETE /api/integrations/teams-webhook", async () => {
    const fetchMock = mockFetchOnce({ configured: false });

    const result = await deleteTeamsWebhook();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/integrations/teams-webhook");
    expect(init.method).toBe("DELETE");
    expect(result).toEqual({ configured: false });
  });
});
