/**
 * Bouton Azure AI Foundry dans le sélecteur de modèle.
 *
 * L'id est `azure_ai/<déploiement>` ; contrairement à Eden AI, il n'y a pas
 * d'URL par défaut : le sélecteur rappelle de saisir celle du projet.
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

import ModelSelector from "@/components/ModelSelector";

const WITH_AZURE = {
  providers: [
    {
      provider: "openai",
      models: [{ id: "openai/gpt-6.1-sol", name: "GPT-6.1 Sol", tag: "Recommended" }],
    },
    {
      provider: "azure_ai",
      models: [
        { id: "azure_ai/gpt-6.1-sol", name: "GPT-6.1 Sol", tag: "Recommended" },
        { id: "azure_ai/gpt-6-luna", name: "GPT-6 Luna", tag: "Fast" },
      ],
    },
  ],
};

async function renderLoaded(ui, models) {
  let answer;
  getModels.mockReturnValue(new Promise((resolve) => { answer = resolve; }));
  const view = render(ui);
  await act(async () => {
    answer(models);
  });
  expect(screen.queryByText("loadingModels")).not.toBeInTheDocument();
  return view;
}

describe("ModelSelector — provider Azure AI Foundry", () => {
  beforeEach(() => {
    getModels.mockReset();
  });

  it("affiche un bouton Azure AI Foundry et choisit le premier déploiement", async () => {
    const onChange = vi.fn();
    await renderLoaded(<ModelSelector value="" onChange={onChange} />, WITH_AZURE);
    await userEvent.click(screen.getByRole("button", { name: /Azure AI Foundry/ }));
    expect(onChange).toHaveBeenCalledWith("azure_ai/gpt-6.1-sol");
  });

  it("rappelle l'URL du projet seulement pour Azure AI Foundry", async () => {
    const { rerender } = await renderLoaded(
      <ModelSelector value="azure_ai/gpt-6.1-sol" onChange={() => {}} />,
      WITH_AZURE,
    );
    expect(screen.getByText("azureAiHint")).toBeInTheDocument();
    rerender(<ModelSelector value="openai/gpt-6.1-sol" onChange={() => {}} />);
    expect(screen.queryByText("azureAiHint")).not.toBeInTheDocument();
  });
});
