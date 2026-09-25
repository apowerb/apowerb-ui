/**
 * Smoke tests for AgentModal.
 *
 * Verifies the modal renders without crashing in both Create (step=choose) and
 * Edit modes, and that core structural elements are present. Heavy
 * dependencies (API, auth, sub-selectors) are mocked out.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AgentModal from "@/components/AgentModal";
import { ToastProvider } from "@/components/Toast";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { email: "test@example.com" },
    isAuthenticated: true,
  }),
}));

// McpServersSection (rendered in the edit/form step) calls useRouter(); without
// an app-router context jsdom throws "invariant expected app router to be
// mounted". Stub next/navigation so the modal renders in tests.
vi.mock("@/lib/navigation", () => ({
  // L'abstraction fournit aussi Link et Image : sans eux, le rendu casse.
  Link: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
  // eslint-disable-next-line @next/next/no-img-element
  Image: ({ alt, ...rest }) => <img alt={alt || ""} {...rest} />,
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
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
}));

vi.mock("@/components/SavedApiKeySelector", () => ({
  default: () => <div data-testid="saved-api-key-selector-mock" />,
}));

vi.mock("@/components/ModelSelector", () => ({
  default: () => <div data-testid="model-selector-mock" />,
  DEFAULT_LLM_PROVIDER: "thaink2",
  DEFAULT_LLM_MODEL_ID: "thaink2/default",
}));

vi.mock("@/hooks/useFocusTrap", () => ({
  useFocusTrap: () => ({ current: null }),
}));

const baseAgent = {
  name: "",
  category: "Base",
  agent_model: "",
  model_api_key: "",
  agent_description: "",
  agent_instruction: "",
  agent_tools: [],
  subAgents: [],
  memory_enabled: false,
  artifacts_enabled: false,
  guardrails_config: null,
  output_schema: null,
  mcp_servers: [],
  agent_skills: [],
  db_credentials: {},
};

function renderModal(props = {}) {
  const defaultProps = {
    show: true,
    editingAgent: null,
    newAgent: baseAgent,
    setNewAgent: vi.fn(),
    boxes: [],
    categories: ["Base", "Sequential", "Parallel", "Loop", "Router"],
    availableTools: [],
    toolConfigs: [],
    onClose: vi.fn(),
    onSave: vi.fn(),
    onToast: vi.fn(),
    onRefreshTools: vi.fn(),
    mcpConfigs: [],
  };
  return render(
    <ToastProvider>
      <AgentModal {...defaultProps} {...props} />
    </ToastProvider>
  );
}

// Rebuilds the agent state from every setNewAgent call, in order, the way
// React would: form-step effects also update it after the template pick.
function replayUpdates(setNewAgent) {
  return setNewAgent.mock.calls.reduce(
    (state, [update]) =>
      typeof update === "function" ? update(state) : update,
    baseAgent,
  );
}

describe("AgentModal smoke", () => {
  beforeEach(() => {
    if (typeof window !== "undefined") {
      window.localStorage.clear();
    }
  });

  it("renders without crashing in Create mode", async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByText(/Create Agent/i)).toBeInTheDocument();
    });
  });

  it("shows 'Edit Agent' title when editingAgent is set", async () => {
    renderModal({ editingAgent: "agent-1" });
    await waitFor(() => {
      expect(screen.getByText(/Edit Agent/i)).toBeInTheDocument();
    });
  });

  it("renders the Agent Name input in edit/form step", async () => {
    renderModal({ editingAgent: "agent-1" });
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Enter agent name/i)).toBeInTheDocument();
    });
  });

  it("renders Save and Cancel buttons in edit mode", async () => {
    renderModal({ editingAgent: "agent-1" });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Save Changes/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^Cancel$/i })).toBeInTheDocument();
    });
  });

  it("keeps the template's own agent_tools when creating from it", async () => {
    // database_assistant declares its native tools in agent_tools (no
    // recommended_tools): dropping them left the new agent without those
    // tools and the core flagged agent_tools as diverging right away.
    const { listSuperAgents } = await import("@/lib/api");
    listSuperAgents.mockResolvedValueOnce([
      {
        template_id: "database_assistant",
        name: "database_assistant",
        display_name: "Database Assistant",
        category: "data",
        agent_tools: ["basic.confirm_destructive", "basic.notify_user"],
        tags: ["database"],
      },
    ]);
    const setNewAgent = vi.fn();
    renderModal({ setNewAgent });

    fireEvent.click(await screen.findByRole("button", { name: /Database Assistant/i }));

    const next = replayUpdates(setNewAgent);
    expect(next.agent_tools).toEqual([
      "basic.confirm_destructive",
      "basic.notify_user",
    ]);
    expect(next.superagent_template_id).toBe("database_assistant");
  });

  it("starts with no agent_tools for a template that only recommends tools", async () => {
    const { listSuperAgents } = await import("@/lib/api");
    listSuperAgents.mockResolvedValueOnce([
      {
        template_id: "jev_decision_agent",
        name: "jev_decision_agent",
        display_name: "Decision Agent (Jev)",
        category: "data",
        recommended_tools: ["jev.tool_jev_classify"],
      },
    ]);
    const setNewAgent = vi.fn();
    renderModal({ setNewAgent });

    fireEvent.click(await screen.findByRole("button", { name: /Decision Agent \(Jev\)/i }));

    const next = replayUpdates(setNewAgent);
    expect(next.agent_tools).toEqual([]);
  });

  it("lists a template's own agent_tools under Native Tools when creating", async () => {
    const { listSuperAgents } = await import("@/lib/api");
    listSuperAgents.mockResolvedValueOnce([
      {
        template_id: "database_assistant",
        name: "database_assistant",
        display_name: "Database Assistant",
        category: "data",
        agent_tools: ["basic.notify_user"],
        recommended_tools: ["database.tool_run_sql"],
      },
    ]);
    renderModal();

    fireEvent.click(await screen.findByRole("button", { name: /Database Assistant/i }));

    expect(await screen.findByText("basic.notify_user")).toBeInTheDocument();
    expect(screen.getByText("database.tool_run_sql")).toBeInTheDocument();
  });

  it("lists a template's own agent_tools under Native Tools when editing", async () => {
    const { getSuperAgent } = await import("@/lib/api");
    getSuperAgent.mockResolvedValueOnce({
      template_id: "database_assistant",
      agent_tools: ["basic.notify_user"],
    });
    renderModal({
      editingAgent: "agent-1",
      newAgent: { ...baseAgent, superagent_template_id: "database_assistant" },
    });

    expect(await screen.findByText("basic.notify_user")).toBeInTheDocument();
  });

  it("returns null when show=false", () => {
    const { container } = renderModal({ show: false });
    expect(container.firstChild).toBeNull();
  });
});
