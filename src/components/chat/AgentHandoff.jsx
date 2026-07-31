"use client";

import { ArrowRightLeft, Bot } from "lucide-react";

export default function AgentHandoff({ handoff }) {
  if (!handoff) return null;

  return (
    <div className="flex items-center gap-2 my-2 px-3 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
      <div className="flex items-center gap-1.5 text-indigo-300">
        <Bot size={14} />
        <span className="text-xs font-medium">{handoff.from || "Agent"}</span>
      </div>
      <ArrowRightLeft size={14} className="text-indigo-400/50 shrink-0" />
      <div className="flex items-center gap-1.5 text-indigo-300">
        <Bot size={14} />
        <span className="text-xs font-medium">{handoff.to || "Sub-agent"}</span>
      </div>
      {handoff.reason && (
        <span className="text-[11px] text-indigo-300/50 ml-2 truncate">
          — {handoff.reason}
        </span>
      )}
    </div>
  );
}
