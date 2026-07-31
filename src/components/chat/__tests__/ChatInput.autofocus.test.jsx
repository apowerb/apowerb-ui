import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

// Mutable agent-activity holder shared with the useChat mock. vi.hoisted
// keeps it in scope despite vi.mock being hoisted above imports.
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
  useChatSessions: () => ({ activeSession: { id: "s1", agentId: "agent1" } }),
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

describe("ChatInput - autofocus after agent reply", () => {
  beforeEach(() => {
    // Run rAF callbacks synchronously so focus lands before assertions.
    vi.stubGlobal("requestAnimationFrame", (cb) => {
      cb();
      return 0;
    });
    h.agent = { isLoading: false, streamingMessageId: null };
  });

  it("focuses the composer when the agent finishes responding (busy -> idle)", () => {
    h.agent = { isLoading: false, streamingMessageId: "m1" }; // streaming
    const { rerender, container } = render(<ChatInput />);

    const busyTextarea = container.querySelector("textarea");
    expect(busyTextarea).toBeDisabled();
    expect(document.activeElement).not.toBe(busyTextarea);

    h.agent = { isLoading: false, streamingMessageId: null }; // reply done
    rerender(<ChatInput />);

    const idleTextarea = container.querySelector("textarea");
    expect(idleTextarea).not.toBeDisabled();
    expect(document.activeElement).toBe(idleTextarea);
  });

  it("does not steal focus when the user is typing in another field", () => {
    h.agent = { isLoading: false, streamingMessageId: "m1" }; // streaming
    const other = document.createElement("input");
    document.body.appendChild(other);
    const { rerender, container } = render(<ChatInput />);

    other.focus();
    expect(document.activeElement).toBe(other);

    h.agent = { isLoading: false, streamingMessageId: null }; // reply done
    rerender(<ChatInput />);

    const textarea = container.querySelector("textarea");
    expect(document.activeElement).toBe(other); // focus stayed put
    expect(document.activeElement).not.toBe(textarea);
    other.remove();
  });

  it("does not steal focus on initial idle mount", () => {
    h.agent = { isLoading: false, streamingMessageId: null };
    const { container } = render(<ChatInput />);
    const textarea = container.querySelector("textarea");
    expect(document.activeElement).not.toBe(textarea);
  });
});
