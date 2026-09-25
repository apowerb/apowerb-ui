import { describe, it, expect } from "vitest";
import { buildFilterOptions, nonEmptyCategories, filterAndSortTools } from "../toolsManagerUtils";

/**
 * Régression : l'API renvoie des catégories sans aucun outil. Elles gonflaient
 * le compteur de l'en-tête (32 annoncées contre 28 listées) et produisaient des
 * puces de filtre menant à « No tools match the current filters ».
 * Relevé en production le 17/09/2026 (apowerb/roadmap#73).
 */
describe("les catégories vides ne sont ni comptées ni proposées au filtrage", () => {
  const availableTools = {
    basic: ["tool_a", "tool_b"],
    rag: ["tool_c"],
    google_auth: [],        // renvoyée par l'API, sans aucun outil
    integration_status: [],
  };

  it("nonEmptyCategories ne garde que celles qui ont des outils", () => {
    expect(nonEmptyCategories(availableTools)).toEqual(["basic", "rag"]);
  });

  it("le compteur de l'en-tête correspond au nombre de catégories listées", () => {
    const listees = filterAndSortTools(availableTools, {
      toolSearch: "",
      categoryFilter: "all",
      toolSortAsc: true,
    });
    expect(nonEmptyCategories(availableTools).length).toBe(listees.length);
  });

  it("aucune puce de filtre ne mène à une liste vide", () => {
    const puces = buildFilterOptions(availableTools)
      .map((o) => o.key)
      .filter((k) => k !== "all");

    for (const key of puces) {
      const resultat = filterAndSortTools(availableTools, {
        toolSearch: "",
        categoryFilter: key,
        toolSortAsc: true,
      });
      expect(resultat.length, `le filtre ${key} ne donne aucun resultat`).toBeGreaterThan(0);
    }
  });
});
