"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useTranslations } from "use-intl";
import { Bot, Send, X, Square, Copy, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useStreaming } from "@/hooks/useStreaming";
import { createSession, getSessionHistory } from "@/lib/api";
import ActionCard from "@/components/chat/action-cards/ActionCard";

// Mirrors the mapping used in useChat.js so the mini chat shares the same
// interactive cards as the main chat (chips picker, confirmation, payment…).
const ACTION_CARD_TOOL_TO_KIND = {
  request_user_input: "user_input",
  confirm_destructive: "confirm_destructive",
  request_payment: "payment",
  schedule_followup: "followup",
  propose_artifact_edit: "artifact_edit",
  request_file_from_user: "file_request",
  propose_agent_upgrade: "agent_upgrade",
  embed_chart: "chart_embed",
  request_location: "location_request",
};

// Compact markdown renderer — same plugin set as the main ChatMessage but a
// lighter component map tailored for the mini chat's narrow width.
const MINI_MD_COMPONENTS = {
  h1: (props) => <h3 className="text-sm font-bold mt-2 mb-1" {...props} />,
  h2: (props) => <h3 className="text-sm font-bold mt-2 mb-1" {...props} />,
  h3: (props) => <h4 className="text-sm font-semibold mt-2 mb-1" {...props} />,
  h4: (props) => <h5 className="text-xs font-semibold mt-2 mb-0.5" {...props} />,
  p: (props) => <p className="mb-1 leading-snug" {...props} />,
  ul: (props) => <ul className="list-disc pl-5 mb-1 space-y-0.5" {...props} />,
  ol: (props) => <ol className="list-decimal pl-5 mb-1 space-y-0.5" {...props} />,
  li: (props) => <li className="leading-snug" {...props} />,
  strong: (props) => <strong className="font-semibold th-text" {...props} />,
  em: (props) => <em className="italic" {...props} />,
  a: (props) => (
    <a
      {...props}
      className="text-blue-400 hover:text-blue-300 underline"
      target="_blank"
      rel="noopener noreferrer"
    />
  ),
  blockquote: (props) => (
    <blockquote className="border-l-2 th-border pl-2 th-text-faint my-1" {...props} />
  ),
  hr: () => <hr className="my-2 th-border" />,
  table: (props) => (
    <div className="overflow-x-auto my-1">
      <table className="text-xs border-collapse" {...props} />
    </div>
  ),
  th: (props) => <th className="border th-border px-1.5 py-0.5 font-semibold text-left" {...props} />,
  td: (props) => <td className="border th-border px-1.5 py-0.5" {...props} />,
  code: ({ inline, className, children, ...rest }) => {
    if (inline) {
      return (
        <code
          className="px-1 py-0.5 rounded th-bg-surface-hover text-[11px] font-mono"
          {...rest}
        >
          {children}
        </code>
      );
    }
    return (
      <code className={className} {...rest}>
        {children}
      </code>
    );
  },
  pre: (props) => (
    <pre
      className="th-bg-surface-hover rounded p-2 my-1 text-xs overflow-x-auto whitespace-pre-wrap select-text"
      {...props}
    />
  ),
};

const REMARK_PLUGINS = [remarkGfm];

function MarkdownView({ text }) {
  const content = useMemo(() => text || "", [text]);
  if (!content) return null;
  return (
    <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={MINI_MD_COMPONENTS}>
      {content}
    </ReactMarkdown>
  );
}

// Heuristic fallback: when the agent writes a numbered / bulleted choice list
// in plain markdown instead of calling request_user_input(chips), parse the
// text and surface the choices as clickable chips anyway. Returns either
// { items: string[] } or null. Used to paper over agents that ignore the
// "use chips" instruction.
const CHOICE_TRIGGER_RE =
  /(which one do you prefer|which do you prefer|pick one|choose one|choose|which|lequel préférez-vous|lequel|votre choix|laquelle|voici.{0,80}proposition|voici.{0,40}options|here are.{0,40}options)/i;

