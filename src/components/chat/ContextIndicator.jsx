"use client";

import { useMemo } from "react";
import { useChat } from "@/hooks/useChat";
import { Database } from "lucide-react";

const DEFAULT_MAX_TOKENS = 128000;

export default function ContextIndicator() {
  const { messages } = useChat();

  const usage = useMemo(() => {
    let totalInput = 0;
    let totalOutput = 0;
    let maxTokens = DEFAULT_MAX_TOKENS;

    for (const msg of messages) {
      if (!msg.meta?.tokens) continue;
      const t = msg.meta.tokens;
      totalInput += t.input_tokens || t.prompt_tokens || 0;
      totalOutput += t.output_tokens || t.completion_tokens || 0;
      if (t.max_tokens) maxTokens = t.max_tokens;
    }

    const total = totalInput + totalOutput;
    const pct = Math.min(100, (total / maxTokens) * 100);

    return { totalInput, totalOutput, total, maxTokens, pct };
  }, [messages]);

  if (usage.total === 0) return null;

  const barColor =
    usage.pct > 80
      ? "bg-red-500"
      : usage.pct > 50
        ? "bg-purple-400"
        : "bg-blue-500";

  return (
    <div className="flex items-center gap-2 px-3 py-1">
      <Database size={10} className="th-text-ghost shrink-0" />
      <div className="flex-1 h-1 th-bg-surface rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full transition-all duration-500`}
          style={{ width: `${usage.pct}%` }}
        />
      </div>
      <span className="text-[10px] th-text-ghost shrink-0 tabular-nums">
        {(usage.total / 1000).toFixed(1)}k / {(usage.maxTokens / 1000).toFixed(0)}k
      </span>
    </div>
  );
}
