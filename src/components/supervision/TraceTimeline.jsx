"use client";

import { Clock, Wrench, Bot, Layers, Zap, Hash } from "lucide-react";
import TraceStep from "./TraceStep";

function formatDuration(ms) {
  if (ms == null) return null;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export default function TraceTimeline({ trace }) {
  if (!trace || !trace.steps) return null;

  const totalSteps = trace.steps.length;
  const toolCalls = trace.steps.filter((s) => s.type === "tool_call").length;
  const totalTokens = trace.total_tokens ?? null;
  const duration = trace.total_duration_ms ?? null;
  const agents = [
    ...new Set(
      trace.steps.map((s) => s.author).filter((a) => a && a !== "user")
    ),
  ];

  return (
    <div className="p-4 space-y-2">
      {/* Summary Badges */}
      <div className="flex flex-wrap gap-2 mb-4">
        <SummaryBadge icon={Hash} label={`${totalSteps} steps`} color="amber" />
        {toolCalls > 0 && (
          <SummaryBadge
            icon={Wrench}
            label={`${toolCalls} tool calls`}
            color="cyan"
          />
        )}
        {totalTokens != null && (
          <SummaryBadge
            icon={Zap}
            label={`${totalTokens.toLocaleString()} tokens`}
            color="purple"
          />
        )}
        {duration != null && (
          <SummaryBadge
            icon={Clock}
            label={formatDuration(duration)}
            color="green"
          />
        )}
        {agents.length > 0 && (
          <SummaryBadge
            icon={Bot}
            label={`${agents.length} agent${agents.length !== 1 ? "s" : ""}`}
            color="indigo"
          />
        )}
        {agents.length > 0 && (
          <div className="flex flex-wrap gap-1 items-center ml-1">
            {agents.map((a) => (
              <span
                key={a}
                className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
              >
                {a}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="relative pl-6 border-l-2 th-border space-y-1">
        {trace.steps.map((step, i) => (
          <TraceStep key={i} step={step} />
        ))}
      </div>
    </div>
  );
}

function SummaryBadge({ icon: Icon, label, color }) {
  const colorClasses = {
    amber: "bg-purple-400/10 text-purple-400 border-purple-400/20",
    cyan: "bg-blue-400/10 text-blue-400 border-blue-400/20",
    purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    green: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    indigo: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${colorClasses[color] || colorClasses.amber}`}
    >
      <Icon size={11} />
      {label}
    </span>
  );
}
