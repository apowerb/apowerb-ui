import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

vi.mock("@/components/Toast", () => ({ useToast: () => toast }));
vi.mock("@/lib/api", () => ({ upgradeDashboardFromTemplate: vi.fn() }));

const api = await import("@/lib/api");
const ChangeLanguageModal = (await import("../ChangeLanguageModal")).default;

const TEMPLATE = { id: "stock_pilotage", label: "Pilotage stocks", version: 3, origin: "builtin", columns: [], params: [] };
const dashboard = (locale) => ({ id: "d1", title: "T", locale, template: { id: "stock_pilotage", version: 3, columns: {}, params: {} } });

function setup({ locale = "fr", upgrade } = {}) {
  const onDone = vi.fn();
  const onClose = vi.fn();
  api.upgradeDashboardFromTemplate.mockImplementation(
    upgrade || (async () => ({ to_version: 3, dashboard: { id: "d1", locale: "en" } })),
  );
  render(<ChangeLanguageModal dashboard={dashboard(locale)} template={TEMPLATE} onClose={onClose} onDone={onDone} />);
  return { onDone, onClose };
}

describe("ChangeLanguageModal", () => {
  beforeEach(() => vi.clearAllMocks());

  it("preselects the other language and warns that the dashboard is rebuilt", () => {
    setup({ locale: "fr" });
    expect(screen.getByRole("radio", { name: /English/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Français/ })).not.toBeChecked();
    expect(screen.getByRole("note")).toHaveTextContent(/rebuilt from the template/);
  });

  it("treats a dashboard without a language as French", () => {
    setup({ locale: null });
    expect(screen.getByRole("radio", { name: /English/ })).toBeChecked();
  });

  it("rebuilds the dashboard in the chosen language", async () => {
    const { onDone, onClose } = setup({ locale: "fr" });
    fireEvent.click(screen.getByRole("button", { name: "Replace and change language" }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith({ id: "d1", locale: "en" }));
    expect(api.upgradeDashboardFromTemplate).toHaveBeenCalledWith("d1", { lang: "en" });
    expect(toast.success).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("cannot submit the current language", () => {
    setup({ locale: "en" });
    fireEvent.click(screen.getByRole("radio", { name: /English/ }));
    expect(screen.getByRole("button", { name: "Replace and change language" })).toBeDisabled();
  });

  it("shows the server errors and stays open", async () => {
    const err = Object.assign(new Error("422"), { detail: { errors: ["This template exists in one language only"] } });
    const { onDone } = setup({ upgrade: async () => Promise.reject(err) });
    fireEvent.click(screen.getByRole("button", { name: "Replace and change language" }));
    expect(await screen.findByText("This template exists in one language only")).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
  });
});
