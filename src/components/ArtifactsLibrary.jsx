"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useTranslations } from "use-intl";
import {
  FileCode,
  RefreshCw,
  Search,
  Filter,
  Loader2,
  Copy,
  Check,
  Download,
  Eye,
  Code2,
  MessageSquare,
  Play,
  Upload,
  Archive,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useArtifactLibrary, SHARED_SCOPE } from "@/hooks/useArtifactLibrary";
import { loadArtifact, executeArtifact, downloadAgentFile } from "@/lib/api";
import { useRouter } from "@/lib/navigation";
import { formatDateTime } from "@/lib/datetime";
import ArtifactCodeView from "@/components/artifacts/ArtifactCodeView";
import ArtifactExecutionResult, { isRunnable } from "@/components/artifacts/ArtifactExecutionResult";

/**
 * An upload has no timestamp of its own in the listing, and the shared scope
 * has no conversation to date it by.
 */
function formatTimestamp(ts) {
  if (!ts) return "-";
  // ADK timestamps are unix seconds (float); normalise to ms.
  const value = typeof ts === "number" ? (ts > 1e12 ? ts : ts * 1000) : ts;
  return formatDateTime(value);
}

export default function ArtifactsLibrary() {
  const t = useTranslations("Artifacts");
  const { user } = useAuth();
  const router = useRouter();

  const userId = user?.email || user?.id || null;
  const { items, isLoading, error, reload } = useArtifactLibrary({ userId });

  const [searchTerm, setSearchTerm] = useState("");
  const [filterAgent, setFilterAgent] = useState("");
  const [filterKind, setFilterKind] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [contents, setContents] = useState({});
  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);
  const [execResult, setExecResult] = useState(null);
  const [isRunning, setIsRunning] = useState(false);

  // A newly selected artifact never inherits the previous one's view. HTML
  // opens on its rendering: a generated report is meant to be looked at, and
  // its markup was the first thing shown for no reason other than being the
  // stored form. Everything else opens on its source, where there is nothing
  // to render.
  const selectArtifact = useCallback((id) => {
    setSelectedId(id);
    const picked = items.find((a) => a.id === id);
    setShowPreview(picked?.language === "html");
    // A run belongs to the artifact it was started from — never carry its
    // output over to the next selection.
    setExecResult(null);
    setIsRunning(false);
  }, [items]);

  const distinctAgents = useMemo(
    () => Array.from(new Set(items.map((a) => a.agentName))).sort(),
    [items],
  );

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return items.filter((a) => {
      if (filterAgent && a.agentName !== filterAgent) return false;
      if (filterKind && a.kind !== filterKind) return false;
      if (!term) return true;
      return (
        a.filename?.toLowerCase().includes(term) ||
        a.language?.toLowerCase().includes(term) ||
        a.agentName?.toLowerCase().includes(term)
      );
    });
  }, [items, searchTerm, filterAgent, filterKind]);

  const selected = useMemo(
    () => filtered.find((a) => a.id === selectedId) || null,
    [filtered, selectedId],
  );

  const loaded = selected ? contents[selected.id] : null;
  const selectedCode = loaded?.code;
  const isBinary = Boolean(loaded?.binary);
  // Derived rather than stored: an artifact is loading exactly while its body
  // is absent from the cache. No second state to keep in sync.
  const isLoadingContent = Boolean(selected) && loaded === undefined;

  // Fetch the body of the selected artifact — the listing endpoint only
  // carries metadata, so content is loaded one artifact at a time.
  useEffect(() => {
    if (!selected || contents[selected.id] !== undefined) return;

    let cancelled = false;
    loadArtifact(
      selected.agentFolder,
      String(userId),
      selected.sessionId,
      selected.filename,
      selected.kind,
    )
      .then((data) => {
        if (cancelled) return;
        setContents((prev) => ({
          ...prev,
          [selected.id]: {
            code: data?.code ?? "",
            // An empty body means two very different things: a file with
            // nothing in it, and a PDF whose bytes cannot be shown as text.
            binary: Boolean(data?.binary),
          },
        }));
      })
      .catch(() => {
        if (cancelled) return;
        setContents((prev) => ({
          ...prev,
          [selected.id]: { code: "", binary: false },
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [selected, contents, userId]);

  // Object URL for a binary artifact, revoked when the selection changes so
  // a long session does not pin every file it looked at in memory.
  const [binaryPreview, setBinaryPreview] = useState(null);

  useEffect(() => {
    if (!selected || !isBinary) {
      setBinaryPreview(null);
      return;
    }

    let url = null;
    let cancelled = false;

    downloadAgentFile(selected.agentFolder, selected.filename)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setBinaryPreview({ url, type: blob.type });
      })
      .catch(() => {
        if (!cancelled) setBinaryPreview(null);
      });

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [selected, isBinary]);

  const handleCopy = useCallback(async () => {
    if (!selectedCode) return;
    try {
      await navigator.clipboard.writeText(selectedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be denied by the browser; nothing actionable here.
    }
  }, [selectedCode]);

  const handleDownload = useCallback(async () => {
    if (!selected) return;

    let blob;
    if (isBinary) {
      try {
        blob = await downloadAgentFile(selected.agentFolder, selected.filename);
      } catch {
        return;
      }
    } else {
      if (selectedCode == null) return;
      blob = new Blob([selectedCode], { type: "text/plain" });
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = selected.filename || "artifact.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [selected, selectedCode, isBinary]);

  const handleRun = useCallback(async () => {
    if (!selected) return;
    setIsRunning(true);
    setExecResult(null);
    try {
      const result = await executeArtifact(
        selected.agentFolder,
        String(userId),
        selected.sessionId,
        selected.filename,
        {},
        selected.kind,
      );
      setExecResult(result);
    } catch (err) {
      setExecResult({
        stdout: "",
        stderr: err?.message || "Execution failed",
        exit_code: -1,
        duration_ms: 0,
      });
    } finally {
      setIsRunning(false);
    }
  }, [selected, userId]);

  const handleOpenConversation = useCallback(() => {
    if (!selected) return;
    router.push(
      `/chat?agent=${encodeURIComponent(selected.agentFolder)}&session=${encodeURIComponent(selected.sessionId)}`,
    );
  }, [selected, router]);

  return (
    <div className="h-full flex flex-col th-bg-body overflow-hidden">
      {/* Header */}
      <header className="shrink-0 p-6 bg-linear-to-r from-brand/20 to-brand-secondary/20 border-b th-border backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-linear-to-br from-brand to-brand-secondary rounded-2xl shadow-lg">
            <FileCode size={32} className="text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-black th-text tracking-tight">
              {t("pageTitle")}
            </h1>
            <p className="th-text-secondary text-sm font-medium mt-1">
              {t("pageSubtitle")}
            </p>
          </div>
          <button
            onClick={reload}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 th-bg-surface hover:th-bg-surface-hover th-text-secondary hover:th-text rounded-xl border th-border text-sm font-semibold transition-all disabled:opacity-50"
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
            {t("refreshLabel")}
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-hidden p-6">
        {/* Full width, like the header above it: this screen shows source
            code side by side with its list, and the 80rem cap the other
            dashboards use left ~300px empty on each side of a 1900px
            display while the code panel scrolled. */}
        <div className="h-full flex flex-col gap-4">
          {/* Filter bar */}
          <div className="shrink-0 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-50 max-w-sm">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 th-text-ghost"
              />
              <input
                type="text"
                placeholder={t("searchPlaceholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 th-bg-surface border th-border rounded-xl text-sm th-text placeholder-th-text-ghost focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/30 transition-all"
              />
            </div>

            <div className="relative">
              <Filter
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 th-text-ghost"
              />
              <select
                value={filterAgent}
                onChange={(e) => setFilterAgent(e.target.value)}
                className="appearance-none pl-8 pr-8 py-2 th-bg-surface border th-border rounded-xl text-sm th-text-secondary focus:outline-none focus:border-brand/50 transition-all cursor-pointer"
              >
                <option value="" className="th-bg-elevated">
                  {t("allAgentsOption")}
                </option>
                {distinctAgents.map((name) => (
                  <option key={name} value={name} className="th-bg-elevated">
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <Filter
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 th-text-ghost"
              />
              <select
                value={filterKind}
                onChange={(e) => setFilterKind(e.target.value)}
                className="appearance-none pl-8 pr-8 py-2 th-bg-surface border th-border rounded-xl text-sm th-text-secondary focus:outline-none focus:border-brand/50 transition-all cursor-pointer"
              >
                <option value="" className="th-bg-elevated">
                  {t("allKindsOption")}
                </option>
                <option value="output" className="th-bg-elevated">
                  {t("kindOutput")}
                </option>
                <option value="input" className="th-bg-elevated">
                  {t("kindInput")}
                </option>
                <option value="legacy" className="th-bg-elevated">
                  {t("kindLegacy")}
                </option>
              </select>
            </div>

            <span className="text-xs th-text-ghost ml-auto">
              {t("artifactsCount", { count: filtered.length })}
            </span>
          </div>

          {error && (
            <div className="shrink-0 p-4 bg-[var(--c-red-500-10)] border border-[var(--c-red-500-20)] rounded-xl text-red-400 text-sm">
              {t("failedToLoad", { error })}
            </div>
          )}

          {isLoading ? (
            <div className="glass-card p-12 rounded-2xl text-center border border-dashed th-border">
              <Loader2 size={48} className="mx-auto mb-4 text-brand animate-spin" />
              <h3 className="text-xl font-bold th-text mb-2">
                {t("loadingTitle")}
              </h3>
              <p className="th-text-secondary text-sm">{t("loadingText")}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="glass-card p-12 rounded-2xl text-center border border-dashed th-border">
              <FileCode size={48} className="mx-auto mb-4 th-text-ghost" />
              <h3 className="text-xl font-bold th-text mb-2">
                {t("emptyTitle")}
              </h3>
              <p className="th-text-secondary text-sm">
                {items.length === 0 ? t("emptyHint") : t("noMatchHint")}
              </p>
            </div>
          ) : (
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,22rem)_1fr] gap-4">
              {/* Artifact list */}
              <div className="min-h-0 overflow-auto custom-scrollbar space-y-2 pr-1">
                {filtered.map((artifact) => {
                  const isActive = artifact.id === selectedId;
                  return (
                    <button
                      key={artifact.id}
                      onClick={() => selectArtifact(artifact.id)}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${
                        isActive
                          ? "bg-brand/10 border-brand/40"
                          : "th-bg-surface th-border hover:th-bg-surface-hover"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {artifact.kind === "input" ? (
                          <Upload size={14} className="text-amber-400 shrink-0" />
                        ) : artifact.kind === "legacy" ? (
                          <Archive size={14} className="th-text-faint shrink-0" />
                        ) : (
                          <Code2 size={14} className="text-blue-400 shrink-0" />
                        )}
                        <span className="text-sm font-medium th-text truncate">
                          {artifact.filename}
                        </span>
                        {artifact.version != null && (
                          <span className="shrink-0 text-[10px] th-text-ghost">
                            v{artifact.version}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[11px] th-text-faint min-w-0">
                        <span
                          className={`shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${
                            artifact.kind === "input"
                              ? "bg-[var(--c-amber-500-15)] text-amber-400"
                              : artifact.kind === "legacy"
                                ? "th-bg-elevated th-text-faint"
                                : "bg-[var(--c-blue-500-15)] text-blue-400"
                          }`}
                        >
                          {artifact.kind === "input"
                            ? t("kindInput")
                            : artifact.kind === "legacy"
                              ? t("kindLegacy")
                              : t("kindOutput")}
                        </span>
                        <span className="truncate">{artifact.agentName}</span>
                        <span className="th-text-ghost">·</span>
                        <span className="shrink-0">{artifact.language}</span>
                      </div>
                      <div className="mt-0.5 text-[10px] th-text-ghost">
                        {artifact.sessionId === SHARED_SCOPE
                          ? t("noConversation")
                          : formatTimestamp(artifact.updatedAt)}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Preview */}
              <div className="min-h-0 flex flex-col rounded-xl border th-border th-bg-surface overflow-hidden">
                {!selected ? (
                  <div className="flex-1 flex items-center justify-center p-8 text-center">
                    <p className="th-text-faint text-sm">{t("selectHint")}</p>
                  </div>
                ) : (
                  <>
                    <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-b th-border">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileCode size={16} className="text-blue-400 shrink-0" />
                        <span className="text-sm font-medium th-text-secondary truncate">
                          {selected.filename}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {isRunnable(selected.language) && (
                          <button
                            onClick={isRunning ? undefined : handleRun}
                            disabled={isRunning}
                            className={`p-1.5 rounded-lg transition-colors ${
                              isRunning
                                ? "bg-[var(--c-purple-500-20)] text-purple-400 cursor-wait"
                                : "bg-[var(--c-blue-500-10)] hover:bg-[var(--c-blue-500-20)] text-blue-400 hover:text-blue-300"
                            }`}
                            title={isRunning ? t("running") : t("runCode")}
                          >
                            {isRunning ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Play size={14} />
                            )}
                          </button>
                        )}
                        {selected.sessionId !== SHARED_SCOPE && (
                          <button
                            onClick={handleOpenConversation}
                            className="p-1.5 rounded-lg th-bg-surface hover:th-bg-surface-hover th-text-faint hover:text-brand transition-colors"
                            title={t("openConversation")}
                          >
                            <MessageSquare size={14} />
                          </button>
                        )}
                        {selected.language === "html" && (
                          <button
                            onClick={() => setShowPreview((v) => !v)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              showPreview
                                ? "bg-[var(--c-blue-500-20)] text-blue-400"
                                : "th-bg-surface hover:th-bg-surface-hover th-text-faint hover:th-text-secondary"
                            }`}
                            title={showPreview ? t("showCode") : t("previewHtml")}
                          >
                            {showPreview ? <Code2 size={14} /> : <Eye size={14} />}
                          </button>
                        )}
                        <button
                          onClick={handleDownload}
                          className="p-1.5 rounded-lg th-bg-surface hover:th-bg-surface-hover th-text-faint hover:th-text-secondary transition-colors"
                          title={t("downloadFile")}
                        >
                          <Download size={14} />
                        </button>
                        {!isBinary && (
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
                        )}
                      </div>
                    </div>

                    <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
                      <ArtifactCodeView
                        code={selectedCode}
                        binaryUrl={binaryPreview?.url}
                        binaryType={binaryPreview?.type}
                        language={selected.language}
                        showPreview={showPreview}
                        previewTitle={t("htmlPreviewTitle")}
                        emptyLabel={
                          isLoadingContent
                            ? t("loadingContent")
                            : isBinary
                              ? t("binaryContent")
                              : t("emptyContent")
                        }
                      />
                    </div>

                    <ArtifactExecutionResult
                      result={execResult}
                      isRunning={isRunning}
                    />
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
