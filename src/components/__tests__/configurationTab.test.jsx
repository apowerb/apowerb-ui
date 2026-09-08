/**
 * L'onglet Configuration du panneau d'administration.
 *
 * Trois états, pas deux : configuré, manquant, et optionnel — le stockage sur
 * dossier local n'est pas un défaut. Et jamais une valeur : la checklist
 * n'affiche que des NOMS de variables, ceux que le cœur a bien voulu servir.
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("use-intl", () => ({
  useTranslations: () => (key, values) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

const getSetupStatus = vi.fn();
vi.mock("@/lib/api", () => ({
  getSetupStatus: (...args) => getSetupStatus(...args),
}));

import ConfigurationTab from "@/components/admin/ConfigurationTab";
import { invalidateSetupStatus } from "@/hooks/useSetupStatus";

const STATUS = {
  items: [
    {
      key: "default_llm",
      configured: true,
      optional: false,
      blocks: ["shared_model"],
      missing: [],
      docs_url: "https://docs.apowerb.com/configuration/default-llm",
    },
    {
      key: "object_storage",
      configured: true,
      mode: "local",
      optional: true,
      blocks: [],
      missing: ["S3_BUCKET_NAME", "S3_ACCESS_KEY"],
      docs_url: "https://docs.apowerb.com/configuration/storage",
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
  missing_count: 1,
};

describe("ConfigurationTab", () => {
  beforeEach(() => {
    getSetupStatus.mockReset();
  });

  it("classe chaque capacité et annonce le nombre de manques", async () => {
    getSetupStatus.mockResolvedValue(STATUS);
    await invalidateSetupStatus();
    render(<ConfigurationTab />);

    expect(await screen.findByTestId("configuration-tab")).toHaveAttribute(
      "data-missing",
      "1",
    );
    expect(screen.getByTestId("setup-row-default_llm")).toHaveAttribute("data-state", "ok");
    expect(screen.getByTestId("setup-row-object_storage")).toHaveAttribute(
      "data-state",
      "optional",
    );
    expect(screen.getByTestId("setup-row-orchestration")).toHaveAttribute(
      "data-state",
      "missing",
    );
    expect(screen.getByText("TH2ETL_API_KEY")).toBeInTheDocument();
  });

  it("dit qu'elle n'a pas pu lire l'état plutôt que d'afficher une liste vide", async () => {
    getSetupStatus.mockResolvedValue(null);
    await invalidateSetupStatus();
    render(<ConfigurationTab />);

    expect(await screen.findByText("unavailable")).toBeInTheDocument();
    expect(screen.queryByTestId("setup-row-orchestration")).toBeNull();
  });
});
