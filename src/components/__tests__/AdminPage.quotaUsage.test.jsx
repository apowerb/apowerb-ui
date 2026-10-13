/**
 * Colonne « Usage » : le total historique reste, et la consommation du quota
 * du mois (`quota_tokens`) s'affiche dessous, avec la date de la dernière
 * remise à zéro quand elle tombe dans le mois en cours. Un ancien serveur
 * n'envoie aucun des deux champs : l'écran ne doit rien inventer.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";

vi.mock("use-intl", () => ({
  useTranslations: () => (key, params) =>
    params ? `${key}(${JSON.stringify(params)})` : key,
  useFormatter: () => ({
    dateTime: (date, options) =>
      new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", ...options }).format(date),
  }),
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

const base = {
  user_id: 2,
  email: "target@example.com",
  first_name: "Ta",
  last_name: "Rget",
  role: "USER",
  groups: [],
  tokens: 1_200_000,
  llm_calls: 40,
};

const TOTAL = 'tokensShort({"tokens":"1.2M"})';

const openUsers = async (users) => {
  listAdminUsers.mockResolvedValue(users);
  render(<AdminPage />);
  fireEvent.click(await screen.findByRole("button", { name: "tabUsers" }));
  const row = (await screen.findByText(base.email)).closest("tr");
  await within(row).findByText(TOTAL);
  return row;
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-13T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Colonne Usage : quota du mois", () => {
  it("montre le total historique, le quota du mois et la date de remise à zéro", async () => {
    const row = await openUsers([
      { ...base, quota_tokens: 300_000, token_usage_reset_at: "2026-10-13T08:30:00Z" },
    ]);
    expect(within(row).getByText(TOTAL)).toBeTruthy();
    expect(within(row).getByText('quotaMonth({"tokens":"300k"})')).toBeTruthy();
    expect(within(row).getByText('quotaResetOn({"date":"13 oct."})')).toBeTruthy();
  });

  it("n'affiche ni quota ni date face à un ancien serveur sans ces champs", async () => {
    const row = await openUsers([base]);
    expect(within(row).getByText(TOTAL)).toBeTruthy();
    expect(row.textContent).not.toMatch(/quotaMonth|quotaResetOn|undefined|NaN|Invalid/);
  });

  it("garde le quota mais n'indique pas une remise à zéro d'un mois précédent", async () => {
    const row = await openUsers([
      { ...base, quota_tokens: 50_000, token_usage_reset_at: "2026-09-30T23:00:00Z" },
    ]);
    expect(within(row).getByText('quotaMonth({"tokens":"50k"})')).toBeTruthy();
    expect(row.textContent).not.toMatch(/quotaResetOn/);
  });

  it("ignore une date de remise à zéro illisible", async () => {
    const row = await openUsers([
      { ...base, quota_tokens: 0, token_usage_reset_at: "pas-une-date" },
    ]);
    expect(within(row).getByText('quotaMonth({"tokens":"0"})')).toBeTruthy();
    expect(row.textContent).not.toMatch(/quotaResetOn|Invalid|NaN/);
  });

  it("recharge la ligne après une remise à zéro réussie", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const row = await openUsers([
      { ...base, quota_tokens: 300_000, token_usage_reset_at: null },
    ]);
    expect(within(row).getByText('quotaMonth({"tokens":"300k"})')).toBeTruthy();
    expect(row.textContent).not.toMatch(/quotaResetOn/);

    listAdminUsers.mockResolvedValue([
      { ...base, quota_tokens: 0, token_usage_reset_at: "2026-10-13T12:00:00Z" },
    ]);
    resetTokenUsage.mockResolvedValue({});
    fireEvent.click(
      screen.getByRole("button", { name: `actionsFor({"email":"${base.email}"})` }),
    );
    fireEvent.click(await screen.findByText("actResetTokens"));

    await waitFor(() => expect(resetTokenUsage).toHaveBeenCalledWith(2));
    const fresh = (await screen.findByText(base.email)).closest("tr");
    await within(fresh).findByText('quotaMonth({"tokens":"0"})');
    expect(within(fresh).getByText('quotaResetOn({"date":"13 oct."})')).toBeTruthy();
    expect(within(fresh).getByText(TOTAL)).toBeTruthy();
  });
});
