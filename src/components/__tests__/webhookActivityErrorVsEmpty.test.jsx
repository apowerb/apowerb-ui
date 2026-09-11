/**
 * Onglet Activity : « rien à montrer » et « le chargement a échoué » sont
 * deux situations différentes.
 *
 * Anis, 11/09/2026 : « une liste vide est rendue comme une erreur ».
 * Reproduction donnée par David : Webhooks, puis l'onglet Activity.
 *
 * La cause est ici : en cas d'échec, `fetchFirstPage` se contente d'un toast
 * et laisse `logs` à []. L'écran rend alors « aucune activité » — le même
 * écran, au mot près, qu'un compte qui n'a simplement reçu aucun webhook.
 * L'utilisateur voit un toast rouge devant une liste vide et conclut que le
 * vide EST l'erreur ; et le toast disparu, plus rien ne dit que la liste
 * affichée n'est pas la vraie.
 */
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("use-intl", () => ({
  useTranslations: () => (key, values) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

const listWebhookLogs = vi.fn();
vi.mock("@/lib/api", () => ({
  listWebhookSubscriptions: () => Promise.resolve({ subscriptions: [] }),
  createWebhookSubscription: vi.fn(),
  updateWebhookSubscription: vi.fn(),
  deleteWebhookSubscription: vi.fn(),
  renewWebhookSubscription: vi.fn(),
  listWebhookLogs: (...a) => listWebhookLogs(...a),
  getWebhookLog: vi.fn(),
  getWebhookLogBody: vi.fn(),
  retriggerWebhookLog: vi.fn(),
  listAgents: () => Promise.resolve({ agents: [] }),
}));

const toastSpy = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };
vi.mock("../Toast", () => ({ useToast: () => toastSpy }));

// L'onglet ouvert est choisi par ?tab= ; on ouvre directement Activity,
// comme le fait le lien de la barre latérale.
vi.mock("@/lib/navigation", () => ({
  useSearchParams: () => new URLSearchParams("tab=activity"),
  Link: ({ children }) => children,
}));

vi.mock("react-markdown", () => ({ default: ({ children }) => children }));
vi.mock("remark-gfm", () => ({ default: () => {} }));

import WebhookManager from "@/components/WebhookManager";

describe("Activity : liste vide contre chargement en échec", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("une liste réellement vide reste un état vide neutre, sans erreur", async () => {
    listWebhookLogs.mockResolvedValue({ total: 0, logs: [] });
    render(<WebhookManager />);
    await waitFor(() => expect(screen.getByText("noActivityTitle")).toBeInTheDocument());
    expect(toastSpy.error).not.toHaveBeenCalled();
    expect(screen.queryByText("errorLoadingActivityTitle")).not.toBeInTheDocument();
  });

  it("un chargement en échec n'est PAS rendu comme une liste vide", async () => {
    listWebhookLogs.mockRejectedValue(new Error("Internal Server Error"));
    render(<WebhookManager />);
    await waitFor(() => expect(screen.getByText("errorLoadingActivityTitle")).toBeInTheDocument());
    // Le coeur du ticket : l'echec ne doit pas emprunter l'ecran du vide.
    expect(screen.queryByText("noActivityTitle")).not.toBeInTheDocument();
    // Le bloc porte le message ; le toast le repetait en double.
    expect(toastSpy.error).not.toHaveBeenCalled();
  });

  it("l'état d'erreur offre de réessayer, et un second appel réussi le remplace", async () => {
    listWebhookLogs.mockRejectedValueOnce(new Error("boom"));
    render(<WebhookManager />);
    await waitFor(() => expect(screen.getByText("errorLoadingActivityTitle")).toBeInTheDocument());

    listWebhookLogs.mockResolvedValue({ total: 0, logs: [] });
    fireEvent.click(screen.getByRole("button", { name: /retryActivityButton/ }));
    await waitFor(() => expect(screen.getByText("noActivityTitle")).toBeInTheDocument());
    expect(screen.queryByText("errorLoadingActivityTitle")).not.toBeInTheDocument();
  });
});
