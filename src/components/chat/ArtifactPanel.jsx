"use client";

import { useTranslations } from "use-intl";
import { useState, useCallback, useRef, useEffect } from "react";
import { X, Copy, Check, Code2, Eye, FileCode, Play, Download, Loader2, MessageSquare, Library } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { executeArtifact as apiExecuteArtifact } from "@/lib/api";
import { Link } from "@/lib/navigation";
import { JsonBlock, DataTable } from "./StructuredOutput";

// What a preview can show besides the raw code, by language / extension.
export function previewKind(artifact) {
  const lang = String(artifact?.language || "").toLowerCase();
  const name = String(artifact?.filename || "").toLowerCase();
  const ext = name.includes(".") ? name.split(".").pop() : "";
  if (lang === "html" || ext === "html" || ext === "htm") return "html";
  if (lang === "markdown" || lang === "md" || ext === "md" || ext === "markdown") return "markdown";
  if (lang === "json" || ext === "json") return "json";
  if (lang === "csv" || ext === "csv" || ext === "tsv") return "csv";
  if (lang === "svg" || ext === "svg") return "svg";
  return null;
}

// Minimal CSV/TSV reader for the table preview (quoted fields, no escapes
// beyond doubled quotes). Returns rows as objects keyed by the header line.
export function parseDelimited(text, max = 500) {
  const lines = String(text || "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const delim = lines[0].includes("\t") ? "\t" : lines[0].includes(";") && !lines[0].includes(",") ? ";" : ",";
  const split = (line) => {
    const out = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) {
        if (c === '"' && line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else if (c === '"') q = false;
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === delim) {
        out.push(cur);
        cur = "";
      } else cur += c;
    }
    out.push(cur);
    return out;
  };
  const header = split(lines[0]).map((h) => h.trim());
  return lines.slice(1, max + 1).map((line) => {
    const cells = split(line);
    const row = {};
    header.forEach((h, i) => {
      const v = (cells[i] ?? "").trim();
      const n = v !== "" && !Number.isNaN(Number(v)) ? Number(v) : v;
      row[h || `col${i + 1}`] = n;
    });
    return row;
  });
}

function ArtifactPreview({ kind, code, t }) {
  if (kind === "html") {
    return (
      <iframe
        srcDoc={code}
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        className="w-full h-full bg-white"
        title={t("htmlPreviewTitle")}
        tabIndex={0}
      />
    );
  }
  if (kind === "markdown") {
    return (
      <div className="p-4 text-sm markdown-content th-text-secondary leading-relaxed">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{code}</ReactMarkdown>
      </div>
    );
  }
  if (kind === "json") {
    return (
      <div className="p-3">
        <JsonBlock content={code} />
      </div>
    );
  }
  if (kind === "csv") {
    const rows = parseDelimited(code);
    return rows.length ? (
      <div className="p-3">
        <DataTable data={rows} />
      </div>
    ) : (
      <div className="p-4 th-text-faint text-sm italic">{t("previewUnavailable")}</div>
    );
  }
  if (kind === "svg") {
    return (
      <div className="p-4 flex items-center justify-center bg-white/90 h-full">
        <img src={`data:image/svg+xml;utf8,${encodeURIComponent(code)}`} alt={t("svgPreviewAlt")} className="max-w-full max-h-full" />
      </div>
    );
  }
  return null;
}

const MIN_WIDTH = 320;
const MAX_WIDTH = 800;
const DEFAULT_WIDTH = 480;

function LineNumbers({ count }) {
  return (
    <div className="select-none text-right pr-3 th-text-ghost text-[11px] leading-[1.4rem] font-mono">
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>{i + 1}</div>
      ))}
    </div>
  );
}

