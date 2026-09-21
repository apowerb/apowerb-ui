/**
 * Ce que le formulaire envoie au backend pour l'API URL : c'est
 * `agent_model_params.model_api_base` que le backend passe à LiteLLM.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const api = vi.hoisted(() => ({
  getAgent: vi.fn(),
  createAgent: vi.fn().mockResolvedValue({}),
  updateAgent: vi.fn().mockResolvedValue({}),
  reloadAgent: vi.fn().mockResolvedValue({}),
  createToolConfig: vi.fn(),
  publishToHub: vi.fn(),
}));
vi.mock("@/lib/api", () => api);
const toast = vi.hoisted(() => ({ warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() }));
vi.mock("@/components/Toast", () => ({ useToast: () => toast }));

import { useAgentCrud } from "@/components/diagram/useAgentCrud";

const agent = (extra) => ({
  name: "llama", category: "Base", agent_model: "openai/llama-3-70b", model_api_key: "sk-x",
  agent_description: "d", agent_instruction: "i", agent_tools: [], subAgents: [], ...extra,
});

function setup() {
  const { result } = renderHook(() =>
    useAgentCrud({ allAgents: [], fetchData: vi.fn(), tabs: [], setTabs: vi.fn() }),
  );
  return result;
}

async function create(result, newAgent) {
  act(() => result.current.setNewAgent(newAgent));
  await act(() => result.current.handleCreateFromModal());
}

describe("useAgentCrud — model_api_base", () => {
  beforeEach(() => vi.clearAllMocks());

  it("création : l'URL saisie part dans agent_model_params, nettoyée", async () => {
    const r = setup();
    await create(r, agent({ template_model_params: { model_api_base: " https://org.example/v1 " } }));
    expect(api.createAgent).toHaveBeenCalledTimes(1);
    expect(api.createAgent.mock.calls[0][0].agent_model_params).toEqual({
      model_api_base: "https://org.example/v1",
      model_api_key: "sk-x",
    });
  });

  it("création sans URL : aucune clé model_api_base (URL par défaut du fournisseur)", async () => {
    const r = setup();
    await create(r, agent({ template_model_params: { model_api_base: "" } }));
    expect(api.createAgent.mock.calls[0][0].agent_model_params).toEqual({ model_api_key: "sk-x" });
  });

  it("URL invalide : rien n'est envoyé, l'utilisateur est prévenu", async () => {
    const r = setup();
    await create(r, agent({ template_model_params: { model_api_base: "org.example/v1" } }));
    expect(api.createAgent).not.toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalledWith(expect.stringMatching(/API URL/));
  });

  it("édition : vider le champ retire l'URL enregistrée (le PUT remplace les params)", async () => {
    api.getAgent.mockResolvedValue({
      agent_name: "llama", agent_type: "base", agent_model: "openai/llama-3-70b",
      agent_model_params: { model_api_key: "__unchanged__", model_api_base: "https://old.example/v1" },
    });
    const r = setup();
    await act(() => r.current.openEditModal({ id: "agent7" }));
    expect(r.current.newAgent.template_model_params).toEqual({ model_api_base: "https://old.example/v1" });

    act(() => r.current.setNewAgent((p) => ({ ...p, template_model_params: { model_api_base: "" } })));
    await act(() => r.current.handleEditFromModal());
    expect(api.updateAgent).toHaveBeenCalledTimes(1);
    expect(api.updateAgent.mock.calls[0][1].agent_model_params).toEqual({ model_api_key: "__unchanged__" });
  });
});
