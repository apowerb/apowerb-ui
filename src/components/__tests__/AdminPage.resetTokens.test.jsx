/**
 * « Remettre le compteur de jetons à zéro » depuis les options d'un compte.
 *
 * Le cœur pose une coupure (`token_usage_reset_at`) sans rien effacer : le
 * quota, la jauge et le plafond glissant repartent de zéro. L'action demande
 * une confirmation, et rien n'est envoyé si l'administrateur annule.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

vi.mock("use-intl", () => ({
  useTranslations: () => (key, params) =>
    params ? `${key}(${JSON.stringify(params)})` : key,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { email: "admin@example.com", role: "ADMIN" } }),
}));

vi.mock("@/components/admin/DashboardTab", () => ({
  default: () => <div data-testid="dashboard-tab" />,
}));

const listAdminUsers = vi.fn();
const resetTokenUsage = vi.fn();

vi.mock("@/lib/api", () => ({
  getAdminContext: vi.fn().mockResolvedValue({ superadmin: true, organization: null }),
  listAdminUsers: (...a) => listAdminUsers(...a),
  getPublicConfig: vi.fn().mockResolvedValue({}),
  listAdminGroups: vi.fn().mockResolvedValue([]),
  listAdminPermissions: vi.fn().mockResolvedValue([]),
  addAdminGroupMember: vi.fn(),
  deleteAdminUser: vi.fn(),
  demandEmailVerification: vi.fn(),
  demandPasswordReset: vi.fn(),
  disableAdminUserMfa: vi.fn(),
  forceRelogin: vi.fn(),
  resetTokenUsage: (...a) => resetTokenUsage(...a),
  setMfaRequired: vi.fn(),
  changeAdminUserRole: vi.fn(),
  createAdminGroup: vi.fn(),
  createAdminUser: vi.fn(),
  deleteAdminGroup: vi.fn(),
  removeAdminGroupMember: vi.fn(),
  setAdminGroupPermissions: vi.fn(),
}));

const { default: AdminPage } = await import("@/components/AdminPage");

const user = {
  user_id: 2,
  email: "target@example.com",
  first_name: "Ta",
  last_name: "Rget",
  role: "USER",
  groups: [],
  tokens: 1_200_000,
};

const openMenu = async () => {
  listAdminUsers.mockResolvedValue([user]);
  render(<AdminPage />);
  fireEvent.click(await screen.findByRole("button", { name: "tabUsers" }));
  fireEvent.click(
    await screen.findByRole("button", { name: `actionsFor({"email":"${user.email}"})` }),
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  resetTokenUsage.mockResolvedValue({ user_id: 2, email: user.email });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("« Remettre le compteur de jetons à zéro »", () => {
  it("figure dans les options du compte", async () => {
    await openMenu();
    await screen.findByText("actResetTokens");
    await screen.findByText("actResetTokensHint");
  });

  it("appelle le cœur pour ce compte après confirmation", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    await openMenu();
    fireEvent.click(await screen.findByText("actResetTokens"));
    expect(confirm).toHaveBeenCalledWith(
      `confirmResetTokens({"email":"${user.email}"})`,
    );
    await waitFor(() => expect(resetTokenUsage).toHaveBeenCalledWith(2));
  });

  it("n'envoie rien si l'administrateur annule", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    await openMenu();
    fireEvent.click(await screen.findByText("actResetTokens"));
    expect(resetTokenUsage).not.toHaveBeenCalled();
  });
});