function ExecutionResult({ result, isRunning }) {
  const t = useTranslations("ArtifactPanel");
  if (isRunning) {
    return (
      <div className="border-t th-border p-3 flex items-center gap-2 th-text-muted text-xs">
        <Loader2 size={14} className="animate-spin" />
        <span>{t("runningEllipsis")}</span>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="border-t th-border text-xs font-mono">
      {/* Header with exit code and duration */}
      <div className="flex items-center gap-3 px-3 py-2 border-b th-border-secondary th-bg-surface">
        <span className={`font-medium ${result.exit_code === 0 ? "text-blue-400" : "text-red-400"}`}>
          {t("exitCode", { code: result.exit_code })}
        </span>
        <span className="th-text-faint">{result.duration_ms}ms</span>
      </div>

      {/* stdout */}
      {result.stdout && (
        <div className="p-3">
          <div className="th-text-faint text-[10px] uppercase tracking-wider mb-1">stdout</div>
          <pre className="text-blue-300/80 whitespace-pre-wrap break-all max-h-48 overflow-y-auto custom-scrollbar">
            {result.stdout}
          </pre>
        </div>
      )}

      {/* stderr */}
      {result.stderr && (
        <div className="p-3 pt-0">
          <div className="th-text-faint text-[10px] uppercase tracking-wider mb-1">stderr</div>
          <pre className="text-red-300/80 whitespace-pre-wrap break-all max-h-48 overflow-y-auto custom-scrollbar">
            {result.stderr}
          </pre>
        </div>
      )}

      {/* Empty output */}
      {!result.stdout && !result.stderr && (
        <div className="p-3 th-text-faint italic">{t("noOutput")}</div>
      )}
    </div>
  );
}

export default function ArtifactPanel({ artifact, artifacts, onSelect, onClose, onAskAbout, sessionMeta }) {
  const t = useTranslations("ArtifactPanel");
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [execResult, setExecResult] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  // Reset state when the artifact changes — rendered kinds (markdown, json,
  // csv, svg) open on their preview, code-like ones on the code. Done during
  // render (the sanctioned "derived state" pattern), not in an effect.
  const [prevArtifactId, setPrevArtifactId] = useState(artifact?.id);
  if (artifact?.id !== prevArtifactId) {
    setPrevArtifactId(artifact?.id);
    setExecResult(null);
    setIsRunning(false);
    const k = previewKind(artifact);
    setShowPreview(k !== null && k !== "html");
  }

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    isDragging.current = true;
    startX.current = e.clientX;
    startWidth.current = width;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [width]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging.current) return;
      const delta = startX.current - e.clientX;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  if (!artifact) return null;

  const code = artifact.code || "";
  const lines = code.split("\n");
  const kind = previewKind(artifact);
  const isHtml = kind === "html";
  const canPreview = kind !== null;
  const canRun = ["python", "javascript", "js", "bash", "sh", "ruby", "go"].includes(
    artifact.language?.toLowerCase()
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = artifact.filename || `artifact.${artifact.language || "txt"}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRun = async () => {
    if (!sessionMeta?.agentName || !sessionMeta?.userId || !sessionMeta?.sessionId) {
      setExecResult({
        stdout: "",
        stderr: "Cannot execute: missing session information.",
        exit_code: -1,
        duration_ms: 0,
      });
      return;
    }

    setIsRunning(true);
    setExecResult(null);
    try {
      const result = await apiExecuteArtifact(
        sessionMeta.agentName,
        sessionMeta.userId,
        sessionMeta.sessionId,
        artifact.filename,
        {},
      );
      setExecResult(result);
    } catch (err) {
      setExecResult({
        stdout: "",
        stderr: err.message || "Execution failed",
        exit_code: -1,
        duration_ms: 0,
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div
      className="shrink-0 border-l th-border th-bg-body flex h-full relative"
      style={{ width }}
    >
      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500/30 active:bg-blue-500/50 transition-colors z-10"
      />

      {/* Panel content */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b th-border">
          <div className="flex items-center gap-2 min-w-0">
            <FileCode size={16} className="text-blue-400 shrink-0" />
            <span className="text-sm font-medium th-text-secondary truncate">
              {artifact.filename || artifact.language}
            </span>
            {/* Source badge */}
            <span
              className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                artifact.source === "adk"
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                  : "th-bg-surface th-text-faint border th-border"
              }`}
            >
              {artifact.source === "adk" ? "ADK" : t("inlineLabel")}
            </span>
            {/* Version */}
            {artifact.version != null && (
              <span className="shrink-0 text-[10px] th-text-ghost">
                v{artifact.version}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {/* Run button */}
            {canRun && (
              <button
                onClick={isRunning ? undefined : handleRun}
                disabled={isRunning}
                className={`p-1.5 rounded-lg transition-colors ${
                  isRunning
                    ? "bg-purple-500/20 text-purple-400 cursor-wait"
                    : "bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300"
                }`}
                title={isRunning ? t("runningEllipsis") : t("runCode")}
              >
                {isRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              </button>
            )}
            {/* Download button */}
            <button
              onClick={handleDownload}
              className="p-1.5 rounded-lg th-bg-surface hover:th-bg-surface-hover th-text-faint hover:th-text-secondary transition-colors"
              title={t("downloadFile")}
            >
              <Download size={14} />
            </button>
            {canPreview && (
              <button
                onClick={() => setShowPreview(!showPreview)}
                className={`p-1.5 rounded-lg transition-colors ${
                  showPreview
                    ? "bg-blue-500/20 text-blue-400"
                    : "th-bg-surface hover:th-bg-surface-hover th-text-faint hover:th-text-secondary"
                }`}
                title={showPreview ? t("showCode") : isHtml ? t("previewHtml") : t("preview")}
                aria-pressed={showPreview}
              >
                {showPreview ? <Code2 size={14} /> : <Eye size={14} />}
              </button>
            )}
            <Link
              href="/artifacts"
              className="p-1.5 rounded-lg th-bg-surface hover:th-bg-surface-hover th-text-faint hover:th-text-secondary transition-colors inline-flex"
              title={t("openLibrary")}
              aria-label={t("openLibrary")}
            >
              <Library size={14} />
            </Link>
            {onAskAbout && (
              <button
                onClick={() => onAskAbout(artifact)}
                className="p-1.5 rounded-lg th-bg-surface hover:th-bg-surface-hover th-text-faint hover:text-brand transition-colors"
                title={t("askAboutArtifact")}
              >
                <MessageSquare size={14} />
              </button>
            )}
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-lg th-bg-surface hover:th-bg-surface-hover th-text-faint hover:th-text-secondary transition-colors"
              title={t("copyCode")}
            >
              {copied ? (
                <Check size={14} className="text-blue-400" />
              ) : (
                <Copy size={14} />
              )}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg th-bg-surface hover:th-bg-surface-hover th-text-faint hover:th-text-secondary transition-colors"
              title={t("closePanel")}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Artifact list tabs */}
        {artifacts.length > 1 && (
          <div className="flex gap-1 px-4 py-2 border-b th-border-secondary overflow-x-auto custom-scrollbar">
            {artifacts.map((a) => (
              <button
                key={a.id}
                onClick={() => onSelect(a.id)}
                className={`shrink-0 px-2 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1 ${
                  a.id === artifact.id
                    ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                    : "th-bg-surface th-text-faint hover:th-text-muted border border-transparent"
                }`}
              >
                <Code2 size={10} />
                {a.filename || a.language}
                {a.source === "adk" && (
                  <span className="text-[8px] text-purple-400 ml-0.5">ADK</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Code content */}
        <div className="flex-1 overflow-auto custom-scrollbar">
          {showPreview && canPreview ? (
            <ArtifactPreview kind={kind} code={code} t={t} />
          ) : code ? (
            <div className="flex text-xs font-mono p-3">
              <LineNumbers count={lines.length} />
              <pre className="flex-1 overflow-x-auto th-text-secondary leading-[1.4rem] whitespace-pre">
                {code}
              </pre>
            </div>
          ) : (
            <div className="p-4 th-text-faint text-sm italic">
              {t("loadingArtifactContent")}
            </div>
          )}
        </div>

        {/* Execution results */}
        <ExecutionResult result={execResult} isRunning={isRunning} />
      </div>
    </div>
  );
}
