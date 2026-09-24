import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetClientConfig } from "../config.js";
import { postForecast } from "../api.js";

function mockFetchOnce(payload, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status < 400,
    status,
    text: async () => JSON.stringify(payload),
  });
  globalThis.fetch = fetchMock;
  return fetchMock;
}

beforeEach(() => {
  resetClientConfig();
});

afterEach(() => {
  resetClientConfig();
  vi.restoreAllMocks();
});

describe("postForecast", () => {
  it("POSTs to /api/v1/forecast and returns the success payload as-is", async () => {
    const payload = { status: "success", series: [{ model: "prophet" }] };
    const fetchMock = mockFetchOnce(payload, 200);

    const result = await postForecast({ data: [], date_var: "date", target_var: "sales" });

    expect(result).toEqual(payload);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/v1/forecast");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toMatchObject({ date_var: "date", target_var: "sales" });
  });

  it("parses the contract's field-level errors on 400 instead of a generic message", async () => {
    mockFetchOnce(
      {
        status: "error",
        errors: [{ field: "date_var", message: "Colonne 'dat' absente ; colonnes disponibles : date, sales" }],
      },
      400,
    );

    await expect(postForecast({})).rejects.toMatchObject({
      status: 400,
      errors: [{ field: "date_var", message: "Colonne 'dat' absente ; colonnes disponibles : date, sales" }],
    });
  });

  it("surfaces a 503 as a structured error naming the missing config", async () => {
    mockFetchOnce(
      { status: "error", errors: [{ field: null, message: "Service de prévision non configuré (TH2FORECAST_URL)" }] },
      503,
    );

    await expect(postForecast({})).rejects.toMatchObject({
      status: 503,
      errors: [{ field: null, message: "Service de prévision non configuré (TH2FORECAST_URL)" }],
    });
  });

  it("forwards an AbortSignal so the caller can cancel the computation", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn().mockImplementation((url, init) => {
      expect(init.signal).toBe(controller.signal);
      return Promise.resolve({ ok: true, status: 200, text: async () => JSON.stringify({ status: "success" }) });
    });
    globalThis.fetch = fetchMock;

    await postForecast({}, { signal: controller.signal });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("postForecast — request validation (422)", () => {
  it("maps FastAPI validation details to the field-named errors of the forecast contract", async () => {
    mockFetchOnce(
      {
        detail: [
          {
            type: "less_than_equal",
            loc: ["body", "horizon"],
            msg: "Input should be less than or equal to 366",
            input: 500,
            ctx: { le: 366 },
          },
        ],
      },
      422,
    );

    await expect(postForecast({})).rejects.toMatchObject({
      status: 422,
      message: "Input should be less than or equal to 366",
      errors: [
        { field: "horizon", message: "Input should be less than or equal to 366", type: "less_than_equal", limit: 366 },
      ],
    });
  });
});
