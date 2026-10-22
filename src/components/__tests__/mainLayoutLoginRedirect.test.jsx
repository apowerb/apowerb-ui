/**
 * Sans session, la page demandée survit à la connexion : le lien d'un avis de
 * décision (`/workflows?decision=<run>`) rouvre la décision une fois connecté.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

const layoutReplace = vi.fn();
const loginReplace = vi.fn();

vi.mock("@/lib/navigation", () => ({
  Link: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
  // eslint-disable-next-line @next/next/no-img-element
  Image: ({ alt, ...rest }) => <img alt={alt || ""} {...rest} />,
  usePathname: () => "/workflows",
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: layoutReplace }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: loginReplace, push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/workflows",
  useSearchParams: () => new URLSearchParams(""),
}));
vi.mock("next-themes", () => ({ useTheme: () => ({ theme: "dark", setTheme: vi.fn() }) }));

let session = { user: null, isAuthenticated: false, isLoading: false, logout: vi.fn() };
vi.mock("@/contexts/AuthContext", () => ({
  AuthProvider: ({ children }) => <>{children}</>,
  useAuth: () => session,
}));
vi.mock("@/contexts/ChatContext", () => ({ ChatProvider: ({ children }) => <>{children}</> }));
vi.mock("@/components/Toast", () => ({ ToastProvider: ({ children }) => <>{children}</>, useToast: () => ({ error: vi.fn(), success: vi.fn() }) }));
vi.mock("@/components/auth/AuthScreen", () => ({ default: () => null }));
vi.mock("@/extensions/Slot", () => ({ default: () => null }));
vi.mock("../NotificationBell", () => ({ default: () => null }));
vi.mock("../auth", () => ({ UserProfileModal: () => null, UserMenu: () => null }));
vi.mock("../ThemeToggle", () => ({ ThemeToggle: () => null }));
vi.mock("../LanguageToggle", () => ({ LanguageToggle: () => null }));
vi.mock("@/components/brand/BrandIcon", () => ({ default: () => null }));
vi.mock("@/lib/api", () => ({
  getPublicConfig: vi.fn().mockResolvedValue({ billing_enabled: false }),
  getSetupStatus: vi.fn().mockResolvedValue({ items: [] }),
  listEvaluationAgents: vi.fn().mockResolvedValue([]),
  recordNavigation: vi.fn(),
  installBrowserErrorCapture: vi.fn(() => () => {}),
}));

const MainLayout = (await import("@/components/MainLayout")).default;
const LoginPage = (await import("@/app/login/page")).default;

const at = (url) => window.history.replaceState({}, "", url);

describe("Connexion demandée depuis une page de l'application", () => {
  beforeEach(() => {
    layoutReplace.mockClear();
    loginReplace.mockClear();
  });
  afterEach(() => at("/"));

  it("garde la page et sa requête dans ?redirect=", async () => {
    session = { ...session, isAuthenticated: false };
    at("/workflows?decision=run-42");
    render(<MainLayout><div /></MainLayout>);
    await waitFor(() => expect(layoutReplace).toHaveBeenCalled());
    expect(layoutReplace).toHaveBeenCalledWith(
      "/login?redirect=" + encodeURIComponent("/workflows?decision=run-42"),
    );
  });

  it("depuis l'accueil, va à /login sans détour", async () => {
    session = { ...session, isAuthenticated: false };
    at("/");
    render(<MainLayout><div /></MainLayout>);
    await waitFor(() => expect(layoutReplace).toHaveBeenCalledWith("/login"));
  });

  it("une fois connecté, la page de connexion y ramène", async () => {
    session = { ...session, isAuthenticated: true, user: { email: "a@example.com" } };
    at("/login?redirect=" + encodeURIComponent("/workflows?decision=run-42"));
    render(<LoginPage />);
    await waitFor(() => expect(loginReplace).toHaveBeenCalledWith("/workflows?decision=run-42"));
  });

  it("une fois connecté, ne suit jamais une cible hors du site", async () => {
    session = { ...session, isAuthenticated: true, user: { email: "a@example.com" } };
    at("/login?redirect=%2F%5Cevil.com");
    render(<LoginPage />);
    await waitFor(() => expect(loginReplace).toHaveBeenCalled());
    expect(loginReplace).toHaveBeenCalledWith("/");
  });
});
