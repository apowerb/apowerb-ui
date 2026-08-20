"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "@/lib/navigation";
import { useTranslations } from "use-intl";
import {
  ArrowLeft,
  Plus,
  Trash2,
  BarChart3,
  Loader2,
  Pencil,
  Globe,
  Lock,
  Building2,
  Link2,
  Copy,
  Check,
  X,
  Download,
  FileText,
  FileCode,
  ChevronDown,
  PanelRightOpen,
  PanelRightClose,
  Bot,
  MessageSquare,
  Link,
  Send,
} from "lucide-react";
import {
  getDashboard,
  getDashboardAgent,
  linkAgentToDashboard,
  listAgentsForBi,
  removeDashboardComponent,
  updateDashboardComponent,
  moveDashboardComponent,
  addDashboardComponent,
  deleteDashboard,
  publishDashboard,
  unpublishDashboard,
  getChart,
  getChartData,
} from "@/lib/api";
import { useToast } from "../Toast";
import ConfirmToast from "../ConfirmToast";
import Breadcrumb from "../Breadcrumb";
import { LayoutDashboard } from "lucide-react";
import ChartRenderer from "./ChartRenderer";
import StatCard from "./StatCard";
import EditChartModal from "./EditChartModal";
import DashboardFilters from "./DashboardFilters";
import AddChartWizard from "./AddChartWizard";
import ChartSidebar from "./ChartSidebar";
import MiniChat from "./MiniChat";
import { authStorage } from "@/lib/authStorage";

import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";
import { formatDateTime } from "@/lib/datetime";
import ReactGridLayout from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

