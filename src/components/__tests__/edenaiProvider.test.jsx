/**
 * Bouton Eden AI dans le sélecteur de modèle.
 *
 * Eden AI est une passerelle : l'id est `edenai/<provider>/<modèle>` et le
 * serveur ajoute l'URL Eden par défaut, l'utilisateur ne saisit que la clé.
 */
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("use-intl", () => ({
  useTranslations: () => (key) => key,
}));

const getModels = vi.fn();
vi.mock("@/lib/api", () => ({
  getModels: (...args) => getModels(...args),
}));

import ModelSelector, { FALLBACK_PROVIDER_MODELS } from "@/components/ModelSelector";

const WITH_EDENAI = {
  providers: [
    {
      provider: "openai",
      models: [{ id: "openai/gpt-6.1-sol", name: "GPT-6.1 Sol", tag: "Recommended" }],
    },
    {
      provider: "edenai",
      models: [
        { id: "edenai/openai/gpt-6.1-sol", name: "GPT-6.1 Sol", tag: "Recommended" },
        { id: "edenai/anthropic/claude-sonnet-5-5", name: "Claude Sonnet 5.5", tag: "Balanced" },
      ],
    },
  ],
};

async function renderLoaded(ui, models) {
  let answer;
  getModels.mockReturnValue(new Promise((resolve) => { answer = resolve; }));
  render(ui);
  await act(async () => {
    answer(models);
  });
  expect(screen.queryByText("loadingModels")).not.toBeInTheDocument();
}

describe("ModelSelector — provider Eden AI", () => {
  beforeEach(() => {
    getModels.mockReset();
  });

  it("affiche un bouton Eden AI quand le serveur sert le groupe edenai", async () => {
    await renderLoaded(<ModelSelector value="" onChange={() => {}} />, WITH_EDENAI);
    expect(screen.getByRole("button", { name: /Eden AI/ })).toBeInTheDocument();
  });

  it("choisit le premier modèle Eden, provider amont compris", async () => {
    const onChange = vi.fn();
    await renderLoaded(<ModelSelector value="" onChange={onChange} />, WITH_EDENAI);
    await userEvent.click(screen.getByRole("button", { name: /Eden AI/ }));
    expect(onChange).toHaveBeenCalledWith("edenai/openai/gpt-6.1-sol");
  });

  it("garde le bouton Eden AI quand GET /models échoue", async () => {
    getModels.mockRejectedValue(new Error("offline"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<ModelSelector value="" onChange={() => {}} />);
    expect(await screen.findByRole("button", { name: /Eden AI/ })).toBeInTheDocument();
    expect(FALLBACK_PROVIDER_MODELS.edenai[0].id).toBe("openai/gpt-6.1-sol");
  });
});
