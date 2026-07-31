/**
 * Smoke tests for DiagramEditor.
 *
 * These tests verify that the top-level editor renders without crashing after
 * the B9 refactor. They mock heavy dependencies (React Flow canvas, modals,
 * API, auth) so the component can mount in jsdom.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import DiagramEditor from "@/components/DiagramEditor";
import { ToastProvider } from "@/components/Toast";

// next/navigation — useSearchParams + useRouter
vi.mock("@/lib/navigation", () => ({
  // L'abstraction fournit aussi Link et Image : sans eux, le rendu casse.
  Link: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
  // eslint-disable-next-line @next/next/no-img-element
  Image: ({ alt, ...rest }) => <img alt={alt || ""} {...rest} />,
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// Auth context
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { email: "test@example.com" },
    isAuthenticated: true,
  }),
}));

// Backend API
vi.mock("@/lib/api", () => ({
  listAgents: vi.fn().mockResolvedValue([]),
  getAgent: vi.fn().mockResolvedValue({}),
  listTools: vi.fn().mockResolvedValue([]),
  listToolConfigs: vi.fn().mockResolvedValue([]),
  listMcpConfigs: vi.fn().mockResolvedValue([]),
  createAgent: vi.fn().mockResolvedValue({}),
  updateAgent: vi.fn().mockResolvedValue({}),
  deleteAgent: vi.fn().mockResolvedValue({}),
  publishToHub: vi.fn().mockResolvedValue({}),
  createToolConfig: vi.fn().mockResolvedValue({}),
}));

// Workflow runner
vi.mock("@/lib/workflowRunner", () => ({
  runWorkflow: vi.fn().mockResolvedValue({}),
}));

// Heavy canvas — React Flow is not jsdom-friendly (ResizeObserver, measuring).
vi.mock("@/components/workflow/WorkflowCanvas", () => ({
  default: () => <div data-testid="workflow-canvas-mock" />,
}));

// Side modals — keep them inert.
vi.mock("@/components/AgentModal", () => ({
  default: () => null,
}));

vi.mock("@/components/AgentDetailsModal", () => ({
  default: () => null,
}));

vi.mock("@/components/ConnectSnippetModal", () => ({
  default: () => null,
}));

vi.mock("@/components/WorkflowPanel", () => ({
  default: () => <div data-testid="workflow-panel-mock" />,
}));

vi.mock("@/components/AgentSidebar", () => ({
  default: () => <aside data-testid="agent-sidebar-mock" />,
}));

const renderWithProviders = (ui) =>
  render(<ToastProvider>{ui}</ToastProvider>);

describe("DiagramEditor smoke", () => {
  beforeEach(() => {
    if (typeof window !== "undefined") {
      window.localStorage.clear();
    }
  });

  it("renders without crashing", async () => {
    renderWithProviders(<DiagramEditor />);
    await waitFor(() => {
      expect(screen.getByTestId("workflow-canvas-mock")).toBeInTheDocument();
    });
  });

  it("renders a Save or Create action button in the toolbar", async () => {
    renderWithProviders(<DiagramEditor />);
    await waitFor(() => {
      const btn = screen.getByRole("button", { name: /save|create/i });
      expect(btn).toBeInTheDocument();
    });
  });

  it("renders the canvas placeholder", async () => {
    renderWithProviders(<DiagramEditor />);
    await waitFor(() => {
      expect(screen.getByTestId("workflow-canvas-mock")).toBeInTheDocument();
      expect(screen.getByTestId("workflow-panel-mock")).toBeInTheDocument();
      expect(screen.getByTestId("agent-sidebar-mock")).toBeInTheDocument();
    });
  });

  it("renders the agent name input (header default state)", async () => {
    renderWithProviders(<DiagramEditor />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/agent name/i)).toBeInTheDocument();
    });
  });
});
