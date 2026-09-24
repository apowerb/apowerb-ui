/**
 * StudioPalette collapsible families.
 *
 * i18n resolves against the real messages/en.json via vitest.setup.js, so
 * assertions use the English strings (family labels, node names). CSS
 * media queries (`xl:` breakpoints) are not evaluated by jsdom in this repo
 * (vitest.config.js sets `css: false`), so the icon-only (<1280px) layout
 * cannot be exercised as a real viewport switch here — the test below only
 * checks that the separator markup (meant to replace the family title at
 * that breakpoint) is present in the DOM between families. Actual visual
 * hiding/showing at 1280px is a CSS concern, not covered by this suite.
 *
 * Family headers are queried by `data-testid` (`palette-family-header-*`)
 * rather than accessible name: a family label ("Trigger", "Output") can be
 * identical to the single node type it contains, so `getByRole("button",
 * { name: "Trigger" })` matches two elements.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StudioPalette from "@/components/workflow-studio/StudioPalette";

const COLLAPSE_KEY = "workflow-studio:palette-collapsed-families";

function familyHeader(family) {
  return screen.getByTestId(`palette-family-header-${family}`);
}

describe("StudioPalette - collapsible families", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("renders all 5 families expanded by default", () => {
    render(<StudioPalette onAdd={() => {}} />);
    for (const family of ["trigger", "intelligence", "tools", "logic", "output"]) {
      expect(familyHeader(family)).toHaveAttribute("aria-expanded", "true");
    }
    expect(screen.getByText("Agent")).toBeInTheDocument();
  });

  it("collapses a family on header click, hides its items, and flips aria-expanded", async () => {
    const user = userEvent.setup();
    render(<StudioPalette onAdd={() => {}} />);

    const header = familyHeader("intelligence");
    expect(header).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("AI Classifier")).toBeInTheDocument();

    await user.click(header);

    expect(header).toHaveAttribute("aria-expanded", "false");
    // Collapse only applies from xl up: below 1280px the headers are hidden,
    // so the items must stay rendered or they would become unreachable.
    const items = screen.getByText("AI Classifier").closest(`#${header.getAttribute("aria-controls")}`);
    expect(items).toHaveClass("xl:hidden");

    await user.click(header);
    expect(header).toHaveAttribute("aria-expanded", "true");
    expect(items).not.toHaveClass("xl:hidden");
  });

  it("is keyboard-activatable (Enter) since it's a real <button>", async () => {
    const user = userEvent.setup();
    render(<StudioPalette onAdd={() => {}} />);
    const header = familyHeader("tools");
    expect(header.tagName).toBe("BUTTON");
    header.focus();
    await user.keyboard("{Enter}");
    expect(header).toHaveAttribute("aria-expanded", "false");
  });

  it("reads the collapsed state from localStorage on mount", () => {
    window.localStorage.setItem(COLLAPSE_KEY, JSON.stringify({ logic: true }));
    render(<StudioPalette onAdd={() => {}} />);
    expect(familyHeader("logic")).toHaveAttribute("aria-expanded", "false");
    expect(familyHeader("tools")).toHaveAttribute("aria-expanded", "true");
  });

  it("persists the toggled state to localStorage under the expected key", async () => {
    const user = userEvent.setup();
    render(<StudioPalette onAdd={() => {}} />);
    await user.click(familyHeader("output"));

    const stored = JSON.parse(window.localStorage.getItem(COLLAPSE_KEY));
    expect(stored.output).toBe(true);
  });

  it("does not crash when localStorage.getItem throws (e.g. private mode)", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => render(<StudioPalette onAdd={() => {}} />)).not.toThrow();
    expect(familyHeader("trigger")).toHaveAttribute("aria-expanded", "true");
  });

  it("does not crash when localStorage.setItem throws on toggle", async () => {
    const user = userEvent.setup();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(<StudioPalette onAdd={() => {}} />);
    const header = familyHeader("trigger");
    await expect(user.click(header)).resolves.not.toThrow();
    expect(header).toHaveAttribute("aria-expanded", "false");
  });

  it("expands all families automatically when a non-empty search is typed, even if collapsed", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      COLLAPSE_KEY,
      JSON.stringify({ trigger: true, intelligence: true, tools: true, logic: true, output: true }),
    );
    render(<StudioPalette onAdd={() => {}} />);

    for (const family of ["trigger", "intelligence", "tools", "logic", "output"]) {
      expect(familyHeader(family)).toHaveAttribute("aria-expanded", "false");
    }

    const search = screen.getByPlaceholderText("Search…");
    await user.type(search, "agent");

    expect(screen.getByText("Agent")).toBeInTheDocument();
    expect(familyHeader("intelligence")).toHaveAttribute("aria-expanded", "true");
  });

  it("clears the search box back to the collapsed state stored before searching", async () => {
    const user = userEvent.setup();
    render(<StudioPalette onAdd={() => {}} />);
    const header = familyHeader("output");
    await user.click(header);
    expect(header).toHaveAttribute("aria-expanded", "false");

    const search = screen.getByPlaceholderText("Search…");
    await user.type(search, "output");
    expect(header).toHaveAttribute("aria-expanded", "true");

    await user.clear(search);
    expect(header).toHaveAttribute("aria-expanded", "false");
  });

  it("renders a visual separator between families, meant to replace the title in icon-only (<1280px) mode", () => {
    render(<StudioPalette onAdd={() => {}} />);
    const separators = screen.getAllByTestId("palette-family-separator");
    // 5 families -> 4 separators between them.
    expect(separators).toHaveLength(4);
  });
});
