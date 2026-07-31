import { describe, it, expect } from "vitest";
import { formatDateTime, formatDate, toDateTimeLocalValue } from "@/lib/datetime";

// UTC instants with known Paris-time equivalents:
//   2024-01-15T12:00:00Z → 13:00 heure Paris (CET = UTC+1, hiver)
//   2024-07-15T12:00:00Z → 14:00 heure Paris (CEST = UTC+2, été)
// On vérifie le DST ici — on ne hardcode PAS +2.

describe("formatDateTime", () => {
  it("affiche l'heure de Paris en hiver (CET = UTC+1)", () => {
    // 2024-01-15 12:00 UTC → 13:00 CET
    const result = formatDateTime("2024-01-15T12:00:00Z");
    expect(result).toMatch(/13[h:.]00/);
  });

  it("affiche l'heure de Paris en été (CEST = UTC+2)", () => {
    // 2024-07-15 12:00 UTC → 14:00 CEST
    const result = formatDateTime("2024-07-15T12:00:00Z");
    expect(result).toMatch(/14[h:.]00/);
  });

  it("parse un timestamp UTC naïf (sans Z) comme UTC", () => {
    // Le backend renvoie parfois "2024-01-15T12:00:00" sans Z (DateTime naïf).
    // On doit le traiter comme UTC, pas heure locale.
    const result = formatDateTime("2024-01-15T12:00:00");
    expect(result).toMatch(/13[h:.]00/);
  });

  it("renvoie '—' pour une valeur nulle", () => {
    expect(formatDateTime(null)).toBe("—");
  });

  it("renvoie '—' pour une valeur undefined", () => {
    expect(formatDateTime(undefined)).toBe("—");
  });

  it("renvoie '—' pour une chaîne invalide", () => {
    expect(formatDateTime("not-a-date")).toBe("—");
  });

  it("accepte un timestamp numérique (ms)", () => {
    // 2024-07-15T12:00:00Z en ms
    const ts = new Date("2024-07-15T12:00:00Z").getTime();
    const result = formatDateTime(ts);
    expect(result).toMatch(/14[h:.]00/);
  });

  it("contient la date en format français", () => {
    const result = formatDateTime("2024-01-15T12:00:00Z");
    // fr-FR : "15 janv." ou "15/01/2024" ou "15 janvier 2024"
    expect(result).toMatch(/15/);
    expect(result).toMatch(/jan/i);
  });
});

describe("formatDate", () => {
  it("retourne uniquement la date sans heure", () => {
    const result = formatDate("2024-01-15T12:00:00Z");
    // Pas de ":"
    expect(result).not.toMatch(/\d{2}:\d{2}/);
    expect(result).toMatch(/15/);
  });

  it("renvoie '—' pour null", () => {
    expect(formatDate(null)).toBe("—");
  });

  it("renvoie '—' pour undefined", () => {
    expect(formatDate(undefined)).toBe("—");
  });

  it("renvoie '—' pour une chaîne invalide", () => {
    expect(formatDate("not-a-date")).toBe("—");
  });

  it("parse un timestamp UTC naïf (sans Z) comme UTC", () => {
    // 2024-07-15T22:00:00 naïf UTC → 15 juil. Paris (CEST UTC+2 = 00:00 le 16, mais date locale Paris = 16)
    // Mais 2024-07-15T00:30:00 UTC naïf → 02:30 CEST → encore le 15 juil
    const result = formatDate("2024-07-15T00:30:00");
    expect(result).toMatch(/15/);
  });
});


describe("toDateTimeLocalValue", () => {
  // Propriete cle (independante du fuseau CI) : la chaine wall-clock
  // produite, re-parsee comme heure LOCALE, doit redonner l'instant
  // d'origine (a la minute). C'est ce qu'attend un <input datetime-local>.
  it("round-trip ete (UTC -> local -> UTC) a la minute", () => {
    const local = toDateTimeLocalValue("2026-07-15T12:00:00Z");
    expect(new Date(local).getTime()).toBe(Date.UTC(2026, 6, 15, 12, 0));
  });

  it("round-trip hiver", () => {
    const local = toDateTimeLocalValue("2026-01-15T12:00:00Z");
    expect(new Date(local).getTime()).toBe(Date.UTC(2026, 0, 15, 12, 0));
  });

  it("traite un timestamp UTC naif (sans Z) comme UTC", () => {
    const local = toDateTimeLocalValue("2026-07-15T12:00:00");
    expect(new Date(local).getTime()).toBe(Date.UTC(2026, 6, 15, 12, 0));
  });

  it("format YYYY-MM-DDTHH:MM (compatible input datetime-local)", () => {
    expect(toDateTimeLocalValue("2026-07-15T12:00:00Z")).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
    );
  });

  it("renvoie '' pour null/undefined/invalide", () => {
    expect(toDateTimeLocalValue(null)).toBe("");
    expect(toDateTimeLocalValue(undefined)).toBe("");
    expect(toDateTimeLocalValue("not-a-date")).toBe("");
  });
});
