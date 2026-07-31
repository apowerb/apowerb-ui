import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useOAuthPopup } from "../useOAuthPopup";

describe("useOAuthPopup", () => {
  let originalOpen;
  let originalFetch;
  let originalAddEventListener;
  let originalRemoveEventListener;

  beforeEach(() => {
    originalOpen = window.open;
    originalFetch = global.fetch;
    originalAddEventListener = window.addEventListener;
    originalRemoveEventListener = window.removeEventListener;

    vi.useFakeTimers({ shouldAdvanceTime: true });
    Storage.prototype.getItem = vi.fn(() => "fake_token");
    Storage.prototype.setItem = vi.fn();
  });

  afterEach(() => {
    window.open = originalOpen;
    global.fetch = originalFetch;
    window.addEventListener = originalAddEventListener;
    window.removeEventListener = originalRemoveEventListener;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns openOAuth function", () => {
    const { result } = renderHook(() =>
      useOAuthPopup({ onSuccess: vi.fn(), onFailure: vi.fn(), onCancel: vi.fn() })
    );
    expect(typeof result.current.openOAuth).toBe("function");
  });

  it("calls onFailure with popup_blocked when popup is null", async () => {
    window.open = vi.fn(() => null);
    const onFailure = vi.fn();

    const { result } = renderHook(() =>
      useOAuthPopup({ onSuccess: vi.fn(), onFailure, onCancel: vi.fn() })
    );

    await act(async () => {
      await result.current.openOAuth("google_drive");
    });

    expect(onFailure).toHaveBeenCalledWith("popup_blocked");
  });

  it("calls onFailure for odoo provider (no OAuth support)", async () => {
    const onFailure = vi.fn();

    const { result } = renderHook(() =>
      useOAuthPopup({ onSuccess: vi.fn(), onFailure, onCancel: vi.fn() })
    );

    await act(async () => {
      await result.current.openOAuth("odoo");
    });

    expect(onFailure).toHaveBeenCalledWith("odoo_not_supported");
  });

  it("opens popup and fetches connect URL for google_drive", async () => {
    const mockPopup = {
      closed: false,
      location: {},
      close: vi.fn(),
    };
    window.open = vi.fn(() => mockPopup);
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ url: "https://accounts.google.com/o/oauth2/auth?..." }),
      })
    );

    const onSuccess = vi.fn();
    const { result } = renderHook(() =>
      useOAuthPopup({ onSuccess, onFailure: vi.fn(), onCancel: vi.fn() })
    );

    await act(async () => {
      await result.current.openOAuth("google_drive");
    });

    expect(window.open).toHaveBeenCalledWith(
      "about:blank",
      "oauth_popup",
      expect.stringContaining("width=500")
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/integrations/google/connect"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer fake_token",
        }),
      })
    );
    expect(mockPopup.location.href).toBe("https://accounts.google.com/o/oauth2/auth?...");
  });

  it("stores google_oauth_service in localStorage for Google providers", async () => {
    const mockPopup = { closed: false, location: {}, close: vi.fn() };
    window.open = vi.fn(() => mockPopup);
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ url: "https://accounts.google.com/auth" }),
      })
    );

    const { result } = renderHook(() =>
      useOAuthPopup({ onSuccess: vi.fn(), onFailure: vi.fn(), onCancel: vi.fn() })
    );

    await act(async () => {
      await result.current.openOAuth("google_gmail");
    });

    expect(localStorage.setItem).toHaveBeenCalledWith("google_oauth_service", "google_gmail");
  });
});
