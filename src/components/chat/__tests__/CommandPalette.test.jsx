import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";

const h = vi.hoisted(() => ({
  setActiveSession: vi.fn(),
  sessions: [
    { id: "s1", title: "Projet Alpha", agentName: "Agent A" },
    { id: "s2", title: "Roadmap Beta", agentName: "Agent B" },
  ],
}));

vi.mock("@/hooks/useChatSessions", () => ({
  useChatSessions: () => ({
    sessions: h.sessions,
    setActiveSession: h.setActiveSession,
  }),
}));
vi.mock("@/hooks/useFocusTrap", () => ({
  useFocusTrap: () => ({ current: null }),
}));

import CommandPalette from "../CommandPalette";

const openPalette = () =>
  fireEvent.keyDown(document, { key: "k", metaKey: true });
const input = () => screen.getByLabelText("Search");

describe("CommandPalette", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (cb) => {
      cb();
      return 0;
    });
    // jsdom has no layout; stub scrollIntoView used by keyboard nav.
    Element.prototype.scrollIntoView = vi.fn();
    h.setActiveSession.mockClear();
    h.sessions = [
      { id: "s1", title: "Projet Alpha", agentName: "Agent A" },
      { id: "s2", title: "Roadmap Beta", agentName: "Agent B" },
    ];
  });

  it("is hidden until Cmd/Ctrl+K, then opens", () => {
    render(<CommandPalette onNewChat={vi.fn()} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    openPalette();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes on Escape", () => {
    render(<CommandPalette onNewChat={vi.fn()} />);
    openPalette();
    fireEvent.keyDown(input(), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("filters sessions by query", () => {
    render(<CommandPalette onNewChat={vi.fn()} />);
    openPalette();
    fireEvent.change(input(), { target: { value: "alpha" } });
    expect(screen.getByText("Projet Alpha")).toBeInTheDocument();
    expect(screen.queryByText("Roadmap Beta")).toBeNull();
  });

  it("Enter on a filtered session activates it and closes", () => {
    render(<CommandPalette onNewChat={vi.fn()} />);
    openPalette();
    fireEvent.change(input(), { target: { value: "beta" } });
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(h.setActiveSession).toHaveBeenCalledWith("s2");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("first item is the New chat action and Enter fires it", () => {
    const onNewChat = vi.fn();
    render(<CommandPalette onNewChat={onNewChat} />);
    openPalette();
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(onNewChat).toHaveBeenCalledTimes(1);
  });

  it("ArrowDown moves selection to the next item before Enter", () => {
    render(<CommandPalette onNewChat={vi.fn()} />);
    openPalette();
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(h.setActiveSession).toHaveBeenCalledWith("s1");
  });

  it("applies sessionFilter (excludes filtered-out sessions like webhook)", () => {
    const sessionFilter = (s) => s.id !== "s2";
    render(<CommandPalette onNewChat={vi.fn()} sessionFilter={sessionFilter} />);
    openPalette();
    expect(screen.getByText("Projet Alpha")).toBeInTheDocument();
    expect(screen.queryByText("Roadmap Beta")).toBeNull();
  });

  it("shows No results and Enter is a no-op when nothing matches", () => {
    render(<CommandPalette onNewChat={vi.fn()} />);
    openPalette();
    fireEvent.change(input(), { target: { value: "zzz-no-match" } });
    expect(screen.getByText("No results")).toBeInTheDocument();
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(h.setActiveSession).not.toHaveBeenCalled();
  });

  it("with no sessions, still offers the New chat action", () => {
    h.sessions = [];
    const onNewChat = vi.fn();
    render(<CommandPalette onNewChat={onNewChat} />);
    openPalette();
    expect(screen.getByText("New chat")).toBeInTheDocument();
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(onNewChat).toHaveBeenCalledTimes(1);
  });

  it("resets the selection to the first item when reopened", () => {
    const onNewChat = vi.fn();
    render(<CommandPalette onNewChat={onNewChat} />);
    openPalette();
    fireEvent.keyDown(input(), { key: "ArrowDown" }); // select s1
    fireEvent.keyDown(input(), { key: "Escape" }); // close
    openPalette(); // reopen -> selection back to the action (index 0)
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(onNewChat).toHaveBeenCalledTimes(1);
    expect(h.setActiveSession).not.toHaveBeenCalled();
  });

  it("renders results as ARIA options wired to the combobox", () => {
    render(<CommandPalette onNewChat={vi.fn()} />);
    openPalette();
    // New-chat action + the two mocked sessions = three options.
    expect(screen.getAllByRole("option")).toHaveLength(3);
    expect(input()).toHaveAttribute("role", "combobox");
    expect(input()).toHaveAttribute("aria-controls", "cmdk-listbox");
  });
});
