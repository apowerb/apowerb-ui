import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import UserInputCard from "../UserInputCard";

function makeCard(overrides = {}) {
  return {
    id: "card_1",
    kind: "user_input",
    status: "pending",
    data: {
      question: "What is your company size?",
      input_type: "text",
      placeholder: "e.g. 50",
    },
    ...overrides,
  };
}

describe("UserInputCard", () => {
  it("renders the question and text input for input_type=text", () => {
    render(<UserInputCard card={makeCard()} onRespond={vi.fn()} />);
    expect(screen.getByText("What is your company size?")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. 50")).toBeInTheDocument();
  });

  it("calls onRespond with a typed payload when Send is clicked", () => {
    const onRespond = vi.fn();
    render(<UserInputCard card={makeCard()} onRespond={onRespond} />);
    fireEvent.change(screen.getByPlaceholderText("e.g. 50"), {
      target: { value: "120" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(onRespond).toHaveBeenCalledWith({ type: "text", value: "120" });
  });

  it("submits on Enter for text/number/date inputs", () => {
    const onRespond = vi.fn();
    render(<UserInputCard card={makeCard()} onRespond={onRespond} />);
    const input = screen.getByPlaceholderText("e.g. 50");
    fireEvent.change(input, { target: { value: "120" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    expect(onRespond).toHaveBeenCalledWith({ type: "text", value: "120" });
  });

  it("does not submit on Enter for multiline inputs", () => {
    const onRespond = vi.fn();
    const card = makeCard({
      data: { question: "Describe", input_type: "multiline" },
    });
    render(<UserInputCard card={card} onRespond={onRespond} />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "hello" } });
    fireEvent.keyDown(textarea, { key: "Enter", code: "Enter" });
    expect(onRespond).not.toHaveBeenCalled();
  });

  it("renders a <select> with choices when input_type=select and no default value", () => {
    const card = makeCard({
      data: {
        question: "Pick a plan",
        input_type: "select",
        choices: ["free", "pro", "enterprise"],
      },
    });
    render(<UserInputCard card={card} onRespond={vi.fn()} />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /select an answer/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "free" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "pro" })).toBeInTheDocument();
  });

  it("disables Send until the user provides a value (select)", () => {
    const card = makeCard({
      data: {
        question: "Pick a plan",
        input_type: "select",
        choices: ["free", "pro"],
      },
    });
    render(<UserInputCard card={card} onRespond={vi.fn()} />);
    const button = screen.getByRole("button", { name: /send/i });
    expect(button).toBeDisabled();
  });

  it("sends a number-typed payload for input_type=number", () => {
    const onRespond = vi.fn();
    const card = makeCard({
      data: { question: "How many?", input_type: "number" },
    });
    render(<UserInputCard card={card} onRespond={onRespond} />);
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "42" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(onRespond).toHaveBeenCalledWith({ type: "number", value: 42 });
  });

  it("renders a textarea when input_type=multiline", () => {
    const card = makeCard({
      data: { question: "Describe your use case", input_type: "multiline" },
    });
    render(<UserInputCard card={card} onRespond={vi.fn()} />);
    const textarea = screen.getByRole("textbox");
    expect(textarea.tagName).toBe("TEXTAREA");
  });

  it("renders a number input for input_type=number", () => {
    const card = makeCard({
      data: { question: "How many?", input_type: "number" },
    });
    render(<UserInputCard card={card} onRespond={vi.fn()} />);
    const input = screen.getByRole("spinbutton");
    expect(input).toHaveAttribute("type", "number");
  });

  it("renders a date input for input_type=date", () => {
    const { container } = render(<UserInputCard card={makeCard({
      data: { question: "Pick a date", input_type: "date" },
    })} onRespond={vi.fn()} />);
    expect(container.querySelector('input[type="date"]')).toBeInTheDocument();
  });

  it("associates the question as a label with the input", () => {
    render(<UserInputCard card={makeCard()} onRespond={vi.fn()} />);
    // Label is clickable and should reference the input via htmlFor
    const input = screen.getByLabelText("What is your company size?");
    expect(input).toBeInTheDocument();
  });

  it("shows the submitted response readonly when status=done", () => {
    const card = makeCard({ status: "done", response: "120" });
    render(<UserInputCard card={card} onRespond={vi.fn()} />);
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /send/i })).not.toBeInTheDocument();
  });
});
