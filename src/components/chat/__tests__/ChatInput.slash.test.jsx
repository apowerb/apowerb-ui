import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, screen, act } from "@testing-library/react";

const h = vi.hoisted(() => ({
  agent: { isLoading: false, streamingMessageId: null },
  sendMessage: vi.fn(),
  abortStreaming: vi.fn(),
  listAgents: vi.fn(),
  mdKeyDown: vi.fn(() => false),
}));

vi.mock("@/hooks/useChat", () => ({
  useChat: () => ({
    sendMessage: h.sendMessage,
    abortStreaming: h.abortStreaming,
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
    handleKeyDown: h.mdKeyDown,
    handlePaste: () => false,
    applyAction: vi.fn(),
  }),
}));
vi.mock("@/lib/api", () => ({ listAgents: h.listAgents }));
vi.mock("../FileUploadZone", () => ({ default: () => null }));
vi.mock("../VoiceInput", () => ({ default: () => null }));
vi.mock("../VoiceConversationModal", () => ({ default: () => null }));
vi.mock("../IntegrationShortcutBar", () => ({ default: () => null }));
vi.mock("../MarkdownToolbar", () => ({ default: () => null }));

import ChatInput, { mentionAt, slashMenuQuery } from "../ChatInput";

const commands = [
  { id: "new-chat", slash: "new", label: "New conversation", keywords: [], run: vi.fn() },
  { id: "rename", slash: "rename", label: "Rename conversation", keywords: [], argsHint: "new title", run: vi.fn() },
  { id: "tpl-summary", slash: "summary", label: "Summarize", keywords: [], insert: "Summarize our conversation", run: vi.fn() },
  { id: "tpl-translate", slash: "translate", label: "Translate", keywords: [], argsHint: "language", insert: "Translate into {arg}:", run: vi.fn() },
];

function type(ta, value) {
  fireEvent.change(ta, { target: { value } });
}

describe("mentionAt / slashMenuQuery (pure helpers)", () => {
  it("finds an @mention being typed before the caret", () => {
    expect(mentionAt("hello @ana", 10)).toEqual({ query: "ana", start: 6, end: 10 });
    expect(mentionAt("@", 1)).toEqual({ query: "", start: 0, end: 1 });
    expect(mentionAt("mail me@x.com", 13)).toBeNull(); // no space before @
    expect(mentionAt("hello @ana done", 15)).toBeNull(); // caret past the token
  });

  it("opens the slash menu only while a name is being typed", () => {
    expect(slashMenuQuery("/")).toBe("");
    expect(slashMenuQuery("/ren")).toBe("ren");
    expect(slashMenuQuery("/rename Foo")).toBeNull();
    expect(slashMenuQuery("hello")).toBeNull();
  });
});

