import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

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
}));

const api = await import("@/lib/api");
const TemplateWizard = (await import("../TemplateWizard")).default;

const TEMPLATE = {
  id: "stock_pilotage",
  label: "Pilotage stocks",
  description: "Stock steering",
  columns: [
    { key: "date", label: "Semaine", type: "date", required: true, default: "semaine" },
    { key: "family", label: "Famille", type: "string", required: true, default: "famille" },
    { key: "sales", label: "Ventes", type: "number", required: true, default: "ventes" },
    { key: "site", label: "Site", type: "string", required: false, default: null },
  ],
  params: [{ key: "horizon", label: "Horizon de prévision (semaines)", type: "integer", default: 8, min: 1, max: 26 }],
};

const col = (name, type = "string") => ({ name, type });

function setup({ columns, create } = {}) {
  api.listDashboardTemplates.mockResolvedValue([TEMPLATE]);
  api.listBiDatasets.mockResolvedValue({
    datasets: [{ file_id: "ds-9", filename: "ventes.csv", columns_count: 4, row_count: 10 }],
  });
  api.previewBiDataset.mockResolvedValue({
    columns: columns || [col("Semaine", "date"), col("FAMILLE"), col("ventes", "number"), col("magasin")],
    sample_rows: [],
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
    expect(screen.getByText("Expected: number")).toBeInTheDocument();
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
      columns: { date: "week", family: "product_group", sales: "qty", site: null },
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
});
