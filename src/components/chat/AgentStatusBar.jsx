"use client";

import { useMemo, useEffect, useState } from "react";
import { useChat } from "@/hooks/useChat";
import { Wrench, PenLine } from "lucide-react";
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
  const { messages, streamingMessageId } = useChat();
  const [visible, setVisible] = useState(false);

  const phase = useMemo(() => {
    if (!streamingMessageId) return null;

    const msg = messages.find((m) => m.id === streamingMessageId);
    if (!msg) return null;

    const hasContent = msg.content && msg.content.trim().length > 0;
    const hasToolCalls = msg.toolCalls && msg.toolCalls.length > 0;
    const hasThinking = msg.thinking && msg.thinking.trim().length > 0;

    if (hasContent) {
      return {
        label: "Generating response",
        icon: PenLine,
        color: "text-blue-400",
        bg: "bg-blue-500/10",
        border: "border-blue-500/20",
      };
    }
    if (hasToolCalls) {
      const lastTool = msg.toolCalls[msg.toolCalls.length - 1];
      return {
        label: `Using ${lastTool.name}`,
        icon: Wrench,
        color: "text-purple-400",
        bg: "bg-purple-500/10",
        border: "border-purple-500/20",
      };
    }
    if (hasThinking) {
      return {
        label: "Thinking",
        icon: null,
        octopus: true,
        color: "text-purple-400",
        bg: "bg-purple-500/10",
        border: "border-purple-500/20",
      };
    }

    return {
      label: "Thinking",
      icon: null,
      octopus: true,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
      border: "border-purple-500/20",
    };
  }, [streamingMessageId, messages]);

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
        className={`mx-4 mb-2 px-3 py-1.5 ${display.bg} border ${display.border} rounded-lg flex items-center gap-2`}
      >
        {display.octopus ? (
          <ThinkingOctopus size={28} className="shrink-0" />
        ) : (
          Icon && <Icon size={14} className={`${display.color} shrink-0`} />
        )}
        <span className={`text-xs font-medium ${display.color}`}>
          {display.label}
          <AnimatedDots />
        </span>
      </div>
    </div>
  );
}
