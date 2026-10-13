import { describe, it, expect } from "vitest";
import {
  autoMap,
  columnName,
  filterByName,
  normalizeType,
  prefillMapping,
  typeMismatch,
  isNewerVersion,
} from "../templateLib";

describe("normalizeType", () => {
  it.each([
    ["date", "date"],
    ["datetime64[ns]", "date"],
    ["int", "number"],
    ["float", "number"],
    ["int64", "number"],
    ["number", "number"],
    ["string", "string"],
    ["object", "string"],
  ])("maps %s to %s", (raw, expected) => {
    expect(normalizeType(raw)).toBe(expected);
  });

  it("returns null for an unknown or missing type", () => {
    expect(normalizeType("bool")).toBeNull();
    expect(normalizeType(undefined)).toBeNull();
  });
});

describe("typeMismatch", () => {
  it("returns the actual normalized type when it differs from the expected one", () => {
    expect(typeMismatch("number", "string")).toBe("string");
    expect(typeMismatch("date", "int")).toBe("number");
  });

  it("is silent when types agree, when the actual type is unknown or nothing is chosen", () => {
    expect(typeMismatch("number", "float")).toBeNull();
    expect(typeMismatch("number", "bool")).toBeNull();
    expect(typeMismatch("number", undefined)).toBeNull();
  });
});

describe("filterByName", () => {
  const ds = [{ filename: "Ventes-2025.csv" }, { filename: "stock.xlsx" }];
  it("keeps everything for an empty query", () => {
    expect(filterByName(ds, "  ", (d) => d.filename)).toHaveLength(2);
  });
  it("matches a substring, case-insensitively", () => {
    expect(filterByName(ds, "VENT", (d) => d.filename)).toEqual([ds[0]]);
    expect(filterByName(ds, "zzz", (d) => d.filename)).toEqual([]);
  });
});

describe("autoMap", () => {
  const cols = [
    { key: "date", default: "semaine" },
    { key: "stock", default: "stock" },
    { key: "site", default: null },
  ];
  it("preselects by default name, case-insensitively, and leaves the rest null", () => {
    expect(autoMap(cols, ["Semaine", "STOCK", "magasin"])).toEqual({
      date: "Semaine",
      stock: "STOCK",
      site: null,
    });
  });
});

describe("prefillMapping", () => {
  const reqs = [
    { key: "date", label: "Semaine", current: "week" },
    { key: "family", label: "Famille", current: "famille_old" },
    { key: "sales", label: "Ventes", current: null },
    { key: "site", label: "Site", current: null },
  ];
  it("prefers the current column, then a name match on the key or label", () => {
    expect(prefillMapping(reqs, ["week", "Famille", "ventes", "x"])).toEqual({
      date: "week",
      family: "Famille",
      sales: "ventes",
      site: null,
    });
  });
});

describe("isNewerVersion", () => {
  it("is true only when the template version is strictly greater", () => {
    expect(isNewerVersion(2, 1)).toBe(true);
    expect(isNewerVersion(1, 1)).toBe(false);
    expect(isNewerVersion(1, 2)).toBe(false);
    expect(isNewerVersion(undefined, 1)).toBe(false);
  });
});

describe("columnName", () => {
  it("accepts both a plain name and a {name,type} object", () => {
    expect(columnName("a")).toBe("a");
    expect(columnName({ name: "b", type: "date" })).toBe("b");
  });
});
