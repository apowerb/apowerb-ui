import { describe, it, expect } from "vitest";
import {
  STATUS_COLORS,
  CATEGORICAL_PALETTE,
  colorForCategory,
  formatChartLabel,
  formatChartValue,
  humanizeAxisLabel,
  humanizeColumnName,
  resolveTone,
} from "@/lib/chart-tokens";

describe("STATUS_COLORS", () => {
  it("covers the order-reconciliation statuses documented in the agent prompt", () => {
    for (const status of ["OK", "NON_CONFORME", "NEEDS_HUMAN_REVIEW", "ORDER_NOT_FOUND"]) {
      expect(STATUS_COLORS[status]).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it("covers every TypeEcart code from the agent prompt", () => {
    for (const code of [
      "PRICE_MISMATCH",
      "QTY_MISMATCH",
      "DATE_MISMATCH",
      "LINE_MISSING_ON_AR",
      "LINE_NOT_IN_PO",
    ]) {
      expect(STATUS_COLORS[code]).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it("uses emerald for OK so the dashboard reads 'go' at a glance", () => {
    expect(STATUS_COLORS.OK).toBe("#10b981");
  });

  it("does NOT use the same colour for OK and NON_CONFORME", () => {
    // The bug we are fixing — every bar was blue on prod.
    expect(STATUS_COLORS.OK).not.toBe(STATUS_COLORS.NON_CONFORME);
  });
});

describe("colorForCategory — exact match", () => {
  it("returns the semantic colour for a known status", () => {
    expect(colorForCategory("OK", 0)).toBe(STATUS_COLORS.OK);
    expect(colorForCategory("NON_CONFORME", 0)).toBe(STATUS_COLORS.NON_CONFORME);
    expect(colorForCategory("PRICE_MISMATCH", 0)).toBe(STATUS_COLORS.PRICE_MISMATCH);
    expect(colorForCategory("LINE_NOT_IN_PO", 0)).toBe(STATUS_COLORS.LINE_NOT_IN_PO);
  });

  it("ignores the index when a semantic match exists", () => {
    // The whole point: OK is green even if it lands at index 7 of a chart.
    expect(colorForCategory("OK", 7)).toBe(STATUS_COLORS.OK);
  });

  it("survives null / undefined inputs", () => {
    expect(colorForCategory(null, 0)).toBe(CATEGORICAL_PALETTE[0]);
    expect(colorForCategory(undefined, 0)).toBe(CATEGORICAL_PALETTE[0]);
  });
});

describe("colorForCategory — compound series names (v2)", () => {
  it("resolves `ok_count` to OK emerald", () => {
    expect(colorForCategory("ok_count", 0)).toBe(STATUS_COLORS.OK);
  });

  it("resolves `non_conforme_count` to NON_CONFORME amber", () => {
    expect(colorForCategory("non_conforme_count", 1)).toBe(STATUS_COLORS.NON_CONFORME);
  });

  it("resolves `ars_ok` and `ars_non_conforme`", () => {
    expect(colorForCategory("ars_ok", 0)).toBe(STATUS_COLORS.OK);
    expect(colorForCategory("ars_non_conforme", 1)).toBe(STATUS_COLORS.NON_CONFORME);
  });

  it("resolves camelCase columns", () => {
    expect(colorForCategory("nbOk", 0)).toBe(STATUS_COLORS.OK);
    expect(colorForCategory("nbNonConforme", 1)).toBe(STATUS_COLORS.NON_CONFORME);
  });

  it("resolves multi-token status (`needs_review`)", () => {
    expect(colorForCategory("needs_review_count", 0)).toBe(STATUS_COLORS.NEEDS_HUMAN_REVIEW);
  });

  it("prefers the longest alias on collision", () => {
    // "non_conforme" must win over "non" — same colour either way for
    // the principle protects future aliases.
    expect(colorForCategory("non_conforme", 0)).toBe(STATUS_COLORS.NON_CONFORME);
  });

  it("does NOT match aliases inside unrelated words", () => {
    // "broker_count" must NOT pick up "ok" via substring match.
    // (tokenize splits on _ so `ok` is a token in `ok_count`, but
    // never in `broker_count`.)
    expect(colorForCategory("broker_count", 0)).toBe(CATEGORICAL_PALETTE[0]);
  });

  it("falls back to categorical palette when no alias matches", () => {
    expect(colorForCategory("fournisseur_acme", 0)).toBe(CATEGORICAL_PALETTE[0]);
    expect(colorForCategory("fournisseur_beta", 1)).toBe(CATEGORICAL_PALETTE[1]);
  });

  it("handles boolean-ish strings on either side", () => {
    expect(colorForCategory("yes", 0)).toBe(STATUS_COLORS.OK);
    expect(colorForCategory("no", 0)).toBe("#ef4444");
  });
});

describe("formatChartLabel", () => {
  it("formats ISO dates in compact French", () => {
    const out = formatChartLabel("2026-05-12");
    expect(out).not.toBe("2026-05-12");
    expect(out).toMatch(/mai/i);
  });

  it("returns non-date values verbatim", () => {
    expect(formatChartLabel("OK")).toBe("OK");
    expect(formatChartLabel(42)).toBe("42");
  });

  it("returns an em-dash for null / undefined", () => {
    expect(formatChartLabel(null)).toBe("—");
  });
});

describe("humanizeAxisLabel (v2)", () => {
  it("translates statuses to readable French", () => {
    expect(humanizeAxisLabel("NON_CONFORME")).toBe("Non conformes");
    expect(humanizeAxisLabel("NEEDS_HUMAN_REVIEW")).toBe("À revoir");
    expect(humanizeAxisLabel("ORDER_NOT_FOUND")).toBe("Commande absente");
  });

  it("translates TypeEcart codes", () => {
    expect(humanizeAxisLabel("PRICE_MISMATCH")).toBe("Prix");
    expect(humanizeAxisLabel("QTY_MISMATCH")).toBe("Quantité");
    expect(humanizeAxisLabel("DATE_MISMATCH")).toBe("Date");
    expect(humanizeAxisLabel("LINE_NOT_IN_PO")).toBe("Ligne hors PO");
  });

  it("falls through to date formatting on ISO inputs", () => {
    expect(humanizeAxisLabel("2026-05-12")).toMatch(/mai/i);
  });

  it("passes unknown labels through", () => {
    expect(humanizeAxisLabel("Fournisseur Acme")).toBe("Fournisseur Acme");
  });
});

describe("formatChartValue", () => {
  it("formats numbers with French thousands separators", () => {
    expect(formatChartValue(12345)).toMatch(/12.345/);
  });

  it("keeps up to 2 decimals on floats", () => {
    expect(formatChartValue(4.947)).toMatch(/4,95|4\.95/);
  });

  it("strips trailing zeroes on integers", () => {
    expect(formatChartValue(42)).toBe("42");
  });

  it("falls back to String() for non-numeric values", () => {
    expect(formatChartValue("hello")).toBe("hello");
  });
});

describe("humanizeColumnName (v2)", () => {
  it("returns the curated French label when present", () => {
    expect(humanizeColumnName("nb_ars")).toBe("ARs traités");
    expect(humanizeColumnName("ars_non_conforme")).toBe("ARs non conformes");
  });

  it("recognises mixed-case DB column names (StatutGlobal, FournisseurNom)", () => {
    expect(humanizeColumnName("FournisseurNom")).toBe("Fournisseur");
    expect(humanizeColumnName("StatutGlobal")).toBe("Statut");
    expect(humanizeColumnName("NumeroCommande")).toBe("N° commande");
  });

  it("title-cases snake_case columns it does not know", () => {
    expect(humanizeColumnName("some_obscure_column")).toBe("Some Obscure Column");
  });

  it("returns empty string on falsy input", () => {
    expect(humanizeColumnName("")).toBe("");
    expect(humanizeColumnName(null)).toBe("");
  });
});

describe("resolveTone (v2)", () => {
  it("returns 'neutral' when no thresholds are provided", () => {
    expect(resolveTone(42, undefined)).toBe("neutral");
    expect(resolveTone(42, null)).toBe("neutral");
  });

  it("supports higher_is_better (default direction)", () => {
    const cfg = { warning: 0.8, danger: 0.5 };
    expect(resolveTone(0.95, cfg)).toBe("success");
    expect(resolveTone(0.75, cfg)).toBe("warning");
    expect(resolveTone(0.4, cfg)).toBe("danger");
  });

  it("supports lower_is_better (e.g. cycle time)", () => {
    const cfg = { warning: 100, danger: 200, direction: "lower_is_better" };
    expect(resolveTone(50, cfg)).toBe("success");
    expect(resolveTone(150, cfg)).toBe("warning");
    expect(resolveTone(250, cfg)).toBe("danger");
  });

  it("returns 'neutral' on non-numeric input", () => {
    expect(resolveTone("hello", { warning: 100 })).toBe("neutral");
    expect(resolveTone(null, { warning: 100 })).toBe("neutral");
  });

  it("Conformité KPI under target turns warning, not neutral", () => {
    // Real scenario: a dashboard shows Compliance at 59.1%. It must be
    // warning, not the neutral grey it currently renders.
    const cfg = { warning: 0.8, danger: 0.5 };
    expect(resolveTone(0.591, cfg)).toBe("warning");
  });
});
