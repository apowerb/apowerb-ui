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
import ChatEmptyState from "./ChatEmptyState";
import FollowUpSuggestions from "./FollowUpSuggestions";
import {
  MessageSquare, AlertCircle, X, Copy, Check,
  Share2, Link, Loader2, Globe, Lock, ExternalLink,
  ArrowDown,
} from "lucide-react";
import { formatDate as formatDateParis, formatDateTime } from "@/lib/datetime";

/* ─────────────────────────────────────────
   Helpers
───────────────────────────────────────── */
function formatConversation(session, messages, t) {
  const lines = [];
  lines.push(`# ${session.title}`);
  lines.push(`${t("agentLabel")}: ${session.agentName}`);
  lines.push(`${t("dateLabel")}: ${formatDateParis(session.createdAt)}`);
  lines.push("---\n");
  for (const msg of messages) {
    const role = msg.role === "user" ? t("userRole") : session.agentName || t("assistantRole");
    const time = formatDateTime(msg.timestamp);
    lines.push(`**${role}** (${time}):`);
    const rawContent = typeof msg.content === "string" ? msg.content : "";
    const thinking = typeof msg.thinking === "string" ? msg.thinking : "";
    const content = rawContent.trim() ? rawContent : thinking;
    if (content.trim()) lines.push(content);
    if (msg.toolCalls?.length) lines.push(`\n_[${t("toolCallCount", { count: msg.toolCalls.length })}]_`);
    lines.push("");
  }
  return lines.join("\n");
}

/* ─────────────────────────────────────────
   Share Modal
───────────────────────────────────────── */
function ShareModal({ session, messages, onClose }) {
  const t = useTranslations("ChatMessages");
  const [status, setStatus]       = useState("idle"); // idle | loading | success | error
  const [shareUrl, setShareUrl]   = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [errorMsg, setErrorMsg]   = useState("");
  const inputRef = useRef(null);

  // Generate share link on mount
  useEffect(() => {
    generateShare();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generateShare = async () => {
    setStatus("loading");
    setErrorMsg("");
    try {
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
      const url = `${window.location.origin}/share/${shareId}`;
      setShareUrl(url);
      setStatus("success");
    } catch (err) {
      setErrorMsg(err.message || t("shareGenericError"));
      setStatus("error");
    }
  };

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
                onClick={generateShare}
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

export default function ChatMessages({ onEditPrompt, onOpenArtifact }) {
  const t = useTranslations("ChatMessages");
  const {
    messages,
    streamingMessageId,
    error,
    clearError,
    resolveApproval,
    setBranchIndex,
    respondToActionCard,
    sendMessage,
    isLoading,
  } = useChat();
  const { activeSession } = useChatSessions();
  const { dispatch } = useChatContext();
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
  const [conversationCopied, setConversationCopied] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

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
    onFailure: (error) => {
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

  const handleCopyConversation = useCallback(async () => {
    if (!activeSession || messages.length === 0) return;
    try {
      const text = formatConversation(activeSession, messages, t);
      await navigator.clipboard.writeText(text);
      setConversationCopied(true);
      setTimeout(() => setConversationCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy conversation:", err);
    }
  }, [activeSession, messages]);

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
    return <ChatEmptyState />;
  }

  return (
    <div className="relative flex-1 flex flex-col overflow-hidden">
      {error && <ChatErrorBanner error={error} onClear={clearError} />}

      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto custom-scrollbar p-4"
      >
        {/* Session header */}
        <div className="text-center py-4 mb-4 border-b th-border-secondary">
          <h2 className="text-lg font-semibold th-text-secondary">{activeSession.title}</h2>
          <p className="text-xs th-text-faint">{t("agentLabel")}: {activeSession.agentName}</p>
        </div>

        {/* Messages */}
        {messages.length === 0 ? (
          <div className="text-center th-text-faint text-sm py-8">
            {t("sendMessageToStart")}
          </div>
        ) : (
          messages.map((message, idx) => (
            <ChatMessage
              key={message.id}
              message={message}
              messageIndex={idx}
              isStreaming={message.id === streamingMessageId}
              onEditPrompt={onEditPrompt}
              onOpenArtifact={onOpenArtifact}
              onApprove={(msgId, approvalId) => resolveApproval(msgId, approvalId, "approved")}
              onReject={(msgId, approvalId) => resolveApproval(msgId, approvalId, "rejected")}
              onModifyApproval={(msgId, approvalId, text) => resolveApproval(msgId, approvalId, "modified", text)}
              onConnectIntegration={handleConnectIntegration}
              onRespondToActionCard={respondToActionCard}
              onNavigateBranch={setBranchIndex}
              agentName={activeSession.agentName}
            />
          ))
        )}

        {/* Action buttons at end of conversation */}
        {!streamingMessageId &&
          messages.length > 0 &&
          messages[messages.length - 1]?.role === "assistant" && (
            <FollowUpSuggestions
              key={messages[messages.length - 1].id}
              content={messages[messages.length - 1].content}
              userText={userLangText}
              onSelect={(text) => sendMessage(text)}
              disabled={isLoading}
            />
          )}

        {messages.length > 0 && !streamingMessageId && (
          <div className="flex items-center justify-center gap-2 py-4">
            {/* Copy conversation */}
            <button
              onClick={handleCopyConversation}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg transition-all th-bg-surface border th-border th-text-faint hover:th-bg-surface-hover hover:th-border-hover hover:th-text-secondary"
              title={t("copyConversationTitle")}
            >
              {conversationCopied ? (
                <><Check size={13} className="text-blue-400" /><span className="text-blue-400">{t("copiedExclaim")}</span></>
              ) : (
                <><Copy size={13} /><span>{t("copy")}</span></>
              )}
            </button>

            {/* Divider */}
            <div className="w-px h-4 th-border" />

            {/* Share conversation */}
            <button
              onClick={() => setShowShareModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg transition-all bg-brand/10 border border-brand/20 text-brand/80 hover:bg-brand/18 hover:border-brand/40 hover:text-brand hover:shadow-[0_0_16px_rgba(1,61,255,0.2)]"
              title={t("shareConversationTitle")}
            >
              <Share2 size={13} />
              <span>{t("share")}</span>
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
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

      {/* Share modal */}
      {showShareModal && (
        <ShareModal
          session={activeSession}
          messages={messages}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
}
