"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useRouter } from "@/lib/navigation";
import { MaybeChatProvider, useChatContext } from "@/contexts/ChatContext";
import { useChatSessions } from "@/hooks/useChatSessions";
import { useChat } from "@/hooks/useChat";
import { useArtifacts } from "@/hooks/useArtifacts";
import { useKnowledgeBase } from "@/hooks/useKnowledgeBase";
import { isRagSession } from "@/lib/chatStorage";
import { getSessionHistory, getAgent, createSession as apiCreateSession } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import ChatSidebar from "./ChatSidebar";
import ChatMessages from "./ChatMessages";
import ChatInput from "./ChatInput";
import AgentSelector from "./AgentSelector";
import CommandPalette from "./CommandPalette";
import AgentStatusBar from "./AgentStatusBar";
import IntegrationReconnectBanner from "./IntegrationReconnectBanner";
import ChatSessionHeader from "./ChatSessionHeader";
import ArtifactPanel from "./ArtifactPanel";
import NotificationToast from "./NotificationToast";
import SessionTabs from "./SessionTabs";
import KnowledgeWizard from "./KnowledgeWizard";
import ShortcutsHelp from "./ShortcutsHelp";
import ConfirmToast from "@/components/ConfirmToast";
import { ChatUiProvider, useChatUi } from "@/contexts/ChatUiContext";
import { useChatCommands } from "@/hooks/useChatCommands";
import { useTranslations } from "use-intl";

