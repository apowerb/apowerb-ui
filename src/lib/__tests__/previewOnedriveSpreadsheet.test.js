import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { previewOnedriveSpreadsheet } from "../api";
import { authStorage } from "../authStorage";

describe("previewOnedriveSpreadsheet", () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    vi.spyOn(authStorage, "getToken").mockReturnValue("test-token");
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function okResponse(body) {
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      text: () => Promise.resolve(JSON.stringify(body)),
    };
  }

  it("POSTs to /api/v1/bi/onedrive/preview with the bearer token", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(
        okResponse({ columns: [], row_count: 0, sample_rows: [], sheet_name: null }),
      ),
    );

    await previewOnedriveSpreadsheet({
      itemPath: "Reports/Sales.xlsx",
      itemId: "file_42",
      sheetName: "Sheet1",
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe("/api/v1/bi/onedrive/preview");
    expect(options.method).toBe("POST");
    expect(options.headers.Authorization).toBe("Bearer test-token");
    expect(options.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(options.body)).toEqual({
      item_path: "Reports/Sales.xlsx",
      item_id: "file_42",
      sheet_name: "Sheet1",
    });
  });

  it("returns the parsed preview payload on 200", async () => {
    const payload = {
      columns: [{ name: "a", type: "string" }],
      row_count: 3,
      sample_rows: [{ a: "1" }, { a: "2" }, { a: "3" }],
      sheet_name: "Sheet1",
    };
    global.fetch = vi.fn(() => Promise.resolve(okResponse(payload)));

    const result = await previewOnedriveSpreadsheet({
      itemPath: "a.csv",
      itemId: null,
      sheetName: null,
    });

    expect(result).toEqual(payload);
  });

  it("throws an error with status property on non-2xx responses", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ detail: "not found" })),
      }),
    );

    await expect(
      previewOnedriveSpreadsheet({
        itemPath: "missing.xlsx",
        itemId: null,
        sheetName: null,
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
