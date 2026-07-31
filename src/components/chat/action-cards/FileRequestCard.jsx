"use client";

import { useState, useRef } from "react";
import { Upload, Loader2, Check, AlertCircle, X, RefreshCw } from "lucide-react";
import { uploadFileChunked } from "@/lib/api";
import { STATUS_STYLES } from "./statusStyles";

function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Returns true if the file matches the `accept` string (like an HTML input@accept).
 * Supports:
 * - extensions (".pdf", ".docx")
 * - MIME types ("application/pdf")
 * - MIME wildcards ("image/*")
 */
export function matchesAccept(file, acceptString) {
  if (!acceptString) return true;
  const patterns = acceptString.split(",").map((s) => s.trim()).filter(Boolean);
  if (patterns.length === 0) return true;
  const name = (file.name || "").toLowerCase();
  const type = (file.type || "").toLowerCase();
  return patterns.some((p) => {
    const pattern = p.toLowerCase();
    if (pattern.startsWith(".")) {
      return name.endsWith(pattern);
    }
    if (pattern.endsWith("/*")) {
      const prefix = pattern.slice(0, -1); // e.g. "image/"
      return type.startsWith(prefix);
    }
    return type === pattern;
  });
}

export default function FileRequestCard({ card, onRespond, agentId }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [replaceMode, setReplaceMode] = useState(false);
  const inputRef = useRef(null);

  if (!card) return null;
  const { data = {}, status } = card;
  const border = STATUS_STYLES[status] || STATUS_STYLES.pending;

  const maxSizeMb = data.max_size_mb || 50;

  const handleFile = async (file) => {
    if (!file) return;
    if (uploading) return;
    setErrorMsg("");

    if (!matchesAccept(file, data.accept)) {
      setErrorMsg(`Invalid file type. Expected: ${data.accept}`);
      return;
    }
    if (file.size > maxSizeMb * 1024 * 1024) {
      setErrorMsg(`File too large (exceeds ${maxSizeMb} MB)`);
      return;
    }

    setUploading(true);
    setProgress(0);
    try {
      const result = await uploadFileChunked(file, agentId || "unknown", (p) => {
        setProgress(p);
      });
      const response = {
        filename: result.filename || file.name,
        path: result.path,
        size: result.size || file.size || 0,
      };
      onRespond?.(response, {
        followupText: `[File uploaded]: ${response.filename}`,
      });
      setReplaceMode(false);
    } catch (err) {
      setErrorMsg(err?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const onChange = (e) => {
    if (uploading) return;
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const onDrop = (e) => {
    e.preventDefault();
    if (uploading) return;
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  };

  const onCancel = () => {
    if (uploading) return;
    onRespond?.("declined", { sendFollowup: false });
  };

  const done = status === "done" && !replaceMode;

  return (
    <div
      role="group"
      aria-label={card.ariaLabel || `File upload request: ${data.purpose || ""}`}
      className={`my-3 rounded-xl border overflow-hidden ${border}`}
    >
      <div className="flex flex-col gap-2 px-3 py-2.5">
        <p className="text-xs th-text-secondary">{data.purpose}</p>

        {done ? (
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg th-bg-surface text-xs th-text-muted">
            <Check size={12} className="text-emerald-400 shrink-0" />
            <span className="truncate flex-1">
              {card.response?.filename || "File uploaded"}
              {card.response?.size
                ? ` · ${formatFileSize(card.response.size)}`
                : ""}
            </span>
            <button
              type="button"
              onClick={() => setReplaceMode(true)}
              className="shrink-0 flex items-center gap-1 text-[11px] th-text-muted hover:th-text-secondary focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <RefreshCw size={11} /> Replace
            </button>
          </div>
        ) : (
          <>
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              className="flex items-center justify-center gap-2 px-3 py-3 rounded-lg border border-dashed th-border-hover th-bg-surface hover:th-bg-surface-hover cursor-pointer text-xs th-text-muted transition-colors"
            >
              {uploading ? (
                <>
                  <Loader2 size={16} className="animate-spin text-blue-300" />
                  Uploading… {progress}%
                </>
              ) : (
                <>
                  <Upload size={16} className="text-blue-300" />
                  Click to select or drop a file
                </>
              )}
              <input
                ref={inputRef}
                type="file"
                data-testid="file-request-input"
                accept={data.accept || undefined}
                onChange={onChange}
                className="hidden"
                disabled={uploading}
              />
            </label>

            {uploading && (
              <div className="w-full h-1 bg-white/10 rounded mt-1 overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onCancel}
                disabled={uploading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg th-bg-surface hover:th-bg-surface-hover border th-border text-xs font-medium th-text-muted transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <X size={12} />
                Cancel
              </button>
            </div>

            {errorMsg && (
              <p className="flex items-center gap-1 text-[11px] text-red-400">
                <AlertCircle size={12} />
                {errorMsg}
              </p>
            )}
          </>
        )}

        {status === "error" && (
          <p className="flex items-center gap-1 text-[11px] text-red-400">
            <AlertCircle size={12} />
            {card.errorMessage || "Upload failed"}
          </p>
        )}
      </div>
    </div>
  );
}
