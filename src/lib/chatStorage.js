const BASE_STORAGE_KEY = "th2_chat";
const SCHEMA_VERSION = 1;
const MAX_MESSAGES_PER_SESSION = 100;

// Store current user ID for scoped storage
let currentUserId = null;

function getStorageKeys(userId = currentUserId) {
  const userSuffix = userId ? `_${userId}` : "";
  return {
    SESSIONS: `${BASE_STORAGE_KEY}_sessions${userSuffix}`,
    ACTIVE_SESSION: `${BASE_STORAGE_KEY}_active${userSuffix}`,
    VERSION: `${BASE_STORAGE_KEY}_version${userSuffix}`,
    FOLDERS: `${BASE_STORAGE_KEY}_folders${userSuffix}`,
  };
}

// Strip base64 data URIs and large inline data from message content before storage
function stripLargeData(content) {
  if (typeof content !== "string") return content;
  // Replace data:image/...;base64,xxxxx with a placeholder
  return content.replace(
    /data:(image|audio|video|application)\/[^;]+;base64,[A-Za-z0-9+/=\s]{200,}/g,
    "[base64 content removed for storage]"
  );
}

// Prepare sessions array for storage: limit messages and strip large data
function prepareForStorage(sessions) {
  return Array.from(sessions.values()).map((session) => ({
    ...session,
    messages: session.messages.slice(-MAX_MESSAGES_PER_SESSION).map((msg) => ({
      ...msg,
      content: stripLargeData(msg.content),
      // Also strip from parts array if present (multimodal messages)
      ...(msg.parts
        ? {
            parts: msg.parts.map((part) =>
              typeof part === "string"
                ? stripLargeData(part)
                : part?.type === "image" || part?.inlineData
                  ? { type: "image", text: "[image removed for storage]" }
                  : part
            ),
          }
        : {}),
    })),
  }));
}

