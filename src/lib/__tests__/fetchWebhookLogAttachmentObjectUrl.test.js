import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";


import { fetchWebhookLogAttachmentObjectUrl } from "../api";
import {
  configureClient,
  resetClientConfig,
} from "@apowerb/sdk/config";

// api.js vit desormais dans packages/sdk : moquer le chemin
// "../authStorage" n'atteint plus le client. On injecte le stockage par la
// couture prevue pour cela, ce qui teste en prime le point d'extension.
const authStorage = {
  getToken: vi.fn(() => "tok-123"),
  setToken: vi.fn(),
  clear: vi.fn(),
};

function okBlobResponse() {
  return { ok: true, status: 200, blob: async () => new Blob(["%PDF"], { type: "application/pdf" }) };
}

describe("fetchWebhookLogAttachmentObjectUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configureClient({ storage: authStorage });
    authStorage.getToken.mockReturnValue("tok-123");
    global.fetch = vi.fn();
    URL.createObjectURL = vi.fn(() => "blob:created");
  });

  afterEach(() => {
    resetClientConfig();
    vi.restoreAllMocks();
  });

  it("fetches with Bearer token, encodes the filename, returns an object URL", async () => {
    global.fetch.mockResolvedValueOnce(okBlobResponse());
    const url = await fetchWebhookLogAttachmentObjectUrl(42, "bon commande.pdf");

    expect(url).toBe("blob:created");
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [calledUrl, opts] = global.fetch.mock.calls[0];
    expect(calledUrl).toBe(
      "/api/webhooks/logs/42/attachments/bon%20commande.pdf"
    );
    expect(opts.headers).toMatchObject({ Authorization: "Bearer tok-123" });
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  it("throws (with status) on a non-ok response", async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 404, blob: async () => new Blob() });
    await expect(fetchWebhookLogAttachmentObjectUrl(7, "x.pdf")).rejects.toMatchObject({ status: 404 });
  });

  it("on 401 refreshes the token, retries, and succeeds", async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: false, status: 401, blob: async () => new Blob() }) // first attempt
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ access_token: "fresh" }) }) // refresh
      .mockResolvedValueOnce(okBlobResponse()); // retry

    const url = await fetchWebhookLogAttachmentObjectUrl(9, "doc.pdf");

    expect(url).toBe("blob:created");
    expect(global.fetch).toHaveBeenCalledTimes(3);
    // retry carried the refreshed token
    const retryOpts = global.fetch.mock.calls[2][1];
    expect(retryOpts.headers).toMatchObject({ Authorization: "Bearer fresh" });
  });

  it("refresh succeeds but the retry still fails -> throws with the retry status", async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: false, status: 401, blob: async () => new Blob() }) // first attempt
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ access_token: "fresh" }) }) // refresh
      .mockResolvedValueOnce({ ok: false, status: 403, blob: async () => new Blob() }); // retry still denied

    await expect(fetchWebhookLogAttachmentObjectUrl(9, "doc.pdf")).rejects.toMatchObject({ status: 403 });
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("refresh fails (no new token) -> clears auth and throws 401", async () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent").mockImplementation(() => true);
    global.fetch
      .mockResolvedValueOnce({ ok: false, status: 401, blob: async () => new Blob() }) // first attempt
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) }); // refresh fails -> null token

    await expect(fetchWebhookLogAttachmentObjectUrl(9, "doc.pdf")).rejects.toMatchObject({ status: 401 });
    expect(authStorage.clear).toHaveBeenCalled();
    expect(dispatchSpy).toHaveBeenCalled();
    // We stopped here: no third fetch, no blob created.
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});
