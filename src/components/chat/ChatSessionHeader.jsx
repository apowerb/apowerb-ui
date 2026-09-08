"use client";

import { useTranslations } from "use-intl";
import { useEffect, useRef, useState } from "react";
import { useChatSessions } from "@/hooks/useChatSessions";
import { useChat } from "@/hooks/useChat";
import { useChatUi } from "@/contexts/ChatUiContext";
import { toAgentId } from "@/lib/jumps";
import {
  Bot,
  RotateCw,
  Loader2,
  Search,
  Share2,
  Download,
  Copy,
  FileJson,
  FileCode,
  MoreHorizontal,
  Keyboard,
  ExternalLink,
  PlugZap,
  Wrench,
  Pin,
  Check,
  ChevronDown,
} from "lucide-react";
import { reloadAgent } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { useRouter } from "@/lib/navigation";
import { buildJumpUrl } from "@/lib/jumps";

// Deterministic hue from the agent id, so the same agent always wears the
// same colour (mirrors the sidebar avatars).
function hueOf(seed) {
  let h = 0;
  for (const ch of String(seed || "")) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

function IconButton({ onClick, title, active, disabled, children, badge }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active || undefined}
      className={`relative p-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-brand/50 outline-none ${
        active ? "bg-brand/15 text-brand" : "th-text-faint hover:th-text hover:th-bg-surface-hover"
      }`}
    >
      {children}
      {badge != null && badge > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-brand text-white text-[9px] font-bold flex items-center justify-center tabular-nums">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
}

function Menu({ open, onClose, children, align = "right" }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      ref={ref}
      role="menu"
      className={`absolute top-full mt-1 ${align === "right" ? "right-0" : "left-0"} z-30 min-w-[220px] rounded-xl border th-border shadow-2xl py-1 animate-fade-in`}
      style={{ background: "var(--bg-dropdown)" }}
    >
      {children}
    </div>
  );
}

