import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";

const h = vi.hoisted(() => ({
  sessions: [],
  createSession: vi.fn(),
  setActiveSession: vi.fn(),
  setPendingComposerText: vi.fn(),
  setAgentPickerOpen: vi.fn(),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { firstName: "Elom" } }) }));
vi.mock("@/hooks/useChatSessions", () => ({
  useChatSessions: () => ({ sessions: h.sessions, createSession: h.createSession, setActiveSession: h.setActiveSession }),
}));
vi.mock("@/contexts/ChatUiContext", () => ({
  useChatUi: () => ({
    setPendingComposerText: h.setPendingComposerText,
    setAgentPickerOpen: h.setAgentPickerOpen,
    requestPalette: vi.fn(),
  }),
}));

import ChatHome from "../ChatHome";

const s1 = { id: "s1", agentId: "a1", agentName: "Emailer", title: "Emailer", messages: [], updatedAt: 3 };
const s2 = { id: "s2", agentId: "a2", agentName: "Analyste", title: "Ventes", messages: [{ id: "m" }], updatedAt: 2 };

describe("ChatHome on an empty thread", () => {
  beforeEach(() => {
    h.sessions = [s1, s2];
    h.setPendingComposerText.mockClear();
    h.setAgentPickerOpen.mockClear();
    h.createSession.mockClear();
  });

  it("names the thread's agent, sends starters straight to the composer and hides the thread from recents", () => {
    render(<ChatHome session={s1} />);
    expect(screen.getByText(/Elom/)).toBeInTheDocument();
    expect(screen.getByText("New conversation with Emailer")).toBeInTheDocument();
    const recent = screen.getByRole("region", { name: "Pick up where you left off" });
    expect(recent).toHaveTextContent("Ventes");
    expect(recent).not.toHaveTextContent("Emailer ·");
    const starter = screen.getByRole("region", { name: "Try one of these" }).querySelector("button");
    fireEvent.click(starter);
    expect(h.setPendingComposerText).toHaveBeenCalledTimes(1);
    expect(h.setAgentPickerOpen).not.toHaveBeenCalled();
    expect(h.createSession).not.toHaveBeenCalled();
  });

  it("without a thread, a starter opens the agent picker when several agents were used", () => {
    render(<ChatHome />);
    const starter = screen.getByRole("region", { name: "Try one of these" }).querySelector("button");
    fireEvent.click(starter);
    expect(h.setAgentPickerOpen).toHaveBeenCalledWith(true);
  });
});
