/**
 * Enter walks the matches; the Enter that confirms an IME composition
 * (Japanese, Chinese, Korean input) must not.
 */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ThreadSearchBar from "../ThreadSearchBar";

const messages = [
  { id: "m1", content: "alpha report" },
  { id: "m2", content: "second report" },
];

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

function setup() {
  for (const m of messages) {
    const el = document.createElement("div");
    el.id = `chat-msg-${m.id}`;
    document.body.appendChild(el);
  }
  render(
    <ThreadSearchBar messages={messages} query="report" onQueryChange={vi.fn()} onClose={vi.fn()} />
  );
  const input = screen.getByRole("textbox");
  const counter = () => document.querySelector('[aria-live="polite"]').textContent;
  return { input, counter };
}

describe("ThreadSearchBar — Enter and IME composition", () => {
  it("moves to the next match on a plain Enter", () => {
    const { input, counter } = setup();
    const before = counter();
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    expect(counter()).not.toBe(before);
  });

  it("stays on the current match while a composition is being confirmed", () => {
    const { input, counter } = setup();
    const before = counter();
    fireEvent.keyDown(input, { key: "Enter", code: "Enter", isComposing: true });
    expect(counter()).toBe(before);
    fireEvent.keyDown(input, { key: "Enter", code: "Enter", keyCode: 229 });
    expect(counter()).toBe(before);
  });
});
