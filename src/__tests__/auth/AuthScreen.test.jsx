import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Stub useAuth to avoid pulling the whole AuthContext
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isLoading: false, mfaPending: null, cancelMfa: vi.fn() }),
}));
vi.mock("next/image", () => ({
  __esModule: true,
  default: (props) => <img {...props} />,
}));

describe("<AuthScreen /> auth flag matrix", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("hides both Sign In and Create Account when DISABLE_BASIC is on", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_DISABLE_BASIC", "true");
    vi.stubEnv("NEXT_PUBLIC_AUTH_DISABLE_SIGNUP", "false");
    const { default: AuthScreen } = await import(
      "@/components/auth/AuthScreen"
    );
    render(<AuthScreen />);
    expect(screen.queryByRole("button", { name: /^Sign In$/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Create Account/ })).toBeNull();
  });

  it("shows Sign In but hides Create Account when only SIGNUP is disabled (closed-signup deployment)", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_DISABLE_BASIC", "false");
    vi.stubEnv("NEXT_PUBLIC_AUTH_DISABLE_SIGNUP", "true");
    const { default: AuthScreen } = await import(
      "@/components/auth/AuthScreen"
    );
    render(<AuthScreen />);
    expect(screen.getByRole("button", { name: /^Sign In$/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Create Account/ })).toBeNull();
  });

  it("shows both buttons when neither flag is set (default)", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_DISABLE_BASIC", "");
    vi.stubEnv("NEXT_PUBLIC_AUTH_DISABLE_SIGNUP", "");
    const { default: AuthScreen } = await import(
      "@/components/auth/AuthScreen"
    );
    render(<AuthScreen />);
    expect(screen.getByRole("button", { name: /^Sign In$/ })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Create Account/ }),
    ).toBeInTheDocument();
  });
});
