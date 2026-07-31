"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "use-intl";
import {
  Search,
  Folder,
  FileSpreadsheet,
  ArrowLeft,
  Loader2,
  Check,
  AlertCircle,
} from "lucide-react";
import { useOAuthPopup } from "@/hooks/useOAuthPopup";

// Official-looking OneDrive logo (same SVG used by chat/OneDrivePicker).
function OneDriveIcon({ size = 20, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="35.98 139.2 648.03 430.85"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <radialGradient
          id="odfp-r0"
          gradientUnits="userSpaceOnUse"
          cx="0"
          cy="0"
          r="1"
          gradientTransform="matrix(130.864814,156.804864,-260.089994,217.063603,48.669602,228.766494)"
        >
          <stop offset="0" stopColor="rgb(72,148,254)" />
          <stop offset="0.695" stopColor="rgb(9,52,179)" />
        </radialGradient>
        <radialGradient
          id="odfp-r1"
          gradientUnits="userSpaceOnUse"
          cx="0"
          cy="0"
          r="1"
          gradientTransform="matrix(-575.289668,663.594003,-491.728488,-426.294267,596.956501,-6.380235)"
        >
          <stop offset="0.165" stopColor="rgb(35,192,254)" />
          <stop offset="0.534" stopColor="rgb(28,145,255)" />
        </radialGradient>
        <linearGradient
          id="odfp-l0"
          gradientUnits="userSpaceOnUse"
          x1="449.995"
          y1="569.73"
          x2="449.995"
          y2="275.97"
        >
          <stop offset="0" stopColor="rgb(0,134,255)" />
          <stop offset="0.49" stopColor="rgb(0,187,255)" />
        </linearGradient>
      </defs>
      <path
        fill="url(#odfp-r0)"
        d="M215.078 205.09C116.012 205.094 41.957 286.188 36.383 376.527C39.836 395.992 51.176 434.43 68.941 432.457C91.145 429.988 147.066 432.457 194.766 346.105C229.609 283.027 301.285 205.086 215.078 205.09Z"
      />
      <path
        fill="url(#odfp-r1)"
        d="M192.172 238.813C158.871 291.535 114.043 367.086 98.914 390.859C80.93 419.121 33.305 407.113 37.25 366.609C36.863 369.895 36.563 373.211 36.355 376.547C29.844 481.934 113.398 569.453 217.375 569.453C331.969 569.453 605.27 426.672 577.609 283.609C548.457 199.52 466.523 139.203 373.664 139.203C280.809 139.203 221.297 192.699 192.172 238.813Z"
      />
      <path
        fill="url(#odfp-l0)"
        d="M215.699 569.496C215.699 569.496 489.32 570.035 535.734 570.035C619.961 570.035 684 501.273 684 421.031C684 340.789 618.672 272.445 535.734 272.445C452.793 272.445 405.027 334.492 369.152 402.227C327.117 481.594 273.488 568.547 215.699 569.496Z"
      />
    </svg>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

const SPREADSHEET_EXTENSIONS = [".xlsx", ".xls", ".xlsm", ".ods", ".csv", ".tsv"];

function getAuthHeaders() {
  if (typeof window === "undefined") return {};
  const token = window.localStorage.getItem("th2_auth_token") || "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function isSpreadsheetFile(item) {
  if (!item || item.type !== "file") return false;
  const name = (item.name || "").toLowerCase();
  return SPREADSHEET_EXTENSIONS.some((ext) => name.endsWith(ext));
}

function joinParentAndName(parentPath, name) {
  // Graph returns parentReference.path like "/drive/root:" (root) or
  // "/drive/root:/Folder/Sub". Backend executors want a plain path relative
  // to the drive root (e.g. "file.xlsx" or "Folder/Sub/file.xlsx").
  const GRAPH_ROOT_PREFIX = "/drive/root:";
  let parent = parentPath || "";
  if (parent.startsWith(GRAPH_ROOT_PREFIX)) {
    parent = parent.slice(GRAPH_ROOT_PREFIX.length);
  }
  parent = parent.replace(/^\/+/, "").replace(/\/+$/, "");
  return parent ? `${parent}/${name}` : name;
}

// ──────────────────────────────────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────────────────────────────────

export default function OneDriveFilePicker({ onFileSelected, onCancel }) {
  const t = useTranslations("OneDriveFilePicker");
  const [items, setItems] = useState([]);
  const [breadcrumb, setBreadcrumb] = useState([
    { id: null, name: t("home") },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notConnected, setNotConnected] = useState(false);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const searchTimer = useRef(null);

  // ── Load a folder ──────────────────────────────────────────────────────────
  const loadFolder = useCallback(async (folderId) => {
    setLoading(true);
    setError(null);
    setNotConnected(false);
    setSelected(null);
    try {
      const params = new URLSearchParams({
        top: "100",
        file_type: "spreadsheet",
      });
      if (folderId) params.set("folder_id", folderId);
      const res = await fetch(
        `/api/onedrivebrowser/list?${params.toString()}`,
        { headers: getAuthHeaders() },
      );
      if (res.status === 401) {
        setNotConnected(true);
        setItems([]);
        return;
      }
      const data = await res.json();
      if (data.status === "success") {
        const sorted = [...(data.items || [])].sort((a, b) => {
          if (a.type === b.type) return (a.name || "").localeCompare(b.name || "");
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
    // `t` intentionally excluded: it must stay referentially stable so the
    // mount-only effect below (`[loadFolder]`) doesn't refire on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadFolder(null);
  }, [loadFolder]);

  // Inline OneDrive OAuth flow — no need to bounce through /integrations.
  const { openOAuth } = useOAuthPopup({
    onSuccess: (provider) => {
      if (provider !== "microsoft_onedrive") return;
      setConnecting(false);
      setNotConnected(false);
      setError(null);
      loadFolder(null);
    },
    onFailure: (err) => {
      setConnecting(false);
      setError(
        typeof err === "string" && err !== "unknown_error"
          ? t("connectionFailedWithReason", { reason: err })
          : t("connectionFailed"),
      );
    },
    onCancel: () => setConnecting(false),
  });

  const handleConnectOneDrive = useCallback(() => {
    setConnecting(true);
    setError(null);
    openOAuth("microsoft_onedrive");
  }, [openOAuth]);

  // ── Navigation ─────────────────────────────────────────────────────────────
  const enterFolder = useCallback(
    (item) => {
      setBreadcrumb((prev) => [...prev, { id: item.id, name: item.name }]);
      loadFolder(item.id);
    },
    [loadFolder],
  );

  const jumpTo = useCallback(
    (index) => {
      const newCrumb = breadcrumb.slice(0, index + 1);
      setBreadcrumb(newCrumb);
      setSearch("");
      loadFolder(newCrumb[newCrumb.length - 1].id);
    },
    [breadcrumb, loadFolder],
  );

  // ── Debounced search ───────────────────────────────────────────────────────
  useEffect(() => {
    clearTimeout(searchTimer.current);
    const query = search.trim();
    if (!query) return;
    setSearching(true);
    setError(null);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/onedrivebrowser/search?q=${encodeURIComponent(query)}&top=50`,
          { headers: getAuthHeaders() },
        );
        if (res.status === 401) {
          setNotConnected(true);
          setItems([]);
          return;
        }
        const data = await res.json();
        if (data.status === "success") {
          // Only keep Excel files and folders
          const filtered = (data.items || []).filter(
            (it) => it.type === "folder" || isSpreadsheetFile(it),
          );
          const sorted = filtered.sort((a, b) => {
            if (a.type === b.type)
              return (a.name || "").localeCompare(b.name || "");
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
    }, 300);
    return () => clearTimeout(searchTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleItemClick = (item) => {
    if (item.type === "folder") {
      enterFolder(item);
      return;
    }
    if (!isSpreadsheetFile(item)) return;
    setSelected(item);
  };

  const handleItemDoubleClick = (item) => {
    if (item.type === "folder") {
      enterFolder(item);
    }
  };

  const handleConfirm = () => {
    if (!selected) return;
    const item_path = joinParentAndName(selected.parentPath, selected.name);
    onFileSelected({
      item_id: selected.id,
      item_path,
      filename: selected.name,
    });
  };

  const isSearching = !!search.trim();

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 text-sm th-text-secondary hover:th-text transition-colors"
          >
            <ArrowLeft size={16} />
            {t("backToOptions")}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <OneDriveIcon size={22} />
        <h3 className="text-lg font-bold th-text">{t("browseOneDrive")}</h3>
      </div>

      {/* Search */}
      <div className="mb-3">
        <div className="relative">
          {searching ? (
            <Loader2
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 animate-spin"
            />
          ) : (
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 th-text-faint"
            />
          )}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="glass-input w-full pl-9 pr-4 py-2 rounded-lg text-sm"
          />
        </div>

        {/* Breadcrumb */}
        {!isSearching && (
          <div className="flex items-center gap-1 mt-3 flex-wrap">
            {breadcrumb.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span className="th-text-faint text-xs">/</span>}
                <button
                  onClick={() => jumpTo(i)}
                  className={`text-xs transition-colors px-1 ${
                    i === breadcrumb.length - 1
                      ? "th-text font-medium cursor-default"
                      : "th-text-secondary hover:th-text"
                  }`}
                >
                  {crumb.name}
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Not connected → connect inline via OAuth popup, no detour to /integrations. */}
      {notConnected && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 mb-4">
          <div className="flex items-start gap-3">
            <OneDriveIcon size={24} className="shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm th-text font-medium mb-1">
                {t("notConnected")}
              </p>
              <p className="text-xs th-text-secondary mb-3">
                {t("notConnectedDescription")}
              </p>
              <button
                type="button"
                onClick={handleConnectOneDrive}
                disabled={connecting}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sky-500/20 text-sky-200 hover:bg-sky-500/30 transition-colors text-xs font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {connecting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <OneDriveIcon size={14} />
                )}
                {connecting ? t("connecting") : t("connectOneDrive")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && !notConnected && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 mb-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Items list */}
      <div className="max-h-[45vh] overflow-y-auto rounded-xl border th-border th-bg-surface mb-4">
        {loading || searching ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={22} className="animate-spin text-blue-400" />
          </div>
        ) : items.length === 0 && !notConnected ? (
          <div className="py-12 text-center">
            <FileSpreadsheet size={36} className="mx-auto mb-2 th-text-faint" />
            <p className="text-sm th-text-secondary">
              {isSearching ? t("noFilesFound") : t("folderEmpty")}
            </p>
          </div>
        ) : (
          <ul className="divide-y th-border">
            {items.map((item) => {
              const isFolder = item.type === "folder";
              const isExcel = isSpreadsheetFile(item);
              const disabled = !isFolder && !isExcel;
              const isSelected = selected?.id === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => handleItemClick(item)}
                    onDoubleClick={() => handleItemDoubleClick(item)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                      isSelected
                        ? "bg-blue-500/15 border-l-2 border-blue-500"
                        : "hover:bg-white/5"
                    } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
                  >
                    {isFolder ? (
                      <Folder size={18} className="text-blue-300 shrink-0" />
                    ) : (
                      <FileSpreadsheet
                        size={18}
                        className="text-emerald-300 shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm th-text truncate">{item.name}</p>
                      {!isFolder && item.size ? (
                        <p className="text-[11px] th-text-faint mt-0.5">
                          {formatBytes(item.size)}
                        </p>
                      ) : null}
                    </div>
                    {isSelected && (
                      <Check size={16} className="text-blue-400 shrink-0" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between">
        <div className="text-xs th-text-faint truncate pr-4">
          {selected ? t("selectedFile", { name: selected.name }) : t("selectFilePrompt")}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg th-text-secondary hover:th-text hover:th-bg-surface-hover text-sm font-medium transition-colors"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selected}
            className="btn-brand flex items-center gap-2 px-5 py-2 text-white rounded-lg font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Check size={14} />
            {t("select")}
          </button>
        </div>
      </div>

    </div>
  );
}

function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}
