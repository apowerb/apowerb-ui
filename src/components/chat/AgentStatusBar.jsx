"use client";

import { useMemo, useEffect, useState } from "react";
import { useTranslations } from "use-intl";
import { useChat } from "@/hooks/useChat";
import { Wrench, PenLine, Hourglass } from "lucide-react";
import ThinkingOctopus from "./ThinkingOctopus";

function AnimatedDots() {
  return (
    <span className="inline-flex ml-0.5">
      <span className="animate-bounce [animation-delay:0ms]">.</span>
      <span className="animate-bounce [animation-delay:150ms]">.</span>
      <span className="animate-bounce [animation-delay:300ms]">.</span>
    </span>
  );
}

export default function AgentStatusBar() {
  const t = useTranslations("AgentStatusBar");
  const { messages, streamingMessageId, streamInfo } = useChat();
  const [visible, setVisible] = useState(false);

  const phase = useMemo(() => {
    if (!streamingMessageId) return null;

    const msg = messages.find((m) => m.id === streamingMessageId);
    if (!msg) return null;

    // A backend-side pause (provider rate limit) beats every other phase: the
    // user must know why nothing moves.
    if (streamInfo?.kind === "rate_limit_retry") {
      return {
        label: t("rateLimited", {
          seconds: streamInfo.delaySeconds ?? "?",
          attempt: streamInfo.attempt ?? 1,
          max: streamInfo.maxAttempts ?? 1,
        }),
        icon: Hourglass,
        color: "text-amber-300",
        bg: "bg-amber-500/10",
        border: "border-amber-500/20",
        noDots: true,
      };
    }

    const hasContent = msg.content && msg.content.trim().length > 0;
    const runningTool = (msg.steps || []).slice().reverse().find((s) => s.kind === "tool" && s.status === "running");
    const hasToolCalls = msg.toolCalls && msg.toolCalls.length > 0;

    if (runningTool) {
      return {
        label: t("usingTool", { name: runningTool.name }),
        icon: Wrench,
        color: "text-brand",
        bg: "bg-brand/10",
        border: "border-brand/20",
      };
    }
    if (hasContent) {
      return {
        label: t("generating"),
        icon: PenLine,
        color: "text-brand",
        bg: "bg-brand/10",
        border: "border-brand/20",
      };
    }
    if (hasToolCalls) {
      const lastTool = msg.toolCalls[msg.toolCalls.length - 1];
      return {
        label: t("usingTool", { name: lastTool.name }),
        icon: Wrench,
        color: "text-brand",
        bg: "bg-brand/10",
        border: "border-brand/20",
      };
    }
    return {
      label: t("thinking"),
      icon: null,
      octopus: true,
      color: "text-brand",
      bg: "bg-brand/10",
      border: "border-brand/20",
    };
  }, [streamingMessageId, messages, streamInfo, t]);

  // Track previous phase for exit animation
  const [prevPhase, setPrevPhase] = useState(null);
  if (phase && phase !== prevPhase) {
    setPrevPhase(phase);
  }

  // Sync visibility with phase changes
  const [prevPhaseForVis, setPrevPhaseForVis] = useState(!!phase);
  if (!!phase !== prevPhaseForVis) {
    setPrevPhaseForVis(!!phase);
    if (!phase) {
      setVisible(false);
    }
  }

  // Trigger enter animation on next frame when phase appears
  useEffect(() => {
    if (phase) {
      requestAnimationFrame(() => setVisible(true));
    }
  }, [phase]);

  // Safety timeout: clear prevPhase if onTransitionEnd doesn't fire
  useEffect(() => {
    if (!phase && prevPhase) {
      const timer = setTimeout(() => {
        setPrevPhase(null);
        setVisible(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [phase, prevPhase]);

  const display = phase || prevPhase;
  if (!display) return null;

  const Icon = display.icon;

  return (
    <div
      className="overflow-hidden transition-all duration-300 ease-in-out"
      style={{
        maxHeight: visible ? 52 : 0,
        opacity: visible ? 1 : 0,
      }}
      onTransitionEnd={() => {
        // Clear stale phase after exit animation completes
        if (!visible && !phase) {
          setPrevPhase(null);
        }
      }}
    >
      <div
        role="status"
        aria-live="polite"
        className={`mx-auto w-full max-w-3xl px-3 py-1.5 mb-2 ${display.bg} border ${display.border} rounded-lg flex items-center gap-2`}
      >
        {display.octopus ? (
          <ThinkingOctopus size={26} className="shrink-0" />
        ) : (
          Icon && <Icon size={14} className={`${display.color} shrink-0`} />
        )}
        <span className={`text-xs font-medium ${display.color}`}>
          {display.label}
          {!display.noDots && <AnimatedDots />}
        </span>
      </div>
    </div>
  );
}
