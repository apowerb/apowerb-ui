/**
 * La mention légale de l'écran de connexion est une brique, pas du noyau.
 *
 * Elle nommait `agent-dev.thaink2.fr` en dur : le texte partait dans le bundle
 * publié, et une installation self-hosted renvoyait ses utilisateurs vers les
 * conditions d'un tiers. Ce test garde les deux moitiés de la correction —
 * le noyau ne rend rien, et l'emplacement est réellement branché, sinon une
 * brique aurait beau s'enregistrer, l'écran resterait muet.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "fs";
import { join } from "path";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isLoading: false, pendingChallenge: null, clearChallenge: vi.fn() }),
}));
vi.mock("next/image", () => ({
  __esModule: true,
  default: (props) => <img {...props} />,
}));

const SOURCE = join(process.cwd(), "src", "components", "auth", "AuthScreen.jsx");

describe("mention légale de l'écran de connexion", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(async () => {
    const { resetRegistry } = await import("@/extensions/registry");
    resetRegistry();
  });

  it("ne rend aucune mention légale sans brique", async () => {
    const { default: AuthScreen } = await import("@/components/auth/AuthScreen");
    render(<AuthScreen />);
    expect(screen.queryByText(/privacy policy/i)).toBeNull();
    expect(screen.queryByText(/terms of use/i)).toBeNull();
  });

  it("rend ce qu'une brique enregistre pour auth.legal", async () => {
    const { registerSlot } = await import("@/extensions/registry");
    registerSlot("auth.legal", () => <p>mention de la brique</p>);
    const { default: AuthScreen } = await import("@/components/auth/AuthScreen");
    render(<AuthScreen />);
    expect(screen.getByText("mention de la brique")).toBeInTheDocument();
  });

  it("ne nomme aucun domaine en dur dans le code de l'écran", () => {
    expect(readFileSync(SOURCE, "utf-8")).not.toMatch(/https?:\/\/[a-z0-9.-]*thaink2\./i);
  });
});
