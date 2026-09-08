"use client";

import { createContext, useContext, useMemo, useState, useCallback } from "react";

/**
 * Cross-component UI signals of the chat screen: "open the share dialog",
 * "search the thread for …", "start renaming the title". They are not
 * conversation data (that is ChatContext) — just what the header, the
 * palette, the composer's `/` menu and the keyboard shortcuts need to reach
 * the same dialogs. Every field has a no-op default so components render
 * fine outside the provider (tests, the BI mini-chat).
 */
const ChatUiContext = createContext(null);

const noop = () => {};
const DEFAULTS = {
  threadSearch: { open: false, query: "" },
  openThreadSearch: noop,
  closeThreadSearch: noop,
  setThreadSearchQuery: noop,
  shareOpen: false,
  setShareOpen: noop,
  shortcutsOpen: false,
  setShortcutsOpen: noop,
  renameRequest: 0,
  requestRename: noop,
  agentPickerOpen: false,
  setAgentPickerOpen: noop,
  artifactsRequest: 0,
  requestArtifacts: noop,
  artifactCount: 0,
  setArtifactCount: noop,
  pendingComposerText: null,
  setPendingComposerText: noop,
  agentPickerQuery: "",
  setAgentPickerQuery: noop,
  deleteRequest: null,
  requestDelete: noop,
  clearDeleteRequest: noop,
  paletteRequest: null,
  requestPalette: noop,
};

export function ChatUiProvider({ children }) {
  const [threadSearch, setThreadSearch] = useState({ open: false, query: "" });
  const [shareOpen, setShareOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [renameRequest, setRenameRequest] = useState(0);
  const [agentPickerOpen, setAgentPickerOpen] = useState(false);
  const [artifactsRequest, setArtifactsRequest] = useState(0);
  const [artifactCount, setArtifactCount] = useState(0);
  const [pendingComposerText, setPendingComposerText] = useState(null);
  const [agentPickerQuery, setAgentPickerQuery] = useState("");
  const [deleteRequest, setDeleteRequest] = useState(null);
  // { mode: "" | ">" | "@" | "#", nonce } — a nonce so repeated requests re-open.
  const [paletteRequest, setPaletteRequest] = useState(null);

  const openThreadSearch = useCallback((query = "") => setThreadSearch({ open: true, query }), []);
  const closeThreadSearch = useCallback(() => setThreadSearch({ open: false, query: "" }), []);
  const setThreadSearchQuery = useCallback((query) => setThreadSearch((s) => ({ ...s, query })), []);
  const requestRename = useCallback(() => setRenameRequest((n) => n + 1), []);
  const requestArtifacts = useCallback(() => setArtifactsRequest((n) => n + 1), []);
  const requestDelete = useCallback((sessionId) => setDeleteRequest(sessionId || null), []);
  const clearDeleteRequest = useCallback(() => setDeleteRequest(null), []);
  const requestPalette = useCallback((mode = "") => setPaletteRequest({ mode, nonce: Date.now() }), []);

  const value = useMemo(
    () => ({
      threadSearch,
      openThreadSearch,
      closeThreadSearch,
      setThreadSearchQuery,
      shareOpen,
      setShareOpen,
      shortcutsOpen,
      setShortcutsOpen,
      renameRequest,
      requestRename,
      agentPickerOpen,
      setAgentPickerOpen,
      artifactsRequest,
      requestArtifacts,
      artifactCount,
      setArtifactCount,
      pendingComposerText,
      setPendingComposerText,
      agentPickerQuery,
      setAgentPickerQuery,
      deleteRequest,
      requestDelete,
      clearDeleteRequest,
      paletteRequest,
      requestPalette,
    }),
    [
      threadSearch,
      openThreadSearch,
      closeThreadSearch,
      setThreadSearchQuery,
      shareOpen,
      shortcutsOpen,
      renameRequest,
      requestRename,
      agentPickerOpen,
      artifactsRequest,
      requestArtifacts,
      artifactCount,
      pendingComposerText,
      agentPickerQuery,
      deleteRequest,
      requestDelete,
      clearDeleteRequest,
      paletteRequest,
      requestPalette,
    ],
  );

  return <ChatUiContext.Provider value={value}>{children}</ChatUiContext.Provider>;
}

export function useChatUi() {
  return useContext(ChatUiContext) || DEFAULTS;
}
