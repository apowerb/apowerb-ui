"use client";

import { useCallback, useMemo } from "react";
import { useTranslations, useLocale } from "use-intl";
import { useTheme } from "next-themes";
import { useRouter } from "@/lib/navigation";
import { useChatSessions } from "@/hooks/useChatSessions";
import { useChat } from "@/hooks/useChat";
import { useChatUi } from "@/contexts/ChatUiContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/Toast";
import { isAdminUser } from "@/lib/roles";
import { reloadAgent } from "@/lib/api";
import { buildJumpUrl } from "@/lib/jumps";
import { buildCommands, recordRecentCommand } from "@/lib/chatCommands";
import {
  formatConversationMarkdown,
  conversationToJson,
  exportFilename,
  downloadText,
} from "@/lib/conversationExport";
import { locales } from "@/i18n/locales";

function persistLocale(loc) {
  document.cookie = `NEXT_LOCALE=${loc}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * Binds the pure command registry to the live chat: sessions, streaming,
 * dialogs, navigation, theme and language. Called once by ChatContainer; the
 * palette, the composer's `/` menu and the keyboard shortcuts receive the
 * result as props, which keeps them testable with plain data.
 */
export function useChatCommands({ onNewChat } = {}) {
  const t = useTranslations("ChatCommands");
  const locale = useLocale();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const toast = useToast();
  const { user } = useAuth();
  const ui = useChatUi();
  const {
    activeSession,
    updateSessionTitle,
    pinSessions,
    archiveSessions,
  } = useChatSessions();
  const { messages, streamingMessageId, regenerate, continueResponse, abortStreaming } = useChat();

  const ctx = useMemo(
    () => ({
      activeSession: activeSession ? { ...activeSession, messages } : null,
      isStreaming: !!streamingMessageId,
      isAdmin: isAdminUser(user),
      artifactCount: ui.artifactCount,
      newChat: () => (onNewChat ? onNewChat() : ui.setAgentPickerOpen(true)),
      renameSession: (id, title) => updateSessionTitle(id, title),
      startRename: () => ui.requestRename(),
      pinSession: (id, pinned) => pinSessions([id], pinned),
      archiveSession: (id, archived) => archiveSessions([id], archived),
      deleteSession: (id) => ui.requestDelete(id),
      copyConversation: async () => {
        if (!activeSession) return;
        try {
          await navigator.clipboard.writeText(
            formatConversationMarkdown(activeSession, messages, {
              agent: t("exportAgent"),
              date: t("exportDate"),
              user: t("exportUser"),
              assistant: t("exportAssistant"),
              toolCalls: (n) => t("exportToolCalls", { count: n }),
              interrupted: t("exportInterrupted"),
              empty: t("exportEmpty"),
            }),
          );
          toast.success(t("copiedToast"));
        } catch {
          toast.error(t("copyFailedToast"));
        }
      },
      downloadConversation: (format) => {
        if (!activeSession) return;
        if (format === "json") {
          downloadText(exportFilename(activeSession, "json"), conversationToJson(activeSession, messages), "application/json");
        } else {
          downloadText(
            exportFilename(activeSession, "md"),
            formatConversationMarkdown(activeSession, messages, {
              agent: t("exportAgent"),
              date: t("exportDate"),
              user: t("exportUser"),
              assistant: t("exportAssistant"),
              toolCalls: (n) => t("exportToolCalls", { count: n }),
              interrupted: t("exportInterrupted"),
              empty: t("exportEmpty"),
            }),
            "text/markdown",
          );
        }
        toast.success(t("downloadedToast"));
      },
      shareConversation: () => ui.setShareOpen(true),
      searchThread: (query) => ui.openThreadSearch(query || ""),
      regenerateLast: () => regenerate(),
      continueLast: () => continueResponse(),
      stopStreaming: () => abortStreaming(),
      toggleArtifacts: () => ui.requestArtifacts(),
      switchAgent: (query) => {
        ui.setAgentPickerQuery(query || "");
        ui.setAgentPickerOpen(true);
      },
      reloadAgent: async () => {
        if (!activeSession?.agentId) return;
        try {
          await reloadAgent(activeSession.agentId);
          toast.success(t("agentReloadedToast"));
        } catch (err) {
          toast.error(t("agentReloadFailedToast", { message: err?.message || "" }));
        }
      },
      navigate: (path, params) => {
        if (params && Object.keys(params).length) {
          const qs = new URLSearchParams(params).toString();
          router.push(`${path}?${qs}`);
        } else {
          router.push(path);
        }
      },
      jump: (kind, params) => router.push(buildJumpUrl(kind, params)),
      toggleTheme: () => setTheme(theme === "light" ? "dark" : "light"),
      setLocale: (loc) => {
        const target = locales.includes(loc) ? loc : locale === "fr" ? "en" : "fr";
        if (target === locale) return;
        persistLocale(target);
        router.refresh();
      },
      openShortcuts: () => ui.setShortcutsOpen(true),
    }),
    [
      activeSession,
      messages,
      streamingMessageId,
      user,
      ui,
      onNewChat,
      updateSessionTitle,
      pinSessions,
      archiveSessions,
      regenerate,
      continueResponse,
      abortStreaming,
      router,
      theme,
      setTheme,
      locale,
      toast,
      t,
    ],
  );

  const commands = useMemo(() => buildCommands(ctx, t), [ctx, t]);

  const runCommand = useCallback(
    (id, args) => {
      const cmd = commands.find((c) => c.id === id);
      if (!cmd) return false;
      recordRecentCommand(id);
      cmd.run(args);
      return true;
    },
    [commands],
  );

  return { commands, runCommand, ctx };
}
