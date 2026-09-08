"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useTranslations } from "use-intl";
import {
  Search,
  MessageSquare,
  Plus,
  CornerDownLeft,
  Bot,
  Hash,
  ChevronRight,
  FileCode,
  LayoutDashboard,
  Puzzle,
  Loader2,
} from "lucide-react";
import * as Icons from "lucide-react";
import { useChatSessions } from "@/hooks/useChatSessions";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useChatUi } from "@/contexts/ChatUiContext";
import { matchCommands, loadRecentCommandIds } from "@/lib/chatCommands";
import { listAgents, listArtifactLibrary, listDashboards, listSkills } from "@/lib/api";

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

/**
 * Mode from the first character of the query (VS Code convention):
 *   ">" commands only · "@" agents · "#" platform objects · otherwise everything.
 */
export function paletteMode(query) {
  const c = (query || "")[0];
  return c === ">" || c === "@" || c === "#" ? c : "";
}

function stripMode(query) {
  return paletteMode(query) ? query.slice(1) : query;
}

function iconFor(name, fallback) {
  return (name && Icons[name]) || fallback;
}

// Lazily-loaded, failure-tolerant lists of platform objects. A brick that is
// not installed answers 404: that group simply stays empty.
async function loadPlatformIndex() {
  const safe = (p) => p.then((r) => (Array.isArray(r) ? r : r?.items || r?.data || [])).catch(() => []);
  const [artifacts, dashboards, skills] = await Promise.all([
    safe(listArtifactLibrary()),
    safe(listDashboards()),
    safe(listSkills()),
  ]);
  return { artifacts, dashboards, skills };
}

async function loadAgents() {
  try {
    const r = await listAgents();
    return Array.isArray(r) ? r : [];
  } catch {
    return [];
  }
}

