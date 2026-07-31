import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";

const h = vi.hoisted(() => ({
  agent: { isLoading: false, streamingMessageId: null },
  session: { id: "s1", agentId: "agent1", messages: [] },
}));

vi.mock("@/hooks/useChat", () => ({
  useChat: () => ({
    sendMessage: vi.fn().mockResolvedValue(undefined),
    abortStreaming: vi.fn(),
    isLoading: h.agent.isLoading,
    streamingMessageId: h.agent.streamingMessageId,
  }),
}));
vi.mock("@/hooks/useChatSessions", () => ({
  useChatSessions: () => ({ activeSession: h.session }),
}));
vi.mock("@/contexts/ChatContext", () => ({
  useChatContext: () => ({ state: { uploadProgress: new Map() } }),
}));
vi.mock("@/hooks/useMarkdownTextarea", () => ({
  useMarkdownTextarea: () => ({
    handleKeyDown: () => false,
    handlePaste: () => false,
    applyAction: vi.fn(),
  }),
}));
vi.mock("../FileUploadZone", () => ({ default: () => null }));
vi.mock("../VoiceInput", () => ({ default: () => null }));
vi.mock("../VoiceConversationModal", () => ({ default: () => null }));
vi.mock("../IntegrationShortcutBar", () => ({ default: () => null }));
vi.mock("../MarkdownToolbar", () => ({ default: () => null }));

import ChatInput from "../ChatInput";

describe("ChatInput - per-session persistent draft", () => {
  beforeEach(() => {
    window.localStorage.clear();
    h.agent = { isLoading: false, streamingMessageId: null };
    h.session = { id: "s1", agentId: "agent1", messages: [] };
  });

  it("persists the draft per session and restores it when switching back", () => {
    const { container, rerender } = render(<ChatInput />);
    const ta = container.querySelector("textarea");
    fireEvent.change(ta, { target: { value: "brouillon session 1" } });
    expect(window.localStorage.getItem("th2chat:draft:s1")).toBe("brouillon session 1");

    h.session = { id: "s2", agentId: "agent1", messages: [] };
    rerender(<ChatInput />);
    expect(container.querySelector("textarea").value).toBe("");

    h.session = { id: "s1", agentId: "agent1", messages: [] };
    rerender(<ChatInput />);
    expect(container.querySelector("textarea").value).toBe("brouillon session 1");
  });

  it("clears the draft after sending", () => {
    const { container } = render(<ChatInput />);
    const ta = container.querySelector("textarea");
    fireEvent.change(ta, { target: { value: "a envoyer" } });
    expect(window.localStorage.getItem("th2chat:draft:s1")).toBe("a envoyer");
    fireEvent.submit(ta.closest("form"));
    expect(window.localStorage.getItem("th2chat:draft:s1")).toBeNull();
  });

  it("does not let a session switch overwrite an in-progress edit", () => {
    window.localStorage.setItem("th2chat:draft:s2", "brouillon s2");
    h.session = { id: "s1", agentId: "agent1", messages: [] };
    const { container, rerender } = render(
      <ChatInput editingText="" onEditingTextClear={() => {}} />,
    );
    // User clicks Edit (editingText set) while the active session flips to s2.
    h.session = { id: "s2", agentId: "agent1", messages: [] };
    rerender(
      <ChatInput editingText="texte en edition" onEditingTextClear={() => {}} />,
    );
    expect(container.querySelector("textarea").value).toBe("texte en edition");
  });
});
