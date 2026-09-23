"use client";

import { useTranslations } from "use-intl";
import { NODE_ICONS } from "./nodeIcons";

/**
 * Ghost chips offered next to the selected node: the two or three types
 * that usually follow it. One click adds the node, wires it — on the named
 * branch when there is one — and pre-fills what it reads. Purely
 * presentational: the rules live in lib/nextNodeSuggestions.
 */
export default function NextNodeSuggestions({ suggestions, onPick }) {
  const t = useTranslations("WorkflowPalette");
  const tNext = useTranslations("WorkflowCanvas");
  if (!suggestions?.length) return null;
  return (
    <div className="flex flex-col gap-1 w-44">
      <p className="text-[10px] font-semibold th-text-ghost uppercase tracking-wide">{tNext("nextStep")}</p>
      {suggestions.map((s) => {
        const Icon = NODE_ICONS[s.type];
        return (
          <button
            key={`${s.type}-${s.route || ""}`}
            type="button"
            onClick={() => onPick(s)}
            title={tNext("nextStepHelp")}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-dashed th-border-secondary th-bg-elevated/70 hover:th-bg-surface-hover th-text-secondary hover:th-text text-[11px] backdrop-blur-sm"
          >
            {Icon && <Icon size={12} aria-hidden="true" />}
            <span className="font-semibold">{t(`node${s.type.charAt(0).toUpperCase()}${s.type.slice(1)}`)}</span>
            {s.route && <span className="ml-auto px-1 rounded th-bg-surface text-[10px] font-mono th-text-faint">{s.route}</span>}
          </button>
        );
      })}
    </div>
  );
}
