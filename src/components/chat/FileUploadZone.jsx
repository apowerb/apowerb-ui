"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslations } from "use-intl";
import {
  Upload,
  X,
  FileText,
  ImageIcon,
  File as FileIcon,
  Loader2,
} from "lucide-react";
import OneDrivePicker from "./OneDrivePicker";
import GoogleDrivePicker from "./GoogleDrivePicker";

const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024;

// ── OneDrive brand mark ───────────────────────────────────────────────────────
function OneDriveLogo({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="35.98 139.2 648.03 430.85" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="fuz-r0" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1"
          gradientTransform="matrix(130.864814,156.804864,-260.089994,217.063603,48.669602,228.766494)">
          <stop offset="0" stopColor="#489afe" />
          <stop offset="0.695" stopColor="#0934b3" />
        </radialGradient>
        <radialGradient id="fuz-r1" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1"
          gradientTransform="matrix(-575.289668,663.594003,-491.728488,-426.294267,596.956501,-6.380235)">
          <stop offset="0.165" stopColor="#23c0fe" />
          <stop offset="0.534" stopColor="#1c91ff" />
        </radialGradient>
        <linearGradient id="fuz-l0" gradientUnits="userSpaceOnUse" x1="449.995" y1="569.73" x2="449.995" y2="275.97">
          <stop offset="0" stopColor="#0086ff" />
          <stop offset="0.49" stopColor="#00bbff" />
        </linearGradient>
      </defs>
      <path fill="url(#fuz-r0)" d="M215.078 205.09C116.012 205.094 41.957 286.188 36.383 376.527C39.836 395.992 51.176 434.43 68.941 432.457C91.145 429.988 147.066 432.457 194.766 346.105C229.609 283.027 301.285 205.086 215.078 205.09Z" />
      <path fill="url(#fuz-r1)" d="M192.172 238.813C158.871 291.535 114.043 367.086 98.914 390.859C80.93 419.121 33.305 407.113 37.25 366.609C36.863 369.895 36.563 373.211 36.355 376.547C29.844 481.934 113.398 569.453 217.375 569.453C331.969 569.453 605.27 426.672 577.609 283.609C548.457 199.52 466.523 139.203 373.664 139.203C280.809 139.203 221.297 192.699 192.172 238.813Z" />
      <path fill="url(#fuz-l0)" d="M215.699 569.496C215.699 569.496 489.32 570.035 535.734 570.035C619.961 570.035 684 501.273 684 421.031C684 340.789 618.672 272.445 535.734 272.445C452.793 272.445 405.027 334.492 369.152 402.227C327.117 481.594 273.488 568.547 215.699 569.496Z" />
    </svg>
  );
}

