import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";

const push = vi.fn();
const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

vi.mock("@/lib/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { email: "x@acme.fr" } }) }));
vi.mock("@/components/Toast", () => ({ useToast: () => toast }));
vi.mock("@/lib/api", () => ({
  listDashboardTemplates: vi.fn(),
  listBiDatasets: vi.fn(),
  previewBiDataset: vi.fn(),
  createDashboardFromTemplate: vi.fn(),
  deleteDashboardTemplate: vi.fn(),
}));

const api = await import("@/lib/api");
const TemplateWizard = (await import("../TemplateWizard")).default;

const TEMPLATE = {
  id: "stock_pilotage",
  label: "Pilotage stocks",
  description: "Stock steering",
  version: 2,
  origin: "builtin",
  owner: null,
  visibility: null,
  can_delete: false,
  columns: [
    { key: "date", label: "Semaine", type: "date", required: true, default: "semaine" },
    { key: "family", label: "Famille", type: "string", required: true, default: "famille" },
    { key: "sales", label: "Ventes", type: "number", required: true, default: "ventes" },
    { key: "site", label: "Site", type: "string", required: false, default: null },
    { key: "stock", label: "Stock", type: "number", required: false, default: "stock" },
  ],
  params: [{ key: "horizon", label: "Horizon de prévision (semaines)", type: "integer", default: 8, min: 1, max: 26 }],
};

const col = (name, type = "string") => ({ name, type });

function setup({ columns, create, templates = [TEMPLATE], datasets, rows = [] } = {}) {
  api.listDashboardTemplates.mockResolvedValue(templates);
  api.listBiDatasets.mockResolvedValue({
    datasets: datasets || [{ file_id: "ds-9", filename: "ventes.csv", columns_count: 4, row_count: 10 }],
  });
  api.previewBiDataset.mockResolvedValue({
    columns: columns || [col("Semaine", "date"), col("FAMILLE"), col("ventes", "number"), col("magasin")],
    sample_rows: rows,
    row_count: 10,
  });
  if (create) api.createDashboardFromTemplate.mockImplementation(create);
  const onClose = vi.fn();
  render(<TemplateWizard onClose={onClose} />);
  return { onClose };
}

const next = () => fireEvent.click(screen.getByRole("button", { name: "Next" }));
const createBtn = () => screen.getByRole("button", { name: "Create" });

async function reachColumns() {
  await screen.findByText("Pilotage stocks");
  next();
  fireEvent.click(await screen.findByRole("radio", { name: /ventes\.csv/ }));
  next();
  await screen.findByLabelText("Semaine");
}

describe("TemplateWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists templates then datasets of the user's organisation", async () => {
    setup();
    expect(await screen.findByText("Pilotage stocks")).toBeInTheDocument();
    next();
    expect(await screen.findByRole("radio", { name: /ventes\.csv/ })).toBeInTheDocument();
    expect(api.listBiDatasets).toHaveBeenCalledWith("acme.fr");
  });

  it("preselects columns whose name matches the default, case-insensitively", async () => {
    setup();
    await reachColumns();
    expect(screen.getByLabelText("Semaine")).toHaveValue("Semaine");
    expect(screen.getByLabelText("Famille")).toHaveValue("FAMILLE");
    expect(screen.getByLabelText("Ventes")).toHaveValue("ventes");
    expect(screen.getByLabelText("Site")).toHaveValue("");
    expect(api.previewBiDataset).toHaveBeenCalledWith("ds-9", "acme.fr");
  });

  it("shows the expected type of each column", async () => {
    setup();
    await reachColumns();
    expect(screen.getByText("Expected: date")).toBeInTheDocument();
    expect(screen.getAllByText("Expected: number")).toHaveLength(2);
  });

  it("blocks Next while a required column is unmapped, and unblocks when chosen by hand", async () => {
    setup({ columns: [col("week", "date"), col("product_group"), col("qty", "number")] });
    await reachColumns();
    expect(screen.getByLabelText("Semaine")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Semaine"), { target: { value: "week" } });
    fireEvent.change(screen.getByLabelText("Famille"), { target: { value: "product_group" } });
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Ventes"), { target: { value: "qty" } });
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });

  it("offers a None option for the optional column only", async () => {
    setup();
    await reachColumns();
    expect(screen.getByLabelText("Site").querySelector("option[value='']")).toHaveTextContent("None");
    expect(screen.getByLabelText("Semaine").querySelector("option[value='']")).not.toHaveTextContent("None");
  });

  it("keeps Create disabled until the title and the horizon are valid", async () => {
    setup();
    await reachColumns();
    next();
    const title = await screen.findByLabelText("Title");
    expect(title).toHaveValue("Pilotage stocks");
    expect(createBtn()).toBeEnabled();
    fireEvent.change(title, { target: { value: "  " } });
    expect(createBtn()).toBeDisabled();
    fireEvent.change(title, { target: { value: "Mon tableau" } });
    const horizon = screen.getByLabelText("Horizon de prévision (semaines)");
    expect(horizon).toHaveValue(8);
    fireEvent.change(horizon, { target: { value: "27" } });
    expect(createBtn()).toBeDisabled();
    fireEvent.change(horizon, { target: { value: "0" } });
    expect(createBtn()).toBeDisabled();
    fireEvent.change(horizon, { target: { value: "2.5" } });
    expect(createBtn()).toBeDisabled();
    fireEvent.change(horizon, { target: { value: "12" } });
    expect(createBtn()).toBeEnabled();
  });

  it("posts the exact body with hand-picked columns, then navigates to the returned url", async () => {
    setup({
      columns: [col("week", "date"), col("product_group"), col("qty", "number"), col("magasin")],
      create: async () => ({ dashboard_id: "d1", title: "Mon tableau", url: "/bi/d1" }),
    });
    await reachColumns();
    fireEvent.change(screen.getByLabelText("Semaine"), { target: { value: "week" } });
    fireEvent.change(screen.getByLabelText("Famille"), { target: { value: "product_group" } });
    fireEvent.change(screen.getByLabelText("Ventes"), { target: { value: "qty" } });
    next();
    fireEvent.change(await screen.findByLabelText("Title"), { target: { value: "Mon tableau" } });
    fireEvent.change(screen.getByLabelText("Horizon de prévision (semaines)"), { target: { value: "12" } });
    fireEvent.click(createBtn());
    await waitFor(() => expect(push).toHaveBeenCalledWith("/bi/d1"));
    expect(api.createDashboardFromTemplate).toHaveBeenCalledWith("stock_pilotage", {
      dataset_id: "ds-9",
      title: "Mon tableau",
      columns: { date: "week", family: "product_group", sales: "qty", site: null, stock: null },
      params: { horizon: 12 },
    });
    expect(toast.info).not.toHaveBeenCalled();
  });

  it("announces a rename when the server returns another title", async () => {
    setup({ create: async () => ({ dashboard_id: "d1", title: "Pilotage stocks (2)", url: "/bi/d1" }) });
    await reachColumns();
    next();
    await screen.findByLabelText("Title");
    fireEvent.click(createBtn());
    await waitFor(() => expect(push).toHaveBeenCalledWith("/bi/d1"));
    expect(toast.info).toHaveBeenCalledWith(expect.stringContaining("Pilotage stocks (2)"));
  });

  it("lists each 422 error in plain text and stays on the form", async () => {
    setup({
      create: async () => {
        const e = new Error("{}");
        e.status = 422;
        e.detail = { errors: ["Column 'qty' is not numeric", "Unknown column 'x'"] };
        throw e;
      },
    });
    await reachColumns();
    next();
    await screen.findByLabelText("Title");
    fireEvent.click(createBtn());
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Column 'qty' is not numeric");
    expect(alert).toHaveTextContent("Unknown column 'x'");
    expect(push).not.toHaveBeenCalled();
    expect(createBtn()).toBeEnabled();
  });

  it("shows a 404 message in plain text", async () => {
    setup({
      create: async () => {
        const e = new Error("Template not found");
        e.status = 404;
        throw e;
      },
    });
    await reachColumns();
    next();
    await screen.findByLabelText("Title");
    fireEvent.click(createBtn());
    expect(await screen.findByRole("alert")).toHaveTextContent("Template not found");
    expect(push).not.toHaveBeenCalled();
  });

  it("closes on Escape", async () => {
    const { onClose } = setup();
    await screen.findByText("Pilotage stocks");
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("filters the dataset list by name", async () => {
    setup({
      datasets: [
        { file_id: "ds-1", filename: "ventes.csv", columns_count: 1, row_count: 1 },
        { file_id: "ds-2", filename: "stock.xlsx", columns_count: 1, row_count: 1 },
      ],
    });
    await screen.findByText("Pilotage stocks");
    next();
    await screen.findByRole("radio", { name: /stock\.xlsx/ });
    fireEvent.change(screen.getByRole("searchbox", { name: "Search datasets" }), { target: { value: "VEN" } });
    expect(screen.queryByRole("radio", { name: /stock\.xlsx/ })).toBeNull();
    expect(screen.getByRole("radio", { name: /ventes\.csv/ })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search datasets" }), { target: { value: "nope" } });
    expect(screen.getByText(/No dataset matches “nope”/)).toBeInTheDocument();
  });

  it("previews the first 5 rows of the chosen dataset on the columns step", async () => {
    const rows = Array.from({ length: 9 }, (_, i) => ({ Semaine: `S${i + 1}`, FAMILLE: "A", ventes: i, magasin: "M" }));
    setup({ rows });
    await reachColumns();
    const table = screen.getByRole("table", { name: /First rows of ventes\.csv/ });
    const body = within(table).getAllByRole("row");
    expect(body).toHaveLength(1 + 5);
    expect(within(table).getByText("S5")).toBeInTheDocument();
    expect(within(table).queryByText("S6")).toBeNull();
  });

  it("warns, without blocking, when a chosen column has another type than expected", async () => {
    setup({ columns: [col("Semaine", "string"), col("FAMILLE"), col("ventes", "string"), col("magasin")] });
    await reachColumns();
    expect(screen.getByText(/looks like text, but date is expected/)).toBeInTheDocument();
    expect(screen.getByText(/looks like text, but number is expected/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });

  it("does not warn when the types match", async () => {
    setup({ columns: [col("Semaine", "date"), col("FAMILLE"), col("ventes", "float"), col("magasin")] });
    await reachColumns();
    expect(screen.queryByText(/is expected/)).toBeNull();
  });

  it("preselects an optional column by its default name and offers None", async () => {
    setup({ columns: [col("Semaine", "date"), col("FAMILLE"), col("ventes", "number"), col("Stock", "number")] });
    await reachColumns();
    expect(screen.getByLabelText("Stock")).toHaveValue("Stock");
    expect(screen.getByLabelText("Stock").querySelector("option[value='']")).toHaveTextContent("None");
    fireEvent.change(screen.getByLabelText("Stock"), { target: { value: "" } });
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });

  describe("user templates", () => {
    const MINE = {
      ...TEMPLATE,
      id: "user_1",
      label: "Mon modèle",
      origin: "user",
      owner: "x@acme.fr",
      visibility: "private",
      can_delete: true,
    };
    const SHARED = {
      ...TEMPLATE,
      id: "user_2",
      label: "Modèle équipe",
      origin: "user",
      owner: "y@acme.fr",
      visibility: "organization",
      can_delete: false,
    };

    it("badges user templates and offers delete only on the ones the user can delete", async () => {
      setup({ templates: [TEMPLATE, MINE, SHARED] });
      await screen.findByText("Mon modèle");
      expect(screen.getByText("My template")).toBeInTheDocument();
      expect(screen.getByText("Organization")).toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: /^Delete template/ })).toHaveLength(1);
      expect(screen.getByRole("button", { name: "Delete template Mon modèle" })).toBeInTheDocument();
    });

    it("asks for confirmation, then deletes and removes the card", async () => {
      api.deleteDashboardTemplate.mockResolvedValue({});
      setup({ templates: [TEMPLATE, MINE] });
      fireEvent.click(await screen.findByRole("button", { name: "Delete template Mon modèle" }));
      expect(api.deleteDashboardTemplate).not.toHaveBeenCalled();
      expect(screen.getByRole("alertdialog")).toHaveTextContent("Mon modèle");
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));
      await waitFor(() => expect(screen.queryByText("Mon modèle")).toBeNull());
      expect(api.deleteDashboardTemplate).toHaveBeenCalledWith("user_1");
      expect(toast.success).toHaveBeenCalled();
    });

    it("keeps the template when the confirmation is cancelled", async () => {
      setup({ templates: [TEMPLATE, MINE] });
      fireEvent.click(await screen.findByRole("button", { name: "Delete template Mon modèle" }));
      fireEvent.click(screen.getByRole("button", { name: "Keep" }));
      expect(screen.queryByRole("alertdialog")).toBeNull();
      expect(api.deleteDashboardTemplate).not.toHaveBeenCalled();
      expect(screen.getByText("Mon modèle")).toBeInTheDocument();
    });

    it("keeps the template and reports the error when the delete fails", async () => {
      api.deleteDashboardTemplate.mockRejectedValue(new Error("Forbidden"));
      setup({ templates: [TEMPLATE, MINE] });
      fireEvent.click(await screen.findByRole("button", { name: "Delete template Mon modèle" }));
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("Forbidden")));
      expect(screen.getByText("Mon modèle")).toBeInTheDocument();
    });
  });
});
