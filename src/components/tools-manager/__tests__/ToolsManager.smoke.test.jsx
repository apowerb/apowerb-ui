/**
 * Smoke tests for ToolsManager.
 *
 * These tests verify that the Tool Box & MCP manager renders without crashing
 * after the B10b refactor. They mock the api layer and auth context so the
 * component can mount in jsdom.
 *
 * Written BEFORE the refactor to guarantee green tests through every
 * extraction step.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import ToolsManager from "@/components/ToolsManager";
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

// Backend API — all calls mocked to empty values so the component renders
// instantly without network.
vi.mock("@/lib/api", () => ({
  listTools: vi.fn().mockResolvedValue({}),
  listToolConfigs: vi.fn().mockResolvedValue([]),
  listMcpConfigs: vi.fn().mockResolvedValue([]),
  saveMcpConfig: vi.fn().mockResolvedValue({}),
  createToolConfig: vi.fn().mockResolvedValue({}),
  deleteToolConfig: vi.fn().mockResolvedValue({}),
  listSkills: vi.fn().mockResolvedValue([]),
  getSkill: vi.fn().mockResolvedValue({}),
  createSkill: vi.fn().mockResolvedValue({}),
  updateSkill: vi.fn().mockResolvedValue({}),
  deleteSkill: vi.fn().mockResolvedValue({}),
  importSkill: vi.fn().mockResolvedValue({}),
}));

// Auth storage (token retrieval, used by skill export)
vi.mock("@/lib/authStorage", () => ({
  authStorage: {
    getToken: vi.fn(() => "fake-token"),
  },
}));

// ToolConfigModal — keep inert. It pulls in heavy sub-components otherwise.
vi.mock("@/components/ToolConfigModal", () => ({
  default: () => null,
}));

const renderWithProviders = (ui) =>
  render(<ToastProvider>{ui}</ToastProvider>);

describe("ToolsManager smoke", () => {
  beforeEach(() => {
    if (typeof window !== "undefined") {
      window.localStorage.clear();
      window.location.hash = "";
    }
  });

  it("renders without crashing", async () => {
    renderWithProviders(<ToolsManager />);
    await waitFor(() => {
      expect(screen.getByText("Tool Box & MCP")).toBeInTheDocument();
    });
  });

  it("renders the stats bar with all five metric cards", async () => {
    renderWithProviders(<ToolsManager />);
    await waitFor(() => {
      // StatsBar labels. Some also appear as tab labels; use getAllByText.
      expect(screen.getAllByText("Available Tools").length).toBeGreaterThan(0);
      expect(screen.getByText("Tool Categories")).toBeInTheDocument();
      expect(screen.getAllByText("My Configurations").length).toBeGreaterThan(0);
      expect(screen.getAllByText("MCP Servers").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Skills").length).toBeGreaterThan(0);
    });
  });

  it("renders the default Available Tools tab content", async () => {
    renderWithProviders(<ToolsManager />);
    await waitFor(() => {
      // The Available Tools tab shows a search input for tools.
      expect(screen.getByPlaceholderText(/search tools/i)).toBeInTheDocument();
    });
  });

  it("switches to the MCP Servers tab when clicked", async () => {
    renderWithProviders(<ToolsManager />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search tools/i)).toBeInTheDocument();
    });

    // Tab buttons contain the TAB label. The MCP Servers tab also has a unique
    // "Add MCP Server" CTA once active.
    const mcpTabButton = screen
      .getAllByRole("button")
      .find((b) => /mcp servers/i.test(b.textContent || ""));
    expect(mcpTabButton).toBeDefined();
    fireEvent.click(mcpTabButton);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search mcp servers/i)).toBeInTheDocument();
      // "Add MCP Server" CTA appears at least once in the MCP tab (empty state + toolbar).
      expect(
        screen.getAllByRole("button", { name: /add mcp server/i }).length,
      ).toBeGreaterThan(0);
    });
  });
});
