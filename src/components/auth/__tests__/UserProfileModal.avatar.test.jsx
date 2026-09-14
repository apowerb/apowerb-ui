/**
 * The profile must not offer an avatar change the server cannot store.
 *
 * Reported from the app on 2026-09-14: picking a photo
 * "crashed". The real auth client has no uploadAvatar — only the mock one
 * does — so the click ended in "authApi.uploadAvatar is not a function", and
 * the remove button reported success without sending anything. Until the
 * backend stores avatars, the affordance is absent rather than broken.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("use-intl", () => ({ useTranslations: () => (k) => k }));
vi.mock("@/extensions/Slot", () => ({ default: () => null }));
vi.mock("@/hooks/useFocusTrap", () => ({ useFocusTrap: () => ({ current: null }) }));
vi.mock("@/lib/datetime", () => ({ formatDate: () => "" }));

let user;
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user,
    token: "t",
    updateProfile: vi.fn(),
    uploadAvatar: vi.fn(),
    refreshProfile: vi.fn(),
    isLoading: false,
  }),
}));

const authApi = {};
vi.mock("@/lib/authStorage", () => ({ authApi }));

const UserProfileModal = (await import("../UserProfileModal")).default;

const fileInput = () => document.querySelector('input[type="file"]');

describe("UserProfileModal avatar", () => {
  beforeEach(() => {
    delete authApi.uploadAvatar;
    user = { id: 1, email: "x@y.fr", username: "x", avatar: "https://example.test/a.png" };
  });

  it("offers neither upload nor removal when the client cannot upload", () => {
    render(<UserProfileModal onClose={() => {}} />);

    expect(fileInput()).toBeNull();
    expect(screen.queryByText("clickToChangeAvatar")).toBeNull();
    expect(screen.queryByTitle("removeAvatarTooltip")).toBeNull();
    expect(screen.getByAltText("avatarAlt")).toBeTruthy();
  });

  it("keeps the change when the client supports it", () => {
    authApi.uploadAvatar = vi.fn();

    render(<UserProfileModal onClose={() => {}} />);

    expect(fileInput()).not.toBeNull();
    expect(screen.getByText("clickToChangeAvatar")).toBeTruthy();
    expect(screen.getByTitle("removeAvatarTooltip")).toBeTruthy();
  });
});
