/**
 * Smoke test for HomeDashboard.
 *
 * NOTE: Vitest is not yet installed in this repo (see correctifs-plan B9).
 * This file is kept as the contract for the future test harness.
 * Once Vitest + @testing-library/react are installed, this test should
 * run as-is.
 *
 * To activate: pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom
 * And add a vitest.config.js with environment: "jsdom".
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import HomeDashboard from "@/components/HomeDashboard";
import { ToastProvider } from "@/components/Toast";

const renderWithProviders = (ui) =>
  render(<ToastProvider>{ui}</ToastProvider>);

vi.mock("@/lib/navigation", () => ({
  // L'abstraction fournit aussi Link et Image : sans eux, le rendu casse.
  Link: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
  // eslint-disable-next-line @next/next/no-img-element
  Image: ({ alt, ...rest }) => <img alt={alt || ""} {...rest} />,
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { email: "test@example.com", name: "Test User" },
    isAuthenticated: true,
  }),
}));

vi.mock("@/lib/api", () => ({
  listAgents: vi.fn().mockResolvedValue([]),
  getBillingBalance: vi.fn().mockResolvedValue({ credits: 1000 }),
  listNotifications: vi.fn().mockResolvedValue({ notifications: [] }),
  getUnreadNotificationCount: vi.fn().mockResolvedValue({ count: 0 }),
  getPublicConfig: vi.fn().mockResolvedValue({ billing_enabled: true }),
  createAgent: vi.fn(),
  listAllSessions: vi.fn().mockResolvedValue([]),
  listPipelines: vi.fn().mockResolvedValue([]),
  listSuperAgents: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/hooks/useIntegrations", () => ({
  useIntegrations: () => ({
    integrations: [],
    byProvider: {},
    loading: false,
    refetch: vi.fn(),
  }),
}));

describe("HomeDashboard", () => {
  beforeEach(() => {
    if (typeof window !== "undefined") {
      window.localStorage.clear();
    }
  });

  it("renders the welcome heading without crashing", async () => {
    renderWithProviders(<HomeDashboard />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    });
  });

  it("affiche l'onboarding selon le flag serveur meme si localStorage est deja pose (fix bug par-navigateur)", async () => {
    // Condition exacte du bug : localStorage deja a true (vu sur un autre compte/navigateur).
    // Avec le flag serveur autoritaire (user.onboarding_completed falsy ici), le modal DOIT
    // apparaitre quand meme -> ne depend plus de localStorage.
    window.localStorage.setItem("th2_onboarding_completed", "true");
    renderWithProviders(<HomeDashboard />);
    await waitFor(
      () => expect(screen.getByRole("dialog")).toBeInTheDocument(),
      { timeout: 2000 },
    );
  });

  it("calls listAgents on mount", async () => {
    const { listAgents } = await import("@/lib/api");
    renderWithProviders(<HomeDashboard />);
    await waitFor(() => {
      expect(listAgents).toHaveBeenCalled();
    });
  });

  it("shows stats cards labels", async () => {
    renderWithProviders(<HomeDashboard />);
    await waitFor(() => {
      expect(screen.getAllByText(/Agents/i).length).toBeGreaterThan(0);
    });
  });
});
