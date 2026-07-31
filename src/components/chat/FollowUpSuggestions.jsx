"use client";

import { useMemo, useRef } from "react";
import { Sparkles } from "lucide-react";

// A real fenced code block: ``` + optional language + newline + content + ```.
// Avoids matching an inline ``` mentioned in prose.
const CODE_BLOCK_RE = /```[\w-]*\n[\s\S]*?```/;
// A markdown table: a row of cells followed by a separator row (|---|:--:|).
// The separator's mandatory dash excludes prose pipes like "| grep | sort |".
const MD_TABLE_RE = /\|.*\|.*\n\s*\|?[ :|-]*-[ :|-]*\|/;
const LIST_RE = /(^|\n)\s*([-*+]|\d+\.)\s+/;

// Localized suggestion strings. The set is chosen from the user's language so
// the chips speak whatever the user speaks.
const SUGGESTIONS = {
  fr: {
    groupLabel: "Questions de suivi suggérées",
    code: "Explique ce code pas à pas",
    table: "Visualise ces données en graphique",
    long: "Résume l'essentiel en 3 points",
    list: "Détaille le premier point",
    generic: [
      "Approfondis ce point",
      "Donne un exemple concret",
      "Quelles sont les limites ?",
    ],
  },
  en: {
    groupLabel: "Suggested follow-ups",
    code: "Walk me through this code",
    table: "Chart this data",
    long: "Summarize the key points",
    list: "Expand on the first point",
    generic: ["Go deeper", "Give a concrete example", "What are the limitations?"],
  },
};

// French stopwords (incl. common non-accented tokens). Tokens that are ambiguous
// between FR and EN ("a", "on", "in", "i", "we") are deliberately excluded from
// EN below so they don't drag French text toward English.
const FR_WORDS =
  /\b(le|la|les|un|une|des|du|de|et|est|que|qui|pour|avec|dans|sur|pas|ca|vous|je|nous|comment|pourquoi|quel|quelle|peux|fais|donne|merci|ok|oui|non|bon|bien|voila|alors|donc|stp|svp|salut|tres|aussi|cette|mon|mes|tes|ses|plus|tout|tous)\b/g;
const EN_WORDS =
  /\b(the|is|are|and|to|of|for|with|not|you|how|why|what|which|can|do|does|give|make|please|your|this|that|have|will|about|would|should)\b/g;

// Lightweight FR/EN detector. French diacritics are a strong, cheap signal;
// otherwise weigh stopwords. Ties (and signal-less input) fall to French,
// matching the FR-first audience. Truly empty input defaults to English.
export function detectLang(text) {
  const t = (typeof text === "string" ? text : "").toLowerCase();
  if (!t.trim()) return "en";
  if (/[àâäçéèêëîïôöùûüœ]/.test(t)) return "fr";
  const fr = (t.match(FR_WORDS) || []).length;
  const en = (t.match(EN_WORDS) || []).length;
  return fr >= en ? "fr" : "en";
}

// Heuristic follow-up suggestions derived from the assistant's last reply.
// Front-only (no backend/LLM call): contextual chips first, then generics,
// capped at 4. `lang` picks the localized strings.
export function suggestFollowUps(content, lang = "en") {
  const text = typeof content === "string" ? content : "";
  if (!text.trim()) return [];

  const L = SUGGESTIONS[lang] || SUGGESTIONS.en;
  const out = [];
  const push = (s) => {
    if (out.length < 4 && !out.includes(s)) out.push(s);
  };

  // Contextual (language-agnostic detection, localized label)
  if (CODE_BLOCK_RE.test(text)) push(L.code);
  if (MD_TABLE_RE.test(text)) push(L.table);
  if (text.length > 600) push(L.long);
  if (LIST_RE.test(text)) push(L.list);

  // Generic fallbacks
  for (const g of L.generic) push(g);

  return out;
}

export default function FollowUpSuggestions({ content, userText, onSelect, disabled }) {
  // Pick the language from what the user wrote; fall back to the reply.
  const lang = useMemo(() => detectLang(userText || content), [userText, content]);
  const suggestions = useMemo(() => suggestFollowUps(content, lang), [content, lang]);
  // Synchronous one-shot guard: blocks a rapid double-click before React can
  // re-render and disable the chips. Reset per message via the parent's `key`.
  const sentRef = useRef(false);

  if (!suggestions.length) return null;

  const handlePick = (s) => {
    if (sentRef.current || disabled) return;
    sentRef.current = true;
    onSelect(s);
  };

  return (
    <div
      className="flex flex-wrap gap-2 mt-3 mb-1"
      role="group"
      aria-label={SUGGESTIONS[lang]?.groupLabel || SUGGESTIONS.en.groupLabel}
    >
      {suggestions.map((s) => (
        <button
          key={s}
          type="button"
          disabled={disabled}
          onClick={() => handlePick(s)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full th-bg-surface border th-border th-text-muted hover:th-bg-surface-hover hover:th-text-secondary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Sparkles size={12} className="th-text-faint shrink-0" />
          {s}
        </button>
      ))}
    </div>
  );
}