function detectInlineChoices(text) {
  if (!text) return null;
  if (!CHOICE_TRIGGER_RE.test(text)) return null;

  // Collect numbered items ("1. foo", "2) foo") or dash bullets ("- foo").
  const lines = text.split("\n");
  const numbered = [];
  const bulleted = [];
  for (const raw of lines) {
    const line = raw.trim();
    const numMatch = line.match(/^(\d{1,2})[\.\)]\s+(.+)$/);
    if (numMatch) {
      numbered.push(numMatch[2].trim());
      continue;
    }
    const dashMatch = line.match(/^[-*]\s+(.+)$/);
    if (dashMatch) {
      bulleted.push(dashMatch[1].trim());
    }
  }
  const raw = numbered.length >= 2 ? numbered : bulleted.length >= 2 ? bulleted : null;
  if (!raw) return null;

  // Clean up markdown emphasis and trim overly long lines.
  const items = raw
    .map((s) =>
      s
        .replace(/^\*\*(.+?)\*\*/, "$1")
        .replace(/^["'`]+|["'`]+$/g, "")
        .trim(),
    )
    .filter((s) => s.length > 0 && s.length <= 200);

  if (items.length < 2 || items.length > 8) return null;
  return { items };
}

function CopyButton({ text }) {
  const t = useTranslations("MiniChat");
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:th-bg-surface-hover th-text-faint hover:th-text-secondary transition-all"
      title={t("copy")}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

export default function MiniChat({
  agentId,
  agentName,
  dashboardId,
  userId,
  onClose,
  onAgentResponse,
}) {
  const t = useTranslations("MiniChat");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const [sessionId] = useState(() => `dashboard-chat-${dashboardId}`);
  const assistantBufferRef = useRef("");
  const sessionCreatedRef = useRef(false);

  const { startStreaming, abortStreaming } = useStreaming();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Load existing conversation history on mount
  useEffect(() => {
    getSessionHistory(agentId, String(userId), sessionId)
      .then((data) => {
        const history = data?.messages || [];
        if (history.length > 0) {
          setMessages(history.map((m) => ({ role: m.role, content: m.content })));
          sessionCreatedRef.current = true;
        }
      })
      .catch(() => {});
  }, [agentId, userId, sessionId]);

  const ensureSession = useCallback(async () => {
    if (sessionCreatedRef.current) return;
    try {
      await createSession({
        agent_name: agentId,
        user_id: String(userId),
        session_id: sessionId,
      });
      sessionCreatedRef.current = true;
    } catch {
      sessionCreatedRef.current = true;
    }
  }, [agentId, userId, sessionId]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    setInput("");
    setError(null);
    assistantBufferRef.current = "";

    const assistantMsgId = `m_${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: `u_${Date.now()}`, role: "user", content: text },
      { id: assistantMsgId, role: "assistant", content: "", cards: [] },
    ]);

    setIsStreaming(true);

    await ensureSession();

    const enrichedText = messages.length <= 1
      ? `[Dashboard context: dashboard_id="${dashboardId}". You have access to tool_get_dashboard_data to read all chart data from this dashboard. Use it when the user asks about the dashboard content.]\n\n${text}`
      : text;

    await startStreaming({
      agentId,
      userId: String(userId),
      sessionId,
      message: { role: "user", parts: [{ text: enrichedText }] },
      onChunk: (chunk) => {
        assistantBufferRef.current += chunk;
        const updated = assistantBufferRef.current;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId ? { ...m, content: updated } : m,
          ),
        );
      },
      onToolCall: (toolCall) => {
        const kind = ACTION_CARD_TOOL_TO_KIND[toolCall.name];
        if (!kind) return;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  cards: [
                    ...(m.cards || []),
                    {
                      id: `card_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                      kind,
                      status: "pending",
                      data: { ...(toolCall.args || {}) },
                    },
                  ],
                }
              : m,
          ),
        );
      },
      onComplete: () => {
        setIsStreaming(false);
        if (onAgentResponse) onAgentResponse();
      },
      onError: (err) => {
        setIsStreaming(false);
        setError(err.message || t("genericError"));
      },
    });
  }, [input, isStreaming, agentId, userId, sessionId, dashboardId, messages.length, startStreaming, ensureSession, onAgentResponse, t]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleStop = useCallback(() => {
    abortStreaming();
    setIsStreaming(false);
  }, [abortStreaming]);

  return (
    <div className="flex flex-col h-full w-[380px] th-bg-modal border-l th-border">
      <div className="flex items-center justify-between px-4 py-3 border-b th-border">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-brand" />
          <span className="text-sm font-medium th-text truncate">{agentName}</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:th-bg-surface-hover th-text-faint hover:th-text transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 select-text">
        {messages.length === 0 && (
          <p className="th-text-muted text-sm text-center mt-8">
            {t("startConversation", { agentName })}
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={msg.id || i}
            className={`group flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
          >
            {(msg.content || msg.role !== "assistant") && (
              <div
                className={`relative max-w-[85%] rounded-lg px-3 py-2 text-sm select-text ${
                  msg.role === "user"
                    ? "bg-brand text-white"
                    : "th-bg-surface border th-border th-text"
                }`}
              >
                {msg.role === "assistant" && msg.content && (
                  <div className="absolute -top-1 -right-1">
                    <CopyButton text={msg.content} />
                  </div>
                )}
                {msg.role === "assistant" ? <MarkdownView text={msg.content} /> : msg.content}
              </div>
            )}
            {/* Fallback: no real action card but the text contains a numbered
                list of choices — render synthetic chips so the user still
                gets a one-click answer. */}
            {msg.role === "assistant" &&
              (!Array.isArray(msg.cards) || msg.cards.length === 0) &&
              !isStreaming &&
              (() => {
                if (msg.respondedFallback) return null;
                const detected = detectInlineChoices(msg.content);
                if (!detected) return null;
                return (
                  <div className="flex flex-wrap gap-1.5 mt-2 max-w-[95%]">
                    {detected.items.map((choice, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setMessages((prev) =>
                            prev.map((m) =>
                              m.id === msg.id
                                ? { ...m, respondedFallback: true }
                                : m,
                            ),
                          );
                          setInput(choice);
                          setTimeout(() => handleSend(), 0);
                        }}
                        className="px-2.5 py-1.5 rounded-lg th-bg-surface border th-border hover:border-blue-500/40 hover:text-blue-300 th-text-secondary text-xs font-medium transition-colors"
                        title={t("choiceHint")}
                      >
                        {choice.length > 80
                          ? `${choice.slice(0, 77)}…`
                          : choice}
                      </button>
                    ))}
                  </div>
                );
              })()}
            {msg.role === "assistant" && Array.isArray(msg.cards) && msg.cards.length > 0 && (
              <div className="w-full max-w-[95%] mt-1 space-y-1">
                {msg.cards.map((card) => (
                  <ActionCard
                    key={card.id}
                    card={card}
                    agentId={agentId}
                    agentName={agentName}
                    onRespond={(payload) => {
                      setMessages((prev) =>
                        prev.map((m) =>
                          m.id === msg.id
                            ? {
                                ...m,
                                cards: m.cards.map((c) =>
                                  c.id === card.id
                                    ? { ...c, status: "done", response: payload }
                                    : c,
                                ),
                              }
                            : m,
                        ),
                      );
                      const answer =
                        typeof payload?.value !== "undefined"
                          ? String(payload.value)
                          : JSON.stringify(payload);
                      setInput(answer);
                      // Send the response as a new user message on the next tick
                      setTimeout(() => {
                        setInput("");
                        assistantBufferRef.current = "";
                        const newAssistantId = `m_${Date.now()}`;
                        setMessages((prev) => [
                          ...prev,
                          { id: `u_${Date.now()}`, role: "user", content: answer },
                          { id: newAssistantId, role: "assistant", content: "", cards: [] },
                        ]);
                        setIsStreaming(true);
                        startStreaming({
                          agentId,
                          userId: String(userId),
                          sessionId,
                          message: { role: "user", parts: [{ text: answer }] },
                          onChunk: (chunk) => {
                            assistantBufferRef.current += chunk;
                            const updated = assistantBufferRef.current;
                            setMessages((prev) =>
                              prev.map((m) =>
                                m.id === newAssistantId ? { ...m, content: updated } : m,
                              ),
                            );
                          },
                          onToolCall: (toolCall) => {
                            const kind = ACTION_CARD_TOOL_TO_KIND[toolCall.name];
                            if (!kind) return;
                            setMessages((prev) =>
                              prev.map((m) =>
                                m.id === newAssistantId
                                  ? {
                                      ...m,
                                      cards: [
                                        ...(m.cards || []),
                                        {
                                          id: `card_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                                          kind,
                                          status: "pending",
                                          data: { ...(toolCall.args || {}) },
                                        },
                                      ],
                                    }
                                  : m,
                              ),
                            );
                          },
                          onComplete: () => {
                            setIsStreaming(false);
                            if (onAgentResponse) onAgentResponse();
                          },
                          onError: (err) => {
                            setIsStreaming(false);
                            setError(err.message || t("genericError"));
                          },
                        });
                      }, 0);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
        {error && (
          <div className="text-red-500 text-xs text-center px-2">{error}</div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="px-3 py-3 border-t th-border">
        <div className="flex items-center gap-2 glass-input rounded-lg px-3 py-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("inputPlaceholder")}
            disabled={isStreaming}
            className="flex-1 bg-transparent text-sm th-text placeholder:th-text-faint outline-none"
          />
          {isStreaming ? (
            <button
              onClick={handleStop}
              className="p-1 rounded hover:th-bg-surface-hover text-red-500 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
              title={t("stop")}
            >
              <Square className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="p-1 rounded hover:th-bg-surface-hover text-brand disabled:th-text-faint disabled:hover:bg-transparent transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              title={t("send")}
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
