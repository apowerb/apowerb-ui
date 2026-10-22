/**
 * Le chatbot sans session renvoie à la connexion avec la page demandée.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/contexts/AuthContext", () => ({
  AuthProvider: ({ children }) => <>{children}</>,
  useAuth: () => ({ isAuthenticated: false, isLoading: false }),
}));
vi.mock("@/components/Toast", () => ({ ToastProvider: ({ children }) => <>{children}</> }));

const ChatbotLayout = (await import("@/app/chatbot/layout")).default;

describe("Chatbot sans session", () => {
  afterEach(() => window.history.replaceState({}, "", "/"));

  it("passe la page et sa requête à /login", async () => {
    window.history.replaceState({}, "", "/chatbot/abc?q=1");
    render(<ChatbotLayout><div /></ChatbotLayout>);
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/login?redirect=" + encodeURIComponent("/chatbot/abc?q=1")),
    );
  });
});
