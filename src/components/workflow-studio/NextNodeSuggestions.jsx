"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useTranslations } from "use-intl";
import { NODE_ICONS } from "./nodeIcons";

/**
 * Ghost chips offered next to the selected node: the two or three types
 * that usually follow it. One click adds the node, wires it — on the named
 * branch when there is one — and pre-fills what it reads. Purely
 * presentational: the rules live in lib/nextNodeSuggestions.
 *
 * `ai`, when the server serves model suggestions, adds a button asking for
 * them; the chips it brings back are marked and explain themselves on hover.
 */
export default function NextNodeSuggestions({ suggestions, onPick, ai }) {
  const t = useTranslations("WorkflowPalette");
  const tNext = useTranslations("WorkflowCanvas");
  if (!suggestions?.length) return null;
  return (
    <div className="flex flex-col gap-1 w-44">
      <p className="text-[10px] font-semibold th-text-ghost uppercase tracking-wide">{tNext("nextStep")}</p>
      {suggestions.map((s) => {
        const Icon = NODE_ICONS[s.type];
        const fromAi = s.source === "ai";
        const help = fromAi ? [s.label, s.reason].filter(Boolean).join(" — ") || tNext("aiBadge") : tNext("nextStepHelp");
        return (
          <button
            key={`${s.source || "rule"}-${s.type}-${s.route || ""}`}
            type="button"
            onClick={() => onPick(s)}
            title={help}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border th-bg-elevated/70 hover:th-bg-surface-hover th-text-secondary hover:th-text text-[11px] backdrop-blur-sm ${
              fromAi ? "border-sky-400/50" : "border-dashed th-border-secondary"
            }`}
          >
            {Icon && <Icon size={12} aria-hidden="true" />}
            <span className="font-semibold">{t(`node${s.type.charAt(0).toUpperCase()}${s.type.slice(1)}`)}</span>
            {s.route && <span className="ml-auto px-1 rounded th-bg-surface text-[10px] font-mono th-text-faint">{s.route}</span>}
            {fromAi && <Sparkles size={11} className={`${s.route ? "" : "ml-auto "}text-sky-400`} aria-label={tNext("aiBadge")} />}
          </button>
        );
      })}
      {ai?.enabled && <AiRow ai={ai} />}
    </div>
  );
}

function AiRow({ ai }) {
  const tNext = useTranslations("WorkflowCanvas");
  const note = (key) => <p className="text-[10px] th-text-faint leading-snug">{tNext(key)}</p>;
  if (ai.status === "quota") return note("aiQuota");
  if (ai.status === "done") return ai.count ? null : note("aiNone");
  const loading = ai.status === "loading";
  return (
    <>
      {ai.status === "unavailable" && note("aiUnavailable")}
      <button
        type="button"
        onClick={ai.onRequest}
        disabled={loading}
        title={tNext("aiSuggestHelp")}
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-sky-400/40 th-bg-elevated/70 hover:th-bg-surface-hover th-text-secondary hover:th-text text-[11px] disabled:opacity-60"
      >
        {loading ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <Sparkles size={12} className="text-sky-400" aria-hidden="true" />}
        <span>{tNext(loading ? "aiLoading" : ai.status === "unavailable" ? "aiRetry" : "aiSuggest")}</span>
      </button>
    </>
  );
}
