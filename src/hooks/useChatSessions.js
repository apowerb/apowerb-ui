"use client";

import { useCallback } from "react";
import { useChatContext, ACTIONS } from "@/contexts/ChatContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  createSession as apiCreateSession,
  deleteSession as apiDeleteSession,
} from "@/lib/api";
import { removeDraft } from "@/lib/chatDrafts";

export function useChatSessions() {
  const { state, dispatch, persistToStorage } = useChatContext();
  const { user } = useAuth();

  const createSession = useCallback(
    async (agentId, agentName, userId = null, agentMeta = {}) => {
      // Backend ownership checks compare user_id against current_user.email,
      // so email MUST take precedence over the UUID in user.id.
      const effectiveUserId =
        userId || user?.email || user?.id || "default_user";
      const sessionId = `session_${Date.now()}`;

      const strUserId = String(effectiveUserId);
      // Create on backend first
      try {
        await apiCreateSession({
          agent_name: agentId,
          user_id: strUserId,
          session_id: sessionId,
        });
      } catch (error) {
        console.warn(
          "[useChatSessions] Backend session creation failed, continuing with local:",
          error,
        );
      }

      const newSession = {
        id: sessionId,
        title: agentName,
        agentId,
        agentName,
        userId: effectiveUserId,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isBackendSynced: true,
        agentType: agentMeta.agentType || "base",
        superagentTemplateId: agentMeta.superagentTemplateId || null,
        tags: agentMeta.tags || [],
      };

      dispatch({ type: ACTIONS.CREATE_SESSION, payload: newSession });

      return sessionId;
    },
    [dispatch, user],
  );

  const deleteSessionById = useCallback(
    async (sessionId) => {
      const session = state.sessions.get(sessionId);
      if (!session) return;

      // Delete from backend
      try {
        await apiDeleteSession(session.agentId, session.userId, sessionId);
      } catch (error) {
        console.warn(
          "[useChatSessions] Backend session deletion failed:",
          error,
        );
      }

      dispatch({ type: ACTIONS.DELETE_SESSION, payload: sessionId });
      removeDraft(sessionId); // don't leave the deleted thread's draft behind
    },
    [state.sessions, dispatch],
  );

  const deleteSessions = useCallback(
    async (sessionIds) => {
      const ids = Array.from(sessionIds || []);
      if (!ids.length) return;
      await Promise.allSettled(ids.map((id) => deleteSessionById(id)));
    },
    [deleteSessionById],
  );

  const pinSessions = useCallback(
    (sessionIds, pinned) => {
      const ids = Array.from(sessionIds || []);
      if (!ids.length) return;
      dispatch({
        type: ACTIONS.UPDATE_SESSIONS_META,
        payload: { ids, patch: { pinned } },
      });
    },
    [dispatch],
  );

  const archiveSessions = useCallback(
    (sessionIds, archived) => {
      const ids = Array.from(sessionIds || []);
      if (!ids.length) return;
      dispatch({
        type: ACTIONS.UPDATE_SESSIONS_META,
        payload: { ids, patch: { archived } },
      });
    },
    [dispatch],
  );

  const addTagToSessions = useCallback(
    (sessionIds, tag) => {
      const ids = Array.from(sessionIds || []);
      if (!ids.length || !tag?.trim()) return;
      dispatch({
        type: ACTIONS.ADD_TAG_TO_SESSIONS,
        payload: { ids, tag: tag.trim() },
      });
    },
    [dispatch],
  );

  const removeTag = useCallback(
    (sessionId, tag) => {
      dispatch({
        type: ACTIONS.REMOVE_TAG_FROM_SESSION,
        payload: { sessionId, tag },
      });
    },
    [dispatch],
  );

  const createFolder = useCallback(
    (name) => {
      const clean = (name || "").trim();
      if (!clean) return null;
      const folder = {
        id: `folder_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: clean,
        createdAt: Date.now(),
      };
      dispatch({ type: ACTIONS.CREATE_FOLDER, payload: { folder } });
      return folder.id;
    },
    [dispatch],
  );

  const renameFolder = useCallback(
    (folderId, name) => {
      if (!name?.trim()) return;
      dispatch({
        type: ACTIONS.RENAME_FOLDER,
        payload: { folderId, name: name.trim() },
      });
    },
    [dispatch],
  );

  const deleteFolder = useCallback(
    (folderId) => {
      dispatch({ type: ACTIONS.DELETE_FOLDER, payload: { folderId } });
    },
    [dispatch],
  );

  const moveSessionsToFolder = useCallback(
    (sessionIds, folderId) => {
      const ids = Array.from(sessionIds || []);
      if (!ids.length) return;
      dispatch({
        type: ACTIONS.MOVE_SESSIONS_TO_FOLDER,
        payload: { ids, folderId: folderId || null },
      });
    },
    [dispatch],
  );

  const setActiveSession = useCallback(
    (sessionId) => {
      dispatch({ type: ACTIONS.SET_ACTIVE_SESSION, payload: sessionId });
    },
    [dispatch],
  );

  const updateSessionTitle = useCallback(
    (sessionId, title) => {
      dispatch({
        type: ACTIONS.UPDATE_SESSION_TITLE,
        payload: { sessionId, title },
      });
    },
    [dispatch],
  );

  const sessions = Array.from(state.sessions.values());
  const activeSession = state.activeSessionId
    ? state.sessions.get(state.activeSessionId)
    : null;

  return {
    sessions,
    folders: state.folders || [],
    activeSessionId: state.activeSessionId,
    activeSession,
    createSession,
    deleteSession: deleteSessionById,
    deleteSessions,
    pinSessions,
    archiveSessions,
    addTagToSessions,
    removeTag,
    createFolder,
    renameFolder,
    deleteFolder,
    moveSessionsToFolder,
    setActiveSession,
    updateSessionTitle,
  };
}
