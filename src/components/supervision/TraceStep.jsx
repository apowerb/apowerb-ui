"use client";

import { useState } from "react";
import {
  MessageSquare,
  Brain,
  Wrench,
  CheckCircle2,
  ArrowRightLeft,
  Bot,
  AlertCircle,
} from "lucide-react";
import { formatDateTime } from "@/lib/datetime";

const STEP_CONFIG = {
  user_input: {
    icon: MessageSquare,
    color: "blue",
    label: "User",
  },
  thinking: {
    icon: Brain,
    color: "purple",
    label: "Thinking",
  },
  tool_call: {
    icon: Wrench,
    color: "cyan",
    label: "Tool Call",
  },
  tool_result: {
    icon: CheckCircle2,
    color: "green",
    label: "Tool Result",
  },
  handoff: {
    icon: ArrowRightLeft,
    color: "indigo",
    label: "Handoff",
  },
  agent_response: {
    icon: Bot,
    color: "slate",
    label: "Response",
  },
  error: {
    icon: AlertCircle,
    color: "red",
    label: "Error",
  },
};

const COLOR_CLASSES = {
  blue: {
    text: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    dot: "bg-blue-500",
  },
  purple: {
    text: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
    dot: "bg-purple-500",
  },
  cyan: {
    text: "text-blue-400",
    bg: "bg-blue-400/10",
    border: "border-blue-400/30",
    dot: "bg-blue-400",
  },
  green: {
    text: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/30",
    dot: "bg-green-500",
  },
  indigo: {
    text: "text-indigo-400",
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/30",
    dot: "bg-indigo-500",
  },
  slate: {
    text: "text-slate-400",
    bg: "bg-slate-500/10",
    border: "border-slate-500/30",
    dot: "bg-slate-500",
  },
  red: {
    text: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    dot: "bg-red-500",
  },
};

function formatTimestamp(ts) {
  if (!ts) return null;
  try {
    // ADK timestamps are unix seconds (float); convert to ms
    const value = typeof ts === "number" ? ts * 1000 : ts;
    const result = formatDateTime(value);
    return result === "—" ? null : result;
  } catch {
    return null;
  }
}

function formatDuration(ms) {
  if (ms == null) return null;
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

const CONTENT_COLLAPSE_THRESHOLD = 200;

export default function TraceStep({ step }) {
  const [expanded, setExpanded] = useState(false);

  const config = STEP_CONFIG[step.type] || STEP_CONFIG.agent_response;
  const colors = COLOR_CLASSES[config.color] || COLOR_CLASSES.slate;
  const Icon = config.icon;

  const content = step.content || "";
  const isLong = content.length > CONTENT_COLLAPSE_THRESHOLD;
  const displayContent = isLong && !expanded
    ? content.slice(0, CONTENT_COLLAPSE_THRESHOLD) + "..."
    : content;

  const timestamp = formatTimestamp(step.timestamp);
  const duration = formatDuration(step.duration_ms);

  return (
    <div className="relative py-2 pl-4">
      {/* Timeline Dot — border matches body so the dot visually "cuts" the timeline */}
      <div
        className={`trace-dot absolute -left-[9px] top-[14px] w-4 h-4 rounded-full border-2 ${colors.dot}`}
      />

      {/* Step Header */}
      <div className="flex flex-wrap items-center gap-2 mb-1">
        {/* Type Badge */}
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${colors.bg} ${colors.text} border ${colors.border}`}
        >
          <Icon size={11} />
          {config.label}
        </span>

        {/* Author Badge */}
        {step.author && step.author !== "user" && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium th-bg-surface th-text-muted border th-border-secondary">
            <Bot size={9} />
            {step.author}
          </span>
        )}

        {/* Timestamp */}
        {timestamp && (
          <span className="text-[10px] th-text-faint">{timestamp}</span>
        )}

        {/* Duration */}
        {duration && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-mono th-bg-surface th-text-faint border th-border-secondary">
            {duration}
          </span>
        )}
      </div>

      {/* Content */}
      {content && (
        <div className="mt-1">
          <p className="text-xs th-text-secondary whitespace-pre-wrap break-words leading-relaxed">
            {displayContent}
          </p>
          {isLong && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[11px] text-purple-400/80 hover:text-purple-400 mt-0.5 transition-colors"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      )}

      {/* Tool Call Details */}
      {step.type === "tool_call" && step.details?.args && (
        <div className="mt-2 p-2 th-bg-surface rounded-lg border th-border-secondary">
          <span className="text-[10px] th-text-faint font-semibold uppercase tracking-wide">
            Arguments
          </span>
          <div className="mt-1 space-y-0.5">
            {Object.entries(step.details.args).map(([key, value]) => (
              <div key={key} className="flex gap-2 text-[11px]">
                <span className="text-blue-400/70 font-mono shrink-0">
                  {key}:
                </span>
                <span className="th-text-muted font-mono break-all">
                  {typeof value === "object"
                    ? JSON.stringify(value)
                    : String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Handoff Details */}
      {step.type === "handoff" && step.details && (
        <div className="mt-2 flex items-center gap-2 text-xs">
          <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">
            {step.details.from || "?"}
          </span>
          <ArrowRightLeft size={14} className="th-text-faint" />
          <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">
            {step.details.to || "?"}
          </span>
        </div>
      )}

      {/* Error Details */}
      {step.type === "error" && step.details?.message && (
        <div className="mt-2 p-2 bg-purple-500/5 rounded-lg border border-purple-500/20">
          <p className="text-[11px] text-purple-400/80 font-mono break-all">
            {step.details.message}
          </p>
        </div>
      )}
    </div>
  );
}
