import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

vi.mock("@/components/Toast", () => ({ useToast: () => toast }));
vi.mock("@/lib/api", () => ({ saveDashboardAsTemplate: vi.fn() }));

const api = await import("@/lib/api");
const SaveAsTemplateModal = (await import("../SaveAsTemplateModal")).default;

function fail(status, detail, message = "x") {
  return async () => {
    const e = new Error(message);
    e.status = status;
    if (detail) e.detail = detail;
    throw e;
  };
}

function setup(save) {
  if (save) api.saveDashboardAsTemplate.mockImplementation(save);
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(<SaveAsTemplateModal dashboard={{ id: "d1", title: "Pilotage Q3" }} onClose={onClose} onSaved={onSaved} />);
  return { onClose, onSaved };
}

describe("SaveAsTemplateModal", () => {
  beforeEach(() => vi.clearAllMocks());

  it("prefills the name with the dashboard title and defaults to private", () => {
    setup();
    expect(screen.getByLabelText("Template name")).toHaveValue("Pilotage Q3");
    expect(screen.getByLabelText("Description")).toHaveValue("");
    expect(screen.getByRole("radio", { name: /Private/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Organization/ })).not.toBeChecked();
  });

  it("blocks saving with an empty name", () => {
    setup();
    fireEvent.change(screen.getByLabelText("Template name"), { target: { value: "  " } });
    expect(screen.getByRole("button", { name: "Save template" })).toBeDisabled();
  });

  it("posts the exact body with description and organization visibility", async () => {
    const { onClose, onSaved } = setup(async () => ({ id: "user_1", label: "Mon modèle" }));
    fireEvent.change(screen.getByLabelText("Template name"), { target: { value: " Mon modèle " } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: " Base stock " } });
    fireEvent.click(screen.getByRole("radio", { name: /Organization/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save template" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(api.saveDashboardAsTemplate).toHaveBeenCalledWith("d1", {
      label: "Mon modèle",
      description: "Base stock",
      visibility: "organization",
    });
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("Mon modèle"));
    expect(onSaved).toHaveBeenCalledWith({ id: "user_1", label: "Mon modèle" });
  });

  it("omits an empty description", async () => {
    const { onClose } = setup(async () => ({ id: "u", label: "Pilotage Q3" }));
    fireEvent.click(screen.getByRole("button", { name: "Save template" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(api.saveDashboardAsTemplate).toHaveBeenCalledWith("d1", {
      label: "Pilotage Q3",
      visibility: "private",
    });
  });

  it("explains a 409 as a name already taken and stays open", async () => {
    const { onClose } = setup(fail(409, { message: "dup" }, "Conflict"));
    fireEvent.click(screen.getByRole("button", { name: "Save template" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("A template with this name already exists");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Save template" })).toBeEnabled();
  });

  it("lists 422 errors", async () => {
    setup(fail(422, { errors: ["Pas une spec v2", "Aucune source"] }));
    fireEvent.click(screen.getByRole("button", { name: "Save template" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Pas une spec v2");
    expect(alert).toHaveTextContent("Aucune source");
  });

  it("closes on Escape", () => {
    const { onClose } = setup();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