function MenuItem({ icon: Icon, label, hint, onClick, danger }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors hover:th-bg-surface-hover ${danger ? "text-red-300" : "th-text-secondary"}`}
    >
      {Icon && <Icon size={14} className="shrink-0 th-text-faint" />}
      <span className="flex-1 truncate">{label}</span>
      {hint && <span className="text-[10px] th-text-ghost">{hint}</span>}
    </button>
  );
}

/**
 * Persistent header of the conversation: who you talk to, an editable title,
 * and every conversation-level action (search, artifacts, export, share,
 * reload, jumps, shortcuts).
 */
export default function ChatSessionHeader({ commands, runCommand }) {
  const t = useTranslations("ChatSessionHeader");
  const { activeSession, updateSessionTitle } = useChatSessions();
  const { messages, streamingMessageId } = useChat();
  const ui = useChatUi();
  const toast = useToast();
  const router = useRouter();
  const [reloading, setReloading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef(null);

  // A rename asked from the palette / the `/rename` command opens the editor.
  const [seenRename, setSeenRename] = useState(ui.renameRequest);
  if (ui.renameRequest !== seenRename) {
    setSeenRename(ui.renameRequest);
    if (activeSession) {
      setDraft(activeSession.title || "");
      setEditing(true);
    }
  }

  useEffect(() => {
    if (editing) {
      const id = requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
      return () => cancelAnimationFrame(id);
    }
    return undefined;
  }, [editing]);

  if (!activeSession) return null;

  const agentId = toAgentId(activeSession.agentId);
  const agentName = activeSession.agentName || activeSession.agentId || t("agentFallback");
  const title = activeSession.title || agentName;
  const hue = hueOf(activeSession.agentId);
  const hasCommand = (id) => (commands || []).some((c) => c.id === id);
  const run = (id, args) => runCommand?.(id, args);

  const startEdit = () => {
    setDraft(title);
    setEditing(true);
  };
  const commitEdit = () => {
    const clean = draft.trim();
    if (clean && clean !== title) updateSessionTitle(activeSession.id, clean);
    setEditing(false);
  };

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

  const handleCopy = async () => {
    run("copy-conversation");
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="shrink-0 flex items-center gap-3 px-4 py-2 border-b th-border-secondary th-bg-sidebar">
      {/* Agent chip → switch agent */}
      <button
        type="button"
        onClick={() => ui.setAgentPickerOpen(true)}
        className="group flex items-center gap-2 min-w-0 rounded-lg pl-1 pr-2 py-1 hover:th-bg-surface-hover transition-colors"
        title={t("switchAgent")}
        aria-label={t("switchAgent")}
      >
        <span
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shrink-0"
          style={{ background: `linear-gradient(135deg, hsl(${hue} 70% 52%), hsl(${(hue + 40) % 360} 70% 40%))` }}
        >
          {agentName.slice(0, 2).toUpperCase()}
        </span>
        <span className="flex items-center gap-1 text-[11px] font-semibold th-text-secondary truncate">
          <Bot size={11} className="text-brand shrink-0" />
          <span className="truncate max-w-[140px]">{agentName}</span>
          <ChevronDown size={11} className="th-text-ghost group-hover:th-text-muted" />
        </span>
      </button>

      <span className="w-px h-5 shrink-0" style={{ background: "var(--border-secondary)" }} />

      {/* Editable title */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitEdit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setEditing(false);
              }
            }}
            aria-label={t("renameTitle")}
            className="w-full max-w-md bg-transparent border-b border-brand/50 outline-none text-sm font-semibold th-text px-0.5"
          />
        ) : (
          <button
            type="button"
            onClick={startEdit}
            title={t("renameTitle")}
            className="group flex items-center gap-2 min-w-0 max-w-full text-left"
          >
            <span className="text-sm font-semibold th-text truncate">{title}</span>
            {activeSession.pinned && <Pin size={11} className="text-brand shrink-0" />}
            <span className="text-[11px] th-text-ghost shrink-0 tabular-nums hidden sm:inline">
              · {t("messagesCount", { count: messages.filter((m) => !m.isSynthetic).length })}
            </span>
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 shrink-0">
        <IconButton onClick={() => (ui.threadSearch.open ? ui.closeThreadSearch() : ui.openThreadSearch(""))} title={t("searchThread")} active={ui.threadSearch.open}>
          <Search size={14} />
        </IconButton>
        <IconButton onClick={() => ui.requestArtifacts()} title={t("artifacts")} disabled={!ui.artifactCount} badge={ui.artifactCount}>
          <FileCode size={14} />
        </IconButton>
        <div className="relative">
          <IconButton onClick={() => setExportOpen((v) => !v)} title={t("export")} active={exportOpen} disabled={!messages.length}>
            <Download size={14} />
          </IconButton>
          <Menu open={exportOpen} onClose={() => setExportOpen(false)}>
            <MenuItem icon={copied ? Check : Copy} label={t("copyMarkdown")} onClick={() => { handleCopy(); setExportOpen(false); }} />
            <MenuItem icon={Download} label={t("downloadMarkdown")} onClick={() => { run("download-md"); setExportOpen(false); }} />
            <MenuItem icon={FileJson} label={t("downloadJson")} onClick={() => { run("download-json"); setExportOpen(false); }} />
          </Menu>
        </div>
        <IconButton onClick={() => ui.setShareOpen(true)} title={t("share")} disabled={!messages.length || !!streamingMessageId}>
          <Share2 size={14} />
        </IconButton>
        <IconButton onClick={handleReload} title={t("reloadAgentTitle")} disabled={reloading || !(agentId || activeSession.agentId)}>
          {reloading ? <Loader2 size={14} className="animate-spin" /> : <RotateCw size={14} />}
        </IconButton>
        <div className="relative">
          <IconButton onClick={() => setMoreOpen((v) => !v)} title={t("more")} active={moreOpen}>
            <MoreHorizontal size={14} />
          </IconButton>
          <Menu open={moreOpen} onClose={() => setMoreOpen(false)}>
            {agentId && (
              <MenuItem icon={ExternalLink} label={t("openAgentInFactory")} onClick={() => { router.push(buildJumpUrl("agents", { select: agentId })); setMoreOpen(false); }} />
            )}
            <MenuItem icon={PlugZap} label={t("manageIntegrations")} onClick={() => { router.push(buildJumpUrl("integrations")); setMoreOpen(false); }} />
            <MenuItem icon={Wrench} label={t("openToolBox")} onClick={() => { router.push(buildJumpUrl("tools")); setMoreOpen(false); }} />
            {hasCommand("pin") && (
              <MenuItem icon={Pin} label={activeSession.pinned ? t("unpin") : t("pin")} onClick={() => { run("pin"); setMoreOpen(false); }} />
            )}
            <MenuItem icon={Keyboard} label={t("shortcuts")} hint="⌘/" onClick={() => { ui.setShortcutsOpen(true); setMoreOpen(false); }} />
          </Menu>
        </div>
      </div>
    </div>
  );
}