// Global keyboard shortcuts of the chat screen (⌘⇧O new chat, ⌘⇧F find in
// thread, ⌘/ help). ⌘K lives in the palette, "/" and Esc in the composer.
function ChatKeyboardShortcuts({ onNewChat }) {
  const ui = useChatUi();
  useEffect(() => {
    const onKey = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (e.shiftKey && key === "o") {
        e.preventDefault();
        onNewChat();
      } else if (e.shiftKey && key === "f") {
        e.preventDefault();
        ui.openThreadSearch("");
      } else if (!e.shiftKey && (e.key === "/" || e.key === "?")) {
        e.preventDefault();
        ui.setShortcutsOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onNewChat, ui]);
  return null;
}

function ChatLayout({ agentFilter, filterLabel, sessionKeywords, initialAgent, initialSession, initialDashboard }) {
  const ui = useChatUi();
  const tCommon = useTranslations("ChatContainer");
  const showAgentSelector = ui.agentPickerOpen;
  const setShowAgentSelector = ui.setAgentPickerOpen;
  const [editingText, setEditingText] = useState("");
  const CHAT_TABS = ["sources", "chat"];
  const [activeTab, setActiveTabRaw] = useState(() => {
    if (typeof window !== "undefined") {
      const h = window.location.hash.replace("#", "");
      return CHAT_TABS.includes(h) ? h : "sources";
    }
    return "sources";
  });
  const setActiveTab = useCallback((tab) => {
    window.location.hash = tab;
    setActiveTabRaw(tab);
  }, []);

  // Ref-based bridge: useChat needs onArtifactSaved, but injectArtifact
  // comes from useArtifacts which depends on messages from useChat.
  const injectRef = useRef(null);

  const handleArtifactSaved = useCallback(({ filename, language, code }) => {
    // Immediately inject artifact with code so the panel shows it in real-time    
    injectRef.current?.({ filename, language, code });
  }, []);

  const { messages, notifications, dismissNotification, isLoading } = useChat({ onArtifactSaved: handleArtifactSaved });
  const { state, dispatch, actions } = useChatContext();
  const { setActiveSession, createSession, deleteSession } = useChatSessions();
  const openAgentPicker = useCallback(() => setShowAgentSelector(true), [setShowAgentSelector]);
  const { commands, runCommand } = useChatCommands({ onNewChat: openAgentPicker });
  const router = useRouter();

  // "@agent" in the composer or a pick in the palette: start a conversation
  // with that agent, carrying over what was typed.
  const handlePickAgent = useCallback(
    async (agent, draft) => {
      if (!agent) return;
      const numericId = agent.agent_id;
      const agentId = numericId != null ? `agent${numericId}` : agent.agent_name;
      const agentName = agent.agent_name || agentId;
      let tags = [];
      try {
        tags = agent.tags ? JSON.parse(agent.tags) : [];
      } catch {
        tags = [];
      }
      if (draft) ui.setPendingComposerText(draft);
      await createSession(agentId, agentName, null, {
        agentType: agent.agent_type || "base",
        superagentTemplateId: agent.superagent_template_id || null,
        tags,
      });
    },
    [createSession, ui],
  );
  const { user } = useAuth();
  const activeSession = state.activeSessionId ? state.sessions.get(state.activeSessionId) : null;
  const isRag = isRagSession(activeSession);

  // Handle URL params for deep-linking into a specific agent/session (e.g. from webhook notifications)
  const deepLinkHandled = useRef(false);
  useEffect(() => {
    if (!initialAgent || deepLinkHandled.current) return;

    // Webhook runs are surfaced in /webhooks (Activity tab), not in
    // the chat. If the URL still points to a webhook_* session
    // (legacy notification, bookmark, manual link), redirect instead
    // of creating a chat session. Format contract with the backend
    // (see th2agent/routers/webhook_handlers/outlook.py): the suffix
    // after "webhook_" is the webhook_logs.id.
    if (
      typeof initialSession === "string" &&
      initialSession.startsWith("webhook_")
    ) {
      const tail = initialSession.slice("webhook_".length);
      const target = tail
        ? `/webhooks?log=${encodeURIComponent(tail)}`
        : "/webhooks";
      router.replace(target);
      deepLinkHandled.current = true;
      return;
    }

    deepLinkHandled.current = true;

    (async () => {
      const agentId = initialAgent; // e.g. "agent201"
      const sessionId = initialSession; // e.g. "webhook_2_xxx" or null

      // If a specific session was requested, check if it already exists locally
      if (sessionId) {
        const existing = state.sessions.get(sessionId);
        if (existing) {
          setActiveSession(sessionId);
          return;
        }

        // Session not in local state — create a local entry so messages can be loaded
        // Try to fetch agent name from API for a better title
        let agentName = agentId;
        try {
          // API expects numeric ID, agentId is like "agent201"
          const numericId = agentId.replace(/\D/g, "");
          if (numericId) {
            const agentData = await getAgent(numericId);
            agentName = agentData.agent_name || agentData.label || agentId;
          }
        } catch {
          // fallback to agentId as name
        }

        // Load session history from backend to populate messages
        const userId = user?.email || user?.id || "default_user";
        let serverMessages = [];
        try {
          const history = await getSessionHistory(agentId, String(userId), sessionId);
          // Backend returns { messages: [{ role, content, timestamp }] }
          if (history?.messages) {
            for (const msg of history.messages) {
              if (!msg.content) continue;
              serverMessages.push({
                id: `msg_${msg.role || "unknown"}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                role: msg.role === "user" ? "user" : "assistant",
                content: msg.content,
                timestamp: msg.timestamp ? msg.timestamp * 1000 : Date.now(),
                isStreaming: false,
              });
            }
          }
        } catch {
          // Session doesn't exist in ADK yet — create it so the chat works
          try {
            await apiCreateSession({
              agent_name: agentId,
              user_id: String(userId),
              session_id: sessionId,
              data: {},
            });
          } catch {
            // Session creation may also fail if agent doesn't exist — proceed with empty local session
          }
        }

        const newSession = {
          id: sessionId,
          title: `Webhook — ${agentName}`,
          agentId,
          agentName,
          userId,
          messages: serverMessages,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isBackendSynced: true,
          agentType: "base",
          superagentTemplateId: null,
          tags: [],
        };

        dispatch({ type: actions.CREATE_SESSION, payload: newSession });
        return;
      }

      // No specific session requested — just open agent selector or create a new session
      // If sessions exist for this agent, activate the most recent one
      const agentSessions = Array.from(state.sessions.values())
        .filter((s) => s.agentId === agentId)
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

      if (agentSessions.length > 0) {
        setActiveSession(agentSessions[0].id);
      } else {
        // Create a new session for this agent
        let agentName = agentId;
        try {
          const agentData = await getAgent(agentId);
          agentName = agentData.agent_name || agentData.label || agentId;
        } catch {
          // fallback
        }
        await createSession(agentId, agentName);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAgent, initialSession]);

  // Build session filter:
  //  1. Always exclude webhook_* sessions — those runs belong in the
  //     Webhooks Activity tab, not in the chat sidebar (cf
  //     th2agent/routers/webhook_handlers/outlook.py:session_id
  //     contract: f"webhook_{log_id}").
  //  2. If the page declared `sessionKeywords`, also restrict to
  //     sessions whose agent name matches.
  const sessionFilter = useMemo(() => {
    const isWebhookSession = (s) =>
      typeof s?.id === "string" && s.id.startsWith("webhook_");
    if (!sessionKeywords?.length) {
      return (session) => !isWebhookSession(session);
    }
    return (session) => {
      if (isWebhookSession(session)) return false;
      const name = (session.agentName || session.agentId || "").toLowerCase();
      return sessionKeywords.some((kw) => name.includes(kw.toLowerCase()));
    };
  }, [sessionKeywords]);

  // Clear active session if it doesn't belong to this page's filter.
  useEffect(() => {
    if (!sessionFilter || !activeSession) return;
    if (!sessionFilter(activeSession)) {
      setActiveSession(null);
    }
  }, [state.activeSessionId, sessionFilter, setActiveSession, activeSession]);

  // Knowledge base state for RAG sessions (single instance, passed as prop to KnowledgeWizard)
  const kb = useKnowledgeBase(isRag ? activeSession?.agentId : null, isRag ? activeSession?.id : null);

  // Reset tab when session changes or when sources readiness changes.
  // Skip during initial loading to avoid a flash (sources→chat) on session switch.
  const [prevTabDeps, setPrevTabDeps] = useState({ sessionId: state.activeSessionId, isRag, isReady: kb.isReady, isInitialLoading: kb.isInitialLoading });
  if (state.activeSessionId !== prevTabDeps.sessionId || isRag !== prevTabDeps.isRag || kb.isReady !== prevTabDeps.isReady || kb.isInitialLoading !== prevTabDeps.isInitialLoading) {
    setPrevTabDeps({ sessionId: state.activeSessionId, isRag, isReady: kb.isReady, isInitialLoading: kb.isInitialLoading });
    if (!isRag) {
      setActiveTab("chat");
    } else if (!kb.isInitialLoading) {
      setActiveTab(kb.isReady ? "chat" : "sources");
    }
  }

  const sessionMeta = activeSession ? {
    agentName: activeSession.agentId,
    userId: activeSession.userId,
    sessionId: activeSession.id,
  } : null;
  const { artifacts, selectedArtifact, selectArtifact, clearSelection, refreshArtifacts, injectArtifact } =
    useArtifacts(messages, sessionMeta, { autoOpen: false });

  // Keep ref in sync with latest callback
  useEffect(() => {
    injectRef.current = injectArtifact;
  });

  // The header badge and the /artifacts command read the count from the UI
  // context; a request from either opens the most recent artifact.
  useEffect(() => {
    ui.setArtifactCount(artifacts.length);
  }, [artifacts.length, ui]);
  const [seenArtifactsRequest, setSeenArtifactsRequest] = useState(ui.artifactsRequest);
  if (ui.artifactsRequest !== seenArtifactsRequest) {
    setSeenArtifactsRequest(ui.artifactsRequest);
    if (selectedArtifact) {
      clearSelection();
    } else if (artifacts.length) {
      selectArtifact(artifacts[artifacts.length - 1].id);
    }
  }

  const handleEditPrompt = useCallback((text) => {
     setEditingText(text);
  }, []);

  const handleAskAboutArtifact = useCallback((artifact) => {
    const name = artifact?.filename || artifact?.language || "this artifact";
    setEditingText(`About \`${name}\`: `);
  }, []);

  // Prefill the input when the user lands on /chat?dashboard=...
  const dashboardPrefillHandled = useRef(false);
  useEffect(() => {
    if (!initialDashboard || dashboardPrefillHandled.current) return;
    dashboardPrefillHandled.current = true;
    setEditingText(`Regarding BI dashboard \`${initialDashboard}\`: `);
  }, [initialDashboard]);

  const clearEditingText = useCallback(() => {
     setEditingText("");
  }, []);

  const handleOpenArtifact = useCallback(
    (code, language) => {
      // Try to find existing artifact by matching code content
      const match = artifacts.find(
        (a) => a.code && a.code.trimEnd() === code.trimEnd() && a.language === language,
      );
      if (match) {
        selectArtifact(match.id);
      } else {
        // Inject as ad-hoc artifact so it opens immediately in the panel
        const ext = { python: "py", javascript: "js", js: "js", typescript: "ts", tsx: "tsx", jsx: "jsx", bash: "sh", html: "html", css: "css", sql: "sql", json: "json", yaml: "yml", go: "go", ruby: "rb" }[language] || "txt";
        injectArtifact({ filename: `code.${ext}`, language, code });
      }
    },
    [artifacts, selectArtifact, injectArtifact],
  );

  return (
    <div className="h-full flex">
      {/* Sidebar with session list */}
      <ChatSidebar onNewChat={() => setShowAgentSelector(true)} sessionFilter={sessionFilter} showUserMenu={!!agentFilter} />

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* RAG session tabs */}
        {isRag && (
          <SessionTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            sourceCount={kb.sources.length}
            chatEnabled={kb.isReady}
          />
        )}

        {/* Knowledge wizard or chat content */}
        {activeTab === "sources" && isRag ? (
          <KnowledgeWizard
            key={activeSession?.id}
            agentId={activeSession?.agentId}
            onReady={() => setActiveTab("chat")}
            knowledgeBase={kb}
          />
        ) : (
          <>
            <ChatSessionHeader commands={commands} runCommand={runCommand} />
            <ChatMessages
             onEditPrompt={handleEditPrompt}
             onOpenArtifact={handleOpenArtifact}
            />
            <AgentStatusBar />
            <IntegrationReconnectBanner />
            <ChatInput
             editingText={editingText}
             onEditingTextClear={clearEditingText}
             commands={commands}
             runCommand={runCommand}
             onPickAgent={handlePickAgent}
            />
          </>
        )}
      </div>

      {/* Artifact side panel */}
      {selectedArtifact && (
        <ArtifactPanel
          artifact={selectedArtifact}
          artifacts={artifacts}
          onSelect={selectArtifact}
          onClose={clearSelection}
          onAskAbout={handleAskAboutArtifact}
          sessionMeta={sessionMeta}
        />
      )}

      {/* Command palette (⌘K) */}
      <CommandPalette
        onNewChat={openAgentPicker}
        sessionFilter={sessionFilter}
        commands={commands}
        runCommand={runCommand}
        onPickAgent={handlePickAgent}
        navigate={(href) => router.push(href)}
      />

      <ChatKeyboardShortcuts onNewChat={openAgentPicker} />
      <ShortcutsHelp open={ui.shortcutsOpen} onClose={() => ui.setShortcutsOpen(false)} />

      <ConfirmToast
        message={ui.deleteRequest ? tCommon("deleteConversationConfirm") : null}
        onConfirm={() => {
          const id = ui.deleteRequest;
          ui.clearDeleteRequest();
          if (id) deleteSession(id);
        }}
        onCancel={() => ui.clearDeleteRequest()}
      />

      {showAgentSelector && (
        <AgentSelector
          onClose={() => {
            setShowAgentSelector(false);
            ui.setAgentPickerQuery("");
          }}
          agentFilter={agentFilter}
          filterLabel={filterLabel}
          initialSearch={ui.agentPickerQuery}
        />
      )}

      {/* Notification toasts */}
      <NotificationToast
       notifications={notifications}
       onDismiss={dismissNotification}
      />
    </div>
  );
}

export default function ChatContainer({ agentFilter, filterLabel, sessionKeywords, initialAgent, initialSession, initialDashboard }) {
  return (
    <MaybeChatProvider>
      <ChatUiProvider>
      <ChatLayout
        agentFilter={agentFilter}
        filterLabel={filterLabel}
        sessionKeywords={sessionKeywords}
        initialAgent={initialAgent}
        initialDashboard={initialDashboard}
        initialSession={initialSession}
      />
      </ChatUiProvider>
    </MaybeChatProvider>
  );
}