// ── Google Drive brand mark ───────────────────────────────────────────────────
function GoogleDriveLogo({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 -13.5 256 256" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid">
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

// ── Device-upload icon ────────────────────────────────────────────────────────
function DeviceUploadIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M13.5 3H12H8C6.34315 3 5 4.34315 5 6V18C5 19.6569 6.34315 21 8 21H12M13.5 3L19 8.625M13.5 3V7.625C13.5 8.17728 13.9477 8.625 14.5 8.625H19M19 8.625V11.8125"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17.5 21L17.5 15M17.5 15L20 17.5M17.5 15L15 17.5"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── File preview pill ─────────────────────────────────────────────────────────
function FilePreview({ file, onRemove }) {
  const isImage = file.type?.startsWith("image/");
  const Icon = isImage ? ImageIcon : file.type?.includes("pdf") ? FileText : FileIcon;

  return (
    <div
      className="relative flex items-center gap-2 px-2 py-1.5 rounded-lg"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-primary)",
      }}
    >
      {isImage && file.preview ? (
        <img src={file.preview} alt={file.name} className="w-8 h-8 rounded object-cover shrink-0" />
      ) : (
        <Icon size={16} className="shrink-0" style={{ color: "var(--text-faint)" }} />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] truncate" style={{ color: "var(--text-secondary)" }}>
          {file.name}
        </p>
        <p className="text-[10px]" style={{ color: "var(--text-ghost)" }}>
          {file.fromOneDrive ? (
            <span className="flex items-center gap-0.5">
              <OneDriveLogo size={9} /><span>OneDrive</span>
            </span>
          ) : file.fromGoogleDrive ? (
            <span className="flex items-center gap-0.5">
              <GoogleDriveLogo size={9} /><span>Google Drive</span>
            </span>
          ) : (
            `${(file.size / 1024).toFixed(1)} KB`
          )}
        </p>
      </div>
      {file.uploading ? (
        <Loader2 size={14} className="text-blue-400 animate-spin shrink-0" />
      ) : (
        <button
          type="button"
          onClick={() => onRemove(file.id)}
          className="p-0.5 rounded transition-colors shrink-0"
          style={{ color: "var(--text-ghost)" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--bg-surface-hover)";
            e.currentTarget.style.color = "var(--text-secondary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--text-ghost)";
          }}
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function FileUploadZone({ files, onFilesChange, disabled }) {
  const t = useTranslations("FileUploadZone");
  const [isDragging, setIsDragging] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showOneDrivePicker, setShowOneDrivePicker] = useState(false);
  const [showGoogleDrivePicker, setShowGoogleDrivePicker] = useState(false);
  const [oneDriveConnected, setOneDriveConnected] = useState(false);
  const [googleDriveConnected, setGoogleDriveConnected] = useState(false);
  const fileInputRef = useRef(null);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  // ── Check active integrations ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = localStorage.getItem("th2_auth_token");
        const res = await fetch("/api/integrations", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!Array.isArray(data) || cancelled) return;
        setOneDriveConnected(
          data.some((i) => typeof i === "object" &&
            String(i.provider ?? "").toLowerCase().includes("onedrive"))
        );
        setGoogleDriveConnected(
          data.some((i) => typeof i === "object" &&
            String(i.provider ?? "").toLowerCase() === "google_drive")
        );
      } catch {
        // No integration — options simply won't appear
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const anyCloudConnected = oneDriveConnected || googleDriveConnected;

  // ── Close menu on outside click ───────────────────────────────────────────
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        !buttonRef.current?.contains(e.target)
      ) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

  // ── Process files from disk ───────────────────────────────────────────────
  const processFiles = useCallback(
    (fileList) => {
      const newFiles = Array.from(fileList).map((f) => {
        if (f.size > LARGE_FILE_THRESHOLD) {
          console.info(`[FileUploadZone] Large file: ${f.name} (${(f.size / 1024 / 1024).toFixed(1)} MB)`);
        }
        const fileObj = {
          id: `file_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          name: f.name,
          type: f.type,
          size: f.size,
          file: f,
          preview: null,
          base64: null,
          uploading: false,
          fromOneDrive: false,
          fromGoogleDrive: false,
        };
        const reader = new FileReader();
        reader.onload = (e) => {
          fileObj.base64 = e.target.result;
          if (f.type.startsWith("image/")) fileObj.preview = e.target.result;
          onFilesChange((prev) => [...prev]);
        };
        reader.readAsDataURL(f);
        return fileObj;
      });
      onFilesChange((prev) => [...prev, ...newFiles]);
    },
    [onFilesChange],
  );

  // ── Drag & drop ───────────────────────────────────────────────────────────
  const handleDragOver = useCallback((e) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e) => { e.preventDefault(); setIsDragging(false); }, []);
  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;
      processFiles(e.dataTransfer.files);
    },
    [disabled, processFiles],
  );

  const handleRemove = useCallback(
    (id) => { onFilesChange((prev) => prev.filter((f) => f.id !== id)); },
    [onFilesChange],
  );

  // ── Button click ──────────────────────────────────────────────────────────
  const handleButtonClick = () => {
    if (disabled) return;
    if (anyCloudConnected) {
      setShowMenu((v) => !v);
    } else {
      fileInputRef.current?.click();
    }
  };

  // ── Cloud file selected callbacks ─────────────────────────────────────────
  const handleCloudFile = useCallback(
    (fileObj) => { onFilesChange((prev) => [...prev, fileObj]); },
    [onFilesChange],
  );

  return (
    <div
      className="relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed pointer-events-none"
          style={{
            borderColor: "rgba(1,61,255,0.4)",
            background: "rgba(1,61,255,0.05)",
          }}
        >
          <Upload size={18} className="text-brand" />
          <span className="text-xs text-brand">{t("dropFiles")}</span>
        </div>
      )}

      {/* File previews */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {files.map((file) => (
            <FilePreview key={file.id} file={file} onRemove={handleRemove} />
          ))}
        </div>
      )}

      {/* Hidden native file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => { processFiles(e.target.files); e.target.value = ""; }}
      />

      {/* Upload button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={handleButtonClick}
        disabled={disabled}
        className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background: "var(--bg-surface)",
          color: "var(--text-faint)",
        }}
        onMouseEnter={(e) => {
          if (!disabled) {
            e.currentTarget.style.background = "var(--bg-surface-hover)";
            e.currentTarget.style.color = "var(--text-secondary)";
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "var(--bg-surface)";
          e.currentTarget.style.color = "var(--text-faint)";
        }}
        title={anyCloudConnected ? t("attachFiles") : t("uploadFromDevice")}
      >
        <Upload size={20} />
      </button>

      {/* Dropdown menu */}
      {showMenu && anyCloudConnected && (
        <div
          ref={menuRef}
          className="absolute bottom-12 left-0 z-40 min-w-[200px] rounded-xl overflow-hidden"
          style={{
            background: "var(--glass-modal-bg)",
            border: "1px solid var(--glass-modal-border)",
            boxShadow: "0 16px 48px var(--glass-modal-shadow)",
          }}
        >
          {/* Arrow pointer */}
          <div
            className="absolute -bottom-[6px] left-4 w-3 h-3 rotate-45"
            style={{
              background: "var(--glass-modal-bg)",
              borderRight: "1px solid var(--glass-modal-border)",
              borderBottom: "1px solid var(--glass-modal-border)",
            }}
          />

          <div className="p-1">
            {/* From device */}
            <button
              type="button"
              onClick={() => { setShowMenu(false); fileInputRef.current?.click(); }}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left transition-colors"
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-surface-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span
                className="flex items-center justify-center w-7 h-7 rounded-lg"
                style={{
                  background: "var(--bg-surface)",
                  color: "var(--text-secondary)",
                }}
              >
                <DeviceUploadIcon size={15} />
              </span>
              <div>
                <p className="text-sm font-medium leading-tight" style={{ color: "var(--text-secondary)" }}>
                  {t("fromDevice")}
                </p>
                <p className="text-[10px]" style={{ color: "var(--text-ghost)" }}>
                  {t("uploadLocalFile")}
                </p>
              </div>
            </button>

            {/* OneDrive */}
            {oneDriveConnected && (
              <>
                <div className="my-1 mx-2 h-px" style={{ background: "var(--border-secondary)" }} />
                <button
                  type="button"
                  onClick={() => { setShowMenu(false); setShowOneDrivePicker(true); }}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left transition-colors"
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-surface-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span
                    className="flex items-center justify-center w-7 h-7 rounded-lg"
                    style={{ background: "var(--bg-surface)" }}
                  >
                    <OneDriveLogo size={16} />
                  </span>
                  <div>
                    <p className="text-sm font-medium leading-tight" style={{ color: "var(--text-secondary)" }}>
                      {t("fromOneDrive")}
                    </p>
                    <p className="text-[10px]" style={{ color: "var(--text-ghost)" }}>
                      {t("browseCloudFiles")}
                    </p>
                  </div>
                </button>
              </>
            )}

            {/* Google Drive */}
            {googleDriveConnected && (
              <>
                <div className="my-1 mx-2 h-px" style={{ background: "var(--border-secondary)" }} />
                <button
                  type="button"
                  onClick={() => { setShowMenu(false); setShowGoogleDrivePicker(true); }}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left transition-colors"
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-surface-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span
                    className="flex items-center justify-center w-7 h-7 rounded-lg"
                    style={{ background: "var(--bg-surface)" }}
                  >
                    <GoogleDriveLogo size={16} />
                  </span>
                  <div>
                    <p className="text-sm font-medium leading-tight" style={{ color: "var(--text-secondary)" }}>
                      {t("fromGoogleDrive")}
                    </p>
                    <p className="text-[10px]" style={{ color: "var(--text-ghost)" }}>
                      {t("browseCloudFiles")}
                    </p>
                  </div>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Pickers */}
      {showOneDrivePicker && (
        <OneDrivePicker onFileSelect={handleCloudFile} onClose={() => setShowOneDrivePicker(false)} />
      )}
      {showGoogleDrivePicker && (
        <GoogleDrivePicker onFileSelect={handleCloudFile} onClose={() => setShowGoogleDrivePicker(false)} />
      )}
    </div>
  );
}
