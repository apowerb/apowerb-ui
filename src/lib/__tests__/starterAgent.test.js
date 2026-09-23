import { describe, it, expect } from "vitest";
import { STARTER_FALLBACK_MODEL, starterAgentModel } from "../starterAgent";

const DEFAULT_ID = "thaink2/default";
const served = (...providers) => ({ providers });

describe("starterAgentModel", () => {
  it("picks the shared model when the server offers it: nothing to configure", () => {
    const models = served(
      { provider: "thaink2", requires_api_key: false, models: [{ id: DEFAULT_ID }] },
      { provider: "gemini", models: [{ id: "gemini/gemini-2.5-flash" }] },
    );
    expect(starterAgentModel(models, DEFAULT_ID)).toBe(DEFAULT_ID);
  });

  it("falls back to a provider-prefixed model otherwise", () => {
    const models = served({ provider: "gemini", models: [{ id: "gemini/gemini-2.5-flash" }] });
    expect(starterAgentModel(models, DEFAULT_ID)).toBe(STARTER_FALLBACK_MODEL);
  });

  it("survives a models list that could not be loaded", () => {
    expect(starterAgentModel(null, DEFAULT_ID)).toBe(STARTER_FALLBACK_MODEL);
    expect(starterAgentModel({}, DEFAULT_ID)).toBe(STARTER_FALLBACK_MODEL);
  });

  it("never sends a bare model id, which the backend refuses (roadmap#92)", () => {
    expect(STARTER_FALLBACK_MODEL).toMatch(/^[a-z0-9_-]+\/.+/);
  });
});
