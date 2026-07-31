/**
 * Smoke test for Supervision page (admin-guarded route).
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
import SupervisionPage from "@/app/(dashboard)/supervision/page";

vi.mock("@/lib/navigation", () => ({
  // L'abstraction fournit aussi Link et Image : sans eux, le rendu casse.
  Link: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
  // eslint-disable-next-line @next/next/no-img-element
  Image: ({ alt, ...rest }) => <img alt={alt || ""} {...rest} />,
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => ({ get: () => null }),
}));

// La page testee vit dans src/app/ : elle appelle next/navigation en direct.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/supervision",
  useSearchParams: () => new URLSearchParams(""),
}));

vi.mock("@/lib/api", () => ({
  listAllSessions: vi.fn().mockResolvedValue({ sessions: [] }),
  getSessionTrace: vi.fn(),
}));

let mockUser = null;
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: mockUser,
    isAuthenticated: !!mockUser,
  }),
}));

describe("SupervisionPage", () => {
  let mockListAllSessions;
  let mockGetSessionTrace;

  beforeEach(async () => {
    const api = await import("@/lib/api");
    mockListAllSessions = api.listAllSessions;
    mockGetSessionTrace = api.getSessionTrace;
    mockListAllSessions.mockClear();
    mockGetSessionTrace.mockClear();
  });

  it("renders the supervision dashboard for an admin user", async () => {
    mockUser = { email: "admin@example.com", role: "admin" };
    render(<SupervisionPage />);
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /supervision dashboard/i }),
      ).toBeInTheDocument();
    });
    expect(mockListAllSessions).toHaveBeenCalled();
  });

  it("shows an access-denied message for a non-admin user", async () => {
    mockUser = { email: "user@example.com", role: "user" };
    render(<SupervisionPage />);
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /admin access required/i }),
      ).toBeInTheDocument();
    });
    expect(mockListAllSessions).not.toHaveBeenCalled();
  });

  it("shows an access-denied message when the user has no role", async () => {
    mockUser = { email: "nobody@example.com" };
    render(<SupervisionPage />);
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /admin access required/i }),
      ).toBeInTheDocument();
    });
    expect(mockListAllSessions).not.toHaveBeenCalled();
  });
});
