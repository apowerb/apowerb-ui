import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import EditChartModal from "../EditChartModal";
import { ToastProvider } from "../../Toast";
import en from "../../../../messages/en.json";
import fr from "../../../../messages/fr.json";

vi.mock("@/lib/api", () => ({
  updateChart: vi.fn(() => Promise.resolve({})),
  uploadBiCsv: vi.fn(),
  listBiDatasets: vi.fn(() => Promise.resolve([])),
  listBiDbConfigs: vi.fn(() => Promise.resolve([])),
  getChartData: vi.fn(() => Promise.resolve({ rows: [] })),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { email: "tester@example.com" } }),
}));

vi.mock("../AgentSourcePicker", () => ({
  default: () => <div>mock-agent-picker</div>,
}));

vi.mock("../OneDriveFilePicker", () => ({
  default: () => <div>mock-onedrive-picker</div>,
}));

import { updateChart } from "@/lib/api";

const agentChart = {
  id: "chart-1",
  name: "revenue",
  title: "Revenue",
  chart_type: "bar",
  organization_id: "example.com",
  project_id: "thaink2",
  refresh_interval: 0,
  filters: [],
  config: {},
  source: {
    source_type: "agent",
    query: "",
    source_options: { agent_ids: [7], message: "Monthly revenue by region" },
  },
};

const renderModal = (chart = agentChart) =>
  render(
    <ToastProvider>
      <EditChartModal chart={chart} onClose={vi.fn()} onSaved={vi.fn()} />
    </ToastProvider>,
  );

/**
 * Symptôme de prod du 08/09 (chart 0db64b90) : un graphique à source agent
 * n'emportait que `agent_ids`. Le cœur retombait alors sur « Return the latest
 * data as a JSON array of objects. », l'agent répondait de la prose, et la
 * lecture des données rendait 502. Ce modal, en plus, réécrivait
 * `source_options` à `{ agent_ids }` à chaque enregistrement : une consigne
 * posée ailleurs disparaissait au premier « Enregistrer ».
 */
describe("EditChartModal — consigne d'un graphique à source agent", () => {
  beforeEach(() => {
    updateChart.mockClear();
  });

  it("affiche la consigne existante", () => {
    renderModal();
    expect(screen.getByDisplayValue("Monthly revenue by region")).toBeTruthy();
  });

  it("conserve la consigne à l'enregistrement", async () => {
    renderModal();
    fireEvent.click(screen.getByText(en.EditChartModal.save));
    await waitFor(() => expect(updateChart).toHaveBeenCalled());
    const payload = updateChart.mock.calls[0][1];
    expect(payload.source.source_options).toMatchObject({
      agent_ids: [7],
      message: "Monthly revenue by region",
    });
  });

  it("enregistre une consigne saisie à la main", async () => {
    const sansConsigne = {
      ...agentChart,
      source: { ...agentChart.source, source_options: { agent_ids: [7] } },
    };
    renderModal(sansConsigne);
    const zone = screen.getByLabelText(en.EditChartModal.agentInstruction);
    fireEvent.change(zone, { target: { value: "  Top 10 clients  " } });
    fireEvent.click(screen.getByText(en.EditChartModal.save));
    await waitFor(() => expect(updateChart).toHaveBeenCalled());
    expect(updateChart.mock.calls[0][1].source.source_options.message).toBe(
      "Top 10 clients",
    );
  });

  it("n'envoie pas de consigne vide", async () => {
    const sansConsigne = {
      ...agentChart,
      source: { ...agentChart.source, source_options: { agent_ids: [7] } },
    };
    renderModal(sansConsigne);
    fireEvent.click(screen.getByText(en.EditChartModal.save));
    await waitFor(() => expect(updateChart).toHaveBeenCalled());
    expect(
      "message" in updateChart.mock.calls[0][1].source.source_options,
    ).toBe(false);
  });
});

/**
 * Le garde d'espaces de noms existant compare les namespaces, pas les clés :
 * une clé neuve absente d'une langue s'afficherait en clair
 * ("EditChartModal.agentInstruction") sans qu'aucun test ne bronche.
 */
describe("messages — les deux langues portent la consigne agent", () => {
  const clés = [
    "agentInstruction",
    "agentInstructionPlaceholder",
    "agentInstructionHint",
  ];
  for (const ns of ["AddChartWizard", "EditChartModal"]) {
    for (const clé of clés) {
      it(`${ns}.${clé} existe en anglais et en français`, () => {
        expect(typeof en[ns][clé]).toBe("string");
        expect(typeof fr[ns][clé]).toBe("string");
        expect(en[ns][clé].length).toBeGreaterThan(0);
        expect(fr[ns][clé].length).toBeGreaterThan(0);
      });
    }
  }
});
