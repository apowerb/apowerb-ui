/**
 * Compteur du modèle mutualisé en pied de barre latérale (OSS).
 *
 * Sans limite servie : le compteur du mois, jamais de barre. Avec une limite :
 * barre remplie du consommé, chiffre du restant. Tenu à jour à chaque fin de
 * run, comme la jauge de crédit commerciale qui prend sa place quand une
 * brique remplit l'emplacement.
 */
import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { notifyRunFinished } from "@/extensions/registry";

vi.mock("use-intl", () => ({
  useTranslations: () => (key, values) => (values ? `${key}:${JSON.stringify(values)}` : key),
}));
const getDefaultLlmUsage = vi.fn();
vi.mock("@/lib/api", () => ({ getDefaultLlmUsage: (...a) => getDefaultLlmUsage(...a) }));

import DefaultLlmUsageMeter from "@/components/DefaultLlmUsageMeter";

const RESET = "2026-09-30T22:00:00Z";
const counter = { enabled: true, used_tokens: 40_600, limit_tokens: null, percent_used: null, warning: false, exceeded: false, resets_at: RESET };
const metered = { enabled: true, used_tokens: 40_600, limit_tokens: 1_000_000, percent_used: 4.06, warning: false, exceeded: false, resets_at: RESET };

describe("DefaultLlmUsageMeter", () => {
  beforeEach(() => getDefaultLlmUsage.mockReset());

  it("serveur sans modèle mutualisé : rien", async () => {
    getDefaultLlmUsage.mockResolvedValue({ enabled: false });
    const { container } = render(<DefaultLlmUsageMeter />);
    await waitFor(() => expect(getDefaultLlmUsage).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("sans limite : le compteur du mois et la remise à zéro, pas de barre", async () => {
    getDefaultLlmUsage.mockResolvedValue(counter);
    render(<DefaultLlmUsageMeter />);
    const box = await screen.findByTestId("default-llm-usage-meter");
    expect(box).toHaveAttribute("data-mode", "counter");
    expect(screen.getByText(/thisMonth/)).toHaveTextContent("40.6 k");
    expect(screen.getByText(/resets/)).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByText(/remaining/)).toBeNull();
  });

  it("sans limite, repliée : le chiffre seul", async () => {
    getDefaultLlmUsage.mockResolvedValue(counter);
    render(<DefaultLlmUsageMeter collapsed />);
    const box = await screen.findByTestId("default-llm-usage-meter");
    expect(box).toHaveTextContent("40.6 k");
    expect(screen.queryByText(/thisMonth/)).toBeNull();
  });

  it("avec limite : barre remplie du consommé, chiffre du restant", async () => {
    getDefaultLlmUsage.mockResolvedValue(metered);
    render(<DefaultLlmUsageMeter />);
    const bar = await screen.findByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "4");
    expect(screen.getByText(/remaining/)).toHaveTextContent('"percent":96');
    expect(screen.getByTestId("default-llm-usage-meter")).toHaveAttribute("data-level", "ok");
    expect(screen.getByText(/40\.6 k \/ 1 M/)).toBeInTheDocument();
  });

  it("dépassé : niveau exceeded, barre à 100", async () => {
    getDefaultLlmUsage.mockResolvedValue({ ...metered, used_tokens: 1_200_000, percent_used: 100, warning: true, exceeded: true });
    render(<DefaultLlmUsageMeter />);
    expect(await screen.findByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByTestId("default-llm-usage-meter")).toHaveAttribute("data-level", "exceeded");
  });

  it("se rafraîchit à chaque fin de run", async () => {
    getDefaultLlmUsage.mockResolvedValueOnce(counter).mockResolvedValueOnce({ ...counter, used_tokens: 41_000 });
    render(<DefaultLlmUsageMeter />);
    expect(await screen.findByText(/thisMonth/)).toHaveTextContent("40.6 k");
    act(() => notifyRunFinished());
    await waitFor(() => expect(screen.getByText(/thisMonth/)).toHaveTextContent("41 k"));
    expect(getDefaultLlmUsage).toHaveBeenCalledTimes(2);
  });
});
