import { useTranslations } from "use-intl";
import { useState, useEffect, useRef, useMemo, useCallback, memo } from "react";
import {
  User,
  Loader2,
  Copy,
  Check,
  Edit2,
  ChevronDown,
  ChevronRight,
  Clock,
  Zap,
  Code2,
  PanelRightOpen,
  FileText,
  Image as ImageIcon,
  File as FileIcon,
  Download,
  RefreshCw,
  StepForward,
  CircleSlash2,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import ApprovalCard from "./ApprovalCard";
import IntegrationConnectCard from "./IntegrationConnectCard";
import ActionCard from "./action-cards/ActionCard";
import BranchNavigator from "./BranchNavigator";
import { JsonBlock } from "./StructuredOutput";
import { ExternalLink } from "lucide-react";
import ReasoningTrail from "./ReasoningTrail";
import InlineChart from "./InlineChart";
import { deriveMessageStatus } from "@/lib/reasoningSteps";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { formatDateTime } from "@/lib/datetime";

// --- CodeBlock: language label + copy + open-in-panel + collapsible for long code ---
const COLLAPSE_THRESHOLD = 10; // lines before collapsing
const PREVIEW_LINES = 4; // lines shown in collapsed preview

function CodeBlock({ className, children, onOpen }) {
  const t = useTranslations("ChatMessage");
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const match = /language-(\w+)/.exec(className || "");
  const language = match ? match[1] : null;

  const code = String(children).replace(/\n$/, "");
  const lines = code.split("\n");
  const lineCount = lines.length;
  const isLong = lineCount > COLLAPSE_THRESHOLD;
  const isSubstantial = code.trim().length >= 20;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  if (!language) {
    // Inline code
    return (
      <code className="bg-black/20 rounded px-1 py-0.5 text-xs font-mono">
        {children}
      </code>
    );
  }

  // Collapsed view for long code blocks
  if (isLong && !expanded) {
    const preview = lines.slice(0, PREVIEW_LINES).join("\n");
    return (
      <div className="bg-black/30 rounded-lg my-2 overflow-hidden th-border-secondary hover:border-blue-500/30 transition-all">
        <div className="flex items-center justify-between px-3 py-1.5 th-bg-surface border-b th-border-secondary">
          <div className="flex items-center gap-2">
            <Code2 size={12} className="text-blue-400" />
            <span className="text-[11px] font-medium th-text-faint">{language}</span>
            <span className="text-[10px] th-text-ghost">{t("linesCount", { count: lineCount })}</span>
          </div>
          <div className="flex items-center gap-1">
            {isSubstantial && onOpen && (
              <button
                onClick={() => onOpen(code, language)}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 hover:text-blue-300 transition-colors"
                title={t("openInCanvasPanel")}
              >
                <PanelRightOpen size={11} />
                {t("open")}
              </button>
            )}
            <button
              onClick={() => setExpanded(true)}
              className="p-1 rounded hover:th-bg-surface-hover th-text-faint hover:th-text-muted transition-colors"
              title={t("expandInline")}
            >
              <ChevronDown size={12} />
            </button>
            <button
              onClick={handleCopy}
              className="p-1 rounded hover:th-bg-surface-hover th-text-faint hover:th-text-muted transition-colors"
              title={t("copyCode")}
            >
              {copied ? (
                <Check size={12} className="text-blue-400" />
              ) : (
                <Copy size={12} />
              )}
            </button>
          </div>
        </div>
        {/* Preview lines with gradient fade */}
        <div
          className="relative cursor-pointer"
          onClick={() => onOpen ? onOpen(code, language) : setExpanded(true)}
        >
          <SyntaxHighlighter
            language={language}
            style={oneDark}
            customStyle={{ margin: 0, padding: "12px", background: "transparent", fontSize: "12px" }}
            wrapLongLines
          >
            {preview}
          </SyntaxHighlighter>
          <div className="absolute inset-x-0 bottom-0 h-10 bg-linear-to-t from-black/60 to-transparent pointer-events-none" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black/30 rounded-lg my-2 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 th-bg-surface border-b th-border-secondary">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium th-text-faint">{language}</span>
          {isLong && (
            <span className="text-[10px] th-text-ghost">{t("linesCount", { count: lineCount })}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isSubstantial && onOpen && (
            <button
              onClick={() => onOpen(code, language)}
              className="p-1 rounded hover:th-bg-surface-hover th-text-faint hover:th-text-muted transition-colors"
              title={t("openInPanel")}
            >
              <ExternalLink size={12} />
            </button>
          )}
          {isLong && expanded && (
            <button
              onClick={() => setExpanded(false)}
              className="p-1 rounded hover:th-bg-surface-hover th-text-faint hover:th-text-muted transition-colors"
              title={t("collapse")}
            >
              <ChevronRight size={12} />
            </button>
          )}
          <button
            onClick={handleCopy}
            className="p-1 rounded hover:th-bg-surface-hover th-text-faint hover:th-text-muted transition-colors"
            title={t("copyCode")}
          >
            {copied ? (
              <Check size={12} className="text-blue-400" />
            ) : (
              <Copy size={12} />
            )}
          </button>
        </div>
      </div>
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        customStyle={{ margin: 0, padding: "12px", background: "transparent", fontSize: "12px" }}
        wrapLongLines
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

// Authenticated download link for /api/files/ paths
function DownloadLink({ href, children }) {
  const [busy, setBusy] = useState(false);

  const handleClick = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("th2_auth_token")
          : null;
      const res = await fetch(`${apiBase}${href}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = href.split("/").pop() || "download";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[DownloadLink] Error:", err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="inline-flex items-center gap-1 text-brand hover:text-brand-hover hover:underline disabled:opacity-50 cursor-pointer"
    >
      <Download size={14} className="shrink-0" />
      {children}
    </button>
  );
}

// Auto-linkify plain-text URLs and emails that markdown didn't catch
const LINKIFY_RE =
  /(https?:\/\/[^\s<>)\]]+|(?:[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}))/g;

function linkifyChildren(children) {
  if (!Array.isArray(children)) children = [children];
  return children.flatMap((child) => {
    if (typeof child !== "string") return [child];
    const parts = child.split(LINKIFY_RE);
    if (parts.length === 1) return [child];
    return parts.map((part, i) => {
      if (LINKIFY_RE.test(part)) {
        LINKIFY_RE.lastIndex = 0; // reset after .test()
        const isEmail = !part.startsWith("http");
        return (
          <a
            key={i}
            className="text-brand hover:underline break-all chat-link"
            href={isEmail ? `mailto:${part}` : part}
            target="_blank"
            rel="noopener noreferrer"
          >
            {part}
          </a>
        );
      }
      return part;
    });
  });
}

// Markdown component overrides - stable reference (created once)
const markdownComponents = {
  h1: ({ node, ...props }) => (
    <h1 className="text-lg font-bold my-2" {...props} />
  ),
  h2: ({ node, ...props }) => (
    <h2 className="text-base font-bold my-2" {...props} />
  ),
  h3: ({ node, ...props }) => (
    <h3 className="text-sm font-bold my-1" {...props} />
  ),
  ul: ({ node, ...props }) => (
    <ul className="list-disc ml-4 my-2 space-y-1" {...props} />
  ),
  ol: ({ node, ...props }) => (
    <ol className="list-decimal ml-4 my-2 space-y-1" {...props} />
  ),
  li: ({ node, children, ...props }) => (
    <li className="text-sm" {...props}>{linkifyChildren(children)}</li>
  ),
  p: ({ node, children, ...props }) => (
    <p className="mb-2 last:mb-0 whitespace-pre-wrap" {...props}>
      {linkifyChildren(children)}
    </p>
  ),
  a: ({ node, href, children, ...props }) => {
    // Authenticated download for /api/files/ links. Tolerate a fabricated host
    // prefix: small models sometimes emit "https://www.example.com/api/files/..."
    // — extract the real path so the download still works with the auth token.
    const fileMatch = href && href.match(/\/api\/files\/\S+/);
    if (fileMatch) {
      return <DownloadLink href={fileMatch[0]}>{children}</DownloadLink>;
    }
    // Neutralize obviously fabricated placeholder links the model invents
    // (example.com / placeholder.com / quickchart.io) so they are not clickable.
    if (href && /(example\.com|placeholder\.com|quickchart\.io)/i.test(href)) {
      return <span className="th-text-muted">{children}</span>;
    }
    return (
      <a
        className="text-brand hover:underline chat-link"
        target="_blank"
        rel="noopener noreferrer"
        href={href}
        {...props}
      >
        {children}
      </a>
    );
  },
  img: ({ node, alt, ...props }) => {
    // Charts/files are shown via dedicated cards, never inline markdown — so a
    // markdown image from the model is always a fabricated/placeholder URL
    // (e.g. via.placeholder.com) that renders broken. Never render an <img>;
    // keep the alt text as a muted caption so the intent is preserved.
    void props;
    return alt ? (
      <span className="th-text-muted text-xs italic">{alt}</span>
    ) : null;
  },
  // code: handled per-instance via makeMarkdownComponents (needs onOpenArtifact ref)
  strong: ({ node, ...props }) => (
    <strong className="font-bold th-text" {...props} />
  ),
  table: ({ node, ...props }) => (
    <div className="overflow-x-auto my-3 rounded-lg border th-border">
      <table className="w-full text-xs" {...props} />
    </div>
  ),
  thead: ({ node, ...props }) => (
    <thead className="th-bg-surface border-b th-border" {...props} />
  ),
  th: ({ node, ...props }) => (
    <th className="px-3 py-2 text-left font-semibold th-text-secondary text-xs" {...props} />
  ),
  td: ({ node, children, ...props }) => (
    <td className="px-3 py-1.5 th-text-secondary border-t th-border-secondary text-xs" {...props}>
      {linkifyChildren(children)}
    </td>
  ),
  tr: ({ node, ...props }) => (
    <tr className="hover:th-bg-surface transition-colors" {...props} />
  ),
  blockquote: ({ node, ...props }) => (
    <blockquote className="border-l-2 border-brand/50 pl-3 my-2 th-text-muted italic" {...props} />
  ),
  hr: ({ node, ...props }) => (
    <hr className="my-4 th-border" {...props} />
  ),
};

const remarkPlugins = [remarkGfm];

// Helper to extract clean text content
function cleanContent(content) {
  if (typeof content !== "string") return content;
  try {
    if (content.trim().startsWith("{") || content.trim().startsWith("[")) {
      const parsed = JSON.parse(content);
      if (parsed.content?.parts?.[0]?.text) {
        return parsed.content.parts[0].text;
      }
      if (typeof parsed.content === "string") {
        return cleanContent(parsed.content);
      }
    }
  } catch (e) {
    // Not JSON, return original
  }
  return content;
}

function formatDuration(ms) {
  if (!ms) return null;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTokens(tokens) {
  if (!tokens) return null;
  const total = tokens.total_tokens || tokens.totalTokens;
  if (!total) return null;
  return total.toLocaleString();
}

function FileAttachment({ att }) {
  const [downloading, setDownloading] = useState(false);
  const isImage = att.type?.startsWith("image/");
  const isPdf = att.type?.includes("pdf");
  const Icon = isImage ? ImageIcon : isPdf ? FileText : FileIcon;
  const sizeLabel = att.size > 0
    ? att.size < 1024
      ? `${att.size} B`
      : att.size < 1048576
        ? `${(att.size / 1024).toFixed(1)} KB`
        : `${(att.size / 1048576).toFixed(1)} MB`
    : null;

  const handleDownload = async () => {
    if (!att.downloadPath || downloading) return;
    setDownloading(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
      const token = typeof window !== "undefined"
        ? localStorage.getItem("th2_auth_token")
        : null;
      const res = await fetch(`${apiBase}${att.downloadPath}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = att.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[FileAttachment] Download error:", err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={downloading}
      className="flex items-center gap-2 px-2.5 py-2 th-bg-surface hover:th-bg-surface-hover border th-border-hover rounded-lg transition-colors cursor-pointer group/file disabled:opacity-50"
    >
      {isImage && att.preview ? (
        // eslint-disable-next-line @next/next/no-img-element -- preview is a local blob/data URL, next/image requires a configured remote domain
        <img
          src={att.preview}
          alt={att.name}
          className="w-10 h-10 rounded object-cover shrink-0"
        />
      ) : (
        <div className="w-10 h-10 rounded th-bg-surface flex items-center justify-center shrink-0">
          <Icon size={18} className="th-text-muted" />
        </div>
      )}
      <div className="min-w-0 flex-1 text-left">
        <p className="text-[11px] th-text-secondary font-medium truncate max-w-[150px]">
          {att.name}
        </p>
        {sizeLabel && (
          <p className="text-[10px] th-text-faint">{sizeLabel}</p>
        )}
      </div>
      {downloading ? (
        <Loader2 size={14} className="th-text-muted animate-spin shrink-0" />
      ) : (
        <Download
          size={14}
          className="th-text-faint group-hover/file:th-text-secondary transition-colors shrink-0"
        />
      )}
    </button>
  );
}


// ── Response state notice (empty / interrupted / error) ────────────────────
function ResponseStateNotice({ status, error, canAct, onRegenerate, onContinue }) {
  const t = useTranslations("ChatMessage");
  if (status !== "empty" && status !== "interrupted" && status !== "error") return null;
  const tone =
    status === "error"
      ? "border-red-500/30 bg-red-500/[0.06] text-red-300"
      : status === "interrupted"
        ? "border-amber-500/30 bg-amber-500/[0.06] text-amber-300"
        : "border-dashed th-border th-bg-surface th-text-muted";
  const Icon = status === "error" ? AlertTriangle : status === "interrupted" ? CircleSlash2 : Sparkles;
  const label =
    status === "error"
      ? t("stateError")
      : status === "interrupted"
        ? t("stateInterrupted")
        : t("stateEmpty");
  const hint =
    status === "error"
      ? error || t("stateErrorHint")
      : status === "interrupted"
        ? t("stateInterruptedHint")
        : t("stateEmptyHint");
  const btn =
    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors";
  return (
    <div
      role="status"
      data-state={status}
      className={`mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-3 py-2 ${tone}`}
    >
      <Icon size={14} className="shrink-0" />
      <div className="min-w-0 flex-1">
        <span className="text-xs font-semibold">{label}</span>
        <span className="text-[11px] opacity-80 ml-2 break-words">{hint}</span>
      </div>
      {canAct && (
        <div className="flex items-center gap-1.5">
          {status === "interrupted" && onContinue && (
            <button type="button" onClick={onContinue} className={`${btn} border-amber-400/40 hover:bg-amber-500/15`}>
              <StepForward size={12} /> {t("continue")}
            </button>
          )}
          {onRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              className={`${btn} ${
                status === "error"
                  ? "border-red-400/40 hover:bg-red-500/15"
                  : "th-border-hover hover:th-bg-surface-hover"
              }`}
            >
              <RefreshCw size={12} /> {status === "error" ? t("retry") : t("regenerate")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Message ────────────────────────────────────────────────────────────────
export default memo(function ChatMessage({
  message,
  messageIndex,
  isStreaming,
  isLastAssistant = false,
  onEditPrompt,
  onOpenArtifact,
  onApprove,
  onReject,
  onModifyApproval,
  onConnectIntegration,
  onRespondToActionCard,
  onNavigateBranch,
  onRegenerate,
  onContinue,
  agentName,
}) {
  const t = useTranslations("ChatMessage");
  const [copied, setCopied] = useState(false);
  const onOpenArtifactRef = useRef(onOpenArtifact);
  useEffect(() => {
    onOpenArtifactRef.current = onOpenArtifact;
  }, [onOpenArtifact]);
  const isUser = message.role === "user";
  const isSynthetic = isUser && message.isSynthetic === true;

  const displayContent = cleanContent(message.content);
  const hasAttachments = isUser && message.attachments && message.attachments.length > 0;
  const hasApprovals = message.approvals && message.approvals.length > 0;
  const hasMeta = message.meta && (message.meta.duration || message.meta.tokens);
  const hasBranches = message._branches && message._branches.length > 1;
  const status = isUser ? "done" : isStreaming ? "streaming" : deriveMessageStatus(message);
  const hasTrail =
    !isUser &&
    ((message.steps && message.steps.length > 0) ||
      (message.thinking && message.thinking.trim().length > 0) ||
      (message.toolCalls && message.toolCalls.length > 0) ||
      (message.handoffs && message.handoffs.length > 0));

  // --- Throttle markdown rendering during streaming (~20fps) ---
  const displayContentRef = useRef(displayContent);
  useEffect(() => {
    displayContentRef.current = displayContent;
  }, [displayContent]);

  const [markdownContent, setMarkdownContent] = useState(displayContent);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (isStreaming) {
      // During streaming: update markdown at throttled rate
      if (!intervalRef.current) {
        setMarkdownContent(displayContentRef.current);
        intervalRef.current = setInterval(() => {
          setMarkdownContent(displayContentRef.current);
        }, 48); // ~20fps for markdown parsing
      }
    } else {
      // Streaming ended: clear interval, render final content immediately
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setMarkdownContent(displayContent);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isStreaming, displayContent]);

  // Build per-instance components (stable — ref is read at click time, not render time)
  const mdComponents = useMemo(
    () => ({
      ...markdownComponents,
      code: ({ node, inline, className, children, ...props }) => {
        const match = /language-(\w+)/.exec(className || "");
        if (!inline && match) {
          const lang = match[1];
          const raw = String(children).replace(/\n$/, "");
          // ```chart — a small JSON spec rendered as a native chart.
          if (lang === "chart") {
            return <InlineChart source={raw} />;
          }
          // Detect JSON blocks and render as structured output
          if (lang === "json") {
            try {
              JSON.parse(raw);
              return <JsonBlock content={raw} />;
            } catch {}
          }
          return (
            <CodeBlock
              className={className}
              onOpen={(...args) => onOpenArtifactRef.current?.(...args)}
            >
              {children}
            </CodeBlock>
          );
        }
        return (
          <code
            className="bg-black/20 rounded px-1 py-0.5 text-xs font-mono"
            {...props}
          >
            {children}
          </code>
        );
      },
    }),
    [], // stable — callback accessed via ref
  );

  // Memoize the expensive markdown render
  const renderedMarkdown = useMemo(
    () => (
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        components={mdComponents}
      >
        {markdownContent || ""}
      </ReactMarkdown>
    ),
    [markdownContent, mdComponents],
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleEdit = () => {
    if (onEditPrompt) {
      onEditPrompt(displayContent);
    }
  };

  const iconBtn =
    "p-1.5 rounded-lg th-text-faint hover:th-text-secondary hover:th-bg-surface-hover transition-colors focus-visible:ring-2 focus-visible:ring-brand/50 outline-none";

  if (isSynthetic) {
    return (
      <div className="flex justify-end my-1 px-1" id={`chat-msg-${message.id}`}>
        <span className="italic th-text-ghost text-[11px] max-w-[80%] truncate">
          ↳ {displayContent}
        </span>
      </div>
    );
  }

  // ── User turn: compact bubble on the right ─────────────────────────────
  if (isUser) {
    return (
      <div id={`chat-msg-${message.id}`} className="group flex justify-end my-3 pl-10">
        <div className="flex flex-col items-end max-w-[78%] min-w-0">
          <div className="relative rounded-2xl rounded-br-md px-4 py-2.5 border border-brand/25 bg-brand/[0.12] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]">
            {hasAttachments && (
              <div className="flex flex-wrap gap-2 mb-2">
                {message.attachments.map((att, idx) => (
                  <FileAttachment key={idx} att={att} />
                ))}
              </div>
            )}
            <div className="text-sm break-words markdown-content user-bubble-md th-text">
              {renderedMarkdown}
            </div>
          </div>
          <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <span className="text-[10px] th-text-ghost tabular-nums mr-1">
              {formatDateTime(message.timestamp)}
            </span>
            <button onClick={handleCopy} className={iconBtn} title={t("copyMessage")} aria-label={t("copyMessage")}>
              {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            </button>
            {onEditPrompt && (
              <button onClick={handleEdit} className={iconBtn} title={t("editAndResend")} aria-label={t("editAndResend")}>
                <Edit2 size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Assistant turn: full-width prose ───────────────────────────────────
  const canAct = isLastAssistant && !isStreaming;
  return (
    <article
      id={`chat-msg-${message.id}`}
      data-status={status}
      className="group relative my-3 pr-2"
      aria-busy={isStreaming || undefined}
    >
      {/* Identity row */}
      <header className="flex items-center gap-2 mb-1.5">
        <span className="w-5 h-5 rounded-md bg-brand/15 border border-brand/25 flex items-center justify-center shrink-0">
          <Sparkles size={11} className="text-brand" />
        </span>
        <span className="text-[11px] font-semibold th-text-secondary truncate">
          {agentName || t("assistant")}
        </span>
        <span className="text-[10px] th-text-ghost tabular-nums">
          {formatDateTime(message.timestamp)}
        </span>
        {status === "interrupted" && (
          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
            {t("badgeInterrupted")}
          </span>
        )}
        {status === "error" && (
          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/30">
            {t("badgeError")}
          </span>
        )}
      </header>

      <div className="pl-7">
        {/* Reasoning trail: thoughts, tools, hand-offs in order */}
        {hasTrail && <ReasoningTrail message={message} isStreaming={isStreaming} />}

        {/* Approval cards (HITL) */}
        {hasApprovals &&
          message.approvals.map((a) => (
            <ApprovalCard
              key={a.id}
              approval={a}
              onApprove={(id) => onApprove?.(message.id, id)}
              onReject={(id) => onReject?.(message.id, id)}
              onModify={(id, text) => onModifyApproval?.(message.id, id, text)}
            />
          ))}

        {/* Integration connect cards */}
        {message.integrationRequests?.length > 0 &&
          Array.from(
            new Map(message.integrationRequests.map((r) => [r.id, r])).values(),
          ).map((req) => (
            <IntegrationConnectCard
              key={req.id}
              request={req}
              onConnect={onConnectIntegration}
            />
          ))}

        {/* Action cards — dispatches to 9 typed components */}
        {message.actionCards?.length > 0 && (
          <div aria-live="polite" aria-atomic="false">
            {Array.from(
              new Map(message.actionCards.map((c) => [c.id, c])).values(),
            ).map((card) => (
              <ActionCard
                key={card.id}
                card={card}
                agentName={agentName}
                onRespond={(response, opts) =>
                  onRespondToActionCard?.(message.id, card.id, response, opts)
                }
              />
            ))}
          </div>
        )}

        {/* The answer */}
        {(markdownContent || isStreaming) && (
          <div className="text-sm leading-relaxed break-words markdown-content th-text-secondary">
            {renderedMarkdown}
            {isStreaming && (
              <span className="inline-flex items-center ml-1 align-middle">
                <span className="w-2 h-4 bg-brand/60 animate-pulse rounded-sm" />
              </span>
            )}
          </div>
        )}

        {/* Empty / interrupted / error */}
        {!isStreaming && (
          <ResponseStateNotice
            status={status}
            error={message.error}
            canAct={canAct}
            onRegenerate={onRegenerate ? () => onRegenerate(message.id) : undefined}
            onContinue={onContinue}
          />
        )}

        {/* Footer: actions (on hover / focus) + metrics */}
        {!isStreaming && (
          <footer
            className={`flex items-center gap-1 mt-1.5 -ml-1.5 transition-opacity ${
              hasBranches ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"
            }`}
          >
            {message.content && (
              <button onClick={handleCopy} className={iconBtn} title={t("copyMessage")} aria-label={t("copyMessage")}>
                {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              </button>
            )}
            {canAct && onRegenerate && status === "done" && (
              <button
                onClick={() => onRegenerate(message.id)}
                className={iconBtn}
                title={t("regenerate")}
                aria-label={t("regenerate")}
              >
                <RefreshCw size={13} />
              </button>
            )}
            {canAct && onContinue && status === "done" && message.content && (
              <button onClick={onContinue} className={iconBtn} title={t("continue")} aria-label={t("continue")}>
                <StepForward size={13} />
              </button>
            )}
            {hasBranches && (
              <BranchNavigator
                branchCount={message._branches.length}
                currentBranch={message._activeBranch ?? message._branches.length - 1}
                onNavigate={(idx) => onNavigateBranch?.(message.id, idx)}
              />
            )}
            {hasMeta && (
              <span className="ml-auto flex items-center gap-3 text-[10px] th-text-ghost tabular-nums">
                {message.meta.duration && (
                  <span className="flex items-center gap-1">
                    <Clock size={10} />
                    {formatDuration(message.meta.duration)}
                  </span>
                )}
                {message.meta.tokens && formatTokens(message.meta.tokens) && (
                  <span className="flex items-center gap-1">
                    <Zap size={10} />
                    {formatTokens(message.meta.tokens)} {t("tokensSuffix")}
                  </span>
                )}
                {/* Cost is intentionally not shown (product decision). */}
              </span>
            )}
          </footer>
        )}
      </div>
    </article>
  );
});
