/**
 * The dialog a person answers a paused run in: question, one button per
 * choice and/or a text field, the engine's 409/422 refusals in words, and
 * "Later" that closes without answering.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DecisionModal from "@/components/workflow-studio/DecisionModal";

const CHOICES = [{ route: "oui", label: "Oui" }, { route: "non", label: "Non" }];
const decision = (extra = {}) => ({
  runId: "r1",
  nodeId: "decision1",
  question: "Valider le plan A ?",
  mode: "choices",
  choices: CHOICES,
  assignee: null,
  ...extra,
});

function setup(d, { onAnswer = vi.fn().mockResolvedValue(undefined), onClose = vi.fn() } = {}) {
  render(<DecisionModal decision={d} onAnswer={onAnswer} onClose={onClose} />);
  return { onAnswer, onClose, user: userEvent.setup() };
}

describe("DecisionModal — rendering by mode", () => {
  it("is an accessible dialog named by the question's heading", () => {
    setup(decision());
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    const labelledby = dialog.getAttribute("aria-labelledby");
    expect(document.getElementById(labelledby)).toHaveTextContent("A decision is needed");
    expect(screen.getByText("Valider le plan A ?")).toBeInTheDocument();
  });

  it("choices: one button per choice, no text field", () => {
    setup(decision());
    expect(screen.getByRole("button", { name: "Oui" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Non" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Send" })).toBeNull();
  });

  it("text: a field and Send, no choice buttons", () => {
    setup(decision({ mode: "text", choices: [] }));
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Oui" })).toBeNull();
  });

  it("both: choices and a text field", () => {
    setup(decision({ mode: "both" }));
    expect(screen.getByRole("button", { name: "Oui" })).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("falls back to the route when a choice has no label", () => {
    setup(decision({ choices: [{ route: "valider" }] }));
    expect(screen.getByRole("button", { name: "valider" })).toBeInTheDocument();
  });

  it("names the assignee when there is one", () => {
    setup(decision({ assignee: "bob@example.com" }));
    expect(screen.getByText(/bob@example.com/)).toBeInTheDocument();
  });
});

describe("DecisionModal — answering", () => {
  it("a choice sends { choice: route } exactly", async () => {
    const { onAnswer, user } = setup(decision());
    await user.click(screen.getByRole("button", { name: "Non" }));
    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith({ choice: "non" });
  });

  it("a written answer sends { text } exactly, and Enter does not submit a multiline field", async () => {
    const { onAnswer, user } = setup(decision({ mode: "text", choices: [] }));
    await user.type(screen.getByRole("textbox"), "Plan B");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(onAnswer).toHaveBeenCalledWith({ text: "Plan B" });
  });

  it("refuses an empty or blank text answer: Send is disabled and nothing is sent", async () => {
    const { onAnswer, user } = setup(decision({ mode: "both" }));
    const send = screen.getByRole("button", { name: "Send" });
    expect(send).toBeDisabled();
    await user.type(screen.getByRole("textbox"), "   ");
    expect(send).toBeDisabled();
    await user.click(send);
    expect(onAnswer).not.toHaveBeenCalled();
    await user.clear(screen.getByRole("textbox"));
    await user.type(screen.getByRole("textbox"), " ok ");
    expect(send).toBeEnabled();
    await user.click(send);
    expect(onAnswer).toHaveBeenCalledWith({ text: "ok" });
  });

  it("shows a sending state and blocks a second answer meanwhile", async () => {
    let resolve;
    const onAnswer = vi.fn(() => new Promise((r) => { resolve = r; }));
    const { user } = setup(decision(), { onAnswer });
    await user.click(screen.getByRole("button", { name: "Oui" }));
    expect(screen.getByRole("button", { name: "Non" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Sending…");
    await user.click(screen.getByRole("button", { name: "Non" }));
    expect(onAnswer).toHaveBeenCalledTimes(1);
    resolve();
    await waitFor(() => expect(screen.getByRole("button", { name: "Non" })).toBeEnabled());
  });
});

describe("DecisionModal — refusals", () => {
  const refuse = (status, code) =>
    vi.fn().mockRejectedValue(Object.assign(new Error("x"), { status, detail: code ? { code } : undefined }));

  it("409 decision_expired: says the decision expired", async () => {
    const { user } = setup(decision(), { onAnswer: refuse(409, "decision_expired") });
    await user.click(screen.getByRole("button", { name: "Oui" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/expired/i);
  });

  it("409 decision_already_answered: says so and stops offering answers", async () => {
    const { user } = setup(decision(), { onAnswer: refuse(409, "decision_already_answered") });
    await user.click(screen.getByRole("button", { name: "Oui" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/already been answered/i);
    expect(screen.getByRole("button", { name: "Oui" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Later" })).toBeEnabled();
  });

  it("422 decision_invalid_answer: says so and lets the person try again", async () => {
    const { user } = setup(decision(), { onAnswer: refuse(422, "decision_invalid_answer") });
    await user.click(screen.getByRole("button", { name: "Oui" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/not accepted/i);
    expect(screen.getByRole("button", { name: "Oui" })).toBeEnabled();
  });

  it("404: the decision is gone or not mine", async () => {
    const { user } = setup(decision(), { onAnswer: refuse(404) });
    await user.click(screen.getByRole("button", { name: "Oui" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/no longer exists/i);
  });

  it("any other failure shows the reason", async () => {
    const { user } = setup(decision(), { onAnswer: vi.fn().mockRejectedValue(new Error("HTTP 502")) });
    await user.click(screen.getByRole("button", { name: "Oui" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("HTTP 502");
  });
});

describe("DecisionModal — Later", () => {
  it("closes without answering", async () => {
    const { onAnswer, onClose, user } = setup(decision());
    await user.click(screen.getByRole("button", { name: "Later" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it("Escape closes it too", async () => {
    const { onAnswer, onClose, user } = setup(decision());
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onAnswer).not.toHaveBeenCalled();
  });
});

describe("DecisionModal - both mode keeps the comment", () => {
  it("a choice also sends the typed text, as { choice, text }", async () => {
    const { onAnswer, user } = setup(decision({ mode: "both" }));
    await user.type(screen.getByRole("textbox"), "  parce que budget ok ");
    await user.click(screen.getByRole("button", { name: "Oui" }));
    expect(onAnswer).toHaveBeenCalledWith({ choice: "oui", text: "parce que budget ok" });
  });

  it("a choice with blank text stays { choice }", async () => {
    const { onAnswer, user } = setup(decision({ mode: "both" }));
    await user.type(screen.getByRole("textbox"), "   ");
    await user.click(screen.getByRole("button", { name: "Non" }));
    expect(onAnswer).toHaveBeenLastCalledWith({ choice: "non" });
  });

  it("text alone sends { text }", async () => {
    const { onAnswer, user } = setup(decision({ mode: "both" }));
    await user.type(screen.getByRole("textbox"), "autre piste");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(onAnswer).toHaveBeenCalledWith({ text: "autre piste" });
  });
});
