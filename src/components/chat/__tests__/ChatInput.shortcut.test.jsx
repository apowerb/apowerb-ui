import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";

const h = vi.hoisted(() => ({
  agent: { isLoading: false, streamingMessageId: null },
}));

vi.mock("@/hooks/useChat", () => ({
  useChat: () => ({
    sendMessage: vi.fn(),
    abortStreaming: vi.fn(),
    isLoading: h.agent.isLoading,
    streamingMessageId: h.agent.streamingMessageId,
  }),
}));
vi.mock("@/hooks/useChatSessions", () => ({
  useChatSessions: () => ({ activeSession: { id: "s1", agentId: "agent1", messages: [] } }),
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

describe("ChatInput - slash focuses the composer", () => {
  beforeEach(() => {
    h.agent = { isLoading: false, streamingMessageId: null };
  });

  it("focuses the composer when / is pressed outside a text field", () => {
    const { container } = render(<ChatInput />);
    const ta = container.querySelector("textarea");
    expect(document.activeElement).not.toBe(ta);
    fireEvent.keyDown(document, { key: "/" });
    expect(document.activeElement).toBe(ta);
  });

  it("does not steal focus from another field on /", () => {
    const other = document.createElement("input");
    document.body.appendChild(other);
    render(<ChatInput />);
    other.focus();
    fireEvent.keyDown(document, { key: "/" });
    expect(document.activeElement).toBe(other);
    other.remove();
  });

  it("does not focus the composer when a modal/dialog is open", () => {
    const modal = document.createElement("div");
    modal.setAttribute("aria-modal", "true");
    document.body.appendChild(modal);
    const { container } = render(<ChatInput />);
    const ta = container.querySelector("textarea");
    fireEvent.keyDown(document, { key: "/" });
    expect(document.activeElement).not.toBe(ta);
    modal.remove();
  });
});
