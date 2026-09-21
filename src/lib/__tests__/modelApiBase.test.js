import { describe, it, expect } from "vitest";
import { isValidModelApiBase, withModelApiBase } from "@/lib/modelApiBase";

describe("isValidModelApiBase", () => {
  it("accepte le vide : le champ est optionnel", () => {
    expect(isValidModelApiBase("")).toBe(true);
    expect(isValidModelApiBase("   ")).toBe(true);
    expect(isValidModelApiBase(undefined)).toBe(true);
  });

  it("accepte une URL http(s) absolue, espaces autour compris", () => {
    expect(isValidModelApiBase("https://mon-org.services.ai.azure.com/models")).toBe(true);
    expect(isValidModelApiBase("  http://10.0.0.5:4000/v1 ")).toBe(true);
  });

  it("refuse ce qui n'est pas une adresse http(s) complète", () => {
    for (const bad of ["api.openai.com/v1", "ftp://host/v1", "https://", "not a url", "javascript:alert(1)"]) {
      expect(isValidModelApiBase(bad), bad).toBe(false);
    }
  });
});

describe("withModelApiBase", () => {
  it("envoie l'URL nettoyée et garde les autres params", () => {
    expect(withModelApiBase({ model_api_base: " https://x.example/v1 ", temperature: 0.2 })).toEqual({
      model_api_base: "https://x.example/v1",
      temperature: 0.2,
    });
  });

  it("retire la clé quand le champ est vidé : c'est ainsi qu'on efface l'URL enregistrée", () => {
    expect(withModelApiBase({ model_api_base: "  ", temperature: 0.2 })).toEqual({ temperature: 0.2 });
    expect(withModelApiBase(null)).toEqual({});
  });
});
