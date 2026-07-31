"use client";

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { chatStorage } from "@/lib/chatStorage";
import { useAuth } from "@/contexts/AuthContext";

const ChatContext = createContext(null);

// Action types
const ACTIONS = {
  INIT_FROM_STORAGE: "INIT_FROM_STORAGE",
  CREATE_SESSION: "CREATE_SESSION",
  DELETE_SESSION: "DELETE_SESSION",
  SET_ACTIVE_SESSION: "SET_ACTIVE_SESSION",
  ADD_MESSAGE: "ADD_MESSAGE",
  APPEND_TO_STREAMING: "APPEND_TO_STREAMING",
  APPEND_THINKING: "APPEND_THINKING",
  ADD_TOOL_CALL: "ADD_TOOL_CALL",
  MOVE_CONTENT_TO_THINKING: "MOVE_CONTENT_TO_THINKING",
  PROMOTE_THINKING_TO_CONTENT: "PROMOTE_THINKING_TO_CONTENT",
  SET_TOOL_RESULT: "SET_TOOL_RESULT",
  SET_MESSAGE_META: "SET_MESSAGE_META",
  FINISH_STREAMING: "FINISH_STREAMING",
  SET_LOADING: "SET_LOADING",
  SET_ERROR: "SET_ERROR",
  UPDATE_SESSION_TITLE: "UPDATE_SESSION_TITLE",
  CLEAR_ERROR: "CLEAR_ERROR",
  UPDATE_UPLOAD_PROGRESS: "UPDATE_UPLOAD_PROGRESS",
  ADD_INTEGRATION_REQUEST: "ADD_INTEGRATION_REQUEST",
  UPDATE_INTEGRATION_REQUEST: "UPDATE_INTEGRATION_REQUEST",
  ADD_ACTION_CARD: "ADD_ACTION_CARD",
  UPDATE_ACTION_CARD: "UPDATE_ACTION_CARD",
  UPDATE_SESSIONS_META: "UPDATE_SESSIONS_META",
  ADD_TAG_TO_SESSIONS: "ADD_TAG_TO_SESSIONS",
  REMOVE_TAG_FROM_SESSION: "REMOVE_TAG_FROM_SESSION",
  CREATE_FOLDER: "CREATE_FOLDER",
  RENAME_FOLDER: "RENAME_FOLDER",
  DELETE_FOLDER: "DELETE_FOLDER",
  MOVE_SESSIONS_TO_FOLDER: "MOVE_SESSIONS_TO_FOLDER",
};

const initialState = {
  sessions: new Map(),
  activeSessionId: null,
  isLoading: false,
  streamingMessageId: null,
  error: null,
  uploadProgress: new Map(),
  folders: [],
  hasHydrated: false,
};

