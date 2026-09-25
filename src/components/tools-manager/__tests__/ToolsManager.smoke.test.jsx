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
import { listMcpConfigs, listToolConfigs } from "@/lib/api";

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
  getToolsDocs: vi.fn().mockResolvedValue({}),
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

  it("renders the five tabs as an accessible tab list", async () => {
    renderWithProviders(<ToolsManager />);
    const tabs = await screen.findAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "Available tools", "My configurations", "MCP servers", "Skills", "Help",
    ]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
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

    fireEvent.click(screen.getByRole("tab", { name: /mcp servers/i }));

    await waitFor(() => {
      // Header action + empty-state call to action.
      expect(
        screen.getAllByRole("button", { name: /add mcp server/i }).length,
      ).toBeGreaterThan(0);
    });
  });

  it("shows header names but never header values of an MCP server", async () => {
    listMcpConfigs.mockResolvedValueOnce([
      { mcp_config_id: "m2", name: "Tavily Search", transport: "http", url: "https://mcp.tavily.com/mcp/", headers: { Authorization: "Bearer tvly-secret-123" } },
    ]);
    renderWithProviders(<ToolsManager />);
    fireEvent.click(await screen.findByRole("tab", { name: /mcp servers/i }));

    expect(await screen.findByText("Tavily Search")).toBeInTheDocument();
    expect(screen.getByText(/Authorization/)).toBeInTheDocument();
    expect(screen.queryByText(/tvly-secret-123/)).not.toBeInTheDocument();
  });

  it("does not count MCP servers as tool configurations", async () => {
    listToolConfigs.mockResolvedValueOnce([
      { tool_config_id: "tc1", tool_config_name: "Mails", tool_name: "emailing.tool_send_email", tool_category: "emailing", status: "active" },
      { tool_config_id: "m1", tool_config_name: "Prod DB", tool_name: "mcp", tool_category: "mcp_server", status: "active" },
    ]);
    renderWithProviders(<ToolsManager />);
    const configsTab = await screen.findByRole("tab", { name: /my configurations/i });
    await waitFor(() => expect(configsTab).toHaveTextContent("My configurations1"));
    fireEvent.click(configsTab);
    expect(await screen.findByText("Mails")).toBeInTheDocument();
    expect(screen.queryByText("Prod DB")).not.toBeInTheDocument();
  });
});
