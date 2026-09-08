"use client";

import { useTranslations } from "use-intl";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useChat } from "@/hooks/useChat";
import { useChatSessions } from "@/hooks/useChatSessions";
import { useChatContext, ACTIONS } from "@/contexts/ChatContext";
import { useOAuthPopup } from "@/hooks/useOAuthPopup";
import { authStorage } from "@/lib/authStorage";
import ChatMessage from "./ChatMessage";
import ContextIndicator from "./ContextIndicator";
import ChatErrorBanner from "./ChatErrorBanner";
import ChatHome from "./ChatHome";
import ThreadSearchBar from "./ThreadSearchBar";
import { useChatUi } from "@/contexts/ChatUiContext";
import FollowUpSuggestions from "./FollowUpSuggestions";
import {
  MessageSquare, AlertCircle, X, Copy, Check,
  Share2, Link, Loader2, Globe, ExternalLink,
  ArrowDown,
} from "lucide-react";
import { useLocale, useNow } from "use-intl";

/* ─────────────────────────────────────────
   Helpers
───────────────────────────────────────── */
/* ─────────────────────────────────────────
   Share Modal
───────────────────────────────────────── */
function ShareModal({ session, messages, onClose }) {
  const t = useTranslations("ChatMessages");
  const [status, setStatus]       = useState("loading"); // loading | success | error
  const [shareUrl, setShareUrl]   = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [errorMsg, setErrorMsg]   = useState("");
  const inputRef = useRef(null);

  // Resolves to the public URL; every state write happens in the promise
  // callbacks below, so neither the mount effect nor the retry handler ever
  // sets state synchronously.
  const createShare = async () => {
    const payload = {
      title: session.title,
      agentName: session.agentName,
      createdAt: session.createdAt,
      isPublic: true,
      messages: messages.map((m) => ({
        role: m.role,
        content: typeof m.content === "string" ? m.content : "",
        timestamp: m.timestamp,
        toolCalls: m.toolCalls || [],
      })),
    };

    const token = authStorage.getToken();
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch("/api/conversations/share", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error || t("serverError", { status: res.status }));
    }

    const { shareId } = await res.json();
    return `${window.location.origin}/share/${shareId}`;
  };
  const failureText = (err) => err.message || t("shareGenericError");

  const retryShare = () => {
    setStatus("loading");
    setErrorMsg("");
    createShare()
      .then((url) => {
        setShareUrl(url);
        setStatus("success");
      })
      .catch((err) => {
        setErrorMsg(failureText(err));
        setStatus("error");
      });
  };

  // Generate share link on mount; a modal closed mid-flight writes nothing.
  useEffect(() => {
    let alive = true;
    createShare()
      .then((url) => {
        if (!alive) return;
        setShareUrl(url);
        setStatus("success");
      })
      .catch((err) => {
        if (!alive) return;
        setErrorMsg(failureText(err));
        setStatus("error");
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    } catch {}
  };

  // Close on backdrop click
  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 px-4 th-bg-overlay"
      style={{ backdropFilter: "blur(6px)" }}
      onClick={handleBackdrop}
    >
      <div
        className="relative w-full rounded-2xl overflow-hidden th-bg-body th-border"
        style={{
          maxWidth: 460,
          boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(1,61,255,0.15)",
        }}
      >
        {/* Top accent */}
        <div
          className="h-px w-full bg-linear-to-r from-transparent via-brand to-transparent"
        />

        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center bg-brand/15 border border-brand/30"
              >
                <Share2 size={18} className="text-brand" />
              </div>
              <div>
                <h3 className="text-base font-semibold th-text">{t("shareConversationTitle")}</h3>
                <p className="text-xs th-text-faint mt-0.5">{t("shareConversationSubtitle")}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors th-bg-surface th-text-faint hover:th-bg-surface-hover hover:th-text-secondary"
            >
              <X size={15} />
            </button>
          </div>

          {/* Session info pill */}
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl mb-6 text-sm th-bg-surface border th-border-secondary"
          >
            <MessageSquare size={14} className="th-text-faint" />
            <span className="th-text-muted truncate flex-1">{session.title}</span>
            <span className="th-text-ghost text-xs flex-shrink-0">{t("messagesCount", { count: messages.length })}</span>
          </div>

          {/* State: loading */}
          {status === "loading" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 size={28} className="animate-spin text-brand" />
              <p className="text-sm th-text-faint">{t("creatingShareableLink")}</p>
            </div>
          )}

          {/* State: success */}
          {status === "success" && (
            <>
              {/* Privacy notice */}
              <div
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-4 text-xs bg-brand/8 border border-brand/20 th-text-muted"
              >
                <Globe size={13} className="text-brand" />
                {t("publicSnapshotReadOnly")}
              </div>

              {/* Link row */}
              <div
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-4 th-bg-surface border th-border"
              >
                <Link size={13} className="th-text-faint" />
                <input
                  ref={inputRef}
                  readOnly
                  value={shareUrl}
                  onClick={(e) => e.target.select()}
                  className="flex-1 bg-transparent text-sm th-text-secondary outline-none min-w-0 font-mono"
                />
                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 th-text-faint"
                >
                  <ExternalLink size={13} />
                </a>
              </div>

              {/* Copy button */}
              <button
                onClick={copyLink}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  linkCopied
                    ? "bg-blue-500/15 border border-blue-500/30 text-blue-400"
                    : "bg-brand border border-transparent text-white shadow-[0_0_30px_rgba(1,61,255,0.35)]"
                }`}
              >
                {linkCopied ? (
                  <><Check size={15} /> {t("copiedToClipboard")}</>
                ) : (
                  <><Copy size={15} /> {t("copyLink")}</>
                )}
              </button>
            </>
          )}

          {/* State: error */}
          {status === "error" && (
            <div className="flex flex-col gap-4">
              <div
                className="flex items-start gap-3 px-4 py-3 rounded-xl"
                style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)" }}
              >
                <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
                <p className="text-sm text-red-300">{errorMsg}</p>
              </div>
              <button
                onClick={retryShare}
                className="w-full py-3 rounded-xl text-sm font-semibold th-text transition-all th-bg-surface border th-border hover:th-bg-surface-hover"
              >
                {t("tryAgain")}
              </button>
            </div>
          )}

          {/* Footer note */}
          {status === "success" && (
            <p className="text-center text-xs th-text-ghost mt-4">
              {t("futureMessagesNote")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Main ChatMessages component
───────────────────────────────────────── */
// Returns true when the scroll container is within `threshold` px of the bottom.
// Extracted so the auto-scroll decision is unit-testable without real layout.
export function isNearBottom(el, threshold = 120) {
  if (!el) return true;
  return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
}

// Recent user messages concatenated — a robust language signal for the
// suggestion chips (one clicked chip cannot flip the detected language).
function recentUserText(messages, k = 6) {
  const parts = [];
  for (let i = messages.length - 1; i >= 0 && parts.length < k; i--) {
    const m = messages[i];
    if (m.role === "user" && typeof m.content === "string" && m.content.trim()) {
      parts.push(m.content);
    }
  }
  return parts.join(" ");
}

// Day separators: "Today", "Yesterday", or the date — only when the day changes.
function dayKey(ts) {
  const d = new Date(ts || 0);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function DaySeparator({ timestamp, locale, t }) {
  // `useNow` keeps "today" out of render-time clock reads (and lets the intl
  // provider control the reference time).
  const now = useNow().getTime();
  const today = dayKey(now);
  const yesterday = dayKey(now - 86_400_000);
  const key = dayKey(timestamp);
  const label =
    key === today
      ? t("today")
      : key === yesterday
        ? t("yesterday")
        : new Date(timestamp).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
  return (
    <div className="flex items-center gap-3 my-5 select-none" aria-hidden="true">
      <span className="flex-1 h-px th-border" style={{ background: "var(--border-secondary)" }} />
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] th-text-ghost">{label}</span>
      <span className="flex-1 h-px" style={{ background: "var(--border-secondary)" }} />
    </div>
  );
}

export default function ChatMessages({ onEditPrompt, onOpenArtifact }) {
  const t = useTranslations("ChatMessages");
  const locale = useLocale();
  const {
    messages,
    streamingMessageId,
    error,
    clearError,
    respondToActionCard,
    sendMessage,
    regenerate,
    continueResponse,
    setBranchIndex,
    isLoading,
  } = useChat();
  const { activeSession } = useChatSessions();
  const { dispatch } = useChatContext();
  const ui = useChatUi();
  const messagesEndRef = useRef(null);
  const userLangText = useMemo(() => recentUserText(messages), [messages]);
  const isStreamingRef = useRef(false);
  const scrollContainerRef = useRef(null);
  const atBottomRef = useRef(true);
  const [showJumpButton, setShowJumpButton] = useState(false);
  const scrollRafRef = useRef(0);
  const [prevSessionId, setPrevSessionId] = useState(activeSession?.id);

  // Reset the FAB when the active session changes (during render - the
  // sanctioned pattern; setState in an effect is disallowed and refs cannot be
  // touched during render). The scroll snap lives in the effect below.
  if (activeSession?.id !== prevSessionId) {
    setPrevSessionId(activeSession?.id);
    setShowJumpButton(false);
  }

  const updateIntegrationRequest = useCallback(
    (requestId, updates) => {
      if (!activeSession) return;
      const msg = messages.find((m) =>
        m.integrationRequests?.some((r) => r.id === requestId)
      );
      if (!msg) return;
      dispatch({
        type: ACTIONS.UPDATE_INTEGRATION_REQUEST,
        payload: {
          sessionId: activeSession.id,
          messageId: msg.id,
          requestId,
          updates,
        },
      });
    },
    [activeSession, messages, dispatch]
  );

  const { openOAuth } = useOAuthPopup({
    onSuccess: (provider) => {
      const msg = messages.find((m) =>
        m.integrationRequests?.some(
          (r) => r.provider === provider && r.status === "connecting"
        )
      );
      const req = msg?.integrationRequests?.find(
        (r) => r.provider === provider && r.status === "connecting"
      );
      if (req) updateIntegrationRequest(req.id, { status: "connected" });
    },
    onFailure: () => {
      const msg = messages.find((m) =>
        m.integrationRequests?.some((r) => r.status === "connecting")
      );
      const req = msg?.integrationRequests?.find((r) => r.status === "connecting");
      if (req) updateIntegrationRequest(req.id, { status: "failed" });
    },
    onCancel: (provider) => {
      const msg = messages.find((m) =>
        m.integrationRequests?.some(
          (r) => r.provider === provider && r.status === "connecting"
        )
      );
      const req = msg?.integrationRequests?.find(
        (r) => r.provider === provider && r.status === "connecting"
      );
      if (req) updateIntegrationRequest(req.id, { status: "pending" });
    },
  });

  const handleConnectIntegration = useCallback(
    (requestId) => {
      const msg = messages.find((m) =>
        m.integrationRequests?.some((r) => r.id === requestId)
      );
      const req = msg?.integrationRequests?.find((r) => r.id === requestId);
      if (!req) return;
      updateIntegrationRequest(requestId, { status: "connecting" });
      openOAuth(req.provider);
    },
    [messages, updateIntegrationRequest, openOAuth]
  );

  useEffect(() => {
    isStreamingRef.current = !!streamingMessageId;
  }, [streamingMessageId]);

  // Smart auto-scroll: only follow to the bottom when the user is already near
  // it. If they scrolled up to re-read, leave them there and surface a
  // jump-to-latest pill instead of yanking them down on every token.
  const scrollToBottom = useCallback((behavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
    atBottomRef.current = true;
    setShowJumpButton(false);
  }, []);

  // Scroll events (not the messages effect) drive the FAB, so we never call
  // setState synchronously inside an effect.
  const handleScroll = useCallback(() => {
    if (scrollRafRef.current) return; // coalesce scroll bursts to one read/frame
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = 0;
      const near = isNearBottom(scrollContainerRef.current);
      atBottomRef.current = near;
      setShowJumpButton(!near);
    });
  }, []);

  useEffect(() => () => cancelAnimationFrame(scrollRafRef.current), []);

  // On session change (and mount), snap to the latest message and resume
  // following. Refs/DOM only - no setState, so set-state-in-effect stays happy.
  useEffect(() => {
    atBottomRef.current = true;
    messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
  }, [activeSession?.id]);

  // Follow new content to the bottom only when the user is already near it;
  // otherwise leave their scroll position untouched and let the FAB offer a jump.
  useEffect(() => {
    // Always snap to the bottom when the user just sent their own message
    // (they want to see it land); otherwise follow streaming/agent updates only
    // when already near the bottom. Ref mutation here, never setState.
    const last = messages[messages.length - 1];
    if (last?.role === "user") atBottomRef.current = true;
    if (atBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({
        behavior: isStreamingRef.current ? "instant" : "smooth",
      });
    }
  }, [messages]);

  if (!activeSession) {
    return <ChatHome />;
  }

  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;
  const lastMessage = messages[messages.length - 1];

  return (
    <div className="relative flex-1 flex flex-col overflow-hidden">
      {error && <ChatErrorBanner error={error} onClear={clearError} />}

      {ui.threadSearch.open && (
        <ThreadSearchBar
          messages={messages}
          query={ui.threadSearch.query}
          onQueryChange={ui.setThreadSearchQuery}
          onClose={ui.closeThreadSearch}
        />
      )}

      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto custom-scrollbar px-4 sm:px-6"
      >
        <div className="mx-auto w-full max-w-3xl py-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-16 gap-2">
              <MessageSquare size={28} className="text-brand/50" />
              <p className="text-sm th-text-muted">{t("sendMessageToStart")}</p>
              <p className="text-[11px] th-text-ghost">{t("startHint")}</p>
            </div>
          ) : (
            messages.map((message, idx) => {
              const prev = messages[idx - 1];
              const showDay = !prev || dayKey(prev.timestamp) !== dayKey(message.timestamp);
              return (
                <div key={message.id}>
                  {showDay && <DaySeparator timestamp={message.timestamp} locale={locale} t={t} />}
                  <ChatMessage
                    message={message}
                    messageIndex={idx}
                    isStreaming={message.id === streamingMessageId}
                    isLastAssistant={message.id === lastAssistantId && !streamingMessageId}
                    onEditPrompt={onEditPrompt}
                    onOpenArtifact={onOpenArtifact}
                    onConnectIntegration={handleConnectIntegration}
                    onRespondToActionCard={respondToActionCard}
                    onNavigateBranch={setBranchIndex}
                    onRegenerate={regenerate}
                    onContinue={continueResponse}
                    agentName={activeSession.agentName}
                  />
                </div>
              );
            })
          )}

          {/* Suggested follow-ups after a completed assistant reply */}
          {!streamingMessageId &&
            messages.length > 0 &&
            lastMessage?.role === "assistant" &&
            lastMessage.status !== "error" &&
            lastMessage.status !== "empty" &&
            lastMessage.status !== "interrupted" && (
              <FollowUpSuggestions
                key={lastMessage.id}
                content={lastMessage.content}
                userText={userLangText}
                onSelect={(text) => sendMessage(text)}
                disabled={isLoading}
              />
            )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {showJumpButton && (
        <button
          type="button"
          onClick={() => scrollToBottom(streamingMessageId ? "instant" : "smooth")}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs shadow-lg th-bg-surface border th-border th-text-secondary hover:th-bg-surface-hover transition-all"
          aria-label={t("goToLatestMessage")}
        >
          <ArrowDown size={14} />
          <span>{streamingMessageId ? t("newMessages") : t("latestMessage")}</span>
        </button>
      )}
      <ContextIndicator />

      {/* Share modal — opened from the header or the command palette */}
      {ui.shareOpen && (
        <ShareModal
          session={activeSession}
          messages={messages}
          onClose={() => ui.setShareOpen(false)}
        />
      )}
    </div>
  );
}
