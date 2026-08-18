import { afterEach, describe, expect, it } from "vitest";

import {
  navItemsFor,
  registerNavItem,
  resetRegistry,
} from "../registry";

/**
 * La navigation était le dernier endroit où le noyau nommait une fonctionnalité
 * vendue. `/usage` était écrit en dur dans `MainLayout`, alors que la page
 * n'existe que dans la brique : toute installation open source affichait une
 * entrée de menu qui rend 404. Constaté en production le 18/08.
 *
 * Même principe que les autres emplacements : le noyau déclare des groupes, les
 * briques y déposent leurs entrées. Sans brique, le groupe est vide et le menu
 * ne montre que ce que le produit contient réellement.
 */
afterEach(() => {
  resetRegistry();
});

describe("entrées de navigation apportées par les briques", () => {
  it("ne propose rien tant qu'aucune brique ne s'est enregistrée", () => {
    // C'est l'édition open source : pas un menu incomplet, le menu exact.
    expect(navItemsFor("groupAgentOps")).toEqual([]);
  });

  it("rend l'entrée déposée par une brique", () => {
    registerNavItem("groupAgentOps", { path: "/usage", labelKey: "usage" });

    expect(navItemsFor("groupAgentOps")).toEqual([
      { path: "/usage", labelKey: "usage" },
    ]);
  });

  it("garde l'ordre d'enregistrement dans un même groupe", () => {
    registerNavItem("groupAgentOps", { path: "/usage", labelKey: "usage" });
    registerNavItem("groupAgentOps", { path: "/supervision", labelKey: "sup" });

    expect(navItemsFor("groupAgentOps").map((i) => i.path)).toEqual([
      "/usage",
      "/supervision",
    ]);
  });

  it("sépare les groupes", () => {
    registerNavItem("groupAgentOps", { path: "/usage", labelKey: "usage" });

    expect(navItemsFor("groupDiscover")).toEqual([]);
  });

  it("refuse une entrée sans chemin, plutôt que de rendre un lien mort", () => {
    // Une entrée sans `path` produirait exactement le défaut qu'on corrige.
    expect(() => registerNavItem("groupAgentOps", { labelKey: "x" })).toThrow();
    expect(() => registerNavItem("", { path: "/x" })).toThrow();
  });

  it("est vidé par resetRegistry, comme les autres emplacements", () => {
    registerNavItem("groupAgentOps", { path: "/usage", labelKey: "usage" });
    resetRegistry();

    expect(navItemsFor("groupAgentOps")).toEqual([]);
  });
});
