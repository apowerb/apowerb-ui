/**
 * Ce que l'application retient d'elle-même pour le jour où ça casse.
 *
 * Les deux exigences opposées de ce module sont testées ensemble : il
 * doit garder assez pour qu'un signalement soit exploitable, et ne rien
 * garder de ce qui ne doit pas voyager — ni jeton, ni valeur sensible de
 * query string, et rien qui grandisse sans fin dans un onglet ouvert
 * depuis des heures.
 */

import { afterEach, describe, expect, it } from "vitest";
import {
  DIAGNOSTIC_LIMITS,
  installBrowserErrorCapture,
  recordAction,
  recordApiCall,
  recordConsole,
  recordNavigation,
  resetDiagnostics,
  scrubUrl,
  snapshot,
} from "@/lib/api";

afterEach(() => resetDiagnostics());

describe("expurgation", () => {
  it("masque la valeur des paramètres sensibles et garde le chemin", () => {
    // Le chemin dit OÙ le défaut s'est produit : le perdre coûterait le
    // diagnostic, alors que perdre la valeur du jeton ne coûte rien.
    expect(scrubUrl("/api/x?access_token=xxxx&page=2")).toBe(
      "/api/x?access_token=<redacted>&page=2",
    );
  });

  it("laisse intacte une URL sans query string", () => {
    expect(scrubUrl("/api/agents/42")).toBe("/api/agents/42");
  });

  it("expurge aussi ce qui est enregistré, pas seulement ce qui est affiché", () => {
    recordApiCall({ method: "get", path: "/api/x?token=xxxx", status: 200 });
    expect(snapshot().api_calls[0].path).not.toContain("token=xxxx");
  });
});

describe("anneau des appels d'API", () => {
  it("retient le code, la durée et l'identifiant de corrélation", () => {
    recordApiCall({
      method: "post",
      path: "/api/tools/run",
      status: 500,
      requestId: "req-42",
      durationMs: 1234.7,
    });
    const [call] = snapshot().api_calls;
    expect(call).toMatchObject({
      method: "POST",
      path: "/api/tools/run",
      status: 500,
      request_id: "req-42",
      duration_ms: 1235,
    });
  });

  it("ne grandit pas au-delà de sa taille", () => {
    for (let i = 0; i < DIAGNOSTIC_LIMITS.MAX_API_CALLS + 15; i += 1) {
      recordApiCall({ method: "get", path: `/api/${i}`, status: 200 });
    }
    const calls = snapshot().api_calls;
    expect(calls).toHaveLength(DIAGNOSTIC_LIMITS.MAX_API_CALLS);
    // On garde les plus RÉCENTS : l'appel qui a échoué vient de se produire.
    expect(calls[calls.length - 1].path).toBe(
      `/api/${DIAGNOSTIC_LIMITS.MAX_API_CALLS + 14}`,
    );
  });
});

describe("fil de navigation", () => {
  it("enregistre les écrans traversés dans l'ordre", () => {
    recordNavigation({ route: "/agents", label: "Agents" });
    recordNavigation({ route: "/agents/42/tools", label: "Outils" });
    expect(snapshot().navigation_trail.map((step) => step.route)).toEqual([
      "/agents",
      "/agents/42/tools",
    ]);
  });

  it("ne duplique pas un écran qu'on n'a pas quitté", () => {
    recordNavigation({ route: "/chat" });
    recordNavigation({ route: "/chat" });
    expect(snapshot().navigation_trail).toHaveLength(1);
  });

  it("mesure le temps passé sur chaque écran", () => {
    // Trois secondes veut dire « traversé », trois minutes veut dire
    // « c'est là que ça s'est joué » : la durée est une donnée.
    recordNavigation({ route: "/a" });
    recordNavigation({ route: "/b" });
    const [premier, second] = snapshot().navigation_trail;
    expect(premier.dwell_ms).not.toBeNull();
    expect(second.dwell_ms).not.toBeNull();
  });

  it("borne le nombre d'écrans retenus", () => {
    for (let i = 0; i < DIAGNOSTIC_LIMITS.MAX_TRAIL + 5; i += 1) {
      recordNavigation({ route: `/écran-${i}` });
    }
    expect(snapshot().navigation_trail).toHaveLength(DIAGNOSTIC_LIMITS.MAX_TRAIL);
  });
});

describe("dernier geste", () => {
  it("retient le libellé de l'action", () => {
    recordAction({ label: "Exécuter", kind: "clic" });
    expect(snapshot().last_action).toMatchObject({ label: "Exécuter", kind: "clic" });
  });

  it("ignore une action sans libellé plutôt que d'écraser la précédente", () => {
    recordAction({ label: "Exécuter" });
    recordAction({ label: "" });
    expect(snapshot().last_action.label).toBe("Exécuter");
  });
});

describe("console", () => {
  it("borne le nombre d'entrées", () => {
    for (let i = 0; i < DIAGNOSTIC_LIMITS.MAX_CONSOLE + 10; i += 1) {
      recordConsole({ level: "error", message: `erreur ${i}` });
    }
    expect(snapshot().console).toHaveLength(DIAGNOSTIC_LIMITS.MAX_CONSOLE);
  });

  it("tronque un message géant", () => {
    recordConsole({ level: "error", message: "x".repeat(10_000) });
    expect(snapshot().console[0].message.length).toBeLessThanOrEqual(2000);
  });
});

describe("capture des erreurs du navigateur", () => {
  it("enregistre console.error sans l'avaler", () => {
    // Un outil de diagnostic qui fait disparaître les messages qu'il
    // observe est une régression, pas une fonctionnalité.
    const vu = [];
    const cible = {
      console: { error: (...args) => vu.push(args.join(" ")), warn: () => {} },
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    const desinstaller = installBrowserErrorCapture(cible);
    cible.console.error("quelque chose a cassé");
    desinstaller();

    expect(vu).toEqual(["quelque chose a cassé"]);
    expect(snapshot().console[0].message).toBe("quelque chose a cassé");
  });

  it("rend son console.error d'origine en se désinstallant", () => {
    const original = () => {};
    const cible = {
      console: { error: original, warn: () => {} },
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    installBrowserErrorCapture(cible)();
    expect(cible.console.error).toBe(original);
  });
});
