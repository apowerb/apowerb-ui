import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

vi.mock("@/components/Toast", () => ({ useToast: () => toast }));
vi.mock("@/lib/api", () => ({
  upgradeDashboardFromTemplate: vi.fn(),
  getDashboardSourceRequirements: vi.fn(),
}));

const api = await import("@/lib/api");
const UpgradeTemplateModal = (await import("../UpgradeTemplateModal")).default;

const TEMPLATE = {
  id: "stock_pilotage",
  label: "Pilotage stocks",
  version: 3,
  columns: [
    { key: "date", label: "Semaine", type: "date", required: true, default: "semaine" },
    { key: "sales", label: "Ventes", type: "number", required: true, default: "ventes" },
    { key: "stock", label: "Stock", type: "number", required: false, default: "stock" },
  ],
  params: [{ key: "horizon", label: "Horizon", type: "integer", default: 8, min: 1, max: 26 }],
};

const LINKED = { id: "d1", title: "T", template: { id: "stock_pilotage", version: 1, columns: {}, params: {} } };
const UNLINKED = { id: "d1", title: "T", template: null };

function setup({ dashboard = LINKED, upgrade } = {}) {
  if (upgrade) api.upgradeDashboardFromTemplate.mockImplementation(upgrade);
  api.getDashboardSourceRequirements.mockResolvedValue({
    source: "ventes.csv",
    dataset_id: "ds-1",
    template: null,
    columns: [
      { key: "semaine", label: "semaine", type: "date", required: false, current: "semaine" },
      { key: "ventes", label: "ventes", type: "number", required: false, current: "ventes" },
      { key: "magasin", label: "magasin", type: "string", required: false, current: "magasin" },
    ],
  });
  const onClose = vi.fn();
  const onDone = vi.fn();
  render(<UpgradeTemplateModal dashboard={dashboard} templates={[TEMPLATE]} onClose={onClose} onDone={onDone} />);
  return { onClose, onDone };
}

describe("UpgradeTemplateModal with a provenance", () => {
  beforeEach(() => vi.clearAllMocks());

  it("warns that manual edits are replaced and shows the version jump, without calling the API yet", () => {
    setup();
    expect(screen.getByText(/version 1 → 3/)).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(/Manual edits .* will be replaced/);
    expect(api.upgradeDashboardFromTemplate).not.toHaveBeenCalled();
    expect(api.getDashboardSourceRequirements).not.toHaveBeenCalled();
  });

  it("posts an empty body on confirmation, then reports the new dashboard", async () => {
    const dashboard = { id: "d1", title: "T", template: { id: "stock_pilotage", version: 3 } };
    const { onDone, onClose } = setup({ upgrade: async () => ({ dashboard, from_version: 1, to_version: 3 }) });
    fireEvent.click(screen.getByRole("button", { name: "Replace and update" }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(dashboard));
    expect(api.upgradeDashboardFromTemplate).toHaveBeenCalledWith("d1", {});
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("3"));
    expect(onClose).toHaveBeenCalled();
  });

  it("lists 422 errors and stays open", async () => {
    const { onDone } = setup({
      upgrade: async () => {
        const e = new Error("{}");
        e.status = 422;
        e.detail = { errors: ["Colonne 'stock' absente"] };
        throw e;
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Replace and update" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Colonne 'stock' absente");
    expect(onDone).not.toHaveBeenCalled();
  });
});

describe("UpgradeTemplateModal without a provenance (attach)", () => {
  beforeEach(() => vi.clearAllMocks());

  async function reach() {
    fireEvent.click(await screen.findByRole("radio", { name: /Pilotage stocks/ }));
    await screen.findByLabelText("Semaine");
  }

  it("reads the columns of the dashboard source and preselects by default name", async () => {
    setup({ dashboard: UNLINKED });
    expect(screen.getByRole("note")).toHaveTextContent(/Manual edits .* will be replaced/);
    await reach();
    expect(api.getDashboardSourceRequirements).toHaveBeenCalledWith("d1");
    expect(screen.getByLabelText("Semaine")).toHaveValue("semaine");
    expect(screen.getByLabelText("Ventes")).toHaveValue("ventes");
    expect(screen.getByLabelText("Stock")).toHaveValue("");
    expect(screen.getByLabelText("Stock").querySelector("option[value='']")).toHaveTextContent("None");
  });

  it("blocks attaching while a required column is unmapped", async () => {
    setup({ dashboard: UNLINKED });
    await reach();
    fireEvent.change(screen.getByLabelText("Ventes"), { target: { value: "" } });
    expect(screen.getByRole("button", { name: "Attach and rebuild" })).toBeDisabled();
  });

  it("posts template_id, columns and params", async () => {
    const dashboard = { id: "d1", title: "T", template: { id: "stock_pilotage", version: 3 } };
    const { onDone } = setup({
      dashboard: UNLINKED,
      upgrade: async () => ({ dashboard, from_version: null, to_version: 3 }),
    });
    await reach();
    fireEvent.change(screen.getByLabelText("Stock"), { target: { value: "magasin" } });
    fireEvent.change(screen.getByLabelText("Horizon"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Attach and rebuild" }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(dashboard));
    expect(api.upgradeDashboardFromTemplate).toHaveBeenCalledWith("d1", {
      template_id: "stock_pilotage",
      columns: { date: "semaine", sales: "ventes", stock: "magasin" },
      params: { horizon: 12 },
    });
  });

  it("blocks attaching with an invalid horizon", async () => {
    setup({ dashboard: UNLINKED });
    await reach();
    fireEvent.change(screen.getByLabelText("Horizon"), { target: { value: "99" } });
    expect(screen.getByRole("button", { name: "Attach and rebuild" })).toBeDisabled();
  });
});
