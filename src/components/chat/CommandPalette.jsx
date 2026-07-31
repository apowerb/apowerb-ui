"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useTranslations } from "use-intl";
import { Search, MessageSquare, Plus, CornerDownLeft } from "lucide-react";
import { useChatSessions } from "@/hooks/useChatSessions";
import { useFocusTrap } from "@/hooks/useFocusTrap";

// Below this query length we only match session titles/agents, never message
// bodies — single letters would match nearly every conversation and bury the
// useful results.
const MSG_SEARCH_MIN = 2;
// Cap message hits so a chatty history never floods the list past the sessions.
const MSG_SEARCH_LIMIT = 12;

// A single-line context window around the match, with ellipses when trimmed, so
// the user sees the term in context inside the palette row.
function buildSnippet(flat, idx, qLen, pad = 48) {
  const start = Math.max(0, idx - pad);
  const end = Math.min(flat.length, idx + qLen + pad);
  return (
    (start > 0 ? "…" : "") +
    flat.slice(start, end) +
    (end < flat.length ? "…" : "")
  );
}

// Full-text search across every loaded conversation's messages. 100% front: it
// reads the already-hydrated session objects (ChatContext loads all messages
// from storage), so it makes no network call. Case-insensitive substring match
// on message content; whitespace is collapsed so multi-line bodies read as one
// line. Returns at most `limit` hits, each with a context snippet.
export function searchMessages(sessions, query, { limit = MSG_SEARCH_LIMIT, sessionFilter } = {}) {
  const q = (query || "").trim().toLowerCase();
  if (q.length < MSG_SEARCH_MIN) return [];
  const out = [];
  for (const s of sessions) {
    if (sessionFilter && !sessionFilter(s)) continue;
    for (const m of s.messages || []) {
      if (typeof m.content !== "string") continue;
      const flat = m.content.replace(/\s+/g, " ").trim();
      if (!flat) continue;
      const idx = flat.toLowerCase().indexOf(q);
      if (idx === -1) continue;
      out.push({
        domId: `cmdk-msg-${s.id}-${m.id}`,
        sessionId: s.id,
        messageId: m.id,
        sessionTitle: s.title || s.agentName || "Sans titre",
        role: m.role === "user" ? "user" : "assistant",
        snippet: buildSnippet(flat, idx, q.length),
      });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

// After jumping to a conversation, scroll the matched message into view and
// flash it so the user sees which message matched. Polls briefly for the
// element since the target session needs a render to mount it.
export function highlightMessage(messageId, attempt = 0) {
  if (!messageId || typeof document === "undefined") return;
  const el = document.getElementById(`chat-msg-${messageId}`);
  if (!el) {
    if (attempt < 20) {
      requestAnimationFrame(() => highlightMessage(messageId, attempt + 1));
    }
    return;
  }
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  const prev = el.style.backgroundColor;
  el.style.transition = "background-color 0.4s ease";
  el.style.backgroundColor = "rgba(1, 61, 255, 0.14)";
  setTimeout(() => {
    el.style.backgroundColor = prev;
  }, 1600);
}

// Cmd/Ctrl+K command palette: fuzzy-jump to a conversation, search inside
// messages, or fire a quick action. Mounted once near the chat root; manages
// its own open state.
export default function CommandPalette({ onNewChat, sessionFilter }) {
  const t = useTranslations("CommandPalette");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const activeItemRef = useRef(null);
  const modalRef = useFocusTrap(open);
  const { sessions, setActiveSession } = useChatSessions();

  // Global Cmd/Ctrl+K toggles the palette. Reset happens here (event handler),
  // never in an effect, to respect the no-setState-in-effect rule. The
  // length === 1 guard ignores dead keys / IME ("Dead", "Process").
  useEffect(() => {
    const onKey = (e) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key.length === 1 &&
        e.key.toLowerCase() === "k"
      ) {
        e.preventDefault();
        setOpen((o) => !o);
        setQuery("");
        setActiveIndex(0);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Focus the search input once open (after the focus-trap grabs the
  // container). No setState here, so the effect stays lint-clean.
  useEffect(() => {
    if (!open) return undefined;
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const actions = [];
    if (onNewChat && (!q || "nouvelle conversation new chat".includes(q))) {
      actions.push({
        domId: "cmdk-opt-action-new",
        type: "action",
        label: t("newChat"),
        run: () => {
          onNewChat();
          close();
        },
      });
    }
    const matchedSessions = sessions
      .filter((s) => !sessionFilter || sessionFilter(s))
      .filter((s) => {
        if (!q) return true;
        return (
          (s.title || "").toLowerCase().includes(q) ||
          (s.agentName || "").toLowerCase().includes(q)
        );
      })
      .slice(0, 50);
    const sessionItems = matchedSessions.map((s) => ({
      domId: `cmdk-opt-${s.id}`,
      type: "session",
      label: s.title || s.agentName || t("untitled"),
      sub: s.agentName,
      run: () => {
        setActiveSession(s.id);
        close();
      },
    }));
    // Full-text matches inside message bodies, jumping to their conversation.
    // Skip conversations already surfaced by a title/agent match above so the
    // same session never appears twice in the list.
    const shownIds = new Set(matchedSessions.map((s) => s.id));
    const messageItems = searchMessages(sessions, query, { sessionFilter })
      .filter((m) => !shownIds.has(m.sessionId))
      .map((m) => ({
        domId: m.domId,
        type: "message",
        label: m.snippet,
        sub: m.sessionTitle,
        run: () => {
          setActiveSession(m.sessionId);
          close();
          highlightMessage(m.messageId);
        },
      }));
    return [...actions, ...sessionItems, ...messageItems];
  }, [query, sessions, sessionFilter, setActiveSession, onNewChat, close, t]);

  const safeIndex = results.length ? Math.min(activeIndex, results.length - 1) : 0;

  // Keep the keyboard-selected item in view as the user arrows through.
  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ block: "nearest" });
  }, [safeIndex]);

  const onInputKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex(Math.min(safeIndex + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(Math.max(safeIndex - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      results[safeIndex]?.run();
    }
  };

  if (!open) return null;

  const activeDescendant = results[safeIndex]?.domId;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/40 backdrop-blur-sm"
      onMouseDown={close}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("paletteLabel")}
        className="w-full max-w-xl mx-4 glass-card rounded-2xl overflow-hidden shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b th-border-secondary">
          <Search size={16} className="th-text-faint shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onInputKeyDown}
            placeholder={t("searchPlaceholder")}
            className="flex-1 bg-transparent outline-none text-sm th-text-primary placeholder:th-text-ghost"
            aria-label={t("search")}
            role="combobox"
            aria-expanded="true"
            aria-controls="cmdk-listbox"
            aria-activedescendant={activeDescendant}
          />
          <kbd className="text-[10px] th-text-ghost border th-border rounded px-1.5 py-0.5">
            Esc
          </kbd>
        </div>
        <div
          id="cmdk-listbox"
          role="listbox"
          aria-label={t("results")}
          className="max-h-[50vh] overflow-y-auto custom-scrollbar py-2"
        >
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs th-text-faint">
              {t("noResults")}
            </div>
          ) : (
            results.map((r, idx) => {
              const selected = idx === safeIndex;
              return (
                <div
                  key={r.domId}
                  id={r.domId}
                  ref={selected ? activeItemRef : null}
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => r.run()}
                  className={`w-full flex items-center gap-2.5 px-4 py-2 text-left text-sm cursor-pointer transition-colors ${
                    selected ? "th-bg-surface-hover" : "hover:th-bg-surface"
                  }`}
                >
                  {r.type === "action" ? (
                    <Plus size={15} className="th-text-faint shrink-0" />
                  ) : r.type === "message" ? (
                    <Search size={15} className="th-text-faint shrink-0" />
                  ) : (
                    <MessageSquare size={15} className="th-text-faint shrink-0" />
                  )}
                  <span className="flex-1 truncate th-text-secondary">
                    {r.label}
                  </span>
                  {r.sub && (
                    <span className="text-[11px] th-text-ghost truncate max-w-[120px]">
                      {r.sub}
                    </span>
                  )}
                  {selected && (
                    <CornerDownLeft size={13} className="th-text-ghost shrink-0" />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
