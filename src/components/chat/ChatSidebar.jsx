"use client";

import { useTranslations } from "use-intl";
import { useState } from "react";
import {
  Plus,
  MessageSquare,
  Trash2,
  Edit2,
  Check,
  X,
  Copy,
  CheckSquare,
  Square,
  ListChecks,
  Download,
  Pin,
  Archive,
  ArchiveRestore,
  Tag,
  Folder,
  FolderPlus,
  FolderInput,
  FolderX,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { useChatSessions } from "@/hooks/useChatSessions";
import ConfirmToast from "@/components/ConfirmToast";
import EmptyState from "@/components/EmptyState";
import UserMenu from "@/components/auth/UserMenu";
import UserProfileModal from "@/components/auth/UserProfileModal";
import EntityJumpButton from "@/components/EntityJumpButton";
import { toAgentId } from "@/lib/jumps";
import { formatDate as formatDateParis, formatDateTime } from "@/lib/datetime";

function formatSessionForCopy(session, t) {
  const lines = [];
  lines.push(`# ${session.title}`);
  lines.push(`${t("agentLabel")}: ${session.agentName}`);
  lines.push(`${t("dateLabel")}: ${formatDateParis(session.createdAt)}`);
  lines.push("---\n");

  for (const msg of session.messages || []) {
    const role = msg.role === "user" ? t("userRole") : session.agentName || t("assistantRole");
    const time = formatDateTime(msg.timestamp);
    lines.push(`**${role}** (${time}):`);
    const content = typeof msg.content === "string" ? msg.content : "";
    if (content.trim()) lines.push(content);
    if (msg.toolCalls?.length) {
      lines.push(`\n_[${t("toolCallCount", { count: msg.toolCalls.length })}]_`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

// Strip legacy "Chat with " prefix from titles
function displayTitle(session, t) {
  const title = session.title || session.agentName || t("untitled");
  return title.replace(/^Chat with\s+/i, "");
}

// Compact avatar: first two chars of the display title
function avatarChars(session, t) {
  const title = displayTitle(session, t).trim();
  if (!title) return "·";
  const parts = title.split(/[\s_\-.]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return title.slice(0, 2).toUpperCase();
}

// Stable hue from agent name so each agent gets a consistent avatar color
function avatarHue(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % 360;
}

function relativeTime(ts) {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w`;
  return formatDateParis(ts);
}

function bucketLabel(ts) {
  const now = new Date();
  const then = new Date(ts);
  const isSameDay = now.toDateString() === then.toDateString();
  if (isSameDay) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (yesterday.toDateString() === then.toDateString()) return "Yesterday";
  const diffDays = Math.floor((now - then) / (1000 * 60 * 60 * 24));
  if (diffDays < 7) return "Previous 7 days";
  if (diffDays < 30) return "Previous 30 days";
  return "Older";
}

const BUCKET_ORDER = ["Today", "Yesterday", "Previous 7 days", "Previous 30 days", "Older"];

// Tags with internal meaning elsewhere (e.g. isRagSession keys off "rag").
// Block them from the free-text tag input to avoid silent side effects.
const RESERVED_TAGS = new Set(["rag"]);

export default function ChatSidebar({ onNewChat, sessionFilter, showUserMenu = false }) {
  const t = useTranslations("ChatSidebar");
  const BUCKET_LABELS = {
    Today: t("bucketToday"),
    Yesterday: t("bucketYesterday"),
    "Previous 7 days": t("bucketPrev7"),
    "Previous 30 days": t("bucketPrev30"),
    Older: t("bucketOlder"),
    Pinned: t("bucketPinned"),
  };
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [copiedSessionId, setCopiedSessionId] = useState(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [bulkCopied, setBulkCopied] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [filterTag, setFilterTag] = useState(null);
  const [tagInputOpen, setTagInputOpen] = useState(false);
  const [tagInputValue, setTagInputValue] = useState("");
  const [tagError, setTagError] = useState("");
  const [collapsedFolders, setCollapsedFolders] = useState(() => new Set());
  const [moveMenuOpen, setMoveMenuOpen] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [editingFolderId, setEditingFolderId] = useState(null);
  const [editFolderName, setEditFolderName] = useState("");
  const [deleteFolderTarget, setDeleteFolderTarget] = useState(null);
  const {
    sessions,
    folders,
    activeSessionId,
    setActiveSession,
    deleteSession,
    deleteSessions,
    pinSessions,
    archiveSessions,
    addTagToSessions,
    removeTag,
    createFolder,
    renameFolder,
    deleteFolder,
    moveSessionsToFolder,
    updateSessionTitle,
  } = useChatSessions();
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");

  const handleStartEdit = (e, session) => {
    e.stopPropagation();
    setEditingId(session.id);
    setEditTitle(displayTitle(session, t));
  };

  const handleSaveEdit = (sessionId) => {
    if (editTitle.trim()) {
      updateSessionTitle(sessionId, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleCancelEdit = (e) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const handleDelete = (e, sessionId) => {
    e.stopPropagation();
    setDeleteTarget(sessionId);
  };

  const enterSelection = (sessionId = null) => {
    setSelectionMode(true);
    setSelectedIds(sessionId ? new Set([sessionId]) : new Set());
    // Reset folder-creation state so a leftover name from the "New folder"
    // form doesn't bleed into the move-to-folder menu.
    setNewFolderName("");
    setNewFolderOpen(false);
  };

  const exitSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
    setMoveMenuOpen(false);
    setTagInputOpen(false);
    setTagInputValue("");
    setTagError("");
    setNewFolderName("");
  };

  const toggleSelected = (sessionId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    setConfirmBulk(false);
    await deleteSessions(ids);
    exitSelection();
  };

  // Selected sessions in display order
  const getSelectedSessions = () => {
    const byId = new Map(sessions.map((s) => [s.id, s]));
    return visibleIds
      .filter((id) => selectedIds.has(id))
      .map((id) => byId.get(id))
      .filter(Boolean);
  };

  const handleBulkCopy = async () => {
    const text = getSelectedSessions()
      .map((s) => formatSessionForCopy(s, t))
      .join("\n\n---\n\n");
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setBulkCopied(true);
      setTimeout(() => setBulkCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleBulkDownload = () => {
    const items = getSelectedSessions();
    if (!items.length) return;
    const text = items.map((s) => formatSessionForCopy(s, t)).join("\n\n---\n\n");
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conversations-${items.length}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleBulkPin = () => {
    const items = getSelectedSessions();
    if (!items.length) return;
    const allPinned = items.every((s) => s.pinned);
    pinSessions(
      items.map((s) => s.id),
      !allPinned,
    );
    exitSelection();
  };

  const handleBulkArchive = () => {
    const items = getSelectedSessions();
    if (!items.length) return;
    const allArchived = items.every((s) => s.archived);
    archiveSessions(
      items.map((s) => s.id),
      !allArchived,
    );
    exitSelection();
  };

  const handleBulkTag = () => {
    const tag = tagInputValue.trim();
    if (!tag) return;
    if (RESERVED_TAGS.has(tag.toLowerCase())) {
      setTagError(t("reservedTagError", { tag }));
      return;
    }
    addTagToSessions(Array.from(selectedIds), tag);
    setTagInputValue("");
    setTagError("");
    setTagInputOpen(false);
    exitSelection();
  };

  const handleMoveToFolder = (folderId) => {
    if (!selectedCount) return;
    moveSessionsToFolder(Array.from(selectedIds), folderId);
    setMoveMenuOpen(false);
    exitSelection();
  };

  const handleCreateFolderAndMove = (name) => {
    const id = createFolder(name);
    if (id) moveSessionsToFolder(Array.from(selectedIds), id);
    setNewFolderName("");
    setMoveMenuOpen(false);
    exitSelection();
  };

  const toggleFolderCollapse = (folderId) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const handleCreateFolder = () => {
    const name = newFolderName.trim();
    if (!name) return;
    createFolder(name);
    setNewFolderName("");
    setNewFolderOpen(false);
  };

  const handleSaveFolderName = (folderId) => {
    if (editFolderName.trim()) renameFolder(folderId, editFolderName.trim());
    setEditingFolderId(null);
  };

  // Derived values below are recomputed each render; the React Compiler
  // memoizes them automatically, so no manual useMemo is needed.
  const folderIdSet = new Set(folders.map((f) => f.id));
  // A session counts as "filed" only if its folder still exists.
  const isFiled = (s) => s.folderId && folderIdSet.has(s.folderId);

  // The tag filter only applies while at least one conversation still carries
  // the tag — otherwise it self-clears (no setState-in-effect needed).
  const effectiveFilterTag =
    filterTag && sessions.some((s) => (s.tags || []).includes(filterTag))
      ? filterTag
      : null;

  // Shared filter for the current view (archived / tag).
  const passesView = (s) =>
    (sessionFilter ? sessionFilter(s) : true) &&
    (showArchived ? s.archived : !s.archived) &&
    (effectiveFilterTag ? (s.tags || []).includes(effectiveFilterTag) : true);

  // Folders only show in the main view; archived view is a flat list.
  const folderGroups = showArchived
    ? []
    : folders.map((folder) => ({
        folder,
        items: [...sessions]
          .filter((s) => passesView(s) && s.folderId === folder.id)
          .sort((a, b) => b.updatedAt - a.updatedAt),
      }));

  const bucketed = (() => {
    const filtered = [...sessions]
      .filter(passesView)
      .filter((s) => (showArchived ? true : !isFiled(s)))
      .sort((a, b) => b.updatedAt - a.updatedAt);

    const groups = new Map();
    for (const s of filtered) {
      // Pinned conversations float to a dedicated bucket (only in the main view)
      const label = !showArchived && s.pinned ? "Pinned" : bucketLabel(s.updatedAt);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(s);
    }
    const order = ["Pinned", ...BUCKET_ORDER];
    return order
      .filter((k) => groups.has(k))
      .map((k) => ({ label: k, items: groups.get(k) }));
  })();

  const folderItemCount = folderGroups.reduce(
    (acc, g) => acc + g.items.length,
    0,
  );
  const total =
    bucketed.reduce((acc, g) => acc + g.items.length, 0) + folderItemCount;

  const archivedCount = sessions.filter(
    (s) => s.archived && (sessionFilter ? sessionFilter(s) : true),
  ).length;

  const visibleIds = [
    ...folderGroups.flatMap((g) => g.items.map((s) => s.id)),
    ...bucketed.flatMap((g) => g.items.map((s) => s.id)),
  ];
  const selectedCount = selectedIds.size;
  const allSelected = total > 0 && selectedCount === total;

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(visibleIds));
  };

  const selectedSessions = getSelectedSessions();
  const allSelectedPinned =
    selectedCount > 0 && selectedSessions.every((s) => s.pinned);
  const allSelectedArchived =
    selectedCount > 0 && selectedSessions.every((s) => s.archived);

  const renderSession = (session) => {
    const isActive = activeSessionId === session.id;
    const isSelected = selectedIds.has(session.id);
    const title = displayTitle(session, t);
    const agentLabel = session.agentName || null;
    const hue = avatarHue(session.agentName || session.agentId || title);

    return (
      <div
        key={session.id}
        className={`group relative flex items-center gap-2.5 pl-2 pr-2 py-1.5 rounded-lg mb-0.5 cursor-pointer transition-colors ${
          selectionMode && isSelected
            ? "sidebar-row-active"
            : isActive && !selectionMode
              ? "sidebar-row-active"
              : "border border-transparent hover:th-bg-surface"
        }`}
        onClick={() =>
          selectionMode
            ? toggleSelected(session.id)
            : setActiveSession(session.id)
        }
        title={agentLabel ? `${title} · ${agentLabel}` : title}
      >
        {selectionMode ? (
          <div className="shrink-0 w-7 h-7 flex items-center justify-center">
            {isSelected ? (
              <CheckSquare size={18} className="text-blue-400" />
            ) : (
              <Square size={18} className="th-text-faint" />
            )}
          </div>
        ) : (
          <div
            className="sidebar-avatar shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold"
            style={{ "--avatar-hue": hue }}
          >
            {avatarChars(session, t)}
          </div>
        )}

        {editingId === session.id ? (
          <div className="flex-1 flex items-center gap-1 min-w-0">
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveEdit(session.id);
                if (e.key === "Escape") setEditingId(null);
              }}
              className="flex-1 min-w-0 bg-transparent border-b th-border th-text text-sm focus:outline-none px-1"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSaveEdit(session.id);
              }}
              className="p-1 hover:th-bg-surface-hover rounded shrink-0"
            >
              <Check size={12} className="text-blue-400" />
            </button>
            <button
              onClick={handleCancelEdit}
              className="p-1 hover:th-bg-surface-hover rounded shrink-0"
            >
              <X size={12} className="text-red-400" />
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                {session.pinned && (
                  <Pin
                    size={11}
                    className="shrink-0 text-blue-400 fill-blue-400/30"
                  />
                )}
                <span
                  className={`flex-1 min-w-0 truncate text-sm ${
                    isActive ? "th-text font-medium" : "th-text-secondary"
                  }`}
                >
                  {title}
                </span>
                <span className="sidebar-row-time shrink-0 text-[10px] th-text-ghost tabular-nums group-hover:opacity-0 transition-opacity">
                  {relativeTime(session.updatedAt)}
                </span>
              </div>
              {agentLabel && (
                <span className="block text-[11px] th-text-ghost truncate mt-0.5">
                  {agentLabel}
                </span>
              )}
              {session.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {session.tags.map((tag) => (
                    <span
                      key={tag}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!selectionMode) setFilterTag(tag);
                      }}
                      className="inline-flex items-center gap-0.5 px-1.5 py-px rounded text-[9px] font-medium th-bg-surface th-text-secondary hover:th-text transition-colors"
                      title={t("filterByTag", { tag })}
                    >
                      {tag}
                      {!selectionMode && (
                        <X
                          size={9}
                          className="th-text-faint hover:text-red-400"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeTag(session.id, tag);
                          }}
                        />
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Floating actions with solid backdrop to mask title/timestamp underneath */}
            {!selectionMode && (
            <div className="sidebar-row-actions absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 px-1.5 py-1 rounded-md opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity">
              {session.agentId && (
                <EntityJumpButton
                  to="agents"
                  params={{ select: toAgentId(session.agentId) }}
                  title={t("openAgent", { name: session.agentName || session.agentId })}
                  size={12}
                  className="!p-1"
                />
              )}
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    await navigator.clipboard.writeText(formatSessionForCopy(session, t));
                    setCopiedSessionId(session.id);
                    setTimeout(() => setCopiedSessionId(null), 2000);
                  } catch (err) {
                    console.error("Failed to copy:", err);
                  }
                }}
                className="p-1 hover:th-bg-surface-hover rounded"
                title={t("copyConversation")}
              >
                {copiedSessionId === session.id ? (
                  <Check size={12} className="text-blue-400" />
                ) : (
                  <Copy size={12} className="th-text-faint" />
                )}
              </button>
              <button
                onClick={(e) => handleStartEdit(e, session)}
                className="p-1 hover:th-bg-surface-hover rounded"
                title={t("rename")}
              >
                <Edit2 size={12} className="th-text-faint" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  pinSessions([session.id], !session.pinned);
                }}
                className="p-1 hover:th-bg-surface-hover rounded"
                title={session.pinned ? t("unpin") : t("pin")}
              >
                <Pin
                  size={12}
                  className={
                    session.pinned ? "text-blue-400" : "th-text-faint"
                  }
                />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  archiveSessions([session.id], !session.archived);
                }}
                className="p-1 hover:th-bg-surface-hover rounded"
                title={session.archived ? t("unarchive") : t("archive")}
              >
                {session.archived ? (
                  <ArchiveRestore size={12} className="th-text-faint" />
                ) : (
                  <Archive size={12} className="th-text-faint" />
                )}
              </button>
              <button
                onClick={(e) => handleDelete(e, session.id)}
                className="p-1 hover:th-bg-surface-hover rounded"
                title={t("delete")}
              >
                <Trash2 size={12} className="text-red-400/60" />
              </button>
            </div>
            )}
          </>
        )}
      </div>
    );
  };

  const renderFolder = ({ folder, items }) => {
    const collapsed = collapsedFolders.has(folder.id);
    const isEditing = editingFolderId === folder.id;
    return (
      <div key={folder.id} className="mb-3">
        <div className="group/folder flex items-center gap-1 px-2 py-1 rounded-md hover:th-bg-surface transition-colors">
          <button
            onClick={() => toggleFolderCollapse(folder.id)}
            className="shrink-0 th-text-faint hover:th-text-secondary"
            title={collapsed ? t("expand") : t("collapse")}
          >
            {collapsed ? (
              <ChevronRight size={14} />
            ) : (
              <ChevronDown size={14} />
            )}
          </button>
          <Folder size={13} className="shrink-0 th-text-faint" />
          {isEditing ? (
            <input
              type="text"
              value={editFolderName}
              onChange={(e) => setEditFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveFolderName(folder.id);
                if (e.key === "Escape") setEditingFolderId(null);
              }}
              className="flex-1 min-w-0 bg-transparent border-b th-border th-text text-xs font-semibold focus:outline-none px-1"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <button
              onClick={() => toggleFolderCollapse(folder.id)}
              className="flex-1 min-w-0 flex items-center gap-1.5 text-left"
            >
              <span className="truncate text-xs font-semibold th-text-secondary uppercase tracking-wide">
                {folder.name}
              </span>
              <span className="shrink-0 text-[10px] th-text-ghost tabular-nums">
                {items.length}
              </span>
            </button>
          )}
          {!selectionMode && !isEditing && (
            <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover/folder:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingFolderId(folder.id);
                  setEditFolderName(folder.name);
                }}
                className="p-0.5 hover:th-bg-surface-hover rounded"
                title={t("renameFolder")}
              >
                <Edit2 size={11} className="th-text-faint" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteFolderTarget(folder.id);
                }}
                className="p-0.5 hover:th-bg-surface-hover rounded"
                title={t("deleteFolderTitle")}
              >
                <FolderX size={11} className="text-red-400/60" />
              </button>
            </div>
          )}
        </div>
        {!collapsed && (
          <div className="pl-2">
            {items.length > 0 ? (
              items.map(renderSession)
            ) : (
              <div className="px-3 py-1.5 text-[11px] th-text-ghost italic">
                {t("emptyFolder")}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-64 h-full th-bg-sidebar border-r th-border-secondary flex flex-col">
      {/* Header */}
      <div className="p-3 border-b th-border-secondary">
        <button
          onClick={onNewChat}
          className="btn-brand w-full flex items-center justify-center gap-2 px-4 py-2.5 text-white rounded-xl font-semibold shadow-lg shadow-brand/20"
        >
          <Plus size={16} />
          {t("newChat")}
        </button>

        {selectionMode ? (
          <div className="mt-2 space-y-1.5">
            {/* Row 1: select-all + count + cancel */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-1.5 px-1.5 py-1 rounded-md text-xs th-text-secondary hover:th-bg-surface transition-colors"
                title={allSelected ? t("deselectAll") : t("selectAll")}
              >
                {allSelected ? (
                  <CheckSquare size={14} className="text-blue-400" />
                ) : (
                  <Square size={14} className="th-text-faint" />
                )}
                <span className="tabular-nums">{t("selectedCount", { count: selectedCount })}</span>
              </button>
              <div className="flex-1" />
              <button
                onClick={exitSelection}
                className="p-1.5 rounded-md th-text-faint hover:th-bg-surface transition-colors"
                title={t("cancel")}
              >
                <X size={16} />
              </button>
            </div>

            {/* Row 2: bulk actions */}
            <div className="flex items-center justify-between gap-0.5">
              <button
                onClick={handleBulkPin}
                disabled={selectedCount === 0}
                className="p-1.5 rounded-md th-text-secondary hover:th-bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title={allSelectedPinned ? t("unpinSelected") : t("pinSelected")}
              >
                <Pin
                  size={16}
                  className={allSelectedPinned ? "text-blue-400" : ""}
                />
              </button>
              <button
                onClick={handleBulkArchive}
                disabled={selectedCount === 0}
                className="p-1.5 rounded-md th-text-secondary hover:th-bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title={
                  allSelectedArchived ? t("unarchiveSelected") : t("archiveSelected")
                }
              >
                {allSelectedArchived ? (
                  <ArchiveRestore size={16} />
                ) : (
                  <Archive size={16} />
                )}
              </button>
              <button
                onClick={() => {
                  if (selectedCount > 0) setTagInputOpen((v) => !v);
                }}
                disabled={selectedCount === 0}
                className={`p-1.5 rounded-md hover:th-bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors ${
                  tagInputOpen ? "text-blue-400" : "th-text-secondary"
                }`}
                title={t("addTagToSelected")}
              >
                <Tag size={16} />
              </button>
              <button
                onClick={() => {
                  if (selectedCount > 0) setMoveMenuOpen((v) => !v);
                }}
                disabled={selectedCount === 0}
                className={`p-1.5 rounded-md hover:th-bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors ${
                  moveMenuOpen ? "text-blue-400" : "th-text-secondary"
                }`}
                title={t("moveToFolder")}
              >
                <FolderInput size={16} />
              </button>
              <button
                onClick={handleBulkCopy}
                disabled={selectedCount === 0}
                className="p-1.5 rounded-md th-text-secondary hover:th-bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title={t("copySelectedToClipboard")}
              >
                {bulkCopied ? (
                  <Check size={16} className="text-blue-400" />
                ) : (
                  <Copy size={16} />
                )}
              </button>
              <button
                onClick={handleBulkDownload}
                disabled={selectedCount === 0}
                className="p-1.5 rounded-md th-text-secondary hover:th-bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title={t("downloadSelectedMd")}
              >
                <Download size={16} />
              </button>
              <button
                onClick={() => selectedCount > 0 && setConfirmBulk(true)}
                disabled={selectedCount === 0}
                className="p-1.5 rounded-md text-red-400 hover:bg-red-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title={t("deleteSelected")}
              >
                <Trash2 size={16} />
              </button>
            </div>

            {/* Tag input */}
            {tagInputOpen && (
              <div>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={tagInputValue}
                    onChange={(e) => {
                      setTagInputValue(e.target.value);
                      if (tagError) setTagError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleBulkTag();
                      if (e.key === "Escape") setTagInputOpen(false);
                    }}
                    placeholder={t("newTagPlaceholder")}
                    className="flex-1 min-w-0 bg-transparent border th-border rounded-md th-text text-xs px-2 py-1 focus:outline-none focus:border-blue-400"
                    autoFocus
                  />
                  <button
                    onClick={handleBulkTag}
                    disabled={!tagInputValue.trim()}
                    className="p-1.5 rounded-md text-blue-400 hover:th-bg-surface disabled:opacity-30 transition-colors"
                    title={t("applyTag")}
                  >
                    <Check size={16} />
                  </button>
                </div>
                {tagError && (
                  <p className="mt-1 px-1 text-[11px] text-red-400">{tagError}</p>
                )}
              </div>
            )}

            {/* Move-to-folder menu */}
            {moveMenuOpen && (
              <div className="rounded-md border th-border th-bg-surface p-1 space-y-0.5 max-h-48 overflow-y-auto custom-scrollbar">
                {folders.length === 0 && (
                  <div className="px-2 py-1 text-[11px] th-text-ghost">
                    {t("noFoldersYet")}
                  </div>
                )}
                {folders.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => handleMoveToFolder(f.id)}
                    className="w-full flex items-center gap-1.5 px-2 py-1 rounded text-xs th-text-secondary hover:th-bg-surface-hover transition-colors text-left"
                  >
                    <Folder size={12} className="shrink-0 th-text-faint" />
                    <span className="truncate">{f.name}</span>
                  </button>
                ))}
                <button
                  onClick={() => handleMoveToFolder(null)}
                  className="w-full flex items-center gap-1.5 px-2 py-1 rounded text-xs th-text-faint hover:th-bg-surface-hover transition-colors text-left"
                >
                  <FolderX size={12} className="shrink-0" />
                  {t("removeFromFolder")}
                </button>
                <div className="flex items-center gap-1 pt-0.5 border-t th-border-secondary">
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newFolderName.trim())
                        handleCreateFolderAndMove(newFolderName);
                      if (e.key === "Escape") setMoveMenuOpen(false);
                    }}
                    placeholder={t("newFolderPlaceholder")}
                    className="flex-1 min-w-0 bg-transparent border th-border rounded th-text text-xs px-2 py-1 focus:outline-none focus:border-blue-400"
                  />
                  <button
                    onClick={() => handleCreateFolderAndMove(newFolderName)}
                    disabled={!newFolderName.trim()}
                    className="p-1 rounded text-blue-400 hover:th-bg-surface disabled:opacity-30 transition-colors"
                    title={t("createFolderAndMove")}
                  >
                    <Check size={15} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          (total > 0 || folders.length > 0) && (
            <>
              <div className="mt-2 flex items-center gap-1">
                {total > 0 && (
                  <button
                    onClick={() => enterSelection()}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs th-text-faint hover:th-text-secondary hover:th-bg-surface transition-colors"
                    title={t("selectMultiple")}
                  >
                    <ListChecks size={14} />
                    {t("select")}
                  </button>
                )}
                <div className="flex-1" />
                <button
                  onClick={() => {
                    setNewFolderOpen((v) => !v);
                    setNewFolderName("");
                  }}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs hover:th-bg-surface transition-colors ${
                    newFolderOpen
                      ? "text-blue-400"
                      : "th-text-faint hover:th-text-secondary"
                  }`}
                  title={t("newFolder")}
                >
                  <FolderPlus size={14} />
                  {t("folder")}
                </button>
              </div>
              {newFolderOpen && (
                <div className="mt-1.5 flex items-center gap-1">
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateFolder();
                      if (e.key === "Escape") setNewFolderOpen(false);
                    }}
                    placeholder={t("folderNamePlaceholder")}
                    className="flex-1 min-w-0 bg-transparent border th-border rounded-md th-text text-xs px-2 py-1 focus:outline-none focus:border-blue-400"
                    autoFocus
                  />
                  <button
                    onClick={handleCreateFolder}
                    disabled={!newFolderName.trim()}
                    className="p-1.5 rounded-md text-blue-400 hover:th-bg-surface disabled:opacity-30 transition-colors"
                    title={t("createFolder")}
                  >
                    <Check size={16} />
                  </button>
                </div>
              )}
            </>
          )
        )}

        {/* Active tag filter */}
        {effectiveFilterTag && !selectionMode && (
          <div className="mt-2 flex items-center gap-1.5 px-2 py-1 rounded-md th-bg-surface text-xs">
            <Tag size={12} className="text-blue-400 shrink-0" />
            <span className="flex-1 min-w-0 truncate th-text-secondary">
              {effectiveFilterTag}
            </span>
            <button
              onClick={() => setFilterTag(null)}
              className="shrink-0 th-text-faint hover:text-red-400 transition-colors"
              title={t("clearFilter")}
            >
              <X size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-2 py-2">
        {total === 0 && !(!showArchived && folderGroups.length > 0) ? (
          showArchived ? (
            <EmptyState
              icon={Archive}
              title={t("noArchivedTitle")}
              description={t("noArchivedDesc")}
            />
          ) : effectiveFilterTag ? (
            <EmptyState
              icon={Tag}
              title={t("noMatchesTitle")}
              description={t("noMatchesDesc", { tag: effectiveFilterTag })}
            />
          ) : (
            <EmptyState
              icon={MessageSquare}
              title={t("noConversationsTitle")}
              description={t("noConversationsDesc")}
              action={onNewChat}
              actionLabel={t("newConversationAction")}
            />
          )
        ) : (
          <>
            {folderGroups.map(renderFolder)}
            {bucketed.map((group) => (
              <div key={group.label} className="mb-3">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider th-text-ghost sticky top-0 th-bg-sidebar z-[1]">
                  {BUCKET_LABELS[group.label] || group.label}
                </div>
                {group.items.map(renderSession)}
              </div>
            ))}
          </>
        )}
      </div>

      {/* Archived toggle */}
      {(archivedCount > 0 || showArchived) && (
        <button
          onClick={() => {
            setShowArchived((v) => !v);
            setFilterTag(null);
            if (selectionMode) exitSelection();
          }}
          className="flex items-center gap-2 px-4 py-2 border-t th-border-secondary text-xs th-text-faint hover:th-text-secondary hover:th-bg-surface transition-colors"
        >
          {showArchived ? (
            <>
              <ArchiveRestore size={14} />
              {t("backToConversations")}
            </>
          ) : (
            <>
              <Archive size={14} />
              {t("archivedCountLabel", { count: archivedCount })}
            </>
          )}
        </button>
      )}
      {/* User profile bar */}
      {showUserMenu && (
        <div className="p-3 border-t th-border-secondary">
          <UserMenu
            onOpenProfile={() => setShowProfile(true)}
            onOpenBilling={() => window.location.href = "/billing"}
          />
        </div>
      )}

      <ConfirmToast
        message={deleteTarget ? t("deleteConversationConfirm") : null}
        onConfirm={() => {
          deleteSession(deleteTarget);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmToast
        message={
          confirmBulk
            ? t("deleteBulkConfirm", { count: selectedCount })
            : null
        }
        onConfirm={handleBulkDelete}
        onCancel={() => setConfirmBulk(false)}
      />

      <ConfirmToast
        message={
          deleteFolderTarget
            ? t("deleteFolderConfirm")
            : null
        }
        onConfirm={() => {
          deleteFolder(deleteFolderTarget);
          setDeleteFolderTarget(null);
        }}
        onCancel={() => setDeleteFolderTarget(null)}
      />

      {showProfile && (
        <UserProfileModal onClose={() => setShowProfile(false)} />
      )}
    </div>
  );
}
