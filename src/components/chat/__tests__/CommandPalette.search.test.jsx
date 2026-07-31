import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";

const h = vi.hoisted(() => ({
  setActiveSession: vi.fn(),
  sessions: [],
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

import CommandPalette, { searchMessages } from "../CommandPalette";

const SESSIONS = [
  {
    id: "s1",
    title: "Projet Alpha",
    agentName: "Agent A",
    messages: [
      { id: "m1", role: "user", content: "Explique le théorème de Bayes" },
      { id: "m2", role: "assistant", content: "Le théorème de Bayes relie deux probabilités." },
    ],
  },
  {
    id: "s2",
    title: "Roadmap Beta",
    agentName: "Agent B",
    messages: [
      { id: "m3", role: "user", content: "Parle-moi de quantum computing" },
    ],
  },
];

describe("searchMessages (pure helper)", () => {
  it("returns nothing below the minimum query length", () => {
    expect(searchMessages(SESSIONS, "b")).toEqual([]);
    expect(searchMessages(SESSIONS, "")).toEqual([]);
    expect(searchMessages(SESSIONS, "   ")).toEqual([]);
  });

  it("finds every message whose content matches, case-insensitively", () => {
    const hits = searchMessages(SESSIONS, "BAYES");
    expect(hits).toHaveLength(2);
    expect(hits.every((x) => x.sessionId === "s1")).toBe(true);
    expect(hits[0].snippet.toLowerCase()).toContain("bayes");
  });

  it("matches across sessions and returns the owning session", () => {
    const hits = searchMessages(SESSIONS, "quantum");
    expect(hits).toHaveLength(1);
    expect(hits[0].sessionId).toBe("s2");
    expect(hits[0].sessionTitle).toBe("Roadmap Beta");
    expect(hits[0].role).toBe("user");
  });

  it("returns nothing when no message contains the term", () => {
    expect(searchMessages(SESSIONS, "zzz-nope")).toEqual([]);
  });

  it("honours sessionFilter (e.g. webhook split)", () => {
    const hits = searchMessages(SESSIONS, "bayes", {
      sessionFilter: (s) => s.id !== "s1",
    });
    expect(hits).toEqual([]);
  });

  it("caps results at the given limit", () => {
    const big = [
      {
        id: "big",
        title: "Big",
        messages: Array.from({ length: 10 }, (_, i) => ({
          id: `b${i}`,
          role: "user",
          content: `mention numéro ${i}`,
        })),
      },
    ];
    expect(searchMessages(big, "mention", { limit: 3 })).toHaveLength(3);
  });

  it("collapses whitespace and adds ellipses around a deep match", () => {
    const long = "x".repeat(60) + "\n\n   motcle   \n" + "y".repeat(60);
    const hits = searchMessages(
      [{ id: "s", title: "S", messages: [{ id: "m", role: "user", content: long }] }],
      "motcle",
    );
    expect(hits).toHaveLength(1);
    const snip = hits[0].snippet;
    expect(snip).toContain("motcle");
    expect(snip).not.toContain("\n");
    expect(snip.startsWith("…")).toBe(true);
    expect(snip.endsWith("…")).toBe(true);
  });

  it("ignores messages whose content is not a string", () => {
    const weird = [
      { id: "s", title: "S", messages: [{ id: "m", role: "assistant", content: { foo: 1 } }] },
    ];
    expect(searchMessages(weird, "foo")).toEqual([]);
  });

  it("tolerates sessions with no messages array", () => {
    expect(searchMessages([{ id: "s", title: "S" }], "anything")).toEqual([]);
  });
});

describe("CommandPalette message search (integration)", () => {
  const openPalette = () =>
    fireEvent.keyDown(document, { key: "k", metaKey: true });
  const input = () => screen.getByLabelText("Search");

  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (cb) => {
      cb();
      return 0;
    });
    Element.prototype.scrollIntoView = vi.fn();
    h.setActiveSession.mockClear();
    h.sessions = SESSIONS;
  });

  it("surfaces a message hit and jumps to its conversation on Enter", () => {
    render(<CommandPalette onNewChat={vi.fn()} />);
    openPalette();
    // "quantum" matches only a message body, not any session title.
    fireEvent.change(input(), { target: { value: "quantum" } });
    expect(screen.getByText(/quantum computing/i)).toBeInTheDocument();
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(h.setActiveSession).toHaveBeenCalledWith("s2");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does not search message bodies for a single character", () => {
    render(<CommandPalette onNewChat={vi.fn()} />);
    openPalette();
    fireEvent.change(input(), { target: { value: "x" } });
    // No session title contains "x" and message search is disabled at 1 char.
    expect(screen.getByText("No results")).toBeInTheDocument();
  });

  it("does not list a conversation twice when its title and a message both match", () => {
    h.sessions = [
      {
        id: "s3",
        title: "Quantum notes",
        agentName: "Agent C",
        messages: [{ id: "m4", role: "user", content: "more about quantum" }],
      },
    ];
    render(<CommandPalette onNewChat={vi.fn()} />);
    openPalette();
    fireEvent.change(input(), { target: { value: "quantum" } });
    // Surfaced once via the title match; the message hit is de-duplicated away.
    expect(screen.getByText("Quantum notes")).toBeInTheDocument();
    expect(screen.queryByText(/more about quantum/i)).toBeNull();
  });
});
