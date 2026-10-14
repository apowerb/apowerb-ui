import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { email: "x@acme.fr" } }) }));
vi.mock("@/components/Toast", () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }) }));
vi.mock("@/lib/api", () => ({
  listDashboardTemplates: vi.fn(),
  listBiDatasets: vi.fn(async () => ({ datasets: [] })),
  previewBiDataset: vi.fn(),
  getDashboardSourceRequirements: vi.fn(async () => ({ source: "s.csv", dataset_id: "ds-1", template: null, columns: [] })),
  replaceDashboardSource: vi.fn(),
  upgradeDashboardFromTemplate: vi.fn(),
  saveDashboardAsTemplate: vi.fn(),
}));

const api = await import("@/lib/api");
const TemplateActionsMenu = (await import("../TemplateActionsMenu")).default;

const tpl = (version) => ({
  id: "stock_pilotage",
  label: "Pilotage stocks",
  version,
  columns: [],
  params: [],
});
const linked = (version) => ({ id: "d1", title: "T", template: { id: "stock_pilotage", version, columns: {}, params: {} } });

async function open(dashboard, templates) {
  api.listDashboardTemplates.mockResolvedValue(templates);
  render(<TemplateActionsMenu dashboard={dashboard} onDashboardChange={vi.fn()} />);
  await act(async () => {});
  expect(api.listDashboardTemplates).toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Template" }));
}

describe("TemplateActionsMenu", () => {
  beforeEach(() => vi.clearAllMocks());

  it("always offers replace-source and save-as-template", async () => {
    await open(linked(3), [tpl(3)]);
    expect(screen.getByRole("menuitem", { name: "Replace the source file" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Save as a template" })).toBeInTheDocument();
  });

  it("lists the templates in the dashboard language", async () => {
    await open({ ...linked(3), locale: "en" }, [tpl(3)]);
    expect(api.listDashboardTemplates).toHaveBeenCalledWith("en");
  });

  it("lists the templates in French for a dashboard without locale", async () => {
    await open(linked(3), [tpl(3)]);
    expect(api.listDashboardTemplates).toHaveBeenCalledWith("fr");
  });

  it("offers the update only when the template version is newer than the provenance", async () => {
    await open(linked(1), [tpl(3)]);
    expect(await screen.findByRole("menuitem", { name: "Update to the latest template version" })).toBeInTheDocument();
  });

  it("hides the update when the dashboard is up to date", async () => {
    await open(linked(3), [tpl(3)]);
    expect(screen.queryByRole("menuitem", { name: /Update to the latest/ })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: /Attach to a template/ })).toBeNull();
  });

  it("offers to attach a dashboard that has no provenance", async () => {
    await open({ id: "d1", title: "T", template: null }, [tpl(3)]);
    expect(await screen.findByRole("menuitem", { name: "Attach to a template" })).toBeInTheDocument();
  });

  it("opens the matching dialog from each item", async () => {
    await open(linked(1), [tpl(3)]);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Save as a template" }));
    expect(screen.getByRole("dialog", { name: "Save as a template" })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Template" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Replace the source file" }));
    expect(await screen.findByRole("dialog", { name: "Replace the source file" })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    fireEvent.click(screen.getByRole("button", { name: "Template" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Update to the latest template version" }));
    expect(screen.getByRole("dialog", { name: "Update to the latest template version" })).toBeInTheDocument();
  });

  it("offers to change the language of a dashboard built from a stock template", async () => {
    await open({ ...linked(3), locale: "fr" }, [{ ...tpl(3), origin: "builtin" }]);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Change the language" }));
    expect(screen.getByRole("dialog", { name: "Change the language" })).toBeInTheDocument();
  });

  it("hides the language change for a user template or a dashboard without one", async () => {
    await open(linked(3), [{ ...tpl(3), origin: "user" }]);
    expect(screen.queryByRole("menuitem", { name: "Change the language" })).toBeNull();
  });

  it("closes the menu on Escape", async () => {
    await open(linked(3), [tpl(3)]);
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