// Cmd/Ctrl+K command palette: fuzzy-jump to a conversation, search inside
// messages, run a command, start a chat with an agent, or open a platform
// object. Mounted once near the chat root; manages its own open state.
export default function CommandPalette({ onNewChat, sessionFilter, commands, runCommand, onPickAgent, navigate }) {
  const t = useTranslations("CommandPalette");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [agents, setAgents] = useState(null); // null = not loaded yet
  const [platform, setPlatform] = useState(null);
  const inputRef = useRef(null);
  const activeItemRef = useRef(null);
  const modalRef = useFocusTrap(open);
  const { sessions, setActiveSession } = useChatSessions();
  const ui = useChatUi();

  const openWith = useCallback((initial = "") => {
    setOpen(true);
    setQuery(initial);
    setActiveIndex(0);
  }, []);

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

  // Requests from elsewhere (the home tiles, the header) open a given mode.
  const [seenRequest, setSeenRequest] = useState(ui.paletteRequest);
  if (ui.paletteRequest !== seenRequest) {
    setSeenRequest(ui.paletteRequest);
    if (ui.paletteRequest) openWith(ui.paletteRequest.mode || "");
  }

  // Focus the search input once open (after the focus-trap grabs the
  // container). No setState here, so the effect stays lint-clean.
  useEffect(() => {
    if (!open) return undefined;
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  const mode = paletteMode(query);

  // Load agents / platform objects the first time their mode is entered.
  // "loading" is derived: a mode whose list has not arrived yet.
  const loading = open && ((mode === "@" && agents === null) || (mode === "#" && platform === null));
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    if (mode === "@" && agents === null) {
      loadAgents().then((list) => {
        if (!cancelled) setAgents(list);
      });
    }
    if (mode === "#" && platform === null) {
      loadPlatformIndex().then((idx) => {
        if (!cancelled) setPlatform(idx);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [open, mode, agents, platform]);

  const close = useCallback(() => setOpen(false), []);

  const results = useMemo(() => {
    const raw = stripMode(query);
    const q = raw.trim().toLowerCase();
    const items = [];

    const pushCommands = (limit) => {
      const list = commands?.length ? matchCommands(commands, raw, { mode: "palette", limit }) : [];
      const recent = new Set(loadRecentCommandIds());
      // Recently used first, registry order otherwise (matchCommands keeps it).
      const ordered = q ? list : [...list.filter((c) => recent.has(c.id)), ...list.filter((c) => !recent.has(c.id))];
      for (const c of ordered) {
        items.push({
          domId: `cmdk-cmd-${c.id}`,
          type: "command",
          group: "commands",
          label: c.label,
          sub: c.description || (c.slash ? `/${c.slash}` : ""),
          hint: c.shortcut,
          iconName: c.iconName,
          run: () => {
            close();
            runCommand?.(c.id, "");
          },
        });
      }
    };

    if (mode === ">") {
      pushCommands(60);
      return items;
    }

    if (mode === "@") {
      for (const a of agents || []) {
        const name = a.label || a.agent_name || "";
        const desc = a.agent_description || "";
        if (q && !name.toLowerCase().includes(q) && !desc.toLowerCase().includes(q)) continue;
        items.push({
          domId: `cmdk-agent-${a.agent_id ?? name}`,
          type: "agent",
          group: "agents",
          label: name,
          sub: desc,
          run: () => {
            close();
            onPickAgent?.(a);
          },
        });
        if (items.length >= 40) break;
      }
      return items;
    }

    if (mode === "#") {
      const add = (list, kind, labelOf, subOf, hrefOf, IconName) => {
        for (const o of list || []) {
          const label = labelOf(o) || "";
          if (q && !label.toLowerCase().includes(q)) continue;
          items.push({
            domId: `cmdk-${kind}-${o.id ?? o.slug ?? label}`,
            type: kind,
            group: kind,
            label,
            sub: subOf(o),
            iconName: IconName,
            run: () => {
              close();
              navigate?.(hrefOf(o));
            },
          });
          if (items.length >= 60) return;
        }
      };
      add(platform?.artifacts, "artifact", (o) => o.filename || o.name, (o) => o.agent_name || o.session_id || "", (o) => "/artifacts", "FileCode");
      add(platform?.dashboards, "dashboard", (o) => o.title || o.name, (o) => o.description || "", (o) => `/bi/${o.id ?? o.slug ?? ""}`, "LayoutDashboard");
      add(platform?.skills, "skill", (o) => o.name || o.skill_name, (o) => o.description || "", () => "/agents", "Puzzle");
      return items;
    }

    // Default mode: New chat, then sessions, a few commands, then message hits.
    if (onNewChat && (!q || "nouvelle conversation new chat".includes(q))) {
      items.push({
        domId: "cmdk-opt-action-new",
        type: "action",
        group: "actions",
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
    for (const s of matchedSessions) {
      items.push({
        domId: `cmdk-opt-${s.id}`,
        type: "session",
        group: "sessions",
        label: s.title || s.agentName || t("untitled"),
        sub: s.agentName,
        run: () => {
          setActiveSession(s.id);
          close();
        },
      });
    }
    if (q && commands?.length) {
      // A handful of matching commands, so ">" is a convenience, not a requirement.
      const before = items.length;
      pushCommands(5);
      // pushCommands appends at the end — fine, sessions stay first.
      void before;
    }
    // Full-text matches inside message bodies, jumping to their conversation.
    // Skip conversations already surfaced by a title/agent match above so the
    // same session never appears twice in the list.
    const shownIds = new Set(matchedSessions.map((s) => s.id));
    const messageItems = searchMessages(sessions, raw, { sessionFilter })
      .filter((m) => !shownIds.has(m.sessionId))
      .map((m) => ({
        domId: m.domId,
        type: "message",
        group: "messages",
        label: m.snippet,
        sub: m.sessionTitle,
        run: () => {
          setActiveSession(m.sessionId);
          close();
          highlightMessage(m.messageId);
        },
      }));
    return [...items, ...messageItems];
  }, [query, mode, sessions, sessionFilter, setActiveSession, onNewChat, close, t, commands, runCommand, agents, platform, onPickAgent, navigate]);

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
  const modeChips = [
    { key: ">", label: t("modeCommands") },
    { key: "@", label: t("modeAgents") },
    { key: "#", label: t("modePlatform") },
  ];
  const placeholder =
    mode === ">" ? t("placeholderCommands") : mode === "@" ? t("placeholderAgents") : mode === "#" ? t("placeholderPlatform") : t("searchPlaceholder");

  const GroupIcon = ({ item }) => {
    if (item.type === "action") return <Plus size={15} className="th-text-faint shrink-0" />;
    if (item.type === "message") return <Search size={15} className="th-text-faint shrink-0" />;
    if (item.type === "agent") return <Bot size={15} className="text-brand shrink-0" />;
    if (item.type === "artifact") return <FileCode size={15} className="th-text-faint shrink-0" />;
    if (item.type === "dashboard") return <LayoutDashboard size={15} className="th-text-faint shrink-0" />;
    if (item.type === "skill") return <Puzzle size={15} className="th-text-faint shrink-0" />;
    if (item.type === "command") {
      const Icon = iconFor(item.iconName, ChevronRight);
      return <Icon size={15} className="text-brand shrink-0" />;
    }
    return <MessageSquare size={15} className="th-text-faint shrink-0" />;
  };

  let lastGroup = null;

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
          {mode ? (
            <span className="text-xs font-bold text-brand w-4 text-center shrink-0">{mode}</span>
          ) : (
            <Search size={16} className="th-text-faint shrink-0" />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onInputKeyDown}
            placeholder={placeholder}
            className="flex-1 bg-transparent outline-none text-sm th-text-primary placeholder:th-text-ghost"
            aria-label={t("search")}
            role="combobox"
            aria-expanded="true"
            aria-controls="cmdk-listbox"
            aria-activedescendant={activeDescendant}
          />
          {loading && <Loader2 size={14} className="animate-spin th-text-faint" />}
          <kbd className="text-[10px] th-text-ghost border th-border rounded px-1.5 py-0.5">
            Esc
          </kbd>
        </div>
        {/* Mode chips */}
        <div className="flex items-center gap-1.5 px-4 py-1.5 border-b th-border-secondary">
          {modeChips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => {
                setQuery(mode === c.key ? "" : c.key);
                setActiveIndex(0);
                inputRef.current?.focus();
              }}
              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors ${
                mode === c.key ? "bg-brand/20 text-brand" : "th-text-ghost hover:th-text-muted hover:th-bg-surface"
              }`}
            >
              <span className="font-mono mr-1">{c.key}</span>
              {c.label}
            </button>
          ))}
        </div>
        <div
          id="cmdk-listbox"
          role="listbox"
          aria-label={t("results")}
          className="max-h-[50vh] overflow-y-auto custom-scrollbar py-2"
        >
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs th-text-faint">
              {loading ? t("loading") : t("noResults")}
            </div>
          ) : (
            results.map((r, idx) => {
              const selected = idx === safeIndex;
              const showGroup = mode !== "" && r.group !== lastGroup;
              lastGroup = r.group;
              return (
                <div key={r.domId}>
                  {showGroup && (
                    <div className="px-4 pt-2 pb-1 text-[10px] font-bold uppercase tracking-[0.16em] th-text-ghost">
                      {t(`group_${r.group}`)}
                    </div>
                  )}
                  <div
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
                    <GroupIcon item={r} />
                    <span className="flex-1 truncate th-text-secondary">
                      {r.label}
                    </span>
                    {r.sub && (
                      <span className="text-[11px] th-text-ghost truncate max-w-[160px]">{r.sub}</span>
                    )}
                    {r.hint && (
                      <kbd className="text-[10px] th-text-ghost border th-border rounded px-1 py-0.5 font-mono">{r.hint}</kbd>
                    )}
                    {selected && (
                      <CornerDownLeft size={13} className="th-text-ghost shrink-0" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
        {!mode && (
          <div className="px-4 py-2 border-t th-border-secondary text-[10px] th-text-ghost flex items-center gap-3">
            <span><kbd className="font-mono">{">"}</kbd> {t("hintCommands")}</span>
            <span><kbd className="font-mono">@</kbd> {t("hintAgents")}</span>
            <span><kbd className="font-mono">#</kbd> {t("hintPlatform")}</span>
          </div>
        )}
      </div>
    </div>
  );
}
