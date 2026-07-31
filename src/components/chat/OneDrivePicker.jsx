"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "use-intl";
import {
  X,
  Search,
  ChevronRight,
  Folder,
  FileText,
  ImageIcon,
  FileSpreadsheet,
  Presentation,
  File as FileGenericIcon,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { formatDate as formatDateParis } from "@/lib/datetime";

// ── OneDrive brand icon (2025) ────────────────────────────────────────────────
function OneDriveIcon({ size = 20, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="35.98 139.2 648.03 430.85"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <radialGradient id="od-r0" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1"
          gradientTransform="matrix(130.864814,156.804864,-260.089994,217.063603,48.669602,228.766494)">
          <stop offset="0" stopColor="rgb(72,148,254)" />
          <stop offset="0.695" stopColor="rgb(9,52,179)" />
        </radialGradient>
        <radialGradient id="od-r1" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1"
          gradientTransform="matrix(-575.289668,663.594003,-491.728488,-426.294267,596.956501,-6.380235)">
          <stop offset="0.165" stopColor="rgb(35,192,254)" />
          <stop offset="0.534" stopColor="rgb(28,145,255)" />
        </radialGradient>
        <linearGradient id="od-l0" gradientUnits="userSpaceOnUse" x1="449.995" y1="569.73" x2="449.995" y2="275.97">
          <stop offset="0" stopColor="rgb(0,134,255)" />
          <stop offset="0.49" stopColor="rgb(0,187,255)" />
        </linearGradient>
      </defs>
      <path fill="url(#od-r0)"
        d="M215.078 205.09C116.012 205.094 41.957 286.188 36.383 376.527C39.836 395.992 51.176 434.43 68.941 432.457C91.145 429.988 147.066 432.457 194.766 346.105C229.609 283.027 301.285 205.086 215.078 205.09Z" />
      <path fill="url(#od-r1)"
        d="M192.172 238.813C158.871 291.535 114.043 367.086 98.914 390.859C80.93 419.121 33.305 407.113 37.25 366.609C36.863 369.895 36.563 373.211 36.355 376.547C29.844 481.934 113.398 569.453 217.375 569.453C331.969 569.453 605.27 426.672 577.609 283.609C548.457 199.52 466.523 139.203 373.664 139.203C280.809 139.203 221.297 192.699 192.172 238.813Z" />
      <path fill="url(#od-l0)"
        d="M215.699 569.496C215.699 569.496 489.32 570.035 535.734 570.035C619.961 570.035 684 501.273 684 421.031C684 340.789 618.672 272.445 535.734 272.445C452.793 272.445 405.027 334.492 369.152 402.227C327.117 481.594 273.488 568.547 215.699 569.496Z" />
    </svg>
  );
}

// ── File-type icon chooser ────────────────────────────────────────────────────
function ItemIcon({ item }) {
  if (item.type === "folder") {
    return <Folder size={18} className="text-blue-300/80 shrink-0" />;
  }
  const ext = (item.name || "").split(".").pop()?.toLowerCase() ?? "";
  const mime = item.mimeType ?? "";
  if (mime.startsWith("image/"))
    return <ImageIcon size={18} className="text-purple-300/80 shrink-0" />;
  if (mime.includes("pdf"))
    return <FileText size={18} className="text-purple-300/80 shrink-0" />;
  if (["xlsx", "xls", "csv"].includes(ext))
    return <FileSpreadsheet size={18} className="text-blue-300/80 shrink-0" />;
  if (["pptx", "ppt"].includes(ext))
    return <Presentation size={18} className="text-purple-300/80 shrink-0" />;
  if (["docx", "doc"].includes(ext))
    return <FileText size={18} className="text-blue-300/80 shrink-0" />;
  return <FileGenericIcon size={18} className="th-text-faint shrink-0" />;
}

function fmt(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

// ── Auth header helper ────────────────────────────────────────────────────────
function getAuthHeaders() {
  const token =
    (typeof window !== "undefined" && localStorage.getItem("th2_auth_token")) || "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function OneDrivePicker({ onFileSelect, onClose }) {
  const t = useTranslations("OneDrivePicker");
  const [items, setItems] = useState([]);
  const [breadcrumb, setBreadcrumb] = useState([{ id: null, name: t("myOneDrive") }]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(new Map()); // id → item
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState(null);
  const searchTimer = useRef(null);

  // ── Load a folder ────────────────────────────────────────────────────────
  const loadFolder = useCallback(async (folderId) => {
    setLoading(true);
    setError(null);
    setSelected(new Map());
    setAddError(null);
    try {
      const params = new URLSearchParams({ top: "100" });
      if (folderId) params.set("folder_id", folderId);
      const res = await fetch(`/api/onedrivebrowser/list?${params}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.status === "success") {
        // Folders first, then files alphabetically
        const sorted = [...(data.items || [])].sort((a, b) => {
          if (a.type === b.type) return a.name.localeCompare(b.name);
          return a.type === "folder" ? -1 : 1;
        });
        setItems(sorted);
      } else {
        setError(data.message || t("failedToLoad"));
      }
    } catch {
      setError(t("networkError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  // Initial load
  useEffect(() => {
    loadFolder(null);
  }, [loadFolder]);

  // ── Navigate into a folder ───────────────────────────────────────────────
  const navigateTo = useCallback(
    (item) => {
      setBreadcrumb((prev) => [...prev, { id: item.id, name: item.name }]);
      loadFolder(item.id);
    },
    [loadFolder],
  );

  // ── Breadcrumb jump ──────────────────────────────────────────────────────
  const jumpTo = useCallback(
    (index) => {
      const newCrumb = breadcrumb.slice(0, index + 1);
      setBreadcrumb(newCrumb);
      loadFolder(newCrumb[newCrumb.length - 1].id);
      setSearch("");
    },
    [breadcrumb, loadFolder],
  );

  // ── Debounced search ─────────────────────────────────────────────────────
  useEffect(() => {
    clearTimeout(searchTimer.current);
    if (!search.trim()) {
      const current = breadcrumb[breadcrumb.length - 1];
      loadFolder(current.id);
      return;
    }
    setSearching(true);
    setError(null);
    setSelected(new Map());
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/onedrivebrowser/search?q=${encodeURIComponent(search.trim())}&top=60`,
          { headers: getAuthHeaders() },
        );
        const data = await res.json();
        if (data.status === "success") {
          const sorted = [...(data.items || [])].sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === "folder" ? -1 : 1;
          });
          setItems(sorted);
        } else {
          setError(data.message || t("searchFailed"));
        }
      } catch {
        setError(t("networkErrorShort"));
      } finally {
        setSearching(false);
      }
    }, 380);
    return () => clearTimeout(searchTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // ── Add selected files to chat ──────────────────────────────────────────
  const handleAdd = useCallback(async () => {
    if (selected.size === 0) return;
    const fileItems = [...selected.values()].filter((i) => i.type !== "folder");
    if (fileItems.length === 0) return;

    setAdding(true);
    setAddError(null);
    const errors = [];

    for (const item of fileItems) {
      try {
        const res = await fetch(
          `/api/onedrivebrowser/content?item_id=${encodeURIComponent(item.id)}`,
          { headers: getAuthHeaders() },
        );
        const data = await res.json();
        if (data.status !== "success") {
          errors.push(`${item.name}: ${data.message || t("failedToLoadShort")}`);
          continue;
        }

        // Build a proper File object from the base64 data-URI
        const commaIdx = data.base64.indexOf(",");
        const b64 = data.base64.slice(commaIdx + 1);
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: data.mimeType });
        const file = new File([blob], data.name, { type: data.mimeType });

        const isImage = data.mimeType.startsWith("image/");
        onFileSelect({
          id: `od_${Date.now()}_${item.id}`,
          name: data.name,
          type: data.mimeType,
          size: data.size,
          file,
          base64: data.base64,
          preview: isImage ? data.base64 : null,
          fromOneDrive: true,
        });
      } catch (e) {
        console.error("OneDrive attach error:", e);
        errors.push(`${item.name}: ${t("unexpectedError", { message: e?.message || e })}`);
      }
    }

    setAdding(false);
    if (errors.length > 0) {
      setAddError(errors.join(" · "));
    } else {
      onClose();
    }
  }, [selected, onFileSelect, onClose, t]);

  // ── Close on Escape ──────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const isSearching = !!search.trim();
  const isIdle = !loading && !searching;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 th-bg-overlay"
      style={{ backdropFilter: "blur(6px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full flex flex-col rounded-2xl overflow-hidden th-bg-body border th-border"
        style={{
          maxWidth: 640,
          maxHeight: "82vh",
          boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset",
        }}
      >
        {/* ── Header ───────────────────────────────────────────────────── */}
        <div
          className="flex items-center gap-3 px-5 py-4 shrink-0 border-b th-border-secondary"
        >
          <OneDriveIcon size={22} />
          <span className="th-text font-semibold text-[15px] tracking-tight">
            {t("browseOneDrive")}
          </span>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg th-text-faint hover:th-text-muted hover:th-bg-surface transition-colors"
          >
            <X size={17} />
          </button>
        </div>

        {/* ── Search ───────────────────────────────────────────────────── */}
        <div
          className="px-4 py-3 shrink-0 border-b th-border-secondary"
        >
          <div className="relative">
            {searching ? (
              <Loader2
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 animate-spin"
              />
            ) : (
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 th-text-ghost"
              />
            )}
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="w-full rounded-xl pl-9 pr-4 py-2 text-sm th-text-secondary placeholder:th-text-ghost focus:outline-none transition-all th-bg-surface border th-border-secondary focus:border-brand/40"
            />
          </div>

          {/* Breadcrumb — hidden during search */}
          {!isSearching && (
            <div className="flex items-center gap-1 mt-2.5 overflow-x-auto scrollbar-hide">
              {breadcrumb.map((crumb, i) => (
                <span key={i} className="flex items-center gap-1 shrink-0">
                  {i > 0 && (
                    <ChevronRight size={11} className="th-text-ghost" />
                  )}
                  <button
                    onClick={() => jumpTo(i)}
                    className={`text-[11px] transition-colors rounded px-0.5 ${
                      i === breadcrumb.length - 1
                        ? "th-text-muted cursor-default"
                        : "th-text-faint hover:th-text-muted"
                    }`}
                  >
                    {crumb.name}
                  </button>
                </span>
              ))}
            </div>
          )}
          {isSearching && (
            <p className="text-[11px] th-text-faint mt-2">
              {t("searchingAllFiles")}
            </p>
          )}
        </div>

        {/* ── File list ─────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-2 py-1.5">
          {/* Loading state */}
          {(loading || searching) && (
            <div className="flex flex-col items-center justify-center h-52 gap-3 text-white/30">
              <Loader2 size={22} className="animate-spin text-blue-400/50" />
              <span className="text-xs">{searching ? t("searching") : t("loadingFiles")}</span>
            </div>
          )}

          {/* Error state */}
          {isIdle && error && (
            <div className="flex flex-col items-center justify-center h-52 gap-2 text-red-400/60">
              <AlertCircle size={22} />
              <p className="text-sm text-center px-6">{error}</p>
            </div>
          )}

          {/* Empty state */}
          {isIdle && !error && items.length === 0 && (
            <div className="flex flex-col items-center justify-center h-52 gap-2 text-white/25">
              <OneDriveIcon size={28} className="opacity-40" />
              <p className="text-sm">{isSearching ? t("noFilesFound") : t("folderEmpty")}</p>
            </div>
          )}

          {/* File rows */}
          {isIdle && !error && items.length > 0 && (
            <div className="flex flex-col gap-0.5">
              {items.map((item) => {
                const isFolder = item.type === "folder";
                const isSelected = selected.has(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={(e) => {
                      if (isFolder) {
                        navigateTo(item);
                        return;
                      }
                      // Cmd/Ctrl+click = toggle individual item
                      // Regular click = select only this item
                      if (e.metaKey || e.ctrlKey) {
                        setSelected((prev) => {
                          const next = new Map(prev);
                          if (next.has(item.id)) next.delete(item.id);
                          else next.set(item.id, item);
                          return next;
                        });
                      } else {
                        setSelected(new Map([[item.id, item]]));
                      }
                    }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left w-full transition-all"
                    style={{
                      background: isSelected
                        ? "rgba(59,130,246,0.15)"
                        : "transparent",
                      border: isSelected
                        ? "1px solid rgba(59,130,246,0.3)"
                        : "1px solid transparent",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected)
                        e.currentTarget.style.background =
                          "rgba(255,255,255,0.04)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected)
                        e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <ItemIcon item={item} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm th-text-secondary truncate leading-tight">
                        {item.name}
                      </p>
                      {!isFolder && (
                        <p className="text-[11px] th-text-ghost mt-0.5">
                          {[
                            fmt(item.size),
                            item.lastModified
                              ? formatDateParis(item.lastModified)
                              : null,
                          ]
                            .filter(Boolean)
                            .join("  ·  ")}
                        </p>
                      )}
                    </div>
                    {isFolder && (
                      <ChevronRight size={13} className="th-text-ghost shrink-0" />
                    )}
                    {isSelected && !isFolder && (
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: "rgba(59,130,246,0.9)" }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <div
          className="px-4 py-3 flex items-center gap-3 shrink-0 border-t th-border-secondary"
        >
          {addError ? (
            <p className="text-xs text-red-400/80 flex-1 truncate">{addError}</p>
          ) : (
            <p className="text-xs th-text-ghost flex-1 truncate">
              {selected.size > 0
                ? selected.size === 1
                  ? `${[...selected.values()][0].name}`
                  : t("filesSelected", { count: selected.size })
                : t("selectFiles")}
            </p>
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs th-text-faint hover:th-text-muted transition-colors rounded-lg"
          >
            {t("cancel")}
          </button>

          <button
            type="button"
            onClick={handleAdd}
            disabled={selected.size === 0 || adding}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white rounded-xl transition-all disabled:opacity-35 disabled:cursor-not-allowed bg-linear-to-br from-brand to-brand-secondary hover:from-brand-hover hover:to-brand"
          >
            {adding && <Loader2 size={13} className="animate-spin" />}
            {adding ? t("attaching") : selected.size > 1 ? t("attachFilesCount", { count: selected.size }) : t("attachToChat")}
          </button>
        </div>
      </div>
    </div>
  );
}