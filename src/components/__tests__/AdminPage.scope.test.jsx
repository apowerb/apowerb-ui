/**
 * Ce que le panneau dit de sa propre portée — et le compte de ses colonnes.
 *
 * Deux régressions réelles motivent ce fichier, toutes deux introduites en
 * retirant la gestion des organisations le 19/08/2026, et aucune n'était
 * détectable : ce composant n'avait aucun test.
 *
 *  1. La phrase de portée avait été réécrite en « vous ne gérez que votre
 *     propre compte » en supposant qu'une build open source ne pouvait
 *     contenir aucune organisation. Faux — le noyau garde les deux tables,
 *     donc une installation portant des données antérieures a des
 *     organisations à plusieurs membres, et l'écran annonçait un compte seul
 *     pendant que le back en renvoyait trois.
 *
 *  2. Le `colSpan` de l'état vide était resté à 8 alors que l'en-tête n'a
 *     plus que 7 colonnes.
 *
 * Le test des libellés vérifie la CLÉ choisie, pas la traduction : c'est la
 * décision qui était fausse, et l'assertion reste vraie quelle que soit la
 * langue. Celui des colonnes compare deux nombres du même rendu, donc il
 * suit toute colonne ajoutée ou retirée sans qu'on ait à le maintenir.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

// `t` rend la clé, et lui accroche ses paramètres. On teste le choix, pas le mot.
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

const getAdminContext = vi.fn();
const listAdminUsers = vi.fn();

vi.mock("@/lib/api", () => ({
  getAdminContext: (...a) => getAdminContext(...a),
  listAdminUsers: (...a) => listAdminUsers(...a),
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

beforeEach(() => {
  vi.clearAllMocks();
  listAdminUsers.mockResolvedValue([]);
});

const renderWith = async (context) => {
  getAdminContext.mockResolvedValue(context);
  render(<AdminPage />);
  await waitFor(() => expect(getAdminContext).toHaveBeenCalled());
};

/** Le tableau vit sous l'onglet Utilisateurs ; le panneau ouvre sur le
 *  tableau de bord. */
const openUsersTab = async () => {
  fireEvent.click(await screen.findByRole("button", { name: "tabUsers" }));
  return screen.findByRole("table");
};

describe("ce que le panneau dit de sa portée", () => {
  it("un superadmin est annoncé comme tel", async () => {
    await renderWith({ superadmin: true, organization: null });
    await screen.findByText("scopeSuperadmin");
  });

  it("un admin rattaché à une organisation la voit NOMMÉE", async () => {
    // Le cas que la première version niait : le noyau borne cet admin aux
    // membres de son organisation, pas à lui seul.
    await renderWith({
      superadmin: false,
      organization: { org_id: 7, name: "Acme" },
    });
    await screen.findByText('scopeOrg({"org":"Acme"})');
  });

  it("un admin sans organisation ne gère que son compte", async () => {
    await renderWith({ superadmin: false, organization: null });
    await screen.findByText("scopeBounded");
  });

  it("ne prétend jamais nommer une organisation qu'il n'a pas", async () => {
    await renderWith({ superadmin: false, organization: null });
    expect(screen.queryByText(/^scopeOrg/)).toBeNull();
  });
});

describe("le tableau des utilisateurs", () => {
  it("étale son état vide sur exactement le nombre de colonnes qu'il a", async () => {
    await renderWith({ superadmin: true, organization: null });

    const table = await openUsersTab();
    const headers = table.querySelectorAll("thead th");
    const empty = table.querySelector("tbody td[colspan]");

    expect(headers.length).toBeGreaterThan(0);
    expect(empty).not.toBeNull();
    expect(Number(empty.getAttribute("colspan"))).toBe(headers.length);
  });

  it("n'affiche plus de colonne organisation", async () => {
    await renderWith({ superadmin: true, organization: null });
    await openUsersTab();
    expect(screen.queryByText("organization")).toBeNull();
    expect(screen.queryByText("tabOrgs")).toBeNull();
  });
});