function chatReducer(state, action) {
  switch (action.type) {
    case ACTIONS.INIT_FROM_STORAGE: {
      // Clean up stale isStreaming flags from crashed/reloaded sessions
      const cleanedSessions = new Map();
      for (const [id, session] of action.payload.sessions) {
        const hasStale = session.messages?.some((m) => m.isStreaming);
        cleanedSessions.set(id, hasStale ? {
          ...session,
          messages: session.messages.map((m) =>
            m.isStreaming ? { ...m, isStreaming: false } : m
          ),
        } : session);
      }
      return {
        ...state,
        sessions: cleanedSessions,
        activeSessionId: action.payload.activeSessionId,
        folders: action.payload.folders || [],
        hasHydrated: true,
        streamingMessageId: null,
        isLoading: false,
      };
    }

    case ACTIONS.CREATE_SESSION: {
      const newSessions = new Map(state.sessions);
      newSessions.set(action.payload.id, action.payload);
      return {
        ...state,
        sessions: newSessions,
        activeSessionId: action.payload.id,
      };
    }

    case ACTIONS.DELETE_SESSION: {
      const newSessions = new Map(state.sessions);
      newSessions.delete(action.payload);
      // If we deleted the active session, select another one
      let newActiveId = state.activeSessionId;
      if (state.activeSessionId === action.payload) {
        const remaining = Array.from(newSessions.values());
        newActiveId = remaining.length > 0 ? remaining[0].id : null;
      }
      return {
        ...state,
        sessions: newSessions,
        activeSessionId: newActiveId,
      };
    }

    case ACTIONS.SET_ACTIVE_SESSION: {
      return {
        ...state,
        activeSessionId: action.payload,
      };
    }

    case ACTIONS.ADD_MESSAGE: {
      const { sessionId, message } = action.payload;
      const session = state.sessions.get(sessionId);
      if (!session) return state;

      const newSessions = new Map(state.sessions);
      newSessions.set(sessionId, {
        ...session,
        messages: [...session.messages, message],
        updatedAt: Date.now(),
      });

      return {
        ...state,
        sessions: newSessions,
        streamingMessageId: message.isStreaming ? message.id : state.streamingMessageId,
      };
    }

    case ACTIONS.APPEND_TO_STREAMING: {
      const { sessionId, messageId, content } = action.payload;
      const session = state.sessions.get(sessionId);
      if (!session) return state;

      const newMessages = session.messages.map((msg) =>
        msg.id === messageId ? { ...msg, content: msg.content + content } : msg
      );

      const newSessions = new Map(state.sessions);
      newSessions.set(sessionId, {
        ...session,
        messages: newMessages,
        updatedAt: Date.now(),
      });

      return {
        ...state,
        sessions: newSessions,
      };
    }

    case ACTIONS.APPEND_THINKING: {
      const { sessionId, messageId, thinking } = action.payload;
      const session = state.sessions.get(sessionId);
      if (!session) return state;

      const newMessages = session.messages.map((msg) =>
        msg.id === messageId
          ? { ...msg, thinking: (msg.thinking || "") + thinking }
          : msg
      );

      const newSessions = new Map(state.sessions);
      newSessions.set(sessionId, {
        ...session,
        messages: newMessages,
        updatedAt: Date.now(),
      });

      return {
        ...state,
        sessions: newSessions,
      };
    }

    case ACTIONS.MOVE_CONTENT_TO_THINKING: {
      const { sessionId, messageId } = action.payload;
      const session = state.sessions.get(sessionId);
      if (!session) return state;

      const newMessages = session.messages.map((msg) => {
        if (msg.id !== messageId || !msg.content) return msg;
        const separator = msg.thinking ? "\n\n---\n\n" : "";
        return {
          ...msg,
          thinking: (msg.thinking || "") + separator + msg.content,
          content: "",
        };
      });

      const newSessions = new Map(state.sessions);
      newSessions.set(sessionId, {
        ...session,
        messages: newMessages,
        updatedAt: Date.now(),
      });

      return {
        ...state,
        sessions: newSessions,
      };
    }

    case ACTIONS.PROMOTE_THINKING_TO_CONTENT: {
      const { sessionId, messageId } = action.payload;
      const session = state.sessions.get(sessionId);
      if (!session) return state;

      const newMessages = session.messages.map((msg) => {
        if (msg.id !== messageId) return msg;
        const hasContent = (msg.content || "").trim().length > 0;
        const hasThinking = (msg.thinking || "").trim().length > 0;
        if (hasContent || !hasThinking) return msg;
        return { ...msg, content: msg.thinking, thinking: "" };
      });

      const newSessions = new Map(state.sessions);
      newSessions.set(sessionId, {
        ...session,
        messages: newMessages,
        updatedAt: Date.now(),
      });

      return {
        ...state,
        sessions: newSessions,
      };
    }

    case ACTIONS.ADD_TOOL_CALL: {
      const { sessionId, messageId, toolCall } = action.payload;
      const session = state.sessions.get(sessionId);
      if (!session) return state;

      const newMessages = session.messages.map((msg) =>
        msg.id === messageId
          ? { ...msg, toolCalls: [...(msg.toolCalls || []), toolCall] }
          : msg
      );

      const newSessions = new Map(state.sessions);
      newSessions.set(sessionId, {
        ...session,
        messages: newMessages,
        updatedAt: Date.now(),
      });

      return {
        ...state,
        sessions: newSessions,
      };
    }

    case ACTIONS.SET_TOOL_RESULT: {
      const { sessionId, messageId, toolName, result } = action.payload;
      const session = state.sessions.get(sessionId);
      if (!session) return state;

      const newMessages = session.messages.map((msg) => {
        if (msg.id !== messageId || !msg.toolCalls) return msg;
        // Find the last tool call matching toolName and attach result
        const updated = [...msg.toolCalls];
        for (let i = updated.length - 1; i >= 0; i--) {
          if (updated[i].name === toolName && !updated[i].result) {
            updated[i] = { ...updated[i], result };
            break;
          }
        }
        return { ...msg, toolCalls: updated };
      });

      const newSessions = new Map(state.sessions);
      newSessions.set(sessionId, {
        ...session,
        messages: newMessages,
        updatedAt: Date.now(),
      });

      return {
        ...state,
        sessions: newSessions,
      };
    }

    case ACTIONS.SET_MESSAGE_META: {
      const { sessionId, messageId, meta } = action.payload;
      const session = state.sessions.get(sessionId);
      if (!session) return state;

      const newMessages = session.messages.map((msg) =>
        msg.id === messageId ? { ...msg, meta: { ...msg.meta, ...meta } } : msg
      );

      const newSessions = new Map(state.sessions);
      newSessions.set(sessionId, {
        ...session,
        messages: newMessages,
        updatedAt: Date.now(),
      });

      return {
        ...state,
        sessions: newSessions,
      };
    }

    case ACTIONS.FINISH_STREAMING: {
      const { sessionId, messageId } = action.payload;
      const session = state.sessions.get(sessionId);
      // Always clear streaming state, even if the session was deleted
      if (!session) {
        return {
          ...state,
          streamingMessageId: null,
          isLoading: false,
        };
      }

      const newMessages = session.messages.map((msg) =>
        msg.id === messageId ? { ...msg, isStreaming: false } : msg
      );

      const newSessions = new Map(state.sessions);
      newSessions.set(sessionId, {
        ...session,
        messages: newMessages,
        updatedAt: Date.now(),
      });

      return {
        ...state,
        sessions: newSessions,
        streamingMessageId: null,
        isLoading: false,
      };
    }

    case ACTIONS.SET_LOADING: {
      return {
        ...state,
        isLoading: action.payload,
      };
    }

    case ACTIONS.SET_ERROR: {
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };
    }

    case ACTIONS.CLEAR_ERROR: {
      return {
        ...state,
        error: null,
      };
    }

    case ACTIONS.UPDATE_UPLOAD_PROGRESS: {
      const newProgress = new Map(state.uploadProgress);
      newProgress.set(action.payload.fileId, action.payload.progress);
      return { ...state, uploadProgress: newProgress };
    }

    case ACTIONS.UPDATE_SESSION_TITLE: {
      const { sessionId, title } = action.payload;
      const session = state.sessions.get(sessionId);
      if (!session) return state;

      const newSessions = new Map(state.sessions);
      newSessions.set(sessionId, {
        ...session,
        title,
        updatedAt: Date.now(),
      });

      return {
        ...state,
        sessions: newSessions,
      };
    }

    case ACTIONS.UPDATE_SESSIONS_META: {
      const { ids, patch } = action.payload;
      const newSessions = new Map(state.sessions);
      for (const id of ids) {
        const session = newSessions.get(id);
        if (!session) continue;
        newSessions.set(id, { ...session, ...patch });
      }
      return { ...state, sessions: newSessions };
    }

    case ACTIONS.ADD_TAG_TO_SESSIONS: {
      const { ids, tag } = action.payload;
      const clean = (tag || "").trim();
      if (!clean) return state;
      const newSessions = new Map(state.sessions);
      for (const id of ids) {
        const session = newSessions.get(id);
        if (!session) continue;
        const tags = session.tags || [];
        if (tags.includes(clean)) continue;
        newSessions.set(id, { ...session, tags: [...tags, clean] });
      }
      return { ...state, sessions: newSessions };
    }

    case ACTIONS.REMOVE_TAG_FROM_SESSION: {
      const { sessionId, tag } = action.payload;
      const session = state.sessions.get(sessionId);
      if (!session) return state;
      const newSessions = new Map(state.sessions);
      newSessions.set(sessionId, {
        ...session,
        tags: (session.tags || []).filter((t) => t !== tag),
      });
      return { ...state, sessions: newSessions };
    }

    case ACTIONS.CREATE_FOLDER: {
      const { folder } = action.payload;
      if (!folder?.id) return state;
      return { ...state, folders: [...state.folders, folder] };
    }

    case ACTIONS.RENAME_FOLDER: {
      const { folderId, name } = action.payload;
      const clean = (name || "").trim();
      if (!clean) return state;
      return {
        ...state,
        folders: state.folders.map((f) =>
          f.id === folderId ? { ...f, name: clean } : f,
        ),
      };
    }

    case ACTIONS.DELETE_FOLDER: {
      const { folderId } = action.payload;
      // Detach sessions from the deleted folder; never delete the conversations.
      const newSessions = new Map(state.sessions);
      for (const [id, session] of state.sessions) {
        if (session.folderId === folderId) {
          newSessions.set(id, { ...session, folderId: null });
        }
      }
      return {
        ...state,
        sessions: newSessions,
        folders: state.folders.filter((f) => f.id !== folderId),
      };
    }

    case ACTIONS.MOVE_SESSIONS_TO_FOLDER: {
      const { ids, folderId } = action.payload;
      const newSessions = new Map(state.sessions);
      for (const id of ids) {
        const session = newSessions.get(id);
        if (!session) continue;
        newSessions.set(id, { ...session, folderId: folderId || null });
      }
      return { ...state, sessions: newSessions };
    }

    case ACTIONS.ADD_INTEGRATION_REQUEST: {
      const { sessionId, messageId, request } = action.payload;
      const session = state.sessions.get(sessionId);
      if (!session) return state;
      const newSessions = new Map(state.sessions);
      const newMessages = session.messages.map((msg) => {
        if (msg.id !== messageId) return msg;
        const existing = msg.integrationRequests || [];
        // Guard against duplicate ids (React key collisions)
        const safeRequest = existing.some((r) => r.id === request.id)
          ? { ...request, id: `${request.id}_${Math.random().toString(36).slice(2, 8)}` }
          : request;
        return {
          ...msg,
          integrationRequests: [...existing, safeRequest],
        };
      });
      newSessions.set(sessionId, { ...session, messages: newMessages });
      return { ...state, sessions: newSessions };
    }

    case ACTIONS.UPDATE_INTEGRATION_REQUEST: {
      const { sessionId, messageId, requestId, updates } = action.payload;
      const session = state.sessions.get(sessionId);
      if (!session) return state;
      const newSessions = new Map(state.sessions);
      const newMessages = session.messages.map((msg) => {
        if (msg.id !== messageId) return msg;
        return {
          ...msg,
          integrationRequests: (msg.integrationRequests || []).map((req) =>
            req.id === requestId ? { ...req, ...updates } : req
          ),
        };
      });
      newSessions.set(sessionId, { ...session, messages: newMessages });
      return { ...state, sessions: newSessions };
    }

    case ACTIONS.ADD_ACTION_CARD: {
      const { sessionId, messageId, card } = action.payload;
      const session = state.sessions.get(sessionId);
      if (!session) return state;
      const newSessions = new Map(state.sessions);
      const newMessages = session.messages.map((msg) => {
        if (msg.id !== messageId) return msg;
        const existing = msg.actionCards || [];
        // Guard against duplicate ids (React key collisions)
        const safeCard = existing.some((c) => c.id === card.id)
          ? { ...card, id: `${card.id}_${Math.random().toString(36).slice(2, 8)}` }
          : card;
        return {
          ...msg,
          actionCards: [...existing, safeCard],
        };
      });
      newSessions.set(sessionId, { ...session, messages: newMessages });
      return { ...state, sessions: newSessions };
    }

    case ACTIONS.UPDATE_ACTION_CARD: {
      const { sessionId, messageId, cardId, updates } = action.payload;
      const session = state.sessions.get(sessionId);
      if (!session) return state;
      const newSessions = new Map(state.sessions);
      const newMessages = session.messages.map((msg) => {
        if (msg.id !== messageId) return msg;
        return {
          ...msg,
          actionCards: (msg.actionCards || []).map((card) =>
            card.id === cardId ? { ...card, ...updates } : card
          ),
        };
      });
      newSessions.set(sessionId, { ...session, messages: newMessages });
      return { ...state, sessions: newSessions };
    }

    default:
      return state;
  }
}