export default function DashboardDetail({ dashboardId }) {
  const t = useTranslations("DashboardDetail");
  const router = useRouter();
  const toast = useToast();

  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddChart, setShowAddChart] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [publishing, setPublishing] = useState(false);

  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishVisibility, setPublishVisibility] = useState("public");
  const [publishSlug, setPublishSlug] = useState("");
  const [copied, setCopied] = useState(false);
  const [deletingDashboard, setDeletingDashboard] = useState(false);
  const [showDeleteDashboardConfirm, setShowDeleteDashboardConfirm] = useState(false);
  const [gridWidth, setGridWidth] = useState(1200);
  const gridContainerRef = useRef(null);

  // Edit chart modal
  const [editingChart, setEditingChart] = useState(null);
  const [loadingChart, setLoadingChart] = useState(null);

  // Filters
  const [filterParams, setFilterParams] = useState(null);

  // Export
  const [exporting, setExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  // Map of chart_id → { title, chart_type } resolved by ChartRenderer
  // once each chart's data arrives. Lets the card header show the real
  // title instead of the generic "Chart" fallback.
  const [chartMeta, setChartMeta] = useState({});
  const exportAreaRef = useRef(null);
  const exportMenuRef = useRef(null);

  // Linked agent
  const [linkedAgent, setLinkedAgent] = useState(null);
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [availableAgents, setAvailableAgents] = useState([]);
  const agentPickerRef = useRef(null);

  // MiniChat
  const [showMiniChat, setShowMiniChat] = useState(false);

  // Sidebar & external drop
  const [showSidebar, setShowSidebar] = useState(false);
  const draggingChartRef = useRef(null);

  const [chartSourcesById, setChartSourcesById] = useState({});

  const fetchDashboard = useCallback(async () => {
    try {
      const data = await getDashboard(dashboardId);
      setDashboard(data);
    } catch (err) {
      console.error("Failed to load dashboard:", err);
      toast.error(t("loadDashboardFailed", { message: err.message }));
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboardId]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Fetch linked agent
  useEffect(() => {
    if (!dashboardId) return;
    getDashboardAgent(dashboardId)
      .then(setLinkedAgent)
      .catch(() => setLinkedAgent(null));
  }, [dashboardId]);

  // Close agent picker on click outside
  useEffect(() => {
    if (!showAgentPicker) return;
    const handleClick = (e) => {
      if (agentPickerRef.current && !agentPickerRef.current.contains(e.target)) {
        setShowAgentPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showAgentPicker]);

  const handleOpenAgentPicker = async () => {
    if (showAgentPicker) {
      setShowAgentPicker(false);
      return;
    }
    try {
      const agents = await listAgentsForBi();
      setAvailableAgents(Array.isArray(agents) ? agents : []);
    } catch {
      setAvailableAgents([]);
    }
    setShowAgentPicker(true);
  };

  const handleLinkAgent = async (agent) => {
    try {
      await linkAgentToDashboard(dashboardId, agent.agent_id);
      setLinkedAgent({ agent_id: agent.agent_id, agent_name: agent.agent_name });
      setShowAgentPicker(false);
      toast.success(t("agentLinked", { name: agent.agent_name }));
    } catch {
      toast.error(t("linkAgentFailed"));
    }
  };

  const handleUnlinkAgent = async () => {
    const name = linkedAgent?.agent_name || t("agentFallback");
    try {
      await linkAgentToDashboard(dashboardId, null);
      setLinkedAgent(null);
      setShowMiniChat(false);
      toast.success(t("agentUnlinked", { name }));
    } catch {
      toast.error(t("unlinkAgentFailed"));
    }
  };

  // Measure grid container width for react-grid-layout
  useEffect(() => {
    const el = gridContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setGridWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    setGridWidth(el.offsetWidth);
    return () => observer.disconnect();
  }, []);

  // Initialize publish slug from dashboard data
  useEffect(() => {
    if (dashboard && !publishSlug) {
      setPublishSlug(dashboard.slug || dashboard.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
    }
  }, [dashboard, publishSlug]);

  // Compute filter labels from component data
  const filterLabels = useMemo(() => {
    const labels = new Set();
    (dashboard?.components || []).forEach((comp) => {
      if (comp.chart?.labels) {
        comp.chart.labels.forEach((l) => labels.add(l));
      }
    });
    return Array.from(labels);
  }, [dashboard]);

  const [editingKv, setEditingKv] = useState(null);
  const [savingKv, setSavingKv] = useState(false);

  const handleEditKeyValue = (comp) => {
    const kv = comp.key_value || {};
    setEditingKv({
      id: comp.id,
      label: kv.label ?? "",
      value: kv.value ?? "",
      unit: kv.unit ?? "",
      description: kv.description ?? "",
      original: kv,
    });
  };

  const confirmEditKeyValue = async () => {
    if (!editingKv) return;
    const label = editingKv.label.trim();
    const rawValue = String(editingKv.value).trim();
    if (!label || rawValue === "") {
      toast.error(t("labelValueRequired"));
      return;
    }
    const numeric = Number(rawValue);
    const value = !Number.isNaN(numeric) ? numeric : rawValue;
    setSavingKv(true);
    try {
      await updateDashboardComponent(dashboardId, editingKv.id, {
        key_value: {
          ...editingKv.original,
          label,
          value,
          unit: editingKv.unit.trim() || null,
          description: editingKv.description.trim() || null,
        },
      });
      toast.success(t("keyFigureUpdated"));
      setEditingKv(null);
      fetchDashboard();
    } catch (err) {
      toast.error(t("updateFailed", { message: err.message }));
    } finally {
      setSavingKv(false);
    }
  };

  const handleRemoveComponent = async (componentId) => {
    setDeleting(componentId);
    try {
      await removeDashboardComponent(dashboardId, componentId);
      toast.success(t("chartRemovedFromDashboard"));
      fetchDashboard();
    } catch (err) {
      toast.error(t("removeChartFailed", { message: err.message }));
    } finally {
      setDeleting(null);
    }
  };

  const handleEditChart = async (chartId) => {
    setLoadingChart(chartId);
    try {
      const chartData = await getChart(chartId);
      setEditingChart(chartData);
    } catch (err) {
      toast.error(t("loadChartDetailsFailed", { message: err.message }));
    } finally {
      setLoadingChart(null);
    }
  };

  const handleLayoutChange = (layout) => {
    const components = dashboard?.components || [];
    layout.forEach((item) => {
      const comp = components.find((c) => c.id === item.i);
      if (!comp) return;
      const oldPos = comp.position || {};
      // Only update if position actually changed
      if (
        oldPos.col === item.x &&
        oldPos.row === item.y &&
        oldPos.width === item.w &&
        oldPos.height === item.h
      ) {
        return;
      }
      moveDashboardComponent(dashboardId, item.i, {
        position: { col: item.x, row: item.y, width: item.w, height: item.h },
      }).catch((err) => {
        console.error("Failed to save position:", err);
      });
    });
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      await publishDashboard(dashboardId, { visibility: publishVisibility });
      toast.success(t("dashboardPublished"));
      setShowPublishModal(false);
      fetchDashboard();
    } catch (err) {
      toast.error(t("publishFailed", { message: err.message }));
    } finally {
      setPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    setPublishing(true);
    try {
      await unpublishDashboard(dashboardId);
      toast.success(t("dashboardRevertedToDraft"));
      fetchDashboard();
    } catch (err) {
      toast.error(t("unpublishFailed", { message: err.message }));
    } finally {
      setPublishing(false);
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/view/dashboard/${publishSlug || dashboard?.slug}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeleteDashboard = () => {
    setShowDeleteDashboardConfirm(true);
  };

  const confirmDeleteDashboard = async () => {
    setShowDeleteDashboardConfirm(false);
    setDeletingDashboard(true);
    try {
      await deleteDashboard(dashboardId);
      toast.success(t("dashboardDeleted"));
      router.push("/bi");
    } catch (err) {
      toast.error(t("deleteDashboardFailed", { message: err.message }));
      setDeletingDashboard(false);
    }
  };

  const handleFilterChange = (params) => {
    setFilterParams(params);
  };

  const handleFilterClear = () => {
    setFilterParams(null);
  };

  // Sidebar drag handlers
  const handleSidebarDragStart = (size) => {
    draggingChartRef.current = size;
  };

  const handleSidebarDragEnd = () => {
    draggingChartRef.current = null;
  };

  const handleDropDragOver = useCallback(() => {
    const info = draggingChartRef.current;
    if (!info) return { w: 6, h: 4 };
    return { w: info.w, h: info.h };
  }, []);

  const handleGridDrop = async (layout, layoutItem, event) => {
    if (!layoutItem) return;
    try {
      const payload = JSON.parse(event.dataTransfer.getData("text/plain"));
      await addDashboardComponent(dashboardId, {
        component: {
          component_type: "chart",
          position: {
            col: layoutItem.x,
            row: layoutItem.y,
            width: layoutItem.w,
            height: layoutItem.h,
          },
          chart: {
            chart_id: payload.chartId,
            title_override: payload.chartTitle,
          },
        },
      });
      toast.success(t("chartAddedToDashboard"));
      fetchDashboard();
    } catch (err) {
      toast.error(t("addChartFailed", { message: err.message }));
    } finally {
      draggingChartRef.current = null;
    }
  };

  // IDs of charts already on the dashboard
  const usedChartIds = useMemo(() => {
    return (dashboard?.components || [])
      .map((c) => c.chart?.chart_id)
      .filter(Boolean);
  }, [dashboard]);

  // Close export menu on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setShowExportMenu(false);
      }
    };
    if (showExportMenu) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showExportMenu]);

  const captureCanvas = async () => {
    const el = exportAreaRef.current;
    if (!el) throw new Error("Nothing to export");

    // Temporarily expand the container so html2canvas captures ALL content
    const prevOverflow = el.style.overflow;
    const prevHeight = el.style.height;
    el.style.overflow = "visible";
    el.style.height = "auto";

    // Apply light theme for export: swap dark colors to light
    const EXPORT_CLASS = "export-light-mode";
    el.classList.add(EXPORT_CLASS);

    try {
      return await html2canvas(el, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        logging: false,
        windowHeight: el.scrollHeight,
      });
    } finally {
      el.classList.remove(EXPORT_CLASS);
      el.style.overflow = prevOverflow;
      el.style.height = prevHeight;
    }
  };

  const handleExportPDF = async () => {
    setShowExportMenu(false);
    setExporting(true);
    try {
      const canvas = await captureCanvas();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;

      // Use A4 landscape and scale image to fit pages
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const usableW = pageW - margin * 2;
      const usableH = pageH - margin * 2;

      // Scale to fit width
      const ratio = usableW / imgWidth;
      const scaledH = imgHeight * ratio;

      // If it fits on one page, center it
      if (scaledH <= usableH) {
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", margin, margin, usableW, scaledH);
      } else {
        // Multi-page: slice the canvas into page-sized chunks
        const sliceHeight = Math.floor(usableH / ratio);
        let srcY = 0;
        let page = 0;

        while (srcY < imgHeight) {
          if (page > 0) pdf.addPage();
          const h = Math.min(sliceHeight, imgHeight - srcY);

          // Create a slice canvas for this page
          const sliceCanvas = document.createElement("canvas");
          sliceCanvas.width = imgWidth;
          sliceCanvas.height = h;
          const ctx = sliceCanvas.getContext("2d");
          ctx.drawImage(canvas, 0, srcY, imgWidth, h, 0, 0, imgWidth, h);

          const renderedH = h * ratio;
          pdf.addImage(sliceCanvas.toDataURL("image/png"), "PNG", margin, margin, usableW, renderedH);

          srcY += h;
          page++;
        }
      }

      pdf.save(`${dashboard.title || "dashboard"}.pdf`);
      toast.success(t("pdfDownloaded"));
    } catch (err) {
      console.error("PDF export failed:", err);
      toast.error(t("exportPdfFailed"));
    } finally {
      setExporting(false);
    }
  };

  const handleExportHTML = async () => {
    setShowExportMenu(false);
    setExporting(true);
    try {
      const el = exportAreaRef.current;
      if (!el) throw new Error("Nothing to export");

      // Switch to light mode for capture
      const prevOverflow = el.style.overflow;
      const prevHeight = el.style.height;
      el.style.overflow = "visible";
      el.style.height = "auto";
      el.classList.add("export-light-mode");
      await new Promise((r) => requestAnimationFrame(r));

      // Capture each grid card individually
      const gridItems = el.querySelectorAll(".react-grid-item");
      const cards = [];
      for (const item of gridItems) {
        const titleEl = item.querySelector(".drag-handle h3");
        const chartTitle = titleEl?.textContent || "Chart";
        const canvas = await html2canvas(item, {
          backgroundColor: "#ffffff",
          scale: 2,
          useCORS: true,
          logging: false,
        });
        cards.push({
          title: chartTitle,
          dataUrl: canvas.toDataURL("image/png"),
        });
      }

      // Restore original state
      el.classList.remove("export-light-mode");
      el.style.overflow = prevOverflow;
      el.style.height = prevHeight;

      const title = dashboard.title || "Dashboard";
      const description = dashboard.description || "";
      const exportDate = formatDateTime(new Date());

      const cardsHtml = cards.map((c) => `
      <div class="card">
        <div class="card-header">${c.title}</div>
        <img src="${c.dataUrl}" alt="${c.title}" />
      </div>`).join("");

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #f5f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; padding: 40px; color: #0f172a; }
  .header { margin-bottom: 32px; }
  .header h1 { font-size: 28px; font-weight: 800; margin-bottom: 4px; }
  .header .description { color: #475569; font-size: 15px; margin-bottom: 8px; }
  .header .meta { color: #94a3b8; font-size: 13px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(450px, 1fr)); gap: 20px; }
  .card { background: #ffffff; border: 1px solid #e2e4ea; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
  .card-header { padding: 14px 18px; font-size: 14px; font-weight: 600; color: #0f172a; border-bottom: 1px solid #f1f3f5; }
  .card img { width: 100%; height: auto; display: block; }
  @media (max-width: 600px) { body { padding: 16px; } .grid { grid-template-columns: 1fr; } }
  @media print { body { padding: 20px; } .card { break-inside: avoid; } }
</style>
</head>
<body>
<div class="header">
  <h1>${title}</h1>
  ${description ? `<p class="description">${description}</p>` : ""}
  <p class="meta">Exported on ${exportDate}</p>
</div>
<div class="grid">${cardsHtml}
</div>
</body>
</html>`;

      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title}.html`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("htmlDownloaded"));
    } catch (err) {
      console.error("HTML export failed:", err);
      toast.error(t("exportHtmlFailed"));
    } finally {
      setExporting(false);
    }
  };

  // The dashboard endpoint only embeds {chart_id, title_override} per
  // component — it doesn't include the chart's source. Fetch the sources on
  // the side so we can decide whether to show the campaign button.
  useEffect(() => {
    const chartIds = (dashboard?.components || [])
      .map((c) => c.chart?.chart_id)
      .filter(Boolean);
    const missing = chartIds.filter((id) => !(id in chartSourcesById));
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(
      missing.map((id) =>
        getChart(id).then(
          (c) => [id, c?.source || null],
          () => [id, null],
        ),
      ),
    ).then((pairs) => {
      if (cancelled) return;
      console.log("[DashboardDetail] chart sources:", pairs);
      setChartSourcesById((prev) => {
        const next = { ...prev };
        for (const [id, src] of pairs) next[id] = src;
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [dashboard, chartSourcesById]);


  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="glass-card p-8 rounded-2xl text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[var(--border-primary)] border-t-blue-500 mx-auto mb-4" />
          <p className="th-text-secondary">{t("loadingDashboard")}</p>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="glass-card p-8 rounded-2xl text-center">
          <p className="th-text-secondary">{t("dashboardNotFound")}</p>
          <button
            onClick={() => router.push("/bi")}
            className="btn-brand mt-4 px-4 py-2 text-white rounded-lg font-medium"
          >
            {t("backToDashboards")}
          </button>
        </div>
      </div>
    );
  }

  const components = dashboard.components || [];
  const isDraft = dashboard.status === "draft";

  // Build react-grid-layout items
  const gridLayout = components.map((comp) => ({
    i: comp.id,
    x: comp.position?.col || 0,
    y: comp.position?.row || 0,
    w: comp.position?.width || 6,
    h: comp.position?.height || 4,
    minW: 2,
    minH: 2,
  }));

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <header className="shrink-0 p-6 bg-linear-to-r from-brand/20 to-brand-secondary/20 border-b th-border backdrop-blur-xl">
        <Breadcrumb
          className="mb-3"
          items={[
            { label: t("biReporting"), href: "/bi", icon: LayoutDashboard },
            { label: dashboard.title || t("dashboardFallback") },
          ]}
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/bi")}
              className="p-2 rounded-lg hover:th-bg-surface-hover th-text-secondary transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-black th-text tracking-tight">{dashboard.title}</h1>
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    isDraft
                      ? "bg-purple-300/20 text-purple-300 border border-purple-300/30"
                      : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                  }`}
                >
                  {isDraft ? t("draft") : t("published")}
                </span>
                {(linkedAgent?.agent_id || dashboard.agent_id) && (
                  <span className="inline-flex items-center gap-1.5 pl-3 pr-1 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <Bot size={12} />
                    {linkedAgent?.agent_name || t("agentIdFallback", { id: linkedAgent?.agent_id || dashboard.agent_id })}
                    <button
                      type="button"
                      onClick={handleUnlinkAgent}
                      title={t("unlinkAgentTitle")}
                      aria-label={t("unlinkAgentAriaLabel")}
                      className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-blue-500/30 text-blue-300 hover:text-blue-100 transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-400"
                    >
                      <X size={10} />
                    </button>
                  </span>
                )}
              </div>
              {dashboard.description && (
                <p className="th-text-secondary text-sm mt-0.5">{dashboard.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isDraft && (
              <button
                onClick={() => setShowPublishModal(true)}
                className="flex items-center gap-2 px-4 py-3 th-bg-surface border th-border hover:bg-blue-500/20 hover:border-blue-500/30 th-text-muted hover:text-blue-400 rounded-xl font-bold transition-all"
                title={t("publishDashboardTitle")}
              >
                <Globe size={20} />
                <span className="text-sm">{t("publish")}</span>
              </button>
            )}
            {!isDraft && (
              <>
                <button onClick={handleCopyLink} className="flex items-center gap-2 px-4 py-3 th-bg-surface border th-border hover:th-bg-surface-hover rounded-xl font-bold transition-all" title={t("copyShareLinkTitle")}>
                  {copied ? <Check size={20} className="text-blue-400" /> : <Link2 size={20} className="th-text-secondary" />}
                  <span className="text-sm th-text-secondary">{copied ? t("copied") : t("share")}</span>
                </button>
                <button onClick={handleUnpublish} className="flex items-center gap-2 px-4 py-3 th-bg-surface border th-border hover:bg-purple-300/20 hover:border-purple-300/30 th-text-muted hover:text-purple-300 rounded-xl font-bold transition-all" title={t("revertToDraftTitle")}>
                  <Lock size={20} />
                </button>
              </>
            )}
            {/* Export dropdown */}
            <div className="relative" ref={exportMenuRef}>
              <button
                onClick={() => setShowExportMenu((v) => !v)}
                disabled={exporting || components.length === 0}
                className="flex items-center gap-2 px-4 py-3 th-bg-surface border th-border hover:th-bg-surface-hover th-text-muted hover:th-text rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                title={t("downloadDashboardTitle")}
              >
                {exporting ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <Download size={20} />
                )}
                <span className="text-sm">{exporting ? t("exporting") : t("download")}</span>
                <ChevronDown size={14} />
              </button>
              {showExportMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 glass-card rounded-xl border th-border shadow-2xl shadow-black/40 z-50 overflow-hidden">
                  <button
                    onClick={handleExportPDF}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:th-bg-surface-hover transition-colors text-left"
                  >
                    <FileText size={18} className="text-purple-400" />
                    <span className="text-sm font-medium th-text">{t("exportAsPdf")}</span>
                  </button>
                  <button
                    onClick={handleExportHTML}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:th-bg-surface-hover transition-colors text-left"
                  >
                    <FileCode size={18} className="text-blue-400" />
                    <span className="text-sm font-medium th-text">{t("exportAsHtml")}</span>
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={handleDeleteDashboard}
              disabled={deletingDashboard}
              className="flex items-center gap-2 px-4 py-3 th-bg-surface border th-border hover:bg-red-500/20 hover:border-red-500/30 th-text-muted hover:text-red-400 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title={t("deleteDashboardTitle")}
            >
              {deletingDashboard ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Trash2 size={20} />
              )}
            </button>
            <button
              onClick={() => setShowSidebar((v) => !v)}
              className={`flex items-center gap-2 px-4 py-3 border rounded-xl font-bold transition-all ${
                showSidebar
                  ? "bg-blue-500/20 border-blue-500/30 text-blue-400"
                  : "th-bg-surface th-border th-text-muted hover:th-bg-surface-hover hover:th-text"
              }`}
              title={showSidebar ? t("hideChartsLibrary") : t("showChartsLibrary")}
            >
              {showSidebar ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />}
              <span className="text-sm">{t("library")}</span>
            </button>
            <button
              onClick={() => setShowAddChart(true)}
              className="btn-brand flex items-center gap-2 px-5 py-3 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:scale-105"
            >
              <Plus size={20} />
              {t("newChart")}
            </button>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="shrink-0 px-6 pt-4">
        <DashboardFilters
          labels={filterLabels}
          onFilterChange={handleFilterChange}
          onClear={handleFilterClear}
        />
      </div>

      {/* Content + Sidebar */}
      <div className="flex-1 relative overflow-hidden">
        {/* Main grid area — always rendered so it's a valid drop target */}
        <div className="absolute inset-0 overflow-auto p-6" ref={exportAreaRef}>
          <div ref={gridContainerRef} className="max-w-7xl mx-auto min-h-full">
            <ReactGridLayout
              layout={gridLayout}
              cols={12}
              rowHeight={60}
              width={gridWidth}
              onLayoutChange={handleLayoutChange}
              draggableHandle=".drag-handle"
              compactType="vertical"
              margin={[16, 16]}
              resizeHandles={["s", "w", "e", "n", "sw", "nw", "se", "ne"]}
              dropConfig={{ enabled: true, defaultItem: { w: 6, h: 4 } }}
              onDrop={handleGridDrop}
              onDropDragOver={handleDropDragOver}
              style={{ minHeight: "100%" }}
            >
              {components.map((comp) => {
                // Derive title based on component type. For chart
                // widgets we now prefer (in order): an explicit
                // ``title_override`` set on the dashboard widget, the
                // chart's own resolved title (from ChartRenderer's
                // onLoaded callback), then the generic fallback.
                const resolvedChartTitle =
                  comp.chart?.chart_id && chartMeta[comp.chart.chart_id]?.title;
                const compTitle =
                  comp.component_type === "key_value"
                    ? comp.key_value?.label || t("kpiFallback")
                    : comp.component_type === "table"
                      ? comp.table?.title || t("tableFallback")
                      : comp.chart?.title_override ||
                        resolvedChartTitle ||
                        t("chartFallback");

                return (
                  <div
                    key={comp.id}
                    className="glass-card rounded-xl flex flex-col overflow-visible"
                  >
                    <div className="drag-handle flex items-center justify-between px-4 py-2.5 border-b th-border cursor-grab active:cursor-grabbing">
                      <div className="flex flex-col min-w-0 flex-1">
                        <h3 className="text-sm font-semibold th-text truncate">
                          {compTitle}
                        </h3>
                        {(() => { const desc = comp.chart?.chart_id && chartMeta[comp.chart.chart_id]?.description; return desc ? (<p className="text-[11px] th-text-faint truncate mt-0.5" title={desc}>{desc}</p>) : null; })()}
                      </div>
                      <div className="flex items-center gap-1">
                        {comp.chart?.chart_id && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditChart(comp.chart.chart_id);
                            }}
                            disabled={loadingChart === comp.chart.chart_id}
                            className="p-1.5 rounded-lg hover:th-bg-surface-hover th-text-faint hover:th-text-secondary transition-colors"
                            title={t("editChartTitle")}
                          >
                            {loadingChart === comp.chart.chart_id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Pencil size={14} />
                            )}
                          </button>
                        )}
                        {comp.component_type === "key_value" && comp.key_value && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditKeyValue(comp);
                            }}
                            className="p-1.5 rounded-lg hover:th-bg-surface-hover th-text-faint hover:th-text-secondary transition-colors"
                            title={t("editValueTitle")}
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveComponent(comp.id);
                          }}
                          disabled={deleting === comp.id}
                          className="p-1.5 rounded-lg hover:bg-red-500/20 th-text-faint hover:text-red-400 transition-colors"
                        >
                          {deleting === comp.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 p-3 min-h-0">
                      {comp.component_type === "key_value" && comp.key_value ? (
                        <StatCard
                          value={comp.key_value.value}
                          label={comp.key_value.label}
                          unit={comp.key_value.unit}
                          description={comp.key_value.description}
                          trend={comp.key_value.trend}
                        />
                      ) : (
                        <ChartRenderer
                          chartId={comp.chart?.chart_id}
                          filterParams={filterParams}
                          onLoaded={(meta) => {
                            const id = comp.chart?.chart_id;
                            if (!id) return;
                            setChartMeta((prev) => {
                              const existing = prev[id];
                              // Avoid re-renders when nothing changed.
                              if (
                                existing &&
                                existing.title === meta.title &&
                                existing.description === meta.description &&
                                existing.chart_type === meta.chart_type &&
                                existing.row_count === meta.row_count
                              ) {
                                return prev;
                              }
                              return { ...prev, [id]: meta };
                            });
                          }}
                          onDelete={async () => {
                            // Detach the broken chart from the dashboard
                            // first (so the grid stops trying to render it),
                            // then best-effort hard-delete the chart row.
                            try {
                              await removeDashboardComponent(dashboardId, comp.id);
                            } catch (err) {
                              toast.error(
                                t("detachChartFailed", { message: err.message }),
                              );
                              return;
                            }
                            try {
                              const { deleteChart: _deleteChart } = await import(
                                "@/lib/api"
                              );
                              await _deleteChart(comp.chart.chart_id);
                            } catch {
                              /* ok — the chart may already be gone */
                            }
                            toast.success(t("chartRemoved"));
                            fetchDashboard();
                          }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </ReactGridLayout>

            {/* Empty state overlay — shown inside the grid area */}
            {components.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="glass-card p-12 rounded-2xl text-center border border-dashed th-border-hover pointer-events-auto">
                  <div className="p-4 bg-blue-500/10 rounded-2xl w-fit mx-auto mb-4">
                    <BarChart3 size={48} className="text-blue-400" />
                  </div>
                  <h3 className="text-xl font-bold th-text mb-2">{t("noChartsYet")}</h3>
                  <p className="th-text-secondary mb-6">
                    {t("createOrDragChartHint")}
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={() => setShowSidebar(true)}
                      className="inline-flex items-center gap-2 px-5 py-3 th-bg-surface border th-border hover:th-bg-surface-hover th-text rounded-xl font-bold transition-all"
                    >
                      <PanelRightOpen size={20} />
                      {t("openLibrary")}
                    </button>
                    <button
                      onClick={() => setShowAddChart(true)}
                      className="btn-brand inline-flex items-center gap-2 px-5 py-3 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:scale-105"
                    >
                      <Plus size={20} />
                      {t("newChart")}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Charts Library Sidebar — absolute right, doesn't push grid */}
        {showSidebar && (
          <div className="absolute top-0 right-0 bottom-0 z-20 shadow-2xl shadow-black/40">
            <ChartSidebar
              onClose={() => setShowSidebar(false)}
              onDragStart={handleSidebarDragStart}
              onDragEnd={handleSidebarDragEnd}
              usedChartIds={usedChartIds}
            />
          </div>
        )}

        {/* MiniChat panel */}
        {showMiniChat && linkedAgent && (
          <div className="absolute top-0 right-0 bottom-0 z-30 shadow-2xl shadow-black/40">
            <MiniChat
              agentId={`agent${linkedAgent.agent_id}`}
              agentName={linkedAgent.agent_name}
              dashboardId={dashboardId}
              userId={(() => { const u = authStorage.getUser(); return u?.email || u?.id || "anonymous"; })()}
              onClose={() => setShowMiniChat(false)}
              onAgentResponse={fetchDashboard}
            />
          </div>
        )}

        {/* Floating agent button — bottom right */}
        {!showMiniChat && (
          <div className="absolute bottom-6 right-6 z-30" ref={agentPickerRef}>
            {(linkedAgent?.agent_id || dashboard.agent_id) ? (
              <button
                onClick={() => setShowMiniChat(true)}
                className="flex items-center gap-2 px-4 py-3 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 hover:shadow-blue-500/40 transition-all hover:scale-105"
              >
                <MessageSquare size={18} />
                <span className="text-sm font-medium">{t("chatWithAgent", { name: linkedAgent?.agent_name || t("agentNameFallback") })}</span>
              </button>
            ) : (
              <>
                <button
                  onClick={handleOpenAgentPicker}
                  className="flex items-center gap-2 px-4 py-3 rounded-full bg-white/10 hover:bg-white/15 text-white/70 hover:text-white border border-white/10 shadow-lg transition-all hover:scale-105"
                >
                  <Bot size={18} />
                  <span className="text-sm font-medium">{t("linkAgent")}</span>
                  <ChevronDown size={14} />
                </button>
                {showAgentPicker && (
                  <div className="absolute bottom-full right-0 mb-2 w-64 max-h-60 overflow-y-auto rounded-lg bg-[#1e1e3a] border border-white/10 shadow-xl">
                    {availableAgents.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-white/40">{t("noAgentsAvailable")}</p>
                    ) : (
                      availableAgents.map((agent) => (
                        <button
                          key={agent.agent_id}
                          onClick={() => handleLinkAgent(agent)}
                          className="w-full text-left px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-2"
                        >
                          <Bot size={14} className="text-blue-400 shrink-0" />
                          <span className="truncate">{agent.agent_name}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Edit Chart Modal */}
      {editingKv && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card rounded-2xl p-6 w-full max-w-md animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold th-text">{t("editKeyFigure")}</h2>
              <button
                onClick={() => setEditingKv(null)}
                className="p-2 rounded-lg hover:th-bg-surface-hover th-text-secondary transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium th-text mb-1.5">
                  {t("label")} <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={editingKv.label}
                  onChange={(e) => setEditingKv((p) => ({ ...p, label: e.target.value }))}
                  className="glass-input w-full px-4 py-2.5 rounded-lg"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium th-text mb-1.5">
                  {t("value")} <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={editingKv.value}
                  onChange={(e) => setEditingKv((p) => ({ ...p, value: e.target.value }))}
                  className="glass-input w-full px-4 py-2.5 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium th-text mb-1.5">{t("unit")}</label>
                <input
                  type="text"
                  value={editingKv.unit}
                  onChange={(e) => setEditingKv((p) => ({ ...p, unit: e.target.value }))}
                  className="glass-input w-full px-4 py-2.5 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium th-text mb-1.5">{t("description")}</label>
                <textarea
                  value={editingKv.description}
                  onChange={(e) => setEditingKv((p) => ({ ...p, description: e.target.value }))}
                  rows={2}
                  className="glass-input w-full px-4 py-2.5 rounded-lg resize-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setEditingKv(null)}
                className="px-4 py-2.5 rounded-lg th-text-secondary hover:th-text hover:th-bg-surface-hover font-medium transition-colors"
              >
                {t("cancel")}
              </button>
              <button
                onClick={confirmEditKeyValue}
                disabled={savingKv || !editingKv.label.trim() || String(editingKv.value).trim() === ""}
                className="btn-brand flex items-center gap-2 px-5 py-2.5 text-white rounded-lg font-bold"
              >
                {savingKv ? <Loader2 size={16} className="animate-spin" /> : null}
                {t("save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingChart && (
        <EditChartModal
          chart={editingChart}
          onClose={() => setEditingChart(null)}
          onSaved={() => {
            setEditingChart(null);
            fetchDashboard();
          }}
        />
      )}

      {/* Add Chart Wizard */}
      {showAddChart && (
        <AddChartWizard
          dashboardId={dashboardId}
          componentCount={components.length}
          onClose={() => setShowAddChart(false)}
          onCreated={() => {
            setShowAddChart(false);
            fetchDashboard();
          }}
        />
      )}

      {/* Publish Modal */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card rounded-2xl p-6 w-full max-w-md animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold th-text">{t("publishDashboard")}</h2>
              <button onClick={() => setShowPublishModal(false)} className="p-2 rounded-lg hover:th-bg-surface-hover th-text-secondary transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium th-text mb-2">{t("visibility")}</label>
                <div className="space-y-2">
                  {[
                    { key: "public", icon: Globe, label: t("visibilityPublicLabel"), desc: t("visibilityPublicDesc") },
                    { key: "organization", icon: Building2, label: t("visibilityOrgLabel"), desc: t("visibilityOrgDesc") },
                  ].map((opt) => {
                    const Icon = opt.icon;
                    const isSelected = publishVisibility === opt.key;
                    const colorClasses = {
                      public: { border: "border-blue-500/50", bg: "bg-blue-500/10", text: "text-blue-400" },
                      organization: { border: "border-blue-500/50", bg: "bg-blue-500/10", text: "text-blue-400" },
                    };
                    const colors = colorClasses[opt.key];
                    return (
                      <button
                        key={opt.key}
                        onClick={() => setPublishVisibility(opt.key)}
                        className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                          isSelected
                            ? `${colors.border} ${colors.bg}`
                            : "th-border th-bg-surface hover:th-border-hover"
                        }`}
                      >
                        <Icon size={20} className={isSelected ? colors.text : "th-text-faint"} />
                        <div>
                          <span className={`text-sm font-semibold ${isSelected ? colors.text : "th-text"}`}>{opt.label}</span>
                          <p className="text-xs th-text-faint">{opt.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium th-text mb-1.5">{t("shareLink")}</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-3 py-2.5 th-bg-surface border th-border rounded-lg text-xs th-text-faint truncate font-mono">
                      {typeof window !== "undefined" ? window.location.origin : ""}/view/dashboard/{publishSlug}
                    </div>
                    <button
                      onClick={handleCopyLink}
                      className="p-2.5 rounded-lg th-bg-surface border th-border hover:th-bg-surface-hover th-text-secondary transition-colors shrink-0"
                    >
                      {copied ? <Check size={16} className="text-blue-400" /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button onClick={() => setShowPublishModal(false)} className="px-4 py-2.5 rounded-lg th-text-secondary hover:th-text hover:th-bg-surface-hover font-medium transition-colors">
                {t("cancel")}
              </button>
              <button
                onClick={handlePublish}
                disabled={publishing}
                className="btn-brand flex items-center gap-2 px-5 py-2.5 text-white rounded-lg font-bold"
              >
                {publishing && <Loader2 size={16} className="animate-spin" />}
                {publishing ? t("publishing") : t("publish")}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteDashboardConfirm && (
        <ConfirmToast
          message={t("deleteDashboardConfirm", { title: dashboard?.title || t("thisDashboard") })}
          onConfirm={confirmDeleteDashboard}
          onCancel={() => setShowDeleteDashboardConfirm(false)}
        />
      )}

    </div>
  );
}
