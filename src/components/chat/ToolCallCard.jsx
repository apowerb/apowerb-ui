import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "use-intl";
import { Wrench, ChevronDown, ChevronRight, Loader2, Check, Download, BarChart3, Table2, Eye, EyeOff, Maximize2, Minimize2 } from "lucide-react";
import { DataTable } from "./StructuredOutput";
import AudioPlayer from "./AudioPlayer";

function ArgValue({ value }) {
  if (value === null || value === undefined) return <span className="text-purple-400">null</span>;
  if (typeof value === "boolean") return <span className="text-purple-400">{String(value)}</span>;
  if (typeof value === "number") return <span className="text-blue-400">{value}</span>;
  if (typeof value === "string") {
    // Truncate long strings
    const display = value.length > 120 ? value.slice(0, 120) + "..." : value;
    return <span className="text-blue-300">{display}</span>;
  }
  if (typeof value === "object") {
    return <span className="th-text-faint text-[10px]">{JSON.stringify(value)}</span>;
  }
  return <span className="th-text-muted">{String(value)}</span>;
}

function DownloadButton({ downloadPath, filename }) {
  const t = useTranslations("ToolCallCard");
  const [busy, setBusy] = useState(false);

  const handleClick = async (e) => {
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("th2_auth_token")
          : null;
      const res = await fetch(`${apiBase}${downloadPath}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || downloadPath.split("/").pop() || "download";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[DownloadButton] Error:", err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30 rounded-lg text-[11px] text-blue-300 font-medium transition-colors cursor-pointer disabled:opacity-50"
    >
      {busy ? (
        <Loader2 size={12} className="animate-spin shrink-0" />
      ) : (
        <Download size={12} className="shrink-0" />
      )}
      {filename || t("download")}
    </button>
  );
}

// Script injected into chart HTML to auto-report height to parent
const RESIZE_SCRIPT = `
<script>
(function(){
  function reportHeight(){
    var h = Math.max(
      document.body.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.scrollHeight,
      document.documentElement.offsetHeight
    );
    window.parent.postMessage({type:'chart-resize',height:h},'*');
  }
  // Report after load and on resize
  window.addEventListener('load', function(){ setTimeout(reportHeight, 200); });
  window.addEventListener('resize', reportHeight);
  // Also observe DOM changes (Plotly renders async)
  if(window.MutationObserver){
    new MutationObserver(function(){ setTimeout(reportHeight, 100); })
      .observe(document.body, {childList:true, subtree:true, attributes:true});
  }
  // Fallback: report periodically for 3s after load
  var attempts = 0;
  var interval = setInterval(function(){
    reportHeight();
    if(++attempts > 6) clearInterval(interval);
  }, 500);
})();
</script>`;

function injectResizeScript(html) {
  if (!html) return html;
  // Inject before </body> or at the end
  if (html.includes("</body>")) {
    return html.replace("</body>", RESIZE_SCRIPT + "</body>");
  }
  return html + RESIZE_SCRIPT;
}

function ChartPreview({ downloadPath, chartJson }) {
  const t = useTranslations("ToolCallCard");
  const [show, setShow] = useState(true);
  // Strategy 1: If we have chart_json, compute HTML synchronously at init
  const [html, setHtml] = useState(() => {
    if (chartJson) {
      try {
        const figData = typeof chartJson === "string" ? JSON.parse(chartJson) : chartJson;
        const plotlyHtml = `<!DOCTYPE html>
<html><head>
<script src="https://cdn.plot.ly/plotly-2.35.2.min.js"><\/script>
<style>
  html,body{margin:0;padding:0;width:100%;height:100%;overflow:auto;background:#fff}
  #chart{width:100%;min-height:400px}
</style>
</head><body>
<div id="chart"></div>
<script>
var fig=${JSON.stringify(figData)};
var layout=Object.assign({},fig.layout,{
  autosize:true,
  margin:{l:50,r:30,t:50,b:50},
  paper_bgcolor:'white',
  plot_bgcolor:'white',
  font:{size:13}
});
Plotly.newPlot('chart',fig.data,layout,{responsive:true,displayModeBar:true});
window.addEventListener('resize',function(){Plotly.Plots.resize('chart')});
<\/script>
</body></html>`;
        return injectResizeScript(plotlyHtml);
      } catch (e) {
        console.warn("[ChartPreview] chart_json parse failed, falling back to download:", e);
      }
    }
    return null;
  });
  const [loading, setLoading] = useState(!html && !!downloadPath);
  const [error, setError] = useState(null);
  const [iframeHeight, setIframeHeight] = useState(420);
  const [fullscreen, setFullscreen] = useState(false);
  const iframeRef = useRef(null);

  // Listen for height messages from the iframe
  useEffect(() => {
    function handleMessage(e) {
      if (e.data?.type === "chart-resize" && typeof e.data.height === "number") {
        const h = Math.max(300, Math.min(e.data.height + 20, fullscreen ? 2000 : 700));
        setIframeHeight(h);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [fullscreen]);

  useEffect(() => {
    if (!show || html) return;

    // Strategy 2: Fetch HTML file from backend
    if (!downloadPath) return;
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("th2_auth_token")
        : null;
    fetch(`${apiBase}${downloadPath}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load chart: ${res.status}`);
        return res.text();
      })
      .then((text) => setHtml(injectResizeScript(text)))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [show, downloadPath, chartJson, html]);

  const containerClass = fullscreen
    ? "fixed inset-4 z-50 rounded-xl border th-border-hover bg-white shadow-2xl flex flex-col"
    : "rounded-lg border th-border overflow-hidden bg-white";

  return (
    <div className="px-3 pb-2">
      <div className="flex items-center gap-2 mb-1.5">
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="flex items-center gap-1.5 text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
        >
          {show ? <EyeOff size={12} /> : <Eye size={12} />}
          <BarChart3 size={12} />
          {show ? t("hideChart") : t("showChart")}
        </button>
        {show && (
          <button
            type="button"
            onClick={() => setFullscreen(!fullscreen)}
            className="flex items-center gap-1 text-[11px] th-text-faint hover:th-text-secondary transition-colors"
          >
            {fullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            {fullscreen ? t("reduce") : t("expand")}
          </button>
        )}
      </div>

      {/* Fullscreen backdrop */}
      {fullscreen && show && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setFullscreen(false)}
        />
      )}

      {show && (
        <div className={containerClass}>
          {loading && (
            <div className="flex items-center justify-center bg-black/10" style={{ height: fullscreen ? "100%" : `${iframeHeight}px` }}>
              <Loader2 size={20} className="animate-spin th-text-faint" />
            </div>
          )}
          {error && (
            <div className="p-3 text-xs text-red-400">{error}</div>
          )}
          {html && (
            <iframe
              ref={iframeRef}
              srcDoc={html}
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              className="w-full bg-white"
              style={{
                height: fullscreen ? "100%" : `${iframeHeight}px`,
                flex: fullscreen ? 1 : undefined,
                border: "none",
              }}
              title={t("chartPreview")}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ImagePreview({ result }) {
  const t = useTranslations("ToolCallCard");
  const [show, setShow] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [objectUrl, setObjectUrl] = useState(null);
  const objectUrlRef = useRef(null);

  const base64Src = result.base64_data
    ? `data:${result.content_type || "image/png"};base64,${result.base64_data}`
    : null;

  useEffect(() => {
    if (base64Src || !result.download_path) return;
    let cancelled = false;
    (async () => {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
        const token = typeof window !== "undefined" ? localStorage.getItem("th2_auth_token") : null;
        const res = await fetch(`${apiBase}${result.download_path}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        if (!cancelled) {
          const url = URL.createObjectURL(blob);
          objectUrlRef.current = url;
          setObjectUrl(url);
        }
      } catch (err) {
        console.error("[ImagePreview] fetch error:", err);
      }
    })();
    return () => { cancelled = true; if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current); };
  }, [result.download_path]);

  const src = base64Src || objectUrl;
  if (!src) return null;

  return (
    <div className="px-3 pb-2">
      <button onClick={() => setShow(!show)} className="flex items-center gap-1.5 text-[11px] th-text-ghost hover:th-text-muted mb-1">
        {show ? <EyeOff size={12} /> : <Eye size={12} />}
        {show ? t("hidePreview") : t("showPreview")}
      </button>
      {show && (
        <div className="relative group">
          <img
            src={src}
            alt={result.file_name || t("generatedImage")}
            className="rounded-lg max-h-80 w-auto cursor-pointer border th-border"
            onClick={() => setFullscreen(true)}
          />
          <div className="mt-1 flex items-center gap-2 text-[10px] th-text-ghost">
            {result.image_format && <span>{result.image_format}</span>}
            {result.size_kb && <span>{result.size_kb} KB</span>}
            {result.provider_used && <span>{t("via", { provider: result.provider_used })}</span>}
          </div>
        </div>
      )}
      {/* Fullscreen modal */}
      {fullscreen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setFullscreen(false)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <button
              onClick={(e) => { e.stopPropagation(); setFullscreen(false); }}
              className="absolute -top-3 -right-3 p-1.5 rounded-full bg-gray-800 hover:bg-gray-700 text-white z-10"
            >
              <Minimize2 size={16} />
            </button>
            <img
              src={src}
              alt={result.file_name || t("generatedImage")}
              className="max-w-full max-h-[85vh] rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function SqlResultPreview({ result }) {
  const t = useTranslations("ToolCallCard");
  const sqlQuery = result.sql || result.sql_query;
  const data = result.data;
  const rowCount = result.row_count ?? (Array.isArray(data) ? data.length : null);

  return (
    <div className="px-3 pb-2 space-y-2">
      {/* SQL Query */}
      {sqlQuery && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-blue-400/60 font-semibold mb-1">
            {t("sqlQuery")}
          </div>
          <pre className="text-[11px] text-blue-300/80 th-bg-surface border th-border-secondary rounded-lg p-2.5 overflow-x-auto custom-scrollbar font-mono whitespace-pre-wrap">
            {sqlQuery}
          </pre>
        </div>
      )}

      {/* Data Table */}
      {Array.isArray(data) && data.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Table2 size={12} className="th-text-faint" />
            <span className="text-[10px] uppercase tracking-wider th-text-faint font-semibold">
              {t("results")}
            </span>
            {rowCount != null && (
              <span className="text-[10px] th-text-ghost">
                {t("rowCount", { count: rowCount })}
              </span>
            )}
          </div>
          <DataTable data={data.slice(0, 50)} />
          {data.length > 50 && (
            <p className="text-[10px] th-text-ghost text-center mt-1">
              {t("showingFirst", { count: data.length })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Parse tool result robustly — ADK may return a string, a nested { result: "..." }, or a plain object
function parseToolResult(raw) {
  if (!raw) return null;
  // Already an object with known keys — use as-is
  if (typeof raw === "object" && !Array.isArray(raw)) {
    // ADK sometimes wraps: { result: "{\"success\":true,...}" }
    if (typeof raw.result === "string") {
      try {
        return JSON.parse(raw.result);
      } catch {
        return raw;
      }
    }
    return raw;
  }
  // String — try to parse as JSON
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return null;
}

export default function ToolCallCard({ tool, isStreaming }) {
  const [expanded, setExpanded] = useState(false);

  const hasArgs = tool.args && Object.keys(tool.args).length > 0;
  const result = parseToolResult(tool.result);
  const downloadPath = result?.download_path;
  const resultFilename = result?.filename;

  // Detect chart for inline preview (HTML download or chart_json)
  const chartJson = result?.chart_json;
  const isChart = (downloadPath && downloadPath.endsWith(".html")) || chartJson;

  // Detect SQL results
  const hasSqlResult =
    result?.data &&
    Array.isArray(result.data) &&
    result.data.length > 0 &&
    typeof result.data[0] === "object" &&
    (tool.name?.toLowerCase().includes("sql") ||
      tool.name?.toLowerCase().includes("db") ||
      result?.sql ||
      result?.sql_query);

  // Detect image results for inline preview
  const isImageResult = result?.content_type?.startsWith("image/")
    || result?.image_format
    || (result?.file_name && /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(result.file_name));

  // Detect audio results for inline player
  const isAudioResult = result?.content_type?.startsWith("audio/")
    || result?.audio_format
    || (result?.file_name && /\.(mp3|wav|ogg|webm|m4a|flac|aac)$/i.test(result.file_name));

  return (
    <div className="th-bg-surface border th-border rounded-xl overflow-hidden">
      <button
        onClick={() => hasArgs && setExpanded(!expanded)}
        className={`w-full flex items-center gap-2 px-3 py-2 text-left ${
          hasArgs ? "hover:th-bg-surface cursor-pointer" : "cursor-default"
        } transition-colors`}
      >
        <Wrench size={14} className="text-blue-400 shrink-0" />
        <span className="text-xs font-medium text-blue-200 flex-1 truncate">
          {tool.name}
        </span>

        {/* Status indicator */}
        {isStreaming ? (
          <Loader2 size={14} className="text-blue-400 animate-spin shrink-0" />
        ) : (
          <Check size={14} className="text-blue-400 shrink-0" />
        )}

        {/* Expand chevron */}
        {hasArgs && (
          <span className="th-text-ghost">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        )}
      </button>

      {/* Download button when tool result contains a download path */}
      {downloadPath && (
        <div className="px-3 pb-2">
          <DownloadButton downloadPath={downloadPath} filename={resultFilename} />
        </div>
      )}

      {/* Inline image preview */}
      {isImageResult && !isStreaming && (
        <ImagePreview result={result} />
      )}

      {/* Inline audio player */}
      {isAudioResult && !isStreaming && (
        <AudioPlayer result={result} />
      )}

      {/* Inline Plotly chart preview */}
      {isChart && !isStreaming && (
        <ChartPreview downloadPath={downloadPath} chartJson={chartJson} />
      )}

      {/* SQL results table */}
      {hasSqlResult && !isStreaming && (
        <SqlResultPreview result={result} />
      )}

      {/* Collapsible args as key-value pairs */}
      {expanded && hasArgs && (
        <div className="px-3 pb-2 border-t th-border-secondary">
          <div className="mt-2 space-y-1">
            {Object.entries(tool.args).map(([key, val]) => (
              <div key={key} className="flex gap-2 text-[11px] leading-relaxed">
                <span className="text-blue-400 shrink-0 font-medium">{key}:</span>
                <ArgValue value={val} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
