import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import en from "../../../../../../messages/en.json";
import fr from "../../../../../../messages/fr.json";

const dir = path.resolve(__dirname, "..");
const files = readdirSync(dir).filter((f) => /\.(jsx?|js)$/.test(f));
const get = (obj, key) => key.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);

describe("biEditor i18n", () => {
  const keys = new Set();
  for (const f of files) {
    const src = readFileSync(path.join(dir, f), "utf8");
    for (const m of src.matchAll(/\bt\(\s*"([A-Za-z0-9_.]+)"/g)) keys.add(m[1]);
  }
  const dynamic = {
    "color.": ["good", "warn", "bad", "muted", "accent"],
    "mark.": ["bar", "line", "area"],
    "provenance.": ["real", "simulated", "forecast"],
    "stepKind.": ["start", "increase", "decrease", "end"],
    "sorts.": ["x_asc", "x_desc", "value_asc", "value_desc"],
    "types.": ["kpi", "combo", "bar", "hbar", "diverging_bar", "line", "area", "pie", "waterfall", "forecast", "table", "text", "note"],
    "typeHints.": ["kpi", "combo", "bar", "hbar", "diverging_bar", "line", "area", "pie", "waterfall", "forecast", "table", "text", "note"],
    "formats.": ["number", "integer", "compact", "percent", "decimal1", "decimal2", "weeks"],
    "filterTypes.": ["select", "multi", "relative_period", "date_range"],
    "period.": ["13w", "26w", "52w", "3m", "12m", "all"],
    "kind.": ["dataset", "sql", "source", "connector"],
    "connector.": ["database", "onedrive_excel", "google_drive", "agent", "csv"],
    "fieldType.": ["string", "number", "date", "boolean"],
    "tabs.": ["block", "data", "filters", "add"],
  };
  for (const [p, vs] of Object.entries(dynamic)) vs.forEach((v) => keys.add(p + v));

  it("has every used key in en and fr", () => {
    expect(keys.size).toBeGreaterThan(100);
    for (const k of keys) {
      expect(typeof get(en.biEditor, k), `en ${k}`).toBe("string");
      expect(typeof get(fr.biEditor, k), `fr ${k}`).toBe("string");
    }
  });
});
