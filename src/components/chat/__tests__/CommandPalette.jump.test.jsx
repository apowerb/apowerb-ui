import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/hooks/useChatSessions", () => ({
  useChatSessions: () => ({ sessions: [], setActiveSession: vi.fn() }),
}));
vi.mock("@/hooks/useFocusTrap", () => ({
  useFocusTrap: () => ({ current: null }),
}));

import { searchMessages, highlightMessage } from "../CommandPalette";

const SESSIONS = [
  {
    id: "s1",
    title: "Alpha",
    messages: [
      { id: "m1", role: "user", content: "explique le theoreme de bayes" },
    ],
  },
];

describe("searchMessages — messageId for jump-to-message", () => {
  it("returns the matched message id", () => {
    const hits = searchMessages(SESSIONS, "bayes");
    expect(hits).toHaveLength(1);
    expect(hits[0].messageId).toBe("m1");
  });
});

describe("highlightMessage", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("scrolls the matched message into view and flashes its background", () => {
    const el = document.createElement("div");
    el.id = "chat-msg-m1";
    document.body.appendChild(el);
    highlightMessage("m1");
    expect(el.scrollIntoView).toHaveBeenCalled();
    expect(el.style.backgroundColor).not.toBe("");
  });

  it("no-ops without throwing on an empty or missing id", () => {
    expect(() => highlightMessage("")).not.toThrow();
    expect(() => highlightMessage(undefined)).not.toThrow();
  });
});
