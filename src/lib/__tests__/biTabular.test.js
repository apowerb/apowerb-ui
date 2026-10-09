import { describe, expect, it } from "vitest";
import { BI_TABULAR_ACCEPT, BI_TABULAR_EXTENSIONS, isBiTabularFile } from "../biTabular";

describe("BI tabular import formats", () => {
  it("accepts the formats the backend converts, not only CSV", () => {
    for (const ext of [".csv", ".tsv", ".xlsx", ".xls", ".ods", ".json", ".jsonl", ".parquet"]) {
      expect(BI_TABULAR_EXTENSIONS).toContain(ext);
    }
    expect(BI_TABULAR_ACCEPT.split(",")).toEqual(BI_TABULAR_EXTENSIONS);
  });

  it("recognises file names case-insensitively", () => {
    expect(isBiTabularFile("Ventes 2025.XLSX")).toBe(true);
    expect(isBiTabularFile("stock.parquet")).toBe(true);
    expect(isBiTabularFile("rapport.pdf")).toBe(false);
    expect(isBiTabularFile(undefined)).toBe(false);
  });
});
