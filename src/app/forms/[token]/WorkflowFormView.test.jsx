/**
 * Public `/forms/[token]` page (T2 UI): loads the `form`-kind trigger's
 * definition, renders each field by type, validates required fields
 * client-side, submits, and shows the confirmation — mirroring
 * `SharedConversationView`'s public-page shape (loading/notFound/error
 * states, no dashboard chrome, no AuthProvider). `GET/POST
 * /api/hooks/forms/{token}` is mocked via `@/lib/api` — this exercises the
 * UI's contract with it, not the server.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WorkflowFormView from "./WorkflowFormView";

const { getWorkflowFormDefinition, submitWorkflowForm } = vi.hoisted(() => ({
  getWorkflowFormDefinition: vi.fn(),
  submitWorkflowForm: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ getWorkflowFormDefinition, submitWorkflowForm }));

function definition(overrides = {}) {
  return {
    title: "Contact us",
    description: "We read every message.",
    access: "public",
    fields: [
      { name: "full_name", label: "Full name", type: "text", required: true, options: null },
      { name: "notes", label: "Notes", type: "textarea", required: false, options: null },
      { name: "age", label: "Age", type: "number", required: false, options: null },
      { name: "subscribe", label: "Subscribe to updates", type: "boolean", required: false, options: null },
      { name: "plan", label: "Plan", type: "select", required: true, options: ["free", "pro"] },
      { name: "start_date", label: "Start date", type: "date", required: false, options: null },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("WorkflowFormView", () => {
  it("shows a loading state, then renders every field by type", async () => {
    getWorkflowFormDefinition.mockResolvedValue(definition());
    render(<WorkflowFormView token="tok123" />);

    expect(screen.getByText("Loading the form…")).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText("Contact us")).toBeInTheDocument());
    expect(screen.getByText("We read every message.")).toBeInTheDocument();

    expect(screen.getByLabelText(/Full name/)).toHaveAttribute("type", "text");
    expect(screen.getByLabelText(/Notes/).tagName).toBe("TEXTAREA");
    expect(screen.getByLabelText(/Age/)).toHaveAttribute("type", "number");
    expect(screen.getByLabelText(/Subscribe to updates/)).toHaveAttribute("type", "checkbox");
    expect(screen.getByLabelText(/Plan/).tagName).toBe("SELECT");
    expect(screen.getByLabelText(/Start date/)).toHaveAttribute("type", "date");
  });

  it("shows a not-found message on 404", async () => {
    const err = new Error("not found");
    err.status = 404;
    getWorkflowFormDefinition.mockRejectedValue(err);
    render(<WorkflowFormView token="missing" />);

    await waitFor(() => expect(screen.getByText("Form not found")).toBeInTheDocument());
  });

  it("invites sign-in on a 401 when loading the definition", async () => {
    const err = new Error("unauthorized");
    err.status = 401;
    getWorkflowFormDefinition.mockRejectedValue(err);
    render(<WorkflowFormView token="tok123" />);

    await waitFor(() => expect(screen.getByText("Sign in required")).toBeInTheDocument());
    const link = screen.getByRole("link", { name: "Sign in" });
    expect(link).toHaveAttribute("href", "/login?redirect=%2Fforms%2Ftok123");
  });

  it("shows a generic error message for anything else", async () => {
    const err = new Error("upstream 502");
    getWorkflowFormDefinition.mockRejectedValue(err);
    render(<WorkflowFormView token="tok123" />);

    await waitFor(() => expect(screen.getByText("Something went wrong")).toBeInTheDocument());
    expect(screen.getByText(/upstream 502/)).toBeInTheDocument();
  });

  it("blocks submit on a missing required field, without calling the API", async () => {
    const user = userEvent.setup();
    getWorkflowFormDefinition.mockResolvedValue(definition());
    render(<WorkflowFormView token="tok123" />);
    await waitFor(() => expect(screen.getByText("Contact us")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findAllByText("This field is required.")).not.toHaveLength(0);
    expect(submitWorkflowForm).not.toHaveBeenCalled();
  });

  it("submits coerced values and shows the confirmation", async () => {
    const user = userEvent.setup();
    getWorkflowFormDefinition.mockResolvedValue(definition());
    submitWorkflowForm.mockResolvedValue({ run_id: "run_1" });
    render(<WorkflowFormView token="tok123" />);
    await waitFor(() => expect(screen.getByText("Contact us")).toBeInTheDocument());

    await user.type(screen.getByLabelText(/Full name/), "Jamie Doe");
    await user.selectOptions(screen.getByLabelText(/Plan/), "pro");
    await user.click(screen.getByLabelText(/Subscribe to updates/));
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(screen.getByText("Thanks!")).toBeInTheDocument());
    expect(submitWorkflowForm).toHaveBeenCalledWith("tok123", {
      full_name: "Jamie Doe",
      notes: null,
      age: null,
      subscribe: true,
      plan: "pro",
      start_date: null,
    });
  });

  it("shows the server's 422 detail without losing the entered values", async () => {
    const user = userEvent.setup();
    getWorkflowFormDefinition.mockResolvedValue(definition());
    const err = new Error("full_name looks fake");
    err.status = 422;
    submitWorkflowForm.mockRejectedValue(err);
    render(<WorkflowFormView token="tok123" />);
    await waitFor(() => expect(screen.getByText("Contact us")).toBeInTheDocument());

    await user.type(screen.getByLabelText(/Full name/), "Jamie Doe");
    await user.selectOptions(screen.getByLabelText(/Plan/), "pro");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(screen.getByText(/full_name looks fake/)).toBeInTheDocument());
    expect(screen.getByLabelText(/Full name/)).toHaveValue("Jamie Doe");
  });

  it("invites sign-in on a 401 at submit time", async () => {
    const user = userEvent.setup();
    getWorkflowFormDefinition.mockResolvedValue(definition());
    const err = new Error("unauthorized");
    err.status = 401;
    submitWorkflowForm.mockRejectedValue(err);
    render(<WorkflowFormView token="tok123" />);
    await waitFor(() => expect(screen.getByText("Contact us")).toBeInTheDocument());

    await user.type(screen.getByLabelText(/Full name/), "Jamie Doe");
    await user.selectOptions(screen.getByLabelText(/Plan/), "pro");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(screen.getByText("Sign in required")).toBeInTheDocument());
  });
});
