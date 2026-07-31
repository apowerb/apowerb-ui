/**
 * Modèle « thaink2 par défaut » côté UI.
 *
 * Deux exigences de Farid (27/07/26) :
 *  - le provider n'apparaît que si le serveur le sert ;
 *  - la clé API n'est ni saisie, ni affichée, ni révélable.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { MASKED_API_KEY, isMaskedApiKey, displayableApiKey } from "@/lib/apiKeyMask";

vi.mock("use-intl", () => ({
  useTranslations: () => (key) => key,
}));

const getModels = vi.fn();
vi.mock("@/lib/api", () => ({
  getModels: (...args) => getModels(...args),
}));

import ModelSelector, { DEFAULT_LLM_MODEL_ID } from "@/components/ModelSelector";

const WITH_DEFAULT = {
  providers: [
    {
      provider: "thaink2",
      requires_api_key: false,
      models: [{ id: "thaink2/default", name: "thaink2 (inclus)", tag: "Default" }],
    },
    {
      provider: "anthropic",
      models: [{ id: "anthropic/claude-sonnet-4-6", name: "Claude Sonnet 4.6", tag: null }],
    },
  ],
};

const WITHOUT_DEFAULT = {
  providers: [
    {
      provider: "anthropic",
      models: [{ id: "anthropic/claude-sonnet-4-6", name: "Claude Sonnet 4.6", tag: null }],
    },
  ],
};

describe("masque de clé API", () => {
  it("reconnaît le sentinelle renvoyé par l'API", () => {
    expect(isMaskedApiKey(MASKED_API_KEY)).toBe(true);
    expect(isMaskedApiKey("sk-user")).toBe(false);
    expect(isMaskedApiKey("")).toBe(false);
  });

  it("ne rend jamais le sentinelle affichable", () => {
    expect(displayableApiKey(MASKED_API_KEY)).toBe("");
    expect(displayableApiKey("sk-user")).toBe("sk-user");
    expect(displayableApiKey(undefined)).toBe("");
  });
});

describe("ModelSelector — provider thaink2", () => {
  beforeEach(() => {
    getModels.mockReset();
  });

  it("affiche le provider thaink2 quand le serveur le sert", async () => {
    getModels.mockResolvedValue(WITH_DEFAULT);
    render(<ModelSelector value="" onChange={() => {}} />);
    expect(await screen.findByRole("button", { name: /thaink2/i })).toBeInTheDocument();
  });

  it("n'affiche PAS thaink2 quand le serveur ne le sert pas", async () => {
    getModels.mockResolvedValue(WITHOUT_DEFAULT);
    render(<ModelSelector value="" onChange={() => {}} />);
    await screen.findByRole("button", { name: /Anthropic/i });
    expect(screen.queryByRole("button", { name: /thaink2/i })).not.toBeInTheDocument();
  });

  it("sélectionne directement thaink2/default au clic sur le provider", async () => {
    getModels.mockResolvedValue(WITH_DEFAULT);
    const onChange = vi.fn();
    render(<ModelSelector value="" onChange={onChange} />);
    await userEvent.click(await screen.findByRole("button", { name: /thaink2/i }));
    expect(onChange).toHaveBeenCalledWith(DEFAULT_LLM_MODEL_ID);
  });

  it("n'offre aucun choix de modèle sur thaink2 : rien à configurer", async () => {
    getModels.mockResolvedValue(WITH_DEFAULT);
    render(<ModelSelector value={DEFAULT_LLM_MODEL_ID} onChange={() => {}} />);
    await waitFor(() => expect(getModels).toHaveBeenCalled());
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText("defaultModelHint")).toBeInTheDocument();
  });

  it("laisse le choix du modèle sur un provider normal", async () => {
    getModels.mockResolvedValue(WITH_DEFAULT);
    render(<ModelSelector value="anthropic/claude-sonnet-4-6" onChange={() => {}} />);
    expect(await screen.findByRole("combobox")).toBeInTheDocument();
  });
});
