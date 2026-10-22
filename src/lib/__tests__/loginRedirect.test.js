/**
 * Le retour après connexion (`/login?redirect=`) ne sort jamais du site :
 * seul un chemin de la même origine est suivi.
 */
import { describe, it, expect, afterEach } from "vitest";
import { internalRedirect, loginHref } from "@/lib/loginRedirect";

const at = (url) => window.history.replaceState({}, "", url);

describe("internalRedirect", () => {
  it.each([
    ["/\\evil.com"],
    ["/\t/evil.com"],
    ["//evil.com"],
    ["https://evil.com"],
    // Tel que lu dans ?redirect=%2F%5Cevil.com
    [decodeURIComponent("/%5Cevil.com")],
    ["javascript:alert(1)"],
  ])("refuse %j (autre origine) et ramène à l'accueil", (target) => {
    expect(internalRedirect(target)).toBe("/");
  });

  it("garde un chemin interne, requête et ancre comprises", () => {
    expect(internalRedirect("/workflows?decision=run-42")).toBe("/workflows?decision=run-42");
    expect(internalRedirect("/workflows#liste")).toBe("/workflows#liste");
  });

  it("sans cible, l'accueil", () => {
    expect(internalRedirect(null)).toBe("/");
    expect(internalRedirect("")).toBe("/");
  });
});

describe("loginHref", () => {
  afterEach(() => at("/"));

  it("emporte la page demandée et sa requête", () => {
    at("/workflows?decision=run-42");
    expect(loginHref()).toBe("/login?redirect=" + encodeURIComponent("/workflows?decision=run-42"));
  });

  it("depuis l'accueil, /login sans détour", () => {
    at("/");
    expect(loginHref()).toBe("/login");
  });
});
