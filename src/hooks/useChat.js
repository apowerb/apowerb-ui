"use client";

import { useCallback } from "react";
import { useChatContext, ACTIONS } from "@/contexts/ChatContext";
import { useStreaming } from "./useStreaming";
import { uploadFileChunked, generateTitle } from "@/lib/api";
import { useToast } from "@/components/Toast";

/**
 * Trigger a browser notification if permitted.
 * Requests permission on first call.
 */
function triggerBrowserNotification(title, body) {
  if (typeof window === "undefined" || !("Notification" in window)) return;

  const show = () => {
    try {
      new Notification(title || "Agent Notification", {
        body: body || "Your agent has finished its task.",
        icon: "/favicon.ico",
        tag: "agent-notify", // prevents duplicate notifications
      });
    } catch (e) {
      console.debug("[Notification] Failed:", e);
    }
  };

  if (Notification.permission === "granted") {
    show();
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then((perm) => {
      if (perm === "granted") show();
    });
  }
}

// Maps a tool name emitted by the agent to the `kind` string used on the front
// to dispatch to the right typed action-card component.
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

// What "Continue" sends when a reply stopped short. Written as a plain user
// turn so every backend understands it; rendered as a small synthetic line.
export const CONTINUE_PROMPT = "Continue exactly where you stopped, without repeating what you already wrote.";

