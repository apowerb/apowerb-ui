"use client";

import { useTranslations } from "use-intl";
import { useState } from "react";
import { useChatSessions } from "@/hooks/useChatSessions";
import EntityJumpButton from "@/components/EntityJumpButton";
import { toAgentId } from "@/lib/jumps";
import { Bot, RotateCw, Loader2 } from "lucide-react";
import { reloadAgent } from "@/lib/api";
import { useToast } from "@/components/Toast";

/**
 * Persistent header at the top of the chat area.
 * Shows the active agent name and jump buttons to related areas
 * (Agent Factory, Integrations, Tool Box).
 */
export default function ChatSessionHeader() {
  const t = useTranslations("ChatSessionHeader");
  const { activeSession } = useChatSessions();
  const toast = useToast();
  const [reloading, setReloading] = useState(false);

  if (!activeSession) return null;

  const agentId = toAgentId(activeSession.agentId);
  const agentName = activeSession.agentName || activeSession.agentId || t("agentFallback");

  const handleReload = async () => {
    const target = agentId || activeSession.agentId;
    if (!target || reloading) return;
    setReloading(true);
    try {
      await reloadAgent(target);
      toast.success(t("agentReloadedSuccess"));
    } catch (err) {
      toast.error(t("agentReloadFailed", { message: err.message }));
    } finally {
      setReloading(false);
    }
  };

  return (
    <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b th-border-secondary th-bg-sidebar">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className="p-1.5 rounded-lg bg-brand/15 border border-brand/20 shrink-0">
          <Bot size={12} className="text-brand" />
        </div>
        <span className="th-text-secondary text-xs font-semibold truncate">
          {agentName}
        </span>
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onClick={handleReload}
          disabled={reloading || !(agentId || activeSession.agentId)}
          className="p-1.5 rounded-lg th-text-faint hover:th-text hover:th-bg-surface-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title={t("reloadAgentTitle")}
          aria-label={t("reloadAgentAria")}
        >
          {reloading ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <RotateCw size={12} />
          )}
        </button>
        {agentId && (
          <EntityJumpButton
            to="agents"
            params={{ select: agentId }}
            title={t("openAgentInFactory")}
          />
        )}
        <EntityJumpButton
          to="integrations"
          title={t("manageIntegrations")}
        />
        <EntityJumpButton
          to="tools"
          title={t("openToolBox")}
        />
      </div>
    </div>
  );
}
