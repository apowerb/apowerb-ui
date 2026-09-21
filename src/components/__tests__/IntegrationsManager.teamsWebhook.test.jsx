/**
 * Carte "Microsoft Teams (webhook)" de l'écran Intégrations (apowerb#198).
 * Distincte de la carte OAuth "Teams" existante (lecture de canaux/chats) :
 * ici on enregistre un webhook entrant pour les notifications de workflow.
 * L'URL n'est jamais réaffichée ni conservée en état après l'envoi.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  getTeamsWebhookStatus,
  saveTeamsWebhook,
  deleteTeamsWebhook,
} from "@/lib/api";
import { TeamsWebhookCard } from "../IntegrationsManager";

vi.mock("@/lib/api", () => ({
  getTeamsWebhookStatus: vi.fn(),
  saveTeamsWebhook: vi.fn(),
  deleteTeamsWebhook: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TeamsWebhookCard: statut", () => {
  it("affiche non configuré puis le bouton Configurer", async () => {
    getTeamsWebhookStatus.mockResolvedValue({ configured: false });
    render(<TeamsWebhookCard />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /configure/i })).toBeInTheDocument(),
    );
    expect(screen.queryByText(/^connected$/i)).not.toBeInTheDocument();
  });

  it("affiche configuré avec Remplacer et Supprimer", async () => {
    getTeamsWebhookStatus.mockResolvedValue({ configured: true });
    render(<TeamsWebhookCard />);

    await waitFor(() => expect(screen.getByText(/^connected$/i)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /replace/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
  });
});

describe("TeamsWebhookCard: configuration", () => {
  it("appelle saveTeamsWebhook avec l'URL saisie", async () => {
    const user = userEvent.setup();
    getTeamsWebhookStatus.mockResolvedValue({ configured: false });
    saveTeamsWebhook.mockResolvedValue({ configured: true });
    render(<TeamsWebhookCard />);

    await waitFor(() => screen.getByRole("button", { name: /configure/i }));
    await user.click(screen.getByRole("button", { name: /configure/i }));

    const input = screen.getByLabelText(/webhook url/i);
    await user.type(input, "https://prod.webhook.office.com/abc");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(saveTeamsWebhook).toHaveBeenCalledWith(
        "https://prod.webhook.office.com/abc",
      ),
    );
  });

  it("affiche l'erreur 422 telle quelle", async () => {
    const user = userEvent.setup();
    getTeamsWebhookStatus.mockResolvedValue({ configured: false });
    const err = new Error("L'hôte n'est pas dans la liste blanche");
    err.status = 422;
    saveTeamsWebhook.mockRejectedValue(err);
    render(<TeamsWebhookCard />);

    await waitFor(() => screen.getByRole("button", { name: /configure/i }));
    await user.click(screen.getByRole("button", { name: /configure/i }));

    const input = screen.getByLabelText(/webhook url/i);
    await user.type(input, "https://evil.example.com");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(
      await screen.findByText("L'hôte n'est pas dans la liste blanche"),
    ).toBeInTheDocument();
  });

  it("ne conserve jamais l'URL dans le DOM après succès", async () => {
    const user = userEvent.setup();
    getTeamsWebhookStatus.mockResolvedValue({ configured: false });
    saveTeamsWebhook.mockResolvedValue({ configured: true });
    render(<TeamsWebhookCard />);

    await waitFor(() => screen.getByRole("button", { name: /configure/i }));
    await user.click(screen.getByRole("button", { name: /configure/i }));

    const input = screen.getByLabelText(/webhook url/i);
    await user.type(input, "https://prod.webhook.office.com/secret-path");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /replace/i })).toBeInTheDocument(),
    );
    expect(
      screen.queryByDisplayValue("https://prod.webhook.office.com/secret-path"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/secret-path/)).not.toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain("secret-path");
  });
});

describe("TeamsWebhookCard: suppression", () => {
  it("appelle deleteTeamsWebhook et repasse en non configuré", async () => {
    const user = userEvent.setup();
    getTeamsWebhookStatus.mockResolvedValue({ configured: true });
    deleteTeamsWebhook.mockResolvedValue({ configured: false });
    render(<TeamsWebhookCard />);

    await waitFor(() => screen.getByRole("button", { name: /delete/i }));
    await user.click(screen.getByRole("button", { name: /delete/i }));

    await waitFor(() => expect(deleteTeamsWebhook).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /configure/i })).toBeInTheDocument(),
    );
  });
});
