"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "use-intl";
import {
  ChevronDown,
  ChevronRight,
  Sparkles,
  ArrowRightLeft,
  Bot,
  AlertTriangle,
  Check,
  Loader2,
} from "lucide-react";
import ThinkingOctopus from "./ThinkingOctopus";
import ToolCallCard from "./ToolCallCard";
import { deriveSteps, summarizeSteps, formatDuration } from "@/lib/reasoningSteps";

const THINKING_CLAMP = 420; // characters shown before "Show more"

function ThinkingStep({ step, live }) {
  const t = useTranslations("ReasoningTrail");
  const [expanded, setExpanded] = useState(false);
  const text = step.text || "";
  const isLong = text.length > THINKING_CLAMP;
  const shown = !isLong || expanded || live ? text : `${text.slice(0, THINKING_CLAMP).trimEnd()}…`;
  return (
    <div className="text-[12.5px] leading-relaxed th-text-muted whitespace-pre-wrap break-words">
      {shown}
      {live && <span className="inline-block w-1.5 h-3.5 ml-0.5 align-middle bg-brand/60 animate-pulse rounded-sm" />}
      {isLong && !live && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="block mt-1 text-[11px] font-medium text-brand hover:underline"
        >
          {expanded ? t("showLess") : t("showMore")}
        </button>
      )}
    </div>
  );
}

function HandoffStep({ step }) {
  return (
    <div className="flex items-center gap-2 text-[12px] th-text-muted">
      <span className="inline-flex items-center gap-1 font-medium th-text-secondary">
        <Bot size={12} /> {step.from || "Agent"}
      </span>
      <ArrowRightLeft size={12} className="th-text-ghost" />
      <span className="inline-flex items-center gap-1 font-medium th-text-secondary">
        <Bot size={12} /> {step.to || "Sub-agent"}
      </span>
      {step.reason && <span className="th-text-faint truncate">— {step.reason}</span>}
    </div>
  );
}

function StepMarker({ step, isLast, live }) {
  const running = step.kind === "tool" && step.status === "running";
  const errored = step.kind === "tool" && step.status === "error";
  const cls = errored
    ? "border-red-400/70 bg-red-500/20 text-red-300"
    : running || (live && isLast)
      ? "border-brand/60 bg-brand/15 text-brand"
      : "border-white/15 th-bg-surface th-text-faint";
  return (
    <span
      aria-hidden="true"
      className={`absolute -left-[13px] top-1 w-[22px] h-[22px] rounded-full border flex items-center justify-center ${cls}`}
      style={{ background: "var(--bg-body-mid)" }}
    >
      {errored ? (
        <AlertTriangle size={11} />
      ) : running ? (
        <Loader2 size={11} className="animate-spin" />
      ) : step.kind === "handoff" ? (
        <ArrowRightLeft size={11} />
      ) : step.kind === "tool" ? (
        <Check size={11} />
      ) : (
        <Sparkles size={11} />
      )}
    </span>
  );
}

/**
 * One collapsible timeline per assistant turn: what the agent thought, which
 * tools it called (with their results), and where it handed off — in the
 * order it actually happened. Open while streaming, folded to a one-line
 * summary once the turn is over.
 */
export default function ReasoningTrail({ message, isStreaming, defaultOpen }) {
  const t = useTranslations("ReasoningTrail");
  const steps = useMemo(() => deriveSteps(message), [message]);
  const [open, setOpen] = useState(!!defaultOpen || !!isStreaming);
  const wasStreaming = useRef(isStreaming);
  const [now, setNow] = useState(() => Date.now());

  // Live elapsed time while the turn runs; frozen afterwards.
  useEffect(() => {
    if (!isStreaming) return undefined;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [isStreaming]);

  // Open on the rising edge of a stream, fold on the falling edge — the
  // reader can always re-open by hand.
  useEffect(() => {
    if (isStreaming && !wasStreaming.current) setOpen(true);
    if (!isStreaming && wasStreaming.current) setOpen(false);
    wasStreaming.current = isStreaming;
  }, [isStreaming]);

  if (!steps.length) return null;

  const summary = summarizeSteps(steps, isStreaming ? now : undefined);
  const duration = formatDuration(summary.durationMs);
  const parts = [];
  if (summary.tools) parts.push(t("toolsCount", { count: summary.tools }));
  if (summary.handoffs) parts.push(t("handoffsCount", { count: summary.handoffs }));
  if (summary.toolErrors) parts.push(t("errorsCount", { count: summary.toolErrors }));
  const detail = parts.join(" · ");
  const title = isStreaming
    ? duration
      ? t("workingFor", { duration })
      : t("working")
    : duration
      ? t("workedFor", { duration })
      : t("worked");

  return (
    <section
      aria-label={t("ariaLabel")}
      className={`my-2 rounded-xl border overflow-hidden transition-colors ${
        isStreaming ? "border-brand/25 bg-brand/[0.04]" : "th-border-secondary th-bg-surface"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:th-bg-surface-hover transition-colors"
      >
        {isStreaming ? (
          <ThinkingOctopus size={22} className="shrink-0" />
        ) : (
          <span className="w-[22px] h-[22px] rounded-md bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0">
            <Sparkles size={12} className="text-brand" />
          </span>
        )}
        <span className={`text-xs font-semibold ${isStreaming ? "text-brand" : "th-text-secondary"}`}>
          {title}
        </span>
        {detail && <span className="text-[11px] th-text-faint truncate">· {detail}</span>}
        <span className="ml-auto th-text-ghost">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>

      {open && (
        <ol className="relative ml-5 mr-3 mb-3 mt-1 pl-4 border-l th-border space-y-3">
          {steps.map((step, i) => {
            const isLast = i === steps.length - 1;
            const live = isStreaming && isLast && step.kind === "thinking" && !step.endedAt;
            return (
              <li key={step.id || i} className="relative">
                <StepMarker step={step} isLast={isLast} live={isStreaming && isLast} />
                {step.kind === "thinking" && <ThinkingStep step={step} live={live} />}
                {step.kind === "handoff" && <HandoffStep step={step} />}
                {step.kind === "tool" && (
                  <ToolCallCard
                    tool={{ name: step.name, args: step.args, result: step.result, status: step.status, durationMs: step.endedAt && step.startedAt ? step.endedAt - step.startedAt : undefined }}
                    isStreaming={step.status === "running"}
                    compact
                  />
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
