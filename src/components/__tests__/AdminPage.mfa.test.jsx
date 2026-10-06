/**
 * « Exiger la MFA » n'est proposé que si un second facteur peut s'enrôler.
 *
 * Sans la brique MFA, `/api/auth/mfa/*` répond 404 : un compte à qui l'on
 * exigeait la MFA était enfermé dehors (mesuré le 06/10/2026), et le cœur
 * refuse désormais la demande (409 `mfa_not_available`). Le bouton ne doit
 * donc pas mener à cette erreur. Mais « Ne plus exiger » reste toujours
 * proposé : un compte déjà marqué doit pouvoir être libéré.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
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
const getPublicConfig = vi.fn();

vi.mock("@/lib/api", () => ({
  getAdminContext: vi.fn().mockResolvedValue({ superadmin: true, organization: null }),
  listAdminUsers: (...a) => listAdminUsers(...a),
  getPublicConfig: (...a) => getPublicConfig(...a),
  listAdminGroups: vi.fn().mockResolvedValue([]),
  listAdminPermissions: vi.fn().mockResolvedValue([]),
  addAdminGroupMember: vi.fn(),
  deleteAdminUser: vi.fn(),
  demandEmailVerification: vi.fn(),
  demandPasswordReset: vi.fn(),
  disableAdminUserMfa: vi.fn(),
  forceRelogin: vi.fn(),
  setMfaRequired: vi.fn(),
  changeAdminUserRole: vi.fn(),
  createAdminGroup: vi.fn(),
  createAdminUser: vi.fn(),
  deleteAdminGroup: vi.fn(),
  removeAdminGroupMember: vi.fn(),
  setAdminGroupPermissions: vi.fn(),
}));

const { default: AdminPage } = await import("@/components/AdminPage");

const target = (over = {}) => ({
  user_id: 2,
  email: "target@example.com",
  first_name: "Ta",
  last_name: "Rget",
  role: "USER",
  groups: [],
  mfa_enabled: false,
  mfa_required: false,
  ...over,
});

const openMenuFor = async ({ config, user }) => {
  getPublicConfig.mockResolvedValue(config);
  listAdminUsers.mockResolvedValue([user]);
  render(<AdminPage />);
  await waitFor(() => expect(getPublicConfig).toHaveBeenCalled());
  fireEvent.click(await screen.findByRole("button", { name: "tabUsers" }));
  fireEvent.click(
    await screen.findByRole("button", { name: `actionsFor({"email":"${user.email}"})` }),
  );
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("« Exiger la MFA » suit la disponibilité d'un second facteur", () => {
  it("est masqué quand le cœur n'a pas de brique MFA", async () => {
    await openMenuFor({ config: { mfa_available: false }, user: target() });
    await screen.findByText("actForceRelogin");
    expect(screen.queryByText("actRequireMfa")).toBeNull();
  });

  it("est masqué quand la configuration ne dit rien", async () => {
    await openMenuFor({ config: {}, user: target() });
    await screen.findByText("actForceRelogin");
    expect(screen.queryByText("actRequireMfa")).toBeNull();
  });

  it("est proposé quand la brique MFA est branchée", async () => {
    await openMenuFor({ config: { mfa_available: true }, user: target() });
    await screen.findByText("actRequireMfa");
  });

  it("« Ne plus exiger » reste proposé sans brique, pour libérer un compte", async () => {
    await openMenuFor({
      config: { mfa_available: false },
      user: target({ mfa_required: true }),
    });
    await screen.findByText("actStopRequiringMfa");
  });
});