export function useChat({ onArtifactSaved } = {}) {
  const { state, dispatch, persistToStorage } = useChatContext();
  const { startStreaming, abortStreaming } = useStreaming();
  const toast = useToast();

  /**
   * Run one assistant turn: stream the answer for `sentContent` into the
   * assistant message `assistantMessageId`, wiring every SSE callback to the
   * reducer. Shared by sendMessage (fresh message) and regenerate (same
   * message id, new branch).
   */
  const runTurn = useCallback(
    async ({ session, sessionId, assistantMessageId, sentContent, startTime }) => {
      // Remembered here, not read back from `state`: the closure below would
      // see the state captured when the turn started, never the error that
      // arrived mid-stream.
      let streamError = null;
      await startStreaming({
        agentId: session.agentId,
        userId: String(session.userId),
        sessionId,
        message: { role: "user", parts: [{ text: sentContent }] },
        onChunk: (chunk) => {
          dispatch({
            type: ACTIONS.APPEND_TO_STREAMING,
            payload: { sessionId, messageId: assistantMessageId, content: chunk },
          });
        },
        onThinking: (thinking) => {
          dispatch({
            type: ACTIONS.APPEND_THINKING,
            payload: { sessionId, messageId: assistantMessageId, thinking },
          });
        },
        onToolCall: (toolCall) => {
          // Trigger browser + in-app notification for notify_user tool
          if (toolCall.name === "notify_user") {
            const agentName = session.agentName || session.agentId || "Agent";
            const notifTitle = toolCall.args?.title || agentName;
            const notifMessage = toolCall.args?.message || "Your agent has finished its task.";
            triggerBrowserNotification(notifTitle, notifMessage);
            toast.success(`${notifTitle}: ${notifMessage}`, 8000);
          }
          if (toolCall.name === "request_integration") {
            dispatch({
              type: ACTIONS.ADD_INTEGRATION_REQUEST,
              payload: {
                sessionId,
                messageId: assistantMessageId,
                request: {
                  id: `intreq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                  provider: toolCall.args?.provider,
                  reason: toolCall.args?.reason || "",
                  status: "pending",
                },
              },
            });
          }
          // Action cards — dispatch a typed card for any of the 9 known tools
          if (ACTION_CARD_TOOL_TO_KIND[toolCall.name]) {
            dispatch({
              type: ACTIONS.ADD_ACTION_CARD,
              payload: {
                sessionId,
                messageId: assistantMessageId,
                card: {
                  id: `card_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                  kind: ACTION_CARD_TOOL_TO_KIND[toolCall.name],
                  status: "pending",
                  data: { ...(toolCall.args || {}) },
                },
              },
            });
          }
          // Move intermediate text to thinking before registering the tool call.
          // Skip for action-card tools: their preceding text is the agent's
          // real answer (e.g. an email draft) and the card itself only carries
          // the follow-up question. Hiding that text behind the thinking pane
          // is what made replies look "stuck in the reasoning".
          if (!ACTION_CARD_TOOL_TO_KIND[toolCall.name]) {
            dispatch({
              type: ACTIONS.MOVE_CONTENT_TO_THINKING,
              payload: { sessionId, messageId: assistantMessageId },
            });
          }
          dispatch({
            type: ACTIONS.ADD_TOOL_CALL,
            payload: { sessionId, messageId: assistantMessageId, toolCall },
          });
        },
        onToolResult: ({ name, result }) => {
          dispatch({
            type: ACTIONS.SET_TOOL_RESULT,
            payload: {
              sessionId,
              messageId: assistantMessageId,
              toolName: name,
              result,
            },
          });
        },
        onMeta: (meta) => {
          const duration = meta.duration || Date.now() - startTime;
          dispatch({
            type: ACTIONS.SET_MESSAGE_META,
            payload: {
              sessionId,
              messageId: assistantMessageId,
              meta: { ...meta, duration },
            },
          });
        },
        onInfo: (info) => {
          // e.g. a rate-limit pause the backend is waiting out — shown in the
          // status bar, never written into the transcript.
          dispatch({ type: ACTIONS.SET_STREAM_INFO, payload: info });
        },
        onStreamError: (err) => {
          // The backend reported a failure inside the stream: the message
          // keeps what was received and shows the error with a Retry.
          streamError = err?.message || "error";
          dispatch({
            type: ACTIONS.SET_MESSAGE_STATUS,
            payload: {
              sessionId,
              messageId: assistantMessageId,
              status: "error",
              error: err?.message || "error",
            },
          });
        },
        onComplete: (info) => {
          const finalDuration = Date.now() - startTime;
          dispatch({
            type: ACTIONS.SET_MESSAGE_META,
            payload: {
              sessionId,
              messageId: assistantMessageId,
              meta: { duration: finalDuration },
            },
          });
          dispatch({
            type: ACTIONS.PROMOTE_THINKING_TO_CONTENT,
            payload: { sessionId, messageId: assistantMessageId },
          });
          dispatch({
            type: ACTIONS.FINISH_STREAMING,
            payload: {
              sessionId,
              messageId: assistantMessageId,
              outcome: info?.interrupted ? "interrupted" : streamError ? "error" : "done",
              ...(streamError && { error: streamError }),
            },
          });
          persistToStorage();
        },
        onArtifactSaved: onArtifactSaved || undefined,
        onError: (error) => {
          // Quota refusals and lost sessions need the prominent banner (they
          // explain what to do next); any other failure lives on the message.
          if (error?.quota || error?.code === "session_expired") {
            dispatch({ type: ACTIONS.SET_ERROR, payload: error.message });
          }
          dispatch({
            type: ACTIONS.FINISH_STREAMING,
            payload: {
              sessionId,
              messageId: assistantMessageId,
              outcome: "error",
              error: error?.message || String(error),
            },
          });
        },
      });
    },
    [dispatch, startStreaming, persistToStorage, onArtifactSaved, toast],
  );

  /**
   * Primary send function — SSE streaming with optional file upload.
   */
  const sendMessage = useCallback(
    async (content, files, opts = {}) => {
      // Un envoi fichiers-seuls (sans texte) est valide : ChatInput.handleSubmit
      // l'autorise déjà. Ne pas le bloquer ici sinon clic = rien (no-op silencieux).
      const hasFiles = Array.isArray(files) && files.length > 0;
      if (!state.activeSessionId || (!content.trim() && !hasFiles)) return;
      const { isSynthetic = false } = opts;

      const session = state.sessions.get(state.activeSessionId);
      if (!session) return;

      const sessionId = state.activeSessionId;

      // Première prise de parole réelle de l'utilisateur dans cette session :
      // déclenche la génération du titre (best-effort, non bloquant).
      const isFirstUserMessage =
        (session.messages?.length ?? 0) === 0 && !isSynthetic;

      // Upload files first and build attachment metadata
      let enrichedContent = content.trim();
      let attachments;

      if (files && files.length > 0) {
        const uploaded = [];
        for (const f of files) {
          try {
            const fileObj = f.file || f;
            const result = await uploadFileChunked(fileObj, session.agentId, (progress) => {
              dispatch({
                type: ACTIONS.UPDATE_UPLOAD_PROGRESS,
                payload: { sessionId, fileId: f.id, progress },
              });
            });
            uploaded.push({
              name: result.filename,
              type: f.type || "",
              size: result.size || f.size || 0,
              preview: f.preview || null,
              downloadPath: result.path,
            });
          } catch (err) {
            console.error("[useChat] File upload failed:", err);
          }
        }
        if (uploaded.length > 0) {
          attachments = uploaded;
          enrichedContent = `[Uploaded files: ${uploaded.map((u) => u.name).join(", ")}]\n\n${enrichedContent}`;
        }
      }

      dispatch({ type: ACTIONS.SET_LOADING, payload: true });
      dispatch({ type: ACTIONS.CLEAR_ERROR });

      // Add user message with attachments (display original text, not enriched).
      // `sentContent` keeps what the agent actually received, so Regenerate
      // can replay the exact turn (attachments prefix included).
      const userMessage = {
        id: `msg_user_${Date.now()}`,
        role: "user",
        content: content.trim(),
        timestamp: Date.now(),
        isStreaming: false,
        ...(enrichedContent !== content.trim() && { sentContent: enrichedContent }),
        ...(attachments && { attachments }),
        ...(isSynthetic && { isSynthetic: true }),
      };

      dispatch({
        type: ACTIONS.ADD_MESSAGE,
        payload: { sessionId, message: userMessage },
      });

      // Titre auto-généré à partir du 1er message (fire-and-forget : n'impacte
      // ni l'envoi ni le streaming). Persisté via le store (localStorage).
      if (isFirstUserMessage) {
        generateTitle(content.trim(), session.agentId)
          .then((res) => {
            const title = res?.title?.trim();
            if (title) {
              dispatch({
                type: ACTIONS.UPDATE_SESSION_TITLE,
                payload: { sessionId, title },
              });
            }
          })
          .catch(() => {});
      }

      // Create placeholder for assistant response
      const assistantMessageId = `msg_assistant_${Date.now()}`;
      const startTime = Date.now();
      const assistantMessage = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        thinking: "",
        toolCalls: [],
        steps: [],
        status: "streaming",
        meta: { startTime },
        timestamp: Date.now(),
        isStreaming: true,
      };

      dispatch({
        type: ACTIONS.ADD_MESSAGE,
        payload: { sessionId, message: assistantMessage },
      });

      await runTurn({ session, sessionId, assistantMessageId, sentContent: enrichedContent, startTime });
    },
    [state.activeSessionId, state.sessions, dispatch, runTurn],
  );

  /**
   * Ask the agent again for the same user turn. The previous answer stays
   * reachable as a branch (◂ 1/2 ▸ under the message). Defaults to the last
   * assistant message of the active conversation.
   */
  const regenerate = useCallback(
    async (messageId) => {
      const sessionId = state.activeSessionId;
      const session = sessionId ? state.sessions.get(sessionId) : null;
      if (!session || state.streamingMessageId) return;
      const messages = session.messages || [];
      let idx = messageId
        ? messages.findIndex((m) => m.id === messageId)
        : messages.map((m) => m.role).lastIndexOf("assistant");
      if (idx === -1 || messages[idx].role !== "assistant") return;
      // The user turn this answer replied to.
      let userIdx = idx - 1;
      while (userIdx >= 0 && messages[userIdx].role !== "user") userIdx -= 1;
      if (userIdx < 0) return;
      const userMsg = messages[userIdx];
      const sentContent = userMsg.sentContent || userMsg.content || "";
      if (!sentContent.trim()) return;

      dispatch({ type: ACTIONS.CLEAR_ERROR });
      dispatch({
        type: ACTIONS.REGENERATE_MESSAGE,
        payload: { sessionId, messageId: messages[idx].id },
      });
      await runTurn({
        session,
        sessionId,
        assistantMessageId: messages[idx].id,
        sentContent,
        startTime: Date.now(),
      });
    },
    [state.activeSessionId, state.sessions, state.streamingMessageId, dispatch, runTurn],
  );

  /** Pick up where an interrupted or truncated answer stopped. */
  const continueResponse = useCallback(async () => {
    if (state.streamingMessageId) return;
    await sendMessage(CONTINUE_PROMPT, undefined, { isSynthetic: true });
  }, [sendMessage, state.streamingMessageId]);

  /** Show another regeneration of a message (◂ ▸ navigator). */
  const setBranchIndex = useCallback(
    (messageId, index) => {
      const sessionId = state.activeSessionId;
      if (!sessionId) return;
      dispatch({
        type: ACTIONS.SET_BRANCH_INDEX,
        payload: { sessionId, messageId, index },
      });
    },
    [state.activeSessionId, dispatch],
  );

  const clearError = useCallback(() => {
    dispatch({ type: ACTIONS.CLEAR_ERROR });
  }, [dispatch]);

  /**
   * Respond to an action card rendered in the chat.
   *
   * @param {string} messageId - id of the assistant message that owns the card
   * @param {string} cardId - id of the card
   * @param {*} response - user's response (string or object depending on kind)
   * @param {object} [opts]
   * @param {boolean} [opts.sendFollowup=true] - if true, send a synthetic
   *   user message back to the agent so it can continue the flow.
   * @param {string} [opts.followupText] - custom text for the followup.
   *   Falls back to `[Response to <kind>]: <json>` when omitted.
   * @param {"done"|"cancelled"|"error"} [opts.status="done"] - terminal state
   *   of the card after the user acted.
   */
  const respondToActionCard = useCallback(
    (messageId, cardId, response, opts = {}) => {
      const { sendFollowup = true, followupText } = opts;
      // If status is not explicitly provided, infer it from sendFollowup:
      // a no-followup response is typically a cancel/reject/skip/deny.
      const status = opts.status || (sendFollowup ? "done" : "cancelled");

      const sessionId = state.activeSessionId;
      if (!sessionId) return;

      const session = state.sessions.get(sessionId);
      const message = session?.messages.find((m) => m.id === messageId);
      const card = message?.actionCards?.find((c) => c.id === cardId);

      // Guard: never process a response twice or on an unknown card.
      if (!card) {
        console.warn(
          "[useChat] respondToActionCard called with unknown card",
          { messageId, cardId },
        );
        return;
      }
      if (card.status !== "pending") {
        console.warn(
          "[useChat] respondToActionCard called on a non-pending card — ignoring",
          { messageId, cardId, status: card.status },
        );
        return;
      }

      dispatch({
        type: ACTIONS.UPDATE_ACTION_CARD,
        payload: {
          sessionId,
          messageId,
          cardId,
          updates: { status, response },
        },
      });

      if (sendFollowup) {
        const kind = card?.kind || "action_card";
        const payload =
          typeof response === "string" ? response : JSON.stringify(response);
        const text = followupText || `[Response to ${kind}]: ${payload}`;
        sendMessage(text, undefined, { isSynthetic: true });
      }
    },
    [state.activeSessionId, state.sessions, dispatch, sendMessage],
  );

  const activeSession = state.activeSessionId
    ? state.sessions.get(state.activeSessionId)
    : null;

  return {
    messages: activeSession?.messages || [],
    isLoading: state.isLoading,
    streamingMessageId: state.streamingMessageId,
    streamInfo: state.streamInfo || null,
    error: state.error,
    sendMessage,
    regenerate,
    continueResponse,
    setBranchIndex,
    abortStreaming,
    clearError,
    respondToActionCard,
  };
}
