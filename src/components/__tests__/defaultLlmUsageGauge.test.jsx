/**
 * Jauge du modèle mutualisé « thaink2/default ».
 *
 * Le backend compte toujours ; il ne sert une limite que si une brique de
 * plafond est installée. La jauge doit refléter exactement cette frontière :
 * sans limite, ni barre ni pourcentage — un chiffre suggérerait un quota qui
 * n'existe pas.
 */
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("use-intl", () => ({
  useTranslations: () => (key, values) => (values ? `${key}:${JSON.stringify(values)}` : key),
}));

const getDefaultLlmUsage = vi.fn();
vi.mock("@/lib/api", () => ({
  getDefaultLlmUsage: (...args) => getDefaultLlmUsage(...args),
}));

import DefaultLlmUsageGauge from "@/components/agent-modal/DefaultLlmUsageGauge";

const RESET = "2026-09-30T22:00:00Z";

describe("DefaultLlmUsageGauge", () => {
  beforeEach(() => {
    getDefaultLlmUsage.mockReset();
  });

  it("sans limite servie : compteur et remise à zéro, ni barre ni alerte", async () => {
    getDefaultLlmUsage.mockResolvedValue({
      enabled: true, used_tokens: 12_500, limit_tokens: null, percent_used: null,
      warning: false, exceeded: false, resets_at: RESET,
    });
    render(<DefaultLlmUsageGauge />);
    expect(await screen.findByTestId("default-llm-usage")).toHaveAttribute("data-tone", "ok");
    expect(screen.getByText(/defaultLlmUsageTokens/)).toHaveTextContent("12.5 k");
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.getByText(/defaultLlmUsageResets/)).toBeInTheDocument();
    expect(screen.queryByText(/defaultLlmUsageWarning|defaultLlmUsageExceeded/)).toBeNull();
  });

  it("avec limite : barre, « utilisé / limite », alerte à partir de 80 %", async () => {
    getDefaultLlmUsage.mockResolvedValue({
      enabled: true, used_tokens: 850_000, limit_tokens: 1_000_000, percent_used: 85,
      warning: true, exceeded: false, resets_at: RESET,
    });
    render(<DefaultLlmUsageGauge />);
    expect(await screen.findByRole("progressbar")).toHaveAttribute("aria-valuenow", "85");
    expect(screen.getByTestId("default-llm-usage")).toHaveAttribute("data-tone", "warning");
    expect(screen.getByText(/defaultLlmUsageOfLimit/)).toHaveTextContent("850 k");
    expect(screen.getByText(/defaultLlmUsageOfLimit/)).toHaveTextContent("1 M");
    expect(screen.getByText(/defaultLlmUsageWarning/)).toBeInTheDocument();
  });

  it("dépassé : la barre reste à 100 et le message le dit", async () => {
    getDefaultLlmUsage.mockResolvedValue({
      enabled: true, used_tokens: 1_500_000, limit_tokens: 1_000_000, percent_used: 100,
      warning: true, exceeded: true, resets_at: RESET,
    });
    render(<DefaultLlmUsageGauge />);
    expect(await screen.findByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByTestId("default-llm-usage")).toHaveAttribute("data-tone", "exceeded");
    expect(screen.getByText(/defaultLlmUsageExceeded/)).toBeInTheDocument();
    expect(screen.queryByText(/defaultLlmUsageWarning/)).toBeNull();
  });

  it("serveur sans modèle mutualisé : rien du tout", async () => {
    getDefaultLlmUsage.mockResolvedValue({ enabled: false });
    const { container } = render(<DefaultLlmUsageGauge />);
    await waitFor(() => expect(getDefaultLlmUsage).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("appel en échec : un mot discret, jamais un écran cassé", async () => {
    getDefaultLlmUsage.mockRejectedValue(new Error("HTTP 500"));
    render(<DefaultLlmUsageGauge />);
    expect(await screen.findByTestId("default-llm-usage-unavailable")).toBeInTheDocument();
    expect(screen.queryByTestId("default-llm-usage")).toBeNull();
  });
});
