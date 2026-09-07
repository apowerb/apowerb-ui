/**
 * L'éditeur d'agent montrait un champ clé API quelle que soit le modèle. Pour
 * `thaink2/default` il n'y a rien à saisir ni à lire : la jauge du mois prend
 * la place du champ, exactement comme dans le formulaire de création.
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("use-intl", () => ({ useTranslations: () => (key) => key }));
vi.mock("@/lib/api", () => ({
  getDefaultLlmUsage: vi.fn().mockResolvedValue({
    enabled: true, used_tokens: 42, limit_tokens: null, percent_used: null,
    warning: false, exceeded: false, resets_at: "2026-09-30T22:00:00Z",
  }),
}));
vi.mock("@/components/SavedApiKeySelector", () => ({
  default: () => <div data-testid="saved-key-selector" />,
}));

import DiagramHeaderPanel from "@/components/diagram/DiagramHeaderPanel";

const base = {
  updateAgentData: () => {},
  canvasOrderLength: 0,
  showApiKey: false,
  setShowApiKey: () => {},
  toolConfigs: [],
};

describe("DiagramHeaderPanel — modèle mutualisé", () => {
  it("thaink2/default : la jauge prend la place du champ clé API", async () => {
    render(<DiagramHeaderPanel {...base} agentData={{ agent_model: "thaink2/default", agent_type: "base" }} />);
    expect(await screen.findByTestId("default-llm-usage")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("apiKeyPlaceholder").closest(".hidden")).not.toBeNull();
    expect(screen.getByTestId("saved-key-selector").closest(".hidden")).not.toBeNull();
  });

  it("autre modèle : champ clé API visible, pas de jauge", () => {
    render(<DiagramHeaderPanel {...base} agentData={{ agent_model: "gemini/gemini-2.5-flash", agent_type: "base" }} />);
    expect(screen.getByPlaceholderText("apiKeyPlaceholder").closest(".hidden")).toBeNull();
    expect(screen.queryByTestId("default-llm-usage")).toBeNull();
  });
});
