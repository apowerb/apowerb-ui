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
  useChatSessions: () => ({
    activeSession: {
      id: "s1",
      agentId: "agent1",
      messages: [
        { id: "u1", role: "user", content: "premiere question" },
        { id: "a1", role: "assistant", content: "une reponse" },
        { id: "u2", role: "user", content: "deuxieme question" },
        { id: "a2", role: "assistant", content: "autre reponse" },
      ],
    },
  }),
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

describe("ChatInput - ArrowUp recalls last user message", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (cb) => {
      cb();
      return 0;
    });
    window.localStorage.clear();
    h.agent = { isLoading: false, streamingMessageId: null };
  });

  it("fills the empty composer with the most recent user message on ArrowUp", () => {
    const { container } = render(<ChatInput />);
    const textarea = container.querySelector("textarea");
    expect(textarea.value).toBe("");
    fireEvent.keyDown(textarea, { key: "ArrowUp" });
    expect(textarea.value).toBe("deuxieme question");
  });

  it("does not recall when the composer already has text", () => {
    const { container } = render(<ChatInput />);
    const textarea = container.querySelector("textarea");
    fireEvent.change(textarea, { target: { value: "brouillon en cours" } });
    fireEvent.keyDown(textarea, { key: "ArrowUp" });
    expect(textarea.value).toBe("brouillon en cours");
  });

  it("does not recall during an IME composition (isComposing)", () => {
    const { container } = render(<ChatInput />);
    const textarea = container.querySelector("textarea");
    const ev = new KeyboardEvent("keydown", {
      key: "ArrowUp",
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(ev, "isComposing", { value: true });
    fireEvent(textarea, ev);
    expect(textarea.value).toBe("");
  });

  it("walks further up the history on repeated ArrowUp", () => {
    const { container } = render(<ChatInput />);
    const textarea = container.querySelector("textarea");
    fireEvent.keyDown(textarea, { key: "ArrowUp" });
    expect(textarea.value).toBe("deuxieme question");
    fireEvent.keyDown(textarea, { key: "ArrowUp" });
    expect(textarea.value).toBe("premiere question");
  });

  it("stops at the oldest message and does not wrap around", () => {
    const { container } = render(<ChatInput />);
    const textarea = container.querySelector("textarea");
    fireEvent.keyDown(textarea, { key: "ArrowUp" }); // deuxieme
    fireEvent.keyDown(textarea, { key: "ArrowUp" }); // premiere (oldest)
    fireEvent.keyDown(textarea, { key: "ArrowUp" }); // stays
    expect(textarea.value).toBe("premiere question");
  });

  it("ArrowDown unwinds toward the newest message, then back to empty", () => {
    const { container } = render(<ChatInput />);
    const textarea = container.querySelector("textarea");
    fireEvent.keyDown(textarea, { key: "ArrowUp" }); // deuxieme
    fireEvent.keyDown(textarea, { key: "ArrowUp" }); // premiere
    fireEvent.keyDown(textarea, { key: "ArrowDown" }); // back to deuxieme
    expect(textarea.value).toBe("deuxieme question");
    fireEvent.keyDown(textarea, { key: "ArrowDown" }); // past newest -> draft (empty)
    expect(textarea.value).toBe("");
  });

  it("ArrowDown does nothing when not navigating history", () => {
    const { container } = render(<ChatInput />);
    const textarea = container.querySelector("textarea");
    fireEvent.change(textarea, { target: { value: "mon brouillon" } });
    fireEvent.keyDown(textarea, { key: "ArrowDown" });
    expect(textarea.value).toBe("mon brouillon");
  });
});
