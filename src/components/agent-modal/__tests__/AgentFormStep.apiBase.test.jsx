/**
 * Champ « API URL » (optionnel) du formulaire de création/édition d'agent —
 * demande de Farid du 21/09 : Azure AI Foundry, modèle hébergé chez le client,
 * fournisseur OpenAI-compatible via LiteLLM.
 */
import { useEffect, useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AgentModal from "@/components/AgentModal";
import { ToastProvider } from "@/components/Toast";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { email: "test@example.com" }, isAuthenticated: true }),
}));
vi.mock("@/lib/navigation", () => ({
  Link: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
  // eslint-disable-next-line @next/next/no-img-element
  Image: ({ alt, ...rest }) => <img alt={alt || ""} {...rest} />,
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn(), back: vi.fn(), forward: vi.fn() }),
}));
vi.mock("@/lib/api", () => ({
  listSuperAgents: vi.fn().mockResolvedValue([]),
  getSuperAgent: vi.fn().mockResolvedValue({ recommended_tools: [] }),
  listToolConfigs: vi.fn().mockResolvedValue([]),
  getOutlookAuthUrl: vi.fn().mockResolvedValue({ auth_url: "" }),
  getOutlookStatus: vi.fn().mockResolvedValue({ connected: false }),
  saveMcpConfig: vi.fn().mockResolvedValue({}),
  listSkills: vi.fn().mockResolvedValue([]),
  listTools: vi.fn().mockResolvedValue({}),
  getToolExpectedParams: vi.fn().mockResolvedValue([]),
  createToolConfig: vi.fn().mockResolvedValue({}),
  updateToolConfig: vi.fn().mockResolvedValue({}),
  getModels: vi.fn().mockResolvedValue([]),
  listSavedApiKeys: vi.fn().mockResolvedValue([]),
  createSavedApiKey: vi.fn().mockResolvedValue({}),
  deleteSavedApiKey: vi.fn().mockResolvedValue({}),
  getDefaultLlmUsage: vi.fn().mockResolvedValue({ enabled: false }),
}));
vi.mock("@/components/SavedApiKeySelector", () => ({ default: () => <div /> }));
vi.mock("@/components/ModelSelector", () => ({
  default: () => <div />,
  DEFAULT_LLM_PROVIDER: "thaink2",
  DEFAULT_LLM_MODEL_ID: "thaink2/default",
}));
vi.mock("@/hooks/useFocusTrap", () => ({ useFocusTrap: () => ({ current: null }) }));

const baseAgent = {
  name: "", category: "Base", agent_model: "openai/llama-3-70b", model_api_key: "",
  agent_description: "", agent_instruction: "", agent_tools: [], subAgents: [],
  memory_enabled: false, artifacts_enabled: false, guardrails_config: null,
  output_schema: null, mcp_servers: [], agent_skills: [], db_credentials: {},
};

const seen = { current: null };
function Harness({ initial }) {
  const [agent, setAgent] = useState(initial);
  useEffect(() => {
    seen.current = agent;
  }, [agent]);
  return (
    <ToastProvider>
      <AgentModal
        show editingAgent="agent-1" newAgent={agent} setNewAgent={setAgent}
        boxes={[]} categories={["Base"]} availableTools={[]} toolConfigs={[]}
        onClose={vi.fn()} onSave={vi.fn()} onToast={vi.fn()} onRefreshTools={vi.fn()} mcpConfigs={[]}
      />
    </ToastProvider>
  );
}

const field = () => screen.getByLabelText(/API URL/);

describe("AgentFormStep — API URL", () => {
  it("affiche l'URL enregistrée à l'édition", async () => {
    render(<Harness initial={{ ...baseAgent, template_model_params: { model_api_base: "https://org.example/v1" } }} />);
    await waitFor(() => expect(field()).toHaveValue("https://org.example/v1"));
  });

  it("vide par défaut, sans message d'erreur", async () => {
    render(<Harness initial={baseAgent} />);
    await waitFor(() => expect(field()).toHaveValue(""));
    expect(field()).toHaveAttribute("aria-invalid", "false");
    expect(screen.queryByText(/Enter a full http\(s\):\/\/ address/)).toBeNull();
  });

  it("la saisie va dans template_model_params sans toucher aux autres params", async () => {
    render(<Harness initial={{ ...baseAgent, template_model_params: { temperature: 0.3 } }} />);
    await waitFor(() => field());
    fireEvent.change(field(), { target: { value: "https://litellm.client.example/v1" } });
    expect(seen.current.template_model_params).toEqual({
      temperature: 0.3,
      model_api_base: "https://litellm.client.example/v1",
    });
  });

  it("signale une URL invalide", async () => {
    render(<Harness initial={baseAgent} />);
    await waitFor(() => field());
    fireEvent.change(field(), { target: { value: "litellm.local/v1" } });
    expect(field()).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(/Enter a full http\(s\):\/\/ address/)).toBeInTheDocument();
  });

  it("masqué pour le modèle mutualisé thaink2/default", async () => {
    render(<Harness initial={{ ...baseAgent, agent_model: "thaink2/default" }} />);
    await waitFor(() => expect(field().closest(".hidden")).not.toBeNull());
  });
});