export function ChatProvider({ children }) {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const { user } = useAuth();
  const previousUserIdRef = useRef(null);

  // Set user ID and load sessions when user changes
  useEffect(() => {
    const userId = user?.id || user?.email;

    // Only reload if user actually changed
    if (userId !== previousUserIdRef.current) {
      previousUserIdRef.current = userId;

      // Set user ID for scoped storage
      chatStorage.setUserId(userId);

      // Load sessions for this user. Storage is already scoped to this user,
      // so we can safely rewrite session.userId to the email — that is what
      // the backend ownership checks compare against. Also dedupe any
      // integrationRequests with colliding ids that pre-date the suffixed id.
      const stored = chatStorage.load();
      if (stored) {
        const migrated = new Map();
        for (const [id, session] of stored.sessions) {
          const needsUserIdFix = user?.email && session.userId !== user.email;
          const dedupedMessages = session.messages?.map((msg) => {
            if (!msg.integrationRequests?.length) return msg;
            const seen = new Set();
            const deduped = msg.integrationRequests.filter((r) => {
              if (seen.has(r.id)) return false;
              seen.add(r.id);
              return true;
            });
            return deduped.length === msg.integrationRequests.length
              ? msg
              : { ...msg, integrationRequests: deduped };
          });
          const messagesChanged =
            dedupedMessages && dedupedMessages !== session.messages &&
            dedupedMessages.some((m, i) => m !== session.messages[i]);
          migrated.set(
            id,
            needsUserIdFix || messagesChanged
              ? {
                  ...session,
                  ...(needsUserIdFix && { userId: user.email }),
                  ...(messagesChanged && { messages: dedupedMessages }),
                }
              : session,
          );
        }
        stored.sessions = migrated;
      }
      dispatch({
        type: ACTIONS.INIT_FROM_STORAGE,
        payload: stored || { sessions: new Map(), activeSessionId: null },
      });
    }
  }, [user]);

  // Persist to localStorage
  const persistToStorage = useCallback(() => {
    chatStorage.save(state.sessions, state.activeSessionId, state.folders);
  }, [state.sessions, state.activeSessionId, state.folders]);

  // Auto-persist when sessions or folders change.
  // Guard on hasHydrated so we never overwrite stored data before the initial
  // load has populated state — but once hydrated we always persist, even when
  // sessions and folders are both empty (e.g. deleting the last folder).
  useEffect(() => {
    if (state.hasHydrated) {
      persistToStorage();
    }
  }, [
    state.hasHydrated,
    state.sessions,
    state.activeSessionId,
    state.folders,
    persistToStorage,
  ]);

  const value = {
    state,
    dispatch,
    actions: ACTIONS,
    persistToStorage,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatContext() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChatContext must be used within a ChatProvider");
  }
  return context;
}

// Non-throwing accessor for the active conversation id. Returns null outside a
// ChatProvider (e.g. the BI mini-chat), so consumers can degrade gracefully.
export function useActiveSessionId() {
  const context = useContext(ChatContext);
  return context?.state?.activeSessionId ?? null;
}

/**
 * N'installe un ChatProvider QUE s'il n'en existe pas déjà un au-dessus.
 * Permet de monter le provider une seule fois au niveau du layout dashboard
 * (pour que l'état du chat + le flux SSE survivent à la navigation entre
 * fonctionnalités) sans casser les routes /chatbot/* qui montent ChatContainer
 * sans provider ancêtre.
 */
export function MaybeChatProvider({ children }) {
  const existing = useContext(ChatContext);
  if (existing) return children;
  return <ChatProvider>{children}</ChatProvider>;
}

export { ACTIONS };
