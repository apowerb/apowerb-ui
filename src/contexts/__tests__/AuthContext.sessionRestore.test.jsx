/**
 * A server that is briefly unreachable must not sign the user out.
 *
 * A page loaded while the API was being redeployed sent the user back to
 * /login. On mount, the session check
 * cleared the stored credentials as soon as the profile request failed —
 * whatever the reason, a 503 or a dropped connection included. Only a
 * refusal of the credentials (401/403) may end the session.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("@/extensions/registry", () => ({ getAuthChallenge: () => null }));

const stored = { user: null, token: null };
const authStorage = {
  getUser: () => stored.user,
  getToken: () => stored.token,
  setUser: (u) => {
    stored.user = u;
  },
  setToken: (t) => {
    stored.token = t;
  },
  clear: vi.fn(() => {
    stored.user = null;
    stored.token = null;
  }),
};
const authApi = { getProfile: vi.fn(), refreshToken: vi.fn() };
vi.mock("@/lib/authStorage", () => ({ authStorage, authApi }));

const { AuthProvider, useAuth } = await import("../AuthContext");

function Probe() {
  const { isAuthenticated, isLoading, token } = useAuth();
  if (isLoading) return <p>loading</p>;
  return <p>{isAuthenticated ? `in:${token}` : "out"}</p>;
}

const httpError = (status) => Object.assign(new Error(`HTTP ${status}`), { status });

const mount = async () => {
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
  await waitFor(() => expect(screen.queryByText("loading")).toBeNull());
  return screen.getByText(/^(in:|out)/).textContent;
};

describe("AuthProvider session restore", () => {
  beforeEach(() => {
    stored.user = { id: "u1", email: "a@b.c" };
    stored.token = "tok";
    authStorage.clear.mockClear();
    authApi.getProfile.mockReset();
    authApi.refreshToken.mockReset();
  });

  it("keeps the session when the API cannot be reached", async () => {
    authApi.getProfile.mockRejectedValue(new TypeError("Failed to fetch"));
    authApi.refreshToken.mockRejectedValue(new TypeError("Failed to fetch"));

    expect(await mount()).toBe("in:tok");
    expect(authStorage.clear).not.toHaveBeenCalled();
    expect(stored.token).toBe("tok");
  });

  it("keeps the session when the API answers 503 during a redeploy", async () => {
    authApi.getProfile.mockRejectedValue(httpError(503));
    authApi.refreshToken.mockRejectedValue(httpError(503));

    expect(await mount()).toBe("in:tok");
    expect(authStorage.clear).not.toHaveBeenCalled();
  });

  it("keeps the session when the token is refused but the refresh hits a 502", async () => {
    authApi.getProfile.mockRejectedValue(httpError(401));
    authApi.refreshToken.mockRejectedValue(httpError(502));

    expect(await mount()).toBe("in:tok");
    expect(authStorage.clear).not.toHaveBeenCalled();
  });

  it("signs out when the token and the refresh cookie are both refused", async () => {
    authApi.getProfile.mockRejectedValue(httpError(401));
    authApi.refreshToken.mockRejectedValue(httpError(401));

    expect(await mount()).toBe("out");
    expect(authStorage.clear).toHaveBeenCalled();
  });

  it("renews the token when only the access token was refused", async () => {
    authApi.getProfile
      .mockRejectedValueOnce(httpError(401))
      .mockResolvedValueOnce({ id: "u1", email: "a@b.c" });
    authApi.refreshToken.mockResolvedValue("tok2");

    expect(await mount()).toBe("in:tok2");
    expect(stored.token).toBe("tok2");
  });
});
