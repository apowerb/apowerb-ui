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

// ── Google Drive brand icon ───────────────────────────────────────────────────
function GoogleDriveIcon({ size = 20, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 -13.5 256 256"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid"
      className={className}
    >
      <g>
        <path d="M19.3542312,196.033928 L30.644172,215.534816 C32.9900287,219.64014 36.3622164,222.86588 40.3210929,225.211737 C51.6602421,210.818376 59.5534225,199.772864 64.000634,192.075201 C68.5137119,184.263529 74.0609657,172.045039 80.6423954,155.41973 C62.9064315,153.085282 49.4659974,151.918058 40.3210929,151.918058 C31.545465,151.918058 18.1051007,153.085282 0,155.41973 C0,159.964996 1.17298825,164.510261 3.51893479,168.615586 L19.3542312,196.033928 Z" fill="#0066DA" />
        <path d="M215.681443,225.211737 C219.64032,222.86588 223.012507,219.64014 225.358364,215.534816 L230.050377,207.470615 L252.483511,168.615586 C254.829368,164.510261 256.002446,159.964996 256.002446,155.41973 C237.79254,153.085282 224.376613,151.918058 215.754667,151.918058 C206.488712,151.918058 193.072785,153.085282 175.506888,155.41973 C182.010479,172.136093 187.484394,184.354584 191.928633,192.075201 C196.412073,199.863919 204.329677,210.909431 215.681443,225.211737 Z" fill="#EA4335" />
        <path d="M128.001268,73.3111515 C141.121182,57.4655263 150.162898,45.2470011 155.126415,36.6555757 C159.123121,29.7376196 163.521739,18.6920726 168.322271,3.51893479 C164.363395,1.1729583 159.818129,0 155.126415,0 L100.876121,0 C96.1841079,0 91.638842,1.31958557 87.6799655,3.51893479 C93.7861943,20.9210065 98.9675428,33.3058067 103.224011,40.6733354 C107.927832,48.8151881 116.186918,59.6944602 128.001268,73.3111515 Z" fill="#00832D" />
        <path d="M175.360141,155.41973 L80.6420959,155.41973 L40.3210929,225.211737 C44.2799694,227.557893 48.8252352,228.730672 53.5172481,228.730672 L202.485288,228.730672 C207.177301,228.730672 211.722567,227.411146 215.681443,225.211737 L175.360141,155.41973 Z" fill="#2684FC" />
        <path d="M128.001268,73.3111515 L87.680265,3.51893479 C83.7213885,5.86488134 80.3489013,9.09044179 78.0030446,13.1960654 L3.51893479,142.223575 C1.17298825,146.329198 0,150.874464 0,155.41973 L80.6423954,155.41973 L128.001268,73.3111515 Z" fill="#00AC47" />
        <path d="M215.241501,77.7099697 L177.999492,13.1960654 C175.653635,9.09044179 172.281148,5.86488134 168.322271,3.51893479 L128.001268,73.3111515 L175.360141,155.41973 L255.855999,155.41973 C255.855999,150.874464 254.682921,146.329198 252.337064,142.223575 L215.241501,77.7099697 Z" fill="#FFBA00" />
      </g>
    </svg>
  );
}

// ── Google Drive folder MIME type ─────────────────────────────────────────────
const FOLDER_MIME = "application/vnd.google-apps.folder";

// ── File-type icon chooser ────────────────────────────────────────────────────
function ItemIcon({ item }) {
  if (item.mimeType === FOLDER_MIME) {
    return <Folder size={18} className="text-blue-300/80 shrink-0" />;
  }
  const ext = (item.name || "").split(".").pop()?.toLowerCase() ?? "";
  const mime = item.mimeType ?? "";
  if (mime.startsWith("image/"))
    return <ImageIcon size={18} className="text-purple-300/80 shrink-0" />;
  if (mime.includes("pdf"))
    return <FileText size={18} className="text-purple-300/80 shrink-0" />;
  if (["xlsx", "xls", "csv"].includes(ext) || mime.includes("spreadsheet"))
    return <FileSpreadsheet size={18} className="text-blue-300/80 shrink-0" />;
  if (["pptx", "ppt"].includes(ext) || mime.includes("presentation"))
    return <Presentation size={18} className="text-purple-300/80 shrink-0" />;
  if (["docx", "doc"].includes(ext) || mime.includes("document"))
    return <FileText size={18} className="text-blue-300/80 shrink-0" />;
  return <FileGenericIcon size={18} className="th-text-faint shrink-0" />;
}