describe("ChatInput — slash commands and @mentions", () => {
  beforeEach(() => {
    window.localStorage.clear();
    h.agent = { isLoading: false, streamingMessageId: null };
    h.sendMessage.mockClear();
    h.abortStreaming.mockClear();
    h.listAgents.mockReset();
    h.mdKeyDown.mockClear();
    h.listAgents.mockResolvedValue([
      { agent_id: 7, agent_name: "Analyste", agent_description: "Chiffres" },
      { agent_id: 8, agent_name: "Rédacteur", agent_description: "Textes" },
    ]);
    vi.stubGlobal("requestAnimationFrame", (cb) => {
      cb();
      return 0;
    });
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("lists matching commands when the draft starts with / and runs one on Enter", () => {
    const runCommand = vi.fn();
    const { container } = render(<ChatInput commands={commands} runCommand={runCommand} />);
    const ta = container.querySelector("textarea");
    type(ta, "/ne");
    const listbox = screen.getByRole("listbox", { name: "Commands" });
    expect(listbox).toHaveTextContent("/new");
    expect(listbox).not.toHaveTextContent("/rename");
    fireEvent.keyDown(ta, { key: "Enter" });
    expect(runCommand).toHaveBeenCalledWith("new-chat", "");
    expect(h.sendMessage).not.toHaveBeenCalled();
    expect(ta.value).toBe("");
  });

  it("inserts a template instead of sending, selecting the placeholder", () => {
    const { container } = render(<ChatInput commands={commands} runCommand={vi.fn()} />);
    const ta = container.querySelector("textarea");
    type(ta, "/trans");
    fireEvent.keyDown(ta, { key: "Tab" });
    expect(ta.value).toBe("Translate into «…»:");
    expect(ta.selectionStart).toBe(15);
    expect(ta.selectionEnd).toBe(18);
    expect(h.sendMessage).not.toHaveBeenCalled();
  });

  it("runs '/rename My title' with its argument on submit", () => {
    const runCommand = vi.fn();
    const { container } = render(<ChatInput commands={commands} runCommand={runCommand} />);
    const ta = container.querySelector("textarea");
    type(ta, "/rename My title");
    expect(screen.queryByRole("listbox")).toBeNull(); // menu closed once an argument is typed
    fireEvent.keyDown(ta, { key: "Enter" });
    expect(runCommand).toHaveBeenCalledWith("rename", "My title");
    expect(h.sendMessage).not.toHaveBeenCalled();
  });

  it("sends an unknown slash text as a normal message", async () => {
    const { container } = render(<ChatInput commands={commands} runCommand={vi.fn()} />);
    const ta = container.querySelector("textarea");
    type(ta, "/unknown thing");
    await act(async () => {
      fireEvent.keyDown(ta, { key: "Enter" });
    });
    expect(h.sendMessage).toHaveBeenCalledWith("/unknown thing", undefined);
  });

  it("offers agents on @ and hands the draft over on pick", async () => {
    const onPickAgent = vi.fn();
    const { container } = render(<ChatInput commands={commands} runCommand={vi.fn()} onPickAgent={onPickAgent} />);
    const ta = container.querySelector("textarea");
    await act(async () => {
      type(ta, "résume ça @ana");
    });
    const listbox = await screen.findByRole("listbox", { name: "Agents" });
    expect(listbox).toHaveTextContent("Analyste");
    expect(listbox).not.toHaveTextContent("Rédacteur");
    fireEvent.keyDown(ta, { key: "Enter" });
    expect(onPickAgent).toHaveBeenCalledTimes(1);
    expect(onPickAgent.mock.calls[0][0].agent_name).toBe("Analyste");
    expect(onPickAgent.mock.calls[0][1]).toBe("résume ça");
  });

  it("leaves Cmd+K to the palette unless text is selected (then it is the link shortcut)", () => {
    const { container } = render(<ChatInput commands={commands} runCommand={vi.fn()} />);
    const ta = container.querySelector("textarea");
    const reachedDocument = vi.fn();
    document.addEventListener("keydown", reachedDocument);
    try {
      type(ta, "see the docs");
      ta.setSelectionRange(8, 8); // caret, no selection → palette
      fireEvent.keyDown(ta, { key: "k", metaKey: true });
      expect(h.mdKeyDown).not.toHaveBeenCalled();
      expect(reachedDocument).toHaveBeenCalledTimes(1);

      ta.setSelectionRange(8, 12); // "docs" selected → link, palette stays closed
      fireEvent.keyDown(ta, { key: "k", metaKey: true });
      expect(h.mdKeyDown).toHaveBeenCalledTimes(1);
      expect(reachedDocument).toHaveBeenCalledTimes(1);
    } finally {
      document.removeEventListener("keydown", reachedDocument);
    }
  });

  it("restores the per-session draft on mount", () => {
    window.localStorage.setItem("th2chat:draft:s1", "draft one");
    const { container } = render(<ChatInput commands={commands} runCommand={vi.fn()} />);
    expect(container.querySelector("textarea").value).toBe("draft one");
  });

  it("stops the answer with Esc while streaming", () => {
    h.agent = { isLoading: false, streamingMessageId: "a1" };
    render(<ChatInput commands={commands} runCommand={vi.fn()} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(h.abortStreaming).toHaveBeenCalledTimes(1);
  });
});
