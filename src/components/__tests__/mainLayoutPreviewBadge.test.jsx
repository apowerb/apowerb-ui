/**
 * Badge ambre "Preview" sur l'entrée Workflows du menu latéral (roadmap#100).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";

vi.mock("@/lib/navigation", () => ({
  Link: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
  // eslint-disable-next-line @next/next/no-img-element
  Image: ({ alt, ...rest }) => <img alt={alt || ""} {...rest} />,
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));
vi.mock("next-themes", () => ({ useTheme: () => ({ theme: "dark", setTheme: vi.fn() }) }));

let currentUser = { id: 1, email: "x@y.fr", role: "user" };
vi.mock("@/contexts/AuthContext", () => ({
  AuthProvider: ({ children }) => <>{children}</>,
  useAuth: () => ({ user: currentUser, isAuthenticated: true, isLoading: false, logout: vi.fn() }),
}));
vi.mock("@/contexts/ChatContext", () => ({ ChatProvider: ({ children }) => <>{children}</> }));
vi.mock("./Toast", () => ({ ToastProvider: ({ children }) => <>{children}</>, useToast: () => ({ error: vi.fn(), success: vi.fn() }) }));
vi.mock("@/components/Toast", () => ({ ToastProvider: ({ children }) => <>{children}</>, useToast: () => ({ error: vi.fn(), success: vi.fn() }) }));
vi.mock("@/extensions/Slot", () => ({ default: () => null }));
vi.mock("./NotificationBell", () => ({ default: () => null }));
vi.mock("./auth", () => ({ UserProfileModal: () => null, UserMenu: () => null }));
vi.mock("./ThemeToggle", () => ({ ThemeToggle: () => null }));
vi.mock("./LanguageToggle", () => ({ LanguageToggle: () => null }));
vi.mock("@/components/brand/BrandIcon", () => ({ default: () => null }));
vi.mock("@/lib/api", () => ({
  getPublicConfig: vi.fn().mockResolvedValue({ billing_enabled: false }),
  listEvaluationAgents: vi.fn().mockResolvedValue([]),
  // Appelés par le layout de l'édition open source ; sans eux le rendu échoue
  // avant d'avoir montré la barre, et le banc ne mesurerait rien.
  getSetupStatus: vi.fn().mockResolvedValue({ items: [] }),
  installBrowserErrorCapture: vi.fn(() => () => {}),
}));

const MainLayout = (await import("@/components/MainLayout")).default;

const hrefs = () => screen.queryAllByRole("link").map((a) => a.getAttribute("href"));

describe("Badge Preview — entrée Workflows du menu (roadmap#100)", () => {
  it("affiche le badge Preview avec son infobulle à côté de l'entrée Workflows", async () => {
    render(<MainLayout><div /></MainLayout>);
    await waitFor(() => expect(hrefs()).toContain("/workflows"));

    const workflowsLink = screen.getAllByRole("link").find((a) => a.getAttribute("href") === "/workflows");
    const badge = within(workflowsLink).getByTestId("preview-badge");
    expect(badge).toHaveTextContent("Preview");
    expect(badge).toHaveAttribute("title", "Preview feature — feedback welcome");
  });
});
