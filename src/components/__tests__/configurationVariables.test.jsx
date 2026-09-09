/**
 * Poser une variable depuis l'onglet Configuration.
 *
 * Ce qui se vérifie ici est ce qui se voit : qu'une valeur tapée ne
 * réapparaisse nulle part dans le rendu, qu'une variable imposée par le
 * déploiement n'offre pas de champ, et qu'un administrateur qui n'est pas
 * superadministrateur retrouve exactement l'écran d'avant.
 *
 * Le `t` de test rend la clé : on teste la décision d'affichage, pas le mot.
 */
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("use-intl", () => ({
  useTranslations: () => (key, values) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

const getSetupStatus = vi.fn();
const listConfigVariables = vi.fn();
const setConfigVariable = vi.fn();
const clearConfigVariable = vi.fn();

vi.mock("@/lib/api", () => ({
  getSetupStatus: (...a) => getSetupStatus(...a),
  listConfigVariables: (...a) => listConfigVariables(...a),
  setConfigVariable: (...a) => setConfigVariable(...a),
  clearConfigVariable: (...a) => clearConfigVariable(...a),
}));

import ConfigurationTab from "@/components/admin/ConfigurationTab";
import { invalidateSetupStatus } from "@/hooks/useSetupStatus";

// Manifestement factice : ce dépôt est public et une fixture y reste.
const TEMOIN = "valeur-temoin-a-ne-jamais-reafficher";

const STATUS = {
  items: [
    {
      key: "system_mail",
      configured: false,
      optional: false,
      blocks: ["password_reset"],
      missing: ["SMTP_HOST", "SMTP_PORT"],
      docs_url: "https://docs.apowerb.com/configuration/mail",
    },
    {
      key: "orchestration",
      configured: false,
      optional: false,
      blocks: ["orchestrator"],
      missing: ["TH2ETL_API_KEY"],
      docs_url: "https://docs.apowerb.com/configuration/orchestration",
    },
  ],
  missing_count: 2,
};

const VARIABLES = {
  items: [
    {
      name: "SMTP_HOST",
      capability: "system_mail",
      secret: false,
      source: "unset",
      updated_at: null,
      updated_by: null,
      pending_restart: false,
    },
    {
      name: "SMTP_PASSWORD",
      capability: "system_mail",
      secret: true,
      source: "database",
      updated_at: "2026-09-09T08:00:00Z",
      updated_by: "chef@example.com",
      pending_restart: true,
    },
    {
      name: "TH2ETL_API_KEY",
      capability: "orchestration",
      secret: true,
      source: "env",
      updated_at: null,
      updated_by: null,
      pending_restart: false,
    },
  ],
  pending_restart: ["SMTP_PASSWORD"],
  superadmin_named: true,
};

async function monter(props = {}) {
  getSetupStatus.mockResolvedValue(STATUS);
  await invalidateSetupStatus();
  const rendu = render(<ConfigurationTab {...props} />);
  await screen.findByTestId("configuration-tab");
  return rendu;
}

describe("ConfigurationTab — poser une variable", () => {
  beforeEach(() => {
    getSetupStatus.mockReset();
    listConfigVariables.mockReset().mockResolvedValue(VARIABLES);
    setConfigVariable.mockReset().mockResolvedValue({});
    clearConfigVariable.mockReset().mockResolvedValue({});
  });

  it("ne demande rien au serveur pour un administrateur non superadministrateur", async () => {
    await monter({ superadmin: false });
    // Un 403 garanti à chaque ouverture serait du bruit dans les journaux
    // du serveur, pas une garde.
    expect(listConfigVariables).not.toHaveBeenCalled();
    expect(screen.queryByTestId("config-var-SMTP_HOST")).toBeNull();
    // Et la checklist d'avant reste entière : les NOMS manquants s'affichent.
    expect(screen.getByText("SMTP_HOST")).toBeTruthy();
  });

  it("range chaque variable sous la capacité qu'elle sert", async () => {
    await monter({ superadmin: true });
    const mail = await screen.findByTestId("setup-row-system_mail");
    expect(mail.querySelector("[data-testid=config-var-SMTP_HOST]")).toBeTruthy();
    expect(mail.querySelector("[data-testid=config-var-SMTP_PASSWORD]")).toBeTruthy();
    expect(mail.querySelector("[data-testid=config-var-TH2ETL_API_KEY]")).toBeNull();

    const etl = screen.getByTestId("setup-row-orchestration");
    expect(etl.querySelector("[data-testid=config-var-TH2ETL_API_KEY]")).toBeTruthy();
  });

  it("un seul appel réseau pour toutes les capacités", async () => {
    await monter({ superadmin: true });
    await screen.findByTestId("config-var-SMTP_HOST");
    // Deux capacités affichées : une requête par ligne serait passée
    // inaperçue sur un écran qui marche.
    expect(listConfigVariables).toHaveBeenCalledTimes(1);
  });

  it("n'offre aucun champ pour une variable imposée par le déploiement", async () => {
    await monter({ superadmin: true });
    const ligne = await screen.findByTestId("config-var-TH2ETL_API_KEY");
    expect(ligne).toHaveAttribute("data-source", "env");
    expect(ligne.querySelector("input")).toBeNull();
    expect(ligne.textContent).toContain("heldByDeployment");
  });

  it("dit quand une valeur a été posée, et par qui", async () => {
    await monter({ superadmin: true });
    const ligne = await screen.findByTestId("config-var-SMTP_PASSWORD");
    expect(ligne.textContent).toContain("setOn");
    expect(ligne.textContent).toContain("chef@example.com");
  });

  it("annonce les variables en attente de redémarrage", async () => {
    await monter({ superadmin: true });
    const bandeau = await screen.findByTestId("config-pending-restart");
    expect(bandeau.textContent).toContain("SMTP_PASSWORD");
  });

  it("prévient quand aucun superadministrateur n'est nommé", async () => {
    listConfigVariables.mockResolvedValue({ ...VARIABLES, superadmin_named: false });
    await monter({ superadmin: true });
    expect(await screen.findByTestId("config-no-superadmin")).toBeTruthy();
  });

  it("envoie la valeur, puis ne la réaffiche nulle part", async () => {
    const { container } = await monter({ superadmin: true });
    const champ = await screen.findByLabelText("SMTP_HOST");
    fireEvent.change(champ, { target: { value: TEMOIN } });
    fireEvent.click(
      screen.getByTestId("config-var-SMTP_HOST").querySelector("button"),
    );

    await waitFor(() =>
      expect(setConfigVariable).toHaveBeenCalledWith("SMTP_HOST", TEMOIN),
    );
    // Le champ est vidé après un succès, et la valeur n'a laissé aucune
    // trace dans le rendu — ni dans un attribut, ni dans un titre.
    await waitFor(() => expect(champ.value).toBe(""));
    expect(container.innerHTML).not.toContain(TEMOIN);
  });

  it("garde le brouillon quand le serveur refuse", async () => {
    // Retaper une valeur à l'aveugle après un refus est la pire des invites.
    setConfigVariable.mockRejectedValue(new Error("valeur invalide"));
    await monter({ superadmin: true });
    const champ = await screen.findByLabelText("SMTP_HOST");
    fireEvent.change(champ, { target: { value: TEMOIN } });
    fireEvent.click(
      screen.getByTestId("config-var-SMTP_HOST").querySelector("button"),
    );

    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(champ.value).toBe(TEMOIN);
  });

  it("retire une valeur posée", async () => {
    await monter({ superadmin: true });
    const ligne = await screen.findByTestId("config-var-SMTP_PASSWORD");
    fireEvent.click(screen.getByLabelText("clear"));
    await waitFor(() =>
      expect(clearConfigVariable).toHaveBeenCalledWith("SMTP_PASSWORD"),
    );
    expect(ligne).toBeTruthy();
  });

  it("retombe en lecture seule, sans erreur, sur un 403", async () => {
    // Un rang révoqué pendant que l'onglet reste ouvert : la réponse juste,
    // pas une panne.
    const refus = new Error("Superadministrator role required.");
    refus.status = 403;
    listConfigVariables.mockRejectedValue(refus);

    await monter({ superadmin: true });
    await waitFor(() => expect(listConfigVariables).toHaveBeenCalled());
    expect(screen.queryByTestId("config-var-SMTP_HOST")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByTestId("configuration-tab")).toBeTruthy();
  });
});
