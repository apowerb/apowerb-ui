/**
 * Marketplace est CACHÉ, pas retiré (apowerb/roadmap#2).
 *
 * Réunion du 11/09/2026. Anis : « est-ce que c'est juste qu'on cache ça ou on
 * enlève la fonctionnalité ? » — David : « Non, non, on cache. Pour l'instant,
 * on ne le retire pas. » Objectif : alléger ce que voit un visiteur avant la
 * communication publique, sans perdre de code.
 *
 * D'où les deux moitiés de ce banc : aucune porte d'entrée ne mène plus à
 * l'écran, et l'écran lui-même existe toujours.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { existsSync } from "node:fs";
import path from "node:path";

vi.mock("@/lib/navigation", () => ({
  Link: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
  // eslint-disable-next-line @next/next/no-img-element
  Image: ({ alt, ...rest }) => <img alt={alt || ""} {...rest} />,
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));
vi.mock("use-intl", () => ({ useTranslations: () => (k) => k, useLocale: () => "fr" }));
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
  // Appelés par le layout de l’édition open source ; sans eux le rendu échoue
  // avant d’avoir montré la barre, et le banc ne mesurerait rien.
  getSetupStatus: vi.fn().mockResolvedValue({ items: [] }),
  installBrowserErrorCapture: vi.fn(() => () => {}),
}));

const MainLayout = (await import("@/components/MainLayout")).default;
const { buildCommands } = await import("@/lib/chatCommands");

const hrefs = () => screen.queryAllByRole("link").map((a) => a.getAttribute("href"));

describe("Marketplace — caché de la navigation (roadmap#2)", () => {
  beforeEach(() => {
    currentUser = { id: 1, email: "x@y.fr", role: "user" };
  });

  it("n'apparaît pas dans la barre latérale d'un utilisateur", async () => {
    render(<MainLayout><div /></MainLayout>);
    await waitFor(() => expect(hrefs()).toContain("/chat"));
    expect(hrefs()).not.toContain("/marketplace");
  });

  it("n'apparaît pas non plus pour un administrateur", async () => {
    currentUser = { id: 2, email: "a@y.fr", role: "admin" };
    render(<MainLayout><div /></MainLayout>);
    await waitFor(() => expect(hrefs()).toContain("/admin"));
    expect(hrefs()).not.toContain("/marketplace");
  });

  it("ne laisse pas un titre de rubrique vide derrière lui", async () => {
    // Marketplace était le seul élément de « Discover » : masquer l'entrée
    // sans masquer la rubrique laissait un intitulé qui ne mène à rien.
    render(<MainLayout><div /></MainLayout>);
    await waitFor(() => expect(hrefs()).toContain("/chat"));
    expect(screen.queryByText("groupDiscover")).not.toBeInTheDocument();
  });

  it("n'est plus proposé par la palette de commandes ni la commande /marketplace", () => {
    const ids = buildCommands({ isAdmin: true }).map((c) => c.id);
    expect(ids).toContain("go-webhooks"); // témoin : la palette répond
    expect(ids).not.toContain("go-marketplace");
  });

  it("existe toujours : la route n'est pas supprimée", () => {
    const page = path.resolve(__dirname, "../../app/(dashboard)/marketplace/page.jsx");
    expect(existsSync(page)).toBe(true);
  });
});