function fmt(bytes) {
  if (!bytes) return "";
  const n = parseInt(bytes, 10);
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

// ── Auth header helper ────────────────────────────────────────────────────────
function getAuthHeaders() {
  const token =
    (typeof window !== "undefined" && localStorage.getItem("th2_auth_token")) || "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function GoogleDrivePicker({ onFileSelect, onClose }) {
  const t = useTranslations("GoogleDrivePicker");
  const [items, setItems] = useState([]);
  const [breadcrumb, setBreadcrumb] = useState([{ id: null, name: t("myDrive") }]);
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
      const params = new URLSearchParams({ max_results: "100" });
      if (folderId) params.set("folder_id", folderId);
      const res = await fetch(`/api/googledrivebrowser/list?${params}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.status === "success") {
        // Folders first, then files alphabetically
        const sorted = [...(data.files || [])].sort((a, b) => {
          const aFolder = a.mimeType === FOLDER_MIME;
          const bFolder = b.mimeType === FOLDER_MIME;
          if (aFolder !== bFolder) return aFolder ? -1 : 1;
          return (a.name || "").localeCompare(b.name || "");
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
          `/api/googledrivebrowser/search?q=${encodeURIComponent(search.trim())}&max_results=60`,
          { headers: getAuthHeaders() },
        );
        const data = await res.json();
        if (data.status === "success") {
          const sorted = [...(data.files || [])].sort((a, b) => {
            const aFolder = a.mimeType === FOLDER_MIME;
            const bFolder = b.mimeType === FOLDER_MIME;
            if (aFolder !== bFolder) return aFolder ? -1 : 1;
            return (a.name || "").localeCompare(b.name || "");
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

  // ── Add selected files to chat ───────────────────────────────────────────
  const handleAdd = useCallback(async () => {
    if (selected.size === 0) return;
    const fileItems = [...selected.values()].filter(
      (i) => i.mimeType !== FOLDER_MIME,
    );
    if (fileItems.length === 0) return;

    setAdding(true);
    setAddError(null);
    const errors = [];

    for (const item of fileItems) {
      try {
        const res = await fetch(
          `/api/googledrivebrowser/content?file_id=${encodeURIComponent(item.id)}`,
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
          id: `gd_${Date.now()}_${item.id}`,
          name: data.name,
          type: data.mimeType,
          size: data.size,
          file,
          base64: data.base64,
          preview: isImage ? data.base64 : null,
          fromGoogleDrive: true,
        });
      } catch (e) {
        console.error("Google Drive attach error:", e);
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
          boxShadow:
            "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset",
        }}
      >
        {/* ── Header ───────────────────────────────────────────────────── */}
        <div
          className="flex items-center gap-3 px-5 py-4 shrink-0 border-b th-border-secondary"
        >
          <GoogleDriveIcon size={22} />
          <span className="th-text font-semibold text-[15px] tracking-tight">
            {t("browseGoogleDrive")}
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
              <span className="text-xs">
                {searching ? t("searching") : t("loadingFiles")}
              </span>
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
              <GoogleDriveIcon size={28} className="opacity-40" />
              <p className="text-sm">
                {isSearching ? t("noFilesFound") : t("folderEmpty")}
              </p>
            </div>
          )}

          {/* File rows */}
          {isIdle && !error && items.length > 0 && (
            <div className="flex flex-col gap-0.5">
              {items.map((item) => {
                const isFolder = item.mimeType === FOLDER_MIME;
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
                            item.modifiedTime
                              ? formatDateParis(item.modifiedTime)
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
            {adding
              ? t("attaching")
              : selected.size > 1
              ? t("attachFilesCount", { count: selected.size })
              : t("attachToChat")}
          </button>
        </div>
      </div>
    </div>
  );
}