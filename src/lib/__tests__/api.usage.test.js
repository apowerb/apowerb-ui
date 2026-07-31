import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";


import { getUsageSummary, getUsageAgentDetail } from "../api";
import {
  configureClient,
  resetClientConfig,
} from "@apowerb/apowerb-sdk/config";

// api.js vit desormais dans packages/apowerb-sdk : moquer le chemin
// "../authStorage" n'atteint plus le client. On injecte le stockage par la
// couture prevue pour cela, ce qui teste en prime le point d'extension.
const authStorage = {
  getToken: vi.fn(() => "tok-123"),
  setToken: vi.fn(),
  clear: vi.fn(),
};

function okJsonResponse(body) {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
  };
}

describe("getUsageSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configureClient({ storage: authStorage });
    authStorage.getToken.mockReturnValue("tok-123");
    global.fetch = vi.fn();
  });

  afterEach(() => {
    resetClientConfig();
    vi.restoreAllMocks();
  });

  it("appelle /api/usage/summary avec le nombre de jours en query param et le Bearer token", async () => {
    const payload = { days: 30, per_agent: [], per_day: [], totals: { calls: 0 } };
    global.fetch.mockResolvedValueOnce(okJsonResponse(payload));

    const result = await getUsageSummary(30);

    expect(result).toEqual(payload);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [calledUrl, opts] = global.fetch.mock.calls[0];
    expect(calledUrl).toBe("/api/usage/summary?days=30");
    expect(opts.headers).toMatchObject({ Authorization: "Bearer tok-123" });
  });

  it("par défaut demande 30 jours", async () => {
    global.fetch.mockResolvedValueOnce(okJsonResponse({}));
    await getUsageSummary();
    expect(global.fetch.mock.calls[0][0]).toBe("/api/usage/summary?days=30");
  });

  it("ajoute granularity quand fourni", async () => {
    global.fetch.mockResolvedValueOnce(okJsonResponse({}));
    await getUsageSummary(7, { granularity: "hour" });
    expect(global.fetch.mock.calls[0][0]).toBe("/api/usage/summary?days=7&granularity=hour");
  });

  it("ajoute agent_id quand fourni", async () => {
    global.fetch.mockResolvedValueOnce(okJsonResponse({}));
    await getUsageSummary(30, { agentId: 8 });
    expect(global.fetch.mock.calls[0][0]).toBe("/api/usage/summary?days=30&agent_id=8");
  });

  it("combine granularity et agent_id", async () => {
    global.fetch.mockResolvedValueOnce(okJsonResponse({}));
    await getUsageSummary(7, { granularity: "hour", agentId: 8 });
    expect(global.fetch.mock.calls[0][0]).toBe(
      "/api/usage/summary?days=7&granularity=hour&agent_id=8",
    );
  });
});

describe("getUsageAgentDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configureClient({ storage: authStorage });
    authStorage.getToken.mockReturnValue("tok-123");
    global.fetch = vi.fn();
  });

  afterEach(() => {
    resetClientConfig();
    vi.restoreAllMocks();
  });

  it("appelle /api/usage/agents/{id} avec days en query param", async () => {
    const payload = { agent_id: 8, agent_name: "Analyste AR", totals: {} };
    global.fetch.mockResolvedValueOnce(okJsonResponse(payload));

    const result = await getUsageAgentDetail(8, 30);

    expect(result).toEqual(payload);
    const [calledUrl, opts] = global.fetch.mock.calls[0];
    expect(calledUrl).toBe("/api/usage/agents/8?days=30");
    expect(opts.headers).toMatchObject({ Authorization: "Bearer tok-123" });
  });

  it("par défaut demande 30 jours", async () => {
    global.fetch.mockResolvedValueOnce(okJsonResponse({}));
    await getUsageAgentDetail(8);
    expect(global.fetch.mock.calls[0][0]).toBe("/api/usage/agents/8?days=30");
  });
});
