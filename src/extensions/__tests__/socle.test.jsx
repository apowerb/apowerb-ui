/**
 * Le front doit être complet sans brique, et complété par elle.
 *
 * Pendant exact des verrous du back. Ce qui est testé n'est pas qu'une option
 * marche, mais la **propriété d'absence** : sans brique, l'interface se rend
 * entièrement et rien ne casse. C'est la condition pour publier `apowerb`.
 *
 * Le motif que ce socle remplace : `AuthScreen` masquait ses boutons de
 * connexion via `NEXT_PUBLIC_OAUTH_EXCLUDE_PROVIDERS`. Un drapeau masque, il ne
 * retire pas — le code partait quand même dans le bundle publié.
 */

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import Slot from "../Slot";
import { filledSlots, getSlot, registerSlot, resetRegistry } from "../registry";

const RACINE = path.resolve(__dirname, "../../..");
const NOYAU = path.join(RACINE, "src");

describe("un emplacement vide ne casse rien", () => {
  afterEach(() => resetRegistry());

  it("rend null quand aucune brique n'est enregistrée", () => {
    resetRegistry();
    const { container } = render(<Slot name="inexistant" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("rend le contenu de repli quand il y en a un", () => {
    resetRegistry();
    render(<Slot name="inexistant">repli</Slot>);
    expect(screen.getByText("repli")).toBeInTheDocument();
  });

  it("getSlot rend null plutôt que de lever", () => {
    resetRegistry();
    expect(getSlot("inexistant")).toBeNull();
  });
});

describe("une brique remplit son emplacement", () => {
  afterEach(() => resetRegistry());

  it("rend le composant enregistré et lui passe les props", () => {
    resetRegistry();
    registerSlot("test.zone", ({ etiquette }) => <span>{etiquette}</span>);

    render(<Slot name="test.zone" etiquette="venu d'une brique" />);

    expect(screen.getByText("venu d'une brique")).toBeInTheDocument();
    expect(filledSlots()).toContain("test.zone");
  });

  it("refuse un nom d'emplacement vide", () => {
    expect(() => registerSlot("", () => null)).toThrow();
  });
});

describe("le noyau ne nomme jamais une brique", () => {
  it("aucun fichier de src/ n'importe extensions/, sauf le manifeste", () => {
    const fautifs = [];
    const parcourir = (repertoire) => {
      for (const entree of fs.readdirSync(repertoire, { withFileTypes: true })) {
        const complet = path.join(repertoire, entree.name);
        if (entree.isDirectory()) {
          if (entree.name === "node_modules" || entree.name === ".next") continue;
          parcourir(complet);
          continue;
        }
        if (!/\.(js|jsx|ts|tsx)$/.test(entree.name)) continue;

        const relatif = path.relative(NOYAU, complet);
        // Le manifeste EST la frontière : c'est son rôle de nommer les briques.
        if (relatif === path.join("extensions", "installed.js")) continue;
        // Les routes Next sont commerciales par leur seule existence : elles
        // sont retirées au moment de la migration, pas rendues optionnelles.
        if (relatif.startsWith(path.join("app", "(dashboard)", "usage"))) continue;
        if (relatif.startsWith(path.join("app", "api", "auth", "mfa"))) continue;

        const contenu = fs.readFileSync(complet, "utf-8");
        for (const [n, ligne] of contenu.split("\n").entries()) {
          if (/^\s*import\s.*extensions\/th2agent-ui/.test(ligne)) {
            fautifs.push(`${relatif}:${n + 1}: ${ligne.trim()}`);
          }
        }
      }
    };
    parcourir(NOYAU);

    expect(fautifs, `le noyau importe une brique :\n  ${fautifs.join("\n  ")}`).toEqual([]);
  });

  it("AuthScreen ne contient plus aucun bouton de connexion par fournisseur", () => {
    const source = fs.readFileSync(
      path.join(NOYAU, "components/auth/AuthScreen.jsx"),
      "utf-8",
    );
    for (const fournisseur of ["accounts.google.com", "github.com/login/oauth", "linkedin.com/oauth"]) {
      expect(source).not.toContain(fournisseur);
    }
    expect(source).toContain('name="auth.providers"');
  });

  it("MainLayout ne connaît plus la jauge de crédit", () => {
    const source = fs.readFileSync(path.join(NOYAU, "components/MainLayout.jsx"), "utf-8");
    expect(source).not.toContain("QuotaMeter");
    expect(source).toContain('name="sidebar.footer"');
  });

  /**
   * Le verrou qui manquait, et qui a laissé passer une vraie fuite.
   *
   * Les tests ci-dessus vérifient que le noyau **n'importe pas** la brique.
   * Ils ne disaient rien de ce qui **reste** dans `src/` : le MFA et les libs
   * de quota y sont restés après le premier découpage, et sont partis tels
   * quels dans `apowerb/th2agent-front`. Le pendant back
   * (`test_les_modules_ont_quitte_le_noyau`) liste nommément les fichiers
   * bannis — c'est ce que fait celui-ci.
   */
  it("aucun fichier commercial ne reste dans src/", () => {
    const bannis = [
      "components/auth/MfaSetupFlow.jsx",
      "components/auth/MfaVerifyModal.jsx",
      "components/QuotaMeter.jsx",
      "components/QuotaBanner.jsx",
      "components/UsagePage.jsx",
      "components/AgentUsagePage.jsx",
      "hooks/useQuota.js",
      "lib/quotaMeter.js",
      "lib/quotaStore.js",
      "lib/usage.js",
    ];
    const presents = bannis.filter((rel) => fs.existsSync(path.join(NOYAU, rel)));
    expect(presents, `code commercial encore dans src/: ${presents.join(", ")}`).toEqual([]);
  });

  it("le vocabulaire commercial a quitté le contexte d'authentification", () => {
    const source = fs.readFileSync(path.join(NOYAU, "contexts/AuthContext.jsx"), "utf-8");
    // Le noyau manipule un défi OPAQUE — il ne sait pas ce qu'est un « MFA ».
    expect(source).not.toMatch(/\bmfa/i);
    expect(source).toContain("pendingChallenge");
    expect(source).toContain("getAuthChallenge");
  });
});

describe("le manifeste est la seule frontière", () => {
  /**
   * Ce fichier part dans le dépôt public : il doit donc passer avec un
   * manifeste **vide**. Il vérifie le contrat du manifeste, jamais son contenu
   * — « la brique remplit tel emplacement » est une assertion de brique, et
   * elle vit dans `extensions/th2agent-ui-advanced/__tests__/`.
   */
  it("chaque brique déclarée expose register() et un nom", async () => {
    const { bricks } = await import("../installed");
    for (const brique of bricks) {
      expect(typeof brique.register).toBe("function");
      expect(typeof brique.name).toBe("string");
    }
  });

  it("un manifeste vide est un état valide, pas une panne", async () => {
    const { installExtensions, _resetInstallation } = await import("../index");
    _resetInstallation();
    expect(() => installExtensions()).not.toThrow();
  });
});