export const chatStorage = {
  /**
   * Set current user ID for scoped storage
   */
  setUserId(userId) {
    currentUserId = userId;
  },

  /**
   * Get current user ID
   */
  getUserId() {
    return currentUserId;
  },

  /**
   * Load all chat data from localStorage for current user.
   * Also strips bloated base64 data from old sessions to reclaim space.
   */
  load() {
    if (typeof window === "undefined") return null;

    const keys = getStorageKeys();

    // Folders are small metadata; load independently so a sessions error
    // doesn't wipe them (and vice-versa).
    let folders = [];
    try {
      const foldersJson = localStorage.getItem(keys.FOLDERS);
      if (foldersJson) {
        const parsed = JSON.parse(foldersJson);
        if (Array.isArray(parsed)) folders = parsed;
      }
    } catch {
      folders = [];
    }

    try {
      const sessionsJson = localStorage.getItem(keys.SESSIONS);
      const activeSession = localStorage.getItem(keys.ACTIVE_SESSION);

      if (!sessionsJson)
        return { sessions: new Map(), activeSessionId: null, folders };

      const sessionsArray = JSON.parse(sessionsJson);

      // Clean up old bloated data on load (strip base64 from previously stored sessions)
      let needsCompaction = false;
      const cleanedArray = sessionsArray.map((s) => {
        if (!s.messages) return s;
        const cleanedMessages = s.messages.map((msg) => {
          const cleaned = stripLargeData(msg.content);
          if (cleaned !== msg.content) needsCompaction = true;
          return { ...msg, content: cleaned };
        });
        return { ...s, messages: cleanedMessages };
      });

      // If we stripped data, re-save the compacted version immediately
      if (needsCompaction) {
        try {
          console.info("[ChatStorage] Compacting old sessions (stripping base64)...");
          localStorage.setItem(keys.SESSIONS, JSON.stringify(cleanedArray));
        } catch {
          // If even the compacted data doesn't fit, clear and re-save
          localStorage.removeItem(keys.SESSIONS);
          try {
            localStorage.setItem(keys.SESSIONS, JSON.stringify(cleanedArray));
          } catch {
            // Last resort: clear everything
            localStorage.removeItem(keys.SESSIONS);
          }
        }
      }

      const sessions = new Map(cleanedArray.map((s) => [s.id, s]));

      // Validate active session exists
      const validActiveId =
        activeSession && sessions.has(activeSession) ? activeSession : null;

      return { sessions, activeSessionId: validActiveId, folders };
    } catch (error) {
      console.error("[ChatStorage] Failed to load from localStorage:", error);
      return { sessions: new Map(), activeSessionId: null, folders };
    }
  },

  /**
   * Save all chat data to localStorage for current user
   */
  save(sessions, activeSessionId, folders) {
    if (typeof window === "undefined") return;

    const keys = getStorageKeys();
    let sessionsArray = prepareForStorage(sessions);

    // Persist folders independently (small payload, never pruned).
    if (folders !== undefined) {
      try {
        localStorage.setItem(keys.FOLDERS, JSON.stringify(folders || []));
      } catch (error) {
        console.error("[ChatStorage] Failed to save folders:", error);
      }
    }

    // Helper: attempt a write after removing old key first to free space
    const tryWrite = (json) => {
      localStorage.removeItem(keys.SESSIONS); // free space BEFORE writing
      localStorage.setItem(keys.SESSIONS, json);
    };

    // Try to save, with progressive pruning on quota errors
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const json = JSON.stringify(sessionsArray);
        localStorage.setItem(keys.VERSION, String(SCHEMA_VERSION));
        tryWrite(json);

        if (activeSessionId) {
          localStorage.setItem(keys.ACTIVE_SESSION, activeSessionId);
        } else {
          localStorage.removeItem(keys.ACTIVE_SESSION);
        }
        return; // Success
      } catch (error) {
        if (error.name !== "QuotaExceededError") {
          console.error("[ChatStorage] Failed to save:", error);
          return;
        }

        // Progressive pruning strategies
        if (attempt === 0) {
          // 1st: reduce messages to 30 per session
          console.warn("[ChatStorage] Quota exceeded, reducing messages per session...");
          sessionsArray = sessionsArray.map((s) => ({
            ...s,
            messages: s.messages.slice(-30),
          }));
        } else if (attempt === 1) {
          // 2nd: keep only 10 messages per session
          console.warn("[ChatStorage] Still over quota, keeping only 10 messages...");
          sessionsArray = sessionsArray.map((s) => ({
            ...s,
            messages: s.messages.slice(-10),
          }));
        } else if (attempt === 2) {
          // 3rd: remove oldest 50% of sessions
          console.warn("[ChatStorage] Still over quota, removing oldest sessions...");
          sessionsArray.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
          sessionsArray = sessionsArray.slice(0, Math.max(1, Math.floor(sessionsArray.length / 2)));
        } else if (attempt === 3) {
          // 4th: keep only the active session with 5 messages
          console.warn("[ChatStorage] Still over quota, keeping only active session...");
          const active = sessionsArray.find((s) => s.id === activeSessionId);
          sessionsArray = active
            ? [{ ...active, messages: active.messages.slice(-5) }]
            : [];
        } else {
          // 5th: give up — clear storage entirely to unblock the app
          console.error("[ChatStorage] Clearing storage to unblock the application.");
          localStorage.removeItem(keys.SESSIONS);
          return;
        }
      }
    }
  },

  /**
   * Clear all chat data for current user
   */
  clear() {
    if (typeof window === "undefined") return;

    const keys = getStorageKeys();
    localStorage.removeItem(keys.SESSIONS);
    localStorage.removeItem(keys.ACTIVE_SESSION);
    localStorage.removeItem(keys.VERSION);
    localStorage.removeItem(keys.FOLDERS);
  },
};

export function isRagSession(session) {
  if (!session) return false;
  const tags = session.tags || [];
  if (tags.includes("rag")) return true;
  if (session.superagentTemplateId === "rag_agent") return true;
  const name = String(session.agentName || session.agentId || "").toLowerCase();
  return name.includes("rag_assistant") || name.includes("knowledge_assistant");
}
