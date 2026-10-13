import { describe, it, expect } from "vitest";
import { toSourceSpec } from "../sources";

const empty = { transforms: [], fields: [], measures: [] };

describe("toSourceSpec", () => {
  it("maps an imported or Data pool file to a dataset source", () => {
    expect(toSourceSpec({ type: "csv", file_id: "f-1", filename: "Ventes 2026.csv" })).toEqual({
      name: "ventes_2026",
      label: "Ventes 2026",
      kind: "dataset",
      dataset_id: "f-1",
      ...empty,
    });
  });

  it("maps a database table to a connector source with its query", () => {
    const spec = toSourceSpec({ type: "db", connection_config_id: 7, query: "SELECT * FROM stock", dbName: "erp", configName: "ERP" });
    expect(spec).toEqual({
      name: "stock",
      label: "stock (ERP)",
      kind: "connector",
      source_type: "database",
      connection_config_id: 7,
      query: "SELECT * FROM stock",
      ...empty,
    });
  });

  it("maps a OneDrive workbook to a connector source", () => {
    const spec = toSourceSpec({ type: "onedrive_excel", item_id: "it-9", item_path: "/Docs/stock.xlsx", filename: "stock.xlsx" });
    expect(spec).toMatchObject({
      name: "stock",
      kind: "connector",
      source_type: "onedrive_excel",
      source_options: { item_id: "it-9", item_path: "/Docs/stock.xlsx" },
    });
  });

  it("maps agents to a connector source and omits an empty instruction", () => {
    expect(toSourceSpec({ type: "agent", agent_ids: [3, 4], message: "" })).toMatchObject({
      kind: "connector",
      source_type: "agent",
      source_options: { agent_ids: [3, 4] },
    });
    expect(toSourceSpec({ type: "agent", agent_ids: [3], message: "Stock du jour" }).source_options).toEqual({ agent_ids: [3], message: "Stock du jour" });
  });

  it("gives each source a unique name", () => {
    const pick = { type: "csv", file_id: "f-2", filename: "ventes.csv" };
    expect(toSourceSpec(pick, ["ventes"]).name).toBe("ventes_2");
    expect(toSourceSpec(pick, ["ventes"], "Ventes N-1")).toMatchObject({ name: "ventes_n_1", label: "Ventes N-1" });
  });

  it("rejects an unknown pick", () => {
    expect(() => toSourceSpec({ type: "ftp" })).toThrow(/ftp/);
  });
});
