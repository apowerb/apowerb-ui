import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";

const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { email: "x@acme.fr" } }) }));
vi.mock("@/components/Toast", () => ({ useToast: () => toast }));
vi.mock("@/lib/api", () => ({
  listBiDatasets: vi.fn(),
  previewBiDataset: vi.fn(),
  getDashboardSourceRequirements: vi.fn(),
  replaceDashboardSource: vi.fn(),
}));

const api = await import("@/lib/api");
const ReplaceSourceModal = (await import("../ReplaceSourceModal")).default;

const REQS = {
  source: "ventes-2025.csv",
  dataset_id: "ds-1",
  template: null,
  columns: [
    { key: "date", label: "Semaine", type: "date", required: true, current: "week" },
    { key: "family", label: "Famille", type: "string", required: true, current: "famille_old" },
    { key: "sales", label: "Ventes", type: "number", required: true, current: null },
    { key: "site", label: "Site", type: "string", required: false, current: null },
  ],
};

const col = (name, type = "string") => ({ name, type });
const rows = (n) => Array.from({ length: n }, (_, i) => ({ week: `2026-W${i + 1}`, Famille: "A", ventes: i }));

function setup({ onDone = vi.fn(), replace } = {}) {
  api.getDashboardSourceRequirements.mockResolvedValue(REQS);
  api.listBiDatasets.mockResolvedValue({
    datasets: [
      { file_id: "ds-1", filename: "ventes-2025.csv", columns_count: 4, row_count: 10 },
      { file_id: "ds-2", filename: "ventes-2026.csv", columns_count: 4, row_count: 12 },
      { file_id: "ds-3", filename: "stock.xlsx", columns_count: 3, row_count: 5 },
    ],
  });
  api.previewBiDataset.mockResolvedValue({
    columns: [col("week", "date"), col("Famille"), col("ventes", "number"), col("magasin")],
    sample_rows: rows(8),
    row_count: 8,
  });
  if (replace) api.replaceDashboardSource.mockImplementation(replace);
  const onClose = vi.fn();
  render(<ReplaceSourceModal dashboardId="d1" onClose={onClose} onDone={onDone} />);
  return { onClose, onDone };
}

const pick = async (name) => fireEvent.click(await screen.findByRole("radio", { name: new RegExp(name) }));

describe("ReplaceSourceModal", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads the source requirements of the dashboard and shows the current source", async () => {
    setup();
    expect(await screen.findByText(/Current source: ventes-2025\.csv/)).toBeInTheDocument();
    expect(api.getDashboardSourceRequirements).toHaveBeenCalledWith("d1");
    expect(api.listBiDatasets).toHaveBeenCalledWith("acme.fr");
  });

  it("filters the dataset list by name", async () => {
    setup();
    await screen.findByRole("radio", { name: /stock\.xlsx/ });
    fireEvent.change(screen.getByRole("searchbox", { name: "Search datasets" }), { target: { value: "2026" } });
    expect(screen.queryByRole("radio", { name: /stock\.xlsx/ })).toBeNull();
    expect(screen.getByRole("radio", { name: /ventes-2026\.csv/ })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search datasets" }), { target: { value: "zzz" } });
    expect(screen.getByText(/No dataset matches/)).toBeInTheDocument();
  });

  it("prefills columns from the current mapping, then by name, and previews 5 rows", async () => {
    setup();
    await pick("ventes-2026");
    await screen.findByLabelText("Semaine");
    expect(screen.getByLabelText("Semaine")).toHaveValue("week");
    expect(screen.getByLabelText("Famille")).toHaveValue("Famille");
    expect(screen.getByLabelText("Ventes")).toHaveValue("ventes");
    expect(screen.getByLabelText("Site")).toHaveValue("");
    expect(api.previewBiDataset).toHaveBeenCalledWith("ds-2", "acme.fr");
    const preview = screen.getByRole("table", { name: /First rows/ });
    expect(within(preview).getAllByRole("row")).toHaveLength(1 + 5);
  });

  it("keeps Replace disabled while a required column is unmapped", async () => {
    setup();
    await pick("ventes-2026");
    await screen.findByLabelText("Semaine");
    fireEvent.change(screen.getByLabelText("Ventes"), { target: { value: "" } });
    expect(screen.getByRole("button", { name: "Replace" })).toBeDisabled();
  });

  it("posts the exact body, then reports success to the parent", async () => {
    const dashboard = { id: "d1", title: "T" };
    const { onDone, onClose } = setup({ replace: async () => ({ dashboard, missing: [] }) });
    await pick("ventes-2026");
    await screen.findByLabelText("Semaine");
    fireEvent.change(screen.getByLabelText("Site"), { target: { value: "magasin" } });
    fireEvent.click(screen.getByRole("button", { name: "Replace" }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(dashboard));
    expect(api.replaceDashboardSource).toHaveBeenCalledWith("d1", {
      dataset_id: "ds-2",
      columns: { date: "week", family: "Famille", sales: "ventes", site: "magasin" },
    });
    expect(toast.success).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("lists each 422 error and stays open", async () => {
    const { onDone, onClose } = setup({
      replace: async () => {
        const e = new Error("{}");
        e.status = 422;
        e.detail = { errors: ["Colonne 'ventes' absente. Disponibles : a, b", "Autre erreur"] };
        throw e;
      },
    });
    await pick("ventes-2026");
    await screen.findByLabelText("Semaine");
    fireEvent.click(screen.getByRole("button", { name: "Replace" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Colonne 'ventes' absente. Disponibles : a, b");
    expect(alert).toHaveTextContent("Autre erreur");
    expect(onDone).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Replace" })).toBeEnabled();
  });

  it("shows a type warning without blocking", async () => {
    setup();
    api.previewBiDataset.mockResolvedValue({
      columns: [col("week", "date"), col("Famille"), col("ventes", "string")],
      sample_rows: rows(2),
      row_count: 2,
    });
    await pick("ventes-2026");
    await screen.findByLabelText("Semaine");
    expect(screen.getByText(/looks like text, but number is expected/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Replace" })).toBeEnabled();
  });

  it("closes on Escape", async () => {
    const { onClose } = setup();
    await screen.findByRole("radio", { name: /stock\.xlsx/ });
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
