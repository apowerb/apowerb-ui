"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "use-intl";
import { Search, X, ChevronUp, ChevronDown } from "lucide-react";

/** Message ids whose text contains `query` (case-insensitive substring). */
export function findInThread(messages, query) {
  const q = (query || "").trim().toLowerCase();
  if (q.length < 2) return [];
  const out = [];
  for (const m of messages || []) {
    if (typeof m.content !== "string") continue;
    if (m.content.toLowerCase().includes(q)) out.push(m.id);
  }
  return out;
}

// Flash + scroll the matched message; the same id convention as the palette.
function reveal(messageId) {
  if (typeof document === "undefined") return;
  const el = document.getElementById(`chat-msg-${messageId}`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  const prev = el.style.boxShadow;
  el.style.transition = "box-shadow 0.3s ease";
  el.style.boxShadow = "0 0 0 2px rgba(59,130,246,0.55)";
  setTimeout(() => {
    el.style.boxShadow = prev;
  }, 1400);
}

/**
 * Find-in-thread bar (⌘⇧F). Lives above the message list; Enter / ⇧Enter walk
 * the matches, Esc closes.
 */
export default function ThreadSearchBar({ messages, query, onQueryChange, onClose }) {
  const t = useTranslations("ThreadSearch");
  const inputRef = useRef(null);
  const [cursor, setCursor] = useState(0);
  const matches = useMemo(() => findInThread(messages, query), [messages, query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // A new query restarts from the first hit.
  const [prevQuery, setPrevQuery] = useState(query);
  if (query !== prevQuery) {
    setPrevQuery(query);
    setCursor(0);
  }

  useEffect(() => {
    if (matches.length) reveal(matches[Math.min(cursor, matches.length - 1)]);
  }, [matches, cursor]);

  const step = (delta) => {
    if (!matches.length) return;
    setCursor((c) => (c + delta + matches.length) % matches.length);
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "Enter") {
      e.preventDefault();
      step(e.shiftKey ? -1 : 1);
    }
  };

  return (
    <div
      role="search"
      className="shrink-0 flex items-center gap-2 mx-4 mt-3 px-3 py-1.5 rounded-xl border th-border th-bg-surface shadow-sm"
    >
      <Search size={14} className="th-text-faint shrink-0" />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={t("placeholder")}
        aria-label={t("ariaLabel")}
        className="flex-1 min-w-0 bg-transparent outline-none text-sm th-text placeholder:th-text-ghost"
      />
      <span className="text-[11px] th-text-faint tabular-nums shrink-0" aria-live="polite">
        {query.trim().length >= 2
          ? matches.length
            ? t("position", { current: Math.min(cursor, matches.length - 1) + 1, total: matches.length })
            : t("noMatch")
          : ""}
      </span>
      <button type="button" onClick={() => step(-1)} disabled={!matches.length} className="p-1 rounded th-text-faint hover:th-text-secondary disabled:opacity-30" aria-label={t("previous")}>
        <ChevronUp size={14} />
      </button>
      <button type="button" onClick={() => step(1)} disabled={!matches.length} className="p-1 rounded th-text-faint hover:th-text-secondary disabled:opacity-30" aria-label={t("next")}>
        <ChevronDown size={14} />
      </button>
      <button type="button" onClick={onClose} className="p-1 rounded th-text-faint hover:th-text-secondary" aria-label={t("close")}>
        <X size={14} />
      </button>
    </div>
  );
}
