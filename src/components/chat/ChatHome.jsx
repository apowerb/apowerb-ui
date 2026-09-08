"use client";

import { useMemo } from "react";
import { useTranslations } from "use-intl";
import {
  Sparkles,
  Bot,
  ArrowRight,
  MessageSquare,
  Command,
  AtSign,
  Slash,
  BarChart3,
  Plus,
  Clock,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useChatSessions } from "@/hooks/useChatSessions";
import { useChatUi } from "@/contexts/ChatUiContext";

function hueOf(seed) {
  let h = 0;
  for (const ch of String(seed || "")) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

function greetingKey(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return "greetingNight";
  if (h < 12) return "greetingMorning";
  if (h < 18) return "greetingAfternoon";
  return "greetingEvening";
}

/** Recent agents and conversations, computed from the session list. */
export function recentFromSessions(sessions, { agents = 5, conversations = 4 } = {}) {
  const sorted = [...(sessions || [])]
    .filter((s) => !s.archived && !(typeof s.id === "string" && s.id.startsWith("webhook_")))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const seen = new Set();
  const recentAgents = [];
  for (const s of sorted) {
    if (!s.agentId || seen.has(s.agentId)) continue;
    seen.add(s.agentId);
    recentAgents.push({
      agentId: s.agentId,
      agentName: s.agentName || s.agentId,
      agentType: s.agentType || "base",
      superagentTemplateId: s.superagentTemplateId || null,
      tags: s.tags || [],
    });
    if (recentAgents.length >= agents) break;
  }
  return { recentAgents, recentConversations: sorted.slice(0, conversations) };
}

const STARTERS = ["starterSummarize", "starterChart", "starterEmail", "starterCompare"];

/**
 * What you see with no conversation open: a greeting, the agents you used
 * recently, prompt starters, your latest threads, and the three power moves
 * of this chat (`/`, `@`, ⌘K).
 */
export default function ChatHome() {
  const t = useTranslations("ChatHome");
  const { user } = useAuth();
  const { sessions, createSession, setActiveSession } = useChatSessions();
  const ui = useChatUi();
  const { recentAgents, recentConversations } = useMemo(() => recentFromSessions(sessions), [sessions]);
  const firstName = user?.firstName || user?.username || (user?.email ? user.email.split("@")[0] : "");

  const startWith = async (agent) => {
    await createSession(agent.agentId, agent.agentName, null, {
      agentType: agent.agentType,
      superagentTemplateId: agent.superagentTemplateId,
      tags: agent.tags,
    });
  };

  const startWithPrompt = (text) => {
    ui.setPendingComposerText(text);
    if (recentAgents.length === 1) startWith(recentAgents[0]);
    else ui.setAgentPickerOpen(true);
  };

  const tile =
    "group flex flex-col gap-2 rounded-2xl border th-border th-bg-surface p-4 text-left transition-all hover:th-bg-surface-hover hover:border-brand/40 focus-visible:ring-2 focus-visible:ring-brand/50 outline-none";

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="mx-auto w-full max-w-3xl px-6 py-10 animate-fade-in">
        {/* Greeting */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-8 h-8 rounded-xl bg-brand/15 border border-brand/25 flex items-center justify-center">
              <Sparkles size={15} className="text-brand" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] th-text-ghost">{t("eyebrow")}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold th-text tracking-tight">
            {t(greetingKey())}
            {firstName ? `, ${firstName}` : ""}.
          </h1>
          <p className="text-sm th-text-muted mt-1.5 max-w-xl">{t("tagline")}</p>
        </div>

        {/* Agents */}
        <section className="mb-8" aria-label={t("agentsTitle")}>
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] th-text-ghost">{t("agentsTitle")}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentAgents.map((a) => {
              const hue = hueOf(a.agentId);
              return (
                <button
                  key={a.agentId}
                  type="button"
                  onClick={() => startWith(a)}
                  className="inline-flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border th-border th-bg-surface hover:th-bg-surface-hover hover:border-brand/40 transition-colors text-xs font-medium th-text-secondary"
                >
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                    style={{ background: `linear-gradient(135deg, hsl(${hue} 70% 52%), hsl(${(hue + 40) % 360} 70% 40%))` }}
                  >
                    {a.agentName.slice(0, 2).toUpperCase()}
                  </span>
                  {a.agentName}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => ui.setAgentPickerOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-dashed th-border-hover text-xs font-medium th-text-muted hover:th-text hover:border-brand/50 transition-colors"
            >
              <Plus size={13} /> {recentAgents.length ? t("browseAgents") : t("pickAgent")}
            </button>
          </div>
        </section>

        {/* Starters */}
        <section className="mb-8" aria-label={t("startersTitle")}>
          <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] th-text-ghost mb-2.5">{t("startersTitle")}</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {STARTERS.map((key) => (
              <button key={key} type="button" onClick={() => startWithPrompt(t(key))} className={tile}>
                <span className="text-sm th-text-secondary leading-snug">{t(key)}</span>
                <span className="inline-flex items-center gap-1 text-[11px] text-brand opacity-0 group-hover:opacity-100 transition-opacity">
                  {t("useStarter")} <ArrowRight size={12} />
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Recent conversations */}
        {recentConversations.length > 0 && (
          <section className="mb-8" aria-label={t("recentTitle")}>
            <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] th-text-ghost mb-2.5">{t("recentTitle")}</h2>
            <ul className="divide-y th-border-secondary rounded-2xl border th-border overflow-hidden">
              {recentConversations.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setActiveSession(s.id)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:th-bg-surface-hover transition-colors"
                  >
                    <MessageSquare size={14} className="th-text-faint shrink-0" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm th-text-secondary truncate">{s.title || s.agentName}</span>
                      <span className="block text-[11px] th-text-ghost truncate">
                        {s.agentName} · {t("messagesCount", { count: (s.messages || []).length })}
                      </span>
                    </span>
                    <Clock size={12} className="th-text-ghost shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Power moves */}
        <section aria-label={t("powerTitle")}>
          <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] th-text-ghost mb-2.5">{t("powerTitle")}</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <button type="button" onClick={() => ui.requestPalette(">")} className={tile}>
              <Command size={16} className="text-brand" />
              <span className="text-xs font-semibold th-text">{t("powerPalette")}</span>
              <span className="text-[11px] th-text-muted">{t("powerPaletteDesc")}</span>
            </button>
            <div className={tile}>
              <Slash size={16} className="text-brand" />
              <span className="text-xs font-semibold th-text">{t("powerSlash")}</span>
              <span className="text-[11px] th-text-muted">{t("powerSlashDesc")}</span>
            </div>
            <button type="button" onClick={() => ui.requestPalette("@")} className={tile}>
              <AtSign size={16} className="text-brand" />
              <span className="text-xs font-semibold th-text">{t("powerMention")}</span>
              <span className="text-[11px] th-text-muted">{t("powerMentionDesc")}</span>
            </button>
            <div className={tile}>
              <BarChart3 size={16} className="text-brand" />
              <span className="text-xs font-semibold th-text">{t("powerChart")}</span>
              <span className="text-[11px] th-text-muted">{t("powerChartDesc")}</span>
            </div>
          </div>
          <p className="mt-4 text-[11px] th-text-ghost flex items-center gap-1.5">
            <Bot size={11} /> {t("footerHint")}
          </p>
        </section>
      </div>
    </div>
  );
}
