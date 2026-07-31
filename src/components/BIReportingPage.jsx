"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "@/lib/navigation";
import { useTranslations } from "use-intl";
import {
  LayoutDashboard,
  Plus,
  Calendar,
  BarChart3,
  Loader2,
  X,
  Trash2,
  Pencil,
  Database,
  ExternalLink,
  Globe,
  Bot,
} from "lucide-react";
import {
  listDashboards,
  listSharedDashboards,
  listCharts,
  getBiStats,
  createDashboard,
  deleteDashboard,
  updateDashboard,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "./Toast";
import ConfirmToast from "./ConfirmToast";
import EmptyState from "./EmptyState";
import { SkeletonCard } from "./Skeleton";
import EntityJumpButton from "@/components/EntityJumpButton";
import { toAgentId } from "@/lib/jumps";
import { formatDate as formatDateParis } from "@/lib/datetime";

export default function BIReportingPage() {
  const t = useTranslations("BIReportingPage");
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const organizationId = user?.email?.split("@")[1] || "default";

  const [dashboards, setDashboards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ dashboards: 0, charts: 0 });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newDashboard, setNewDashboard] = useState({ name: "", description: "" });
  const [statusFilter, setStatusFilter] = useState("all");
  const [sharedDashboards, setSharedDashboards] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameValue, setRenameValue] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter !== "all") {
        params.status = statusFilter;
      }
      const dashList = await listDashboards(params);
      const items = Array.isArray(dashList) ? dashList : dashList?.items || [];
      setDashboards(items);

      // Load shared dashboards from other users
      try {
        const sharedList = await listSharedDashboards();
        const sharedItems = Array.isArray(sharedList) ? sharedList : sharedList?.items || [];
        setSharedDashboards(sharedItems);
      } catch {
        setSharedDashboards([]);
      }

      // Try stats endpoint first, fallback to counting
      try {
        const s = await getBiStats(organizationId);
        setStats({
          dashboards: s.dashboard_count ?? items.length,
          charts: s.chart_count ?? 0,
        });
      } catch {
        // Stats endpoint not ready — count from lists
        try {
          const chartList = await listCharts();
          const chartItems = Array.isArray(chartList) ? chartList : chartList?.items || [];
          setStats({ dashboards: items.length, charts: chartItems.length });
        } catch {
          setStats({ dashboards: items.length, charts: 0 });
        }
      }
    } catch (err) {
      console.warn("Failed to load dashboards:", err);
      setDashboards([]);
      setStats({ dashboards: 0, charts: 0 });
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDeleteDashboard = (e, dashId, dashTitle) => {
    e.stopPropagation();
    setDeleteTarget({ id: dashId, title: dashTitle || t("thisDashboardFallback") });
  };

  const confirmDeleteDashboard = async () => {
    if (!deleteTarget) return;
    const { id } = deleteTarget;
    setDeleteTarget(null);
    try {
      await deleteDashboard(id);
      toast.success(t("dashboardDeletedToast"));
      fetchData();
    } catch (err) {
      toast.error(t("dashboardDeleteFailedToast", { error: err.message }));
    }
  };

  const handleRenameDashboard = (e, dash) => {
    e.stopPropagation();
    setRenameValue(dash.title || "");
    setRenameTarget({ id: dash.id, title: dash.title });
  };

  const confirmRename = async () => {
    if (!renameTarget) return;
    const title = renameValue.trim();
    if (!title) {
      toast.error(t("dashboardNameRequiredToast"));
      return;
    }
    const { id } = renameTarget;
    setRenameTarget(null);
    try {
      await updateDashboard(id, { title });
      toast.success(t("dashboardRenamedToast"));
      fetchData();
    } catch (err) {
      toast.error(t("dashboardRenameFailedToast", { error: err.message }));
    }
  };

  const handleCreate = async () => {
    if (!newDashboard.name.trim()) {
      toast.error(t("dashboardNameRequiredToast"));
      return;
    }
    setCreating(true);
    try {
      const created = await createDashboard({
        title: newDashboard.name.trim(),
        description: newDashboard.description.trim() || undefined,
      });
      toast.success(t("dashboardCreatedToast"));
      setShowCreateModal(false);
      setNewDashboard({ name: "", description: "" });
      fetchData();
      if (created?.id) {
        router.push(`/bi/${created.id}`);
      }
    } catch (err) {
      toast.error(t("dashboardCreateFailedToast", { error: err.message }));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden th-bg-body">
      {/* Header */}
      <header className="shrink-0 p-6 bg-linear-to-r from-brand/20 to-brand-secondary/20 border-b th-border backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-linear-to-br from-brand to-brand-secondary rounded-2xl shadow-lg">
              <LayoutDashboard size={32} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black th-text tracking-tight">{t("pageTitle")}</h1>
              <p className="th-text-secondary text-sm font-medium mt-1">
                {t("pageSubtitle")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/bi/data")}
              className="flex items-center gap-2 px-5 py-3 th-bg-surface border th-border hover:th-bg-surface-hover th-text-secondary hover:th-text rounded-xl font-bold transition-all"
            >
              <Database size={20} />
              {t("dataPoolButton")}
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-brand flex items-center gap-2 px-5 py-3 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:scale-105"
            >
              <Plus size={20} />
              {t("newDashboardButton")}
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : (
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Stats Bar */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <LayoutDashboard size={20} className="text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-black th-text">{stats.dashboards}</p>
                  <p className="text-xs th-text-faint">{t("dashboardsStatLabel")}</p>
                </div>
              </div>
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <BarChart3 size={20} className="text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-black th-text">{stats.charts}</p>
                  <p className="text-xs th-text-faint">{t("chartsStatLabel")}</p>
                </div>
              </div>
            </div>

            {/* Status Filter Tabs */}
            <div className="flex items-center gap-2">
              {[
                { key: "all", label: t("tabAllLabel") },
                { key: "draft", label: t("tabDraftLabel") },
                { key: "published", label: t("tabPublishedLabel") },
                ...(sharedDashboards.length > 0
                  ? [{ key: "shared", label: t("tabSharedLabel"), count: sharedDashboards.length, icon: Globe }]
                  : []),
              ].map((tab) => {
                const TabIcon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setStatusFilter(tab.key)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      statusFilter === tab.key
                        ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                        : "th-bg-surface border th-border th-text-secondary hover:th-bg-surface-hover"
                    }`}
                  >
                    {TabIcon && <TabIcon size={14} />}
                    {tab.label}
                    {tab.count != null && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                        statusFilter === tab.key
                          ? "bg-blue-500/30 text-blue-300"
                          : "bg-white/10 th-text-faint"
                      }`}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Shared Dashboards Grid (when Shared tab is active) */}
            {statusFilter === "shared" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sharedDashboards.map((dash) => (
                  <div
                    key={dash.id}
                    onClick={() => {
                      const slug = dash.slug || dash.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
                      router.push(`/view/dashboard/${slug}`);
                    }}
                    className="glass-card rounded-xl p-5 cursor-pointer hover:border-blue-500/30 transition-all group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-blue-500/10 rounded-lg shrink-0">
                        <LayoutDashboard size={20} className="text-blue-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-lg font-bold th-text group-hover:text-blue-400 transition-colors truncate">
                            {dash.title}
                          </h3>
                          <span className="inline-flex items-center gap-1 shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                            <Globe size={10} />
                            {dash.visibility === "organization" ? t("orgBadge") : t("publicBadge")}
                          </span>
                        </div>
                        {dash.description && (
                          <p className="th-text-secondary text-sm mt-1 line-clamp-2">{dash.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-3">
                          {dash.created_by && (
                            <span className="text-xs th-text-faint">{t("byAuthor", { author: dash.created_by })}</span>
                          )}
                          <span className="flex items-center gap-1.5 text-xs th-text-faint">
                            <BarChart3 size={12} />
                            {t("chartsCount", { count: dash.component_count || dash.components?.length || 0 })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : dashboards.length === 0 ? (
              <EmptyState
                icon={LayoutDashboard}
                title={t("noDashboardsTitle")}
                description={t("noDashboardsDescription")}
                action={() => setShowCreateModal(true)}
                actionLabel={t("newDashboardButton")}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dashboards.map((dash) => (
                  <div
                    key={dash.id}
                    onClick={() => router.push(`/bi/${dash.id}`)}
                    className="glass-card rounded-xl p-5 cursor-pointer hover:border-blue-500/30 transition-all group relative"
                  >
                    <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <EntityJumpButton
                        to="chat"
                        params={
                          dash.agent_id
                            ? { agent: toAgentId(dash.agent_id), dashboard: dash.id }
                            : { dashboard: dash.id }
                        }
                        title={t("discussDashboardTooltip")}
                        size={14}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/view/dashboard/${dash.slug || dash.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`);
                        }}
                        className="p-1.5 rounded-lg hover:bg-blue-500/20 th-text-faint hover:text-blue-400 transition-all"
                        title={t("viewDashboardTooltip")}
                      >
                        <ExternalLink size={14} />
                      </button>
                      <button
                        onClick={(e) => handleRenameDashboard(e, dash)}
                        className="p-1.5 rounded-lg hover:bg-blue-500/20 th-text-faint hover:text-blue-400 transition-all"
                        title={t("renameDashboardTooltip")}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={(e) => handleDeleteDashboard(e, dash.id, dash.title)}
                        className="p-1.5 rounded-lg hover:bg-red-500/20 th-text-faint hover:text-red-400 transition-all"
                        title={t("deleteDashboardTooltip")}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-blue-500/10 rounded-lg shrink-0">
                        <LayoutDashboard size={20} className="text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold th-text group-hover:text-blue-400 transition-colors truncate">
                            {dash.title}
                          </h3>
                          <span
                            className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold ${
                              dash.status === "published"
                                ? "bg-blue-500/20 text-blue-400"
                                : "bg-purple-400/20 text-purple-400"
                            }`}
                          >
                            {dash.status === "published" ? t("publishedStatus") : t("draftStatus")}
                          </span>
                          {dash.visibility && dash.visibility !== "private" && (
                            <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              dash.visibility === "public"
                                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                                : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                            }`}>
                              {dash.visibility === "public" ? t("publicBadge") : t("orgBadge")}
                            </span>
                          )}
                          {dash.agent_id && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-400">
                              <Bot size={10} />
                              {t("agentBadge")}
                            </span>
                          )}
                        </div>
                        {dash.description && (
                          <p className="th-text-secondary text-sm mt-1 line-clamp-2">
                            {dash.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-3">
                          {dash.created_at && (
                            <span className="flex items-center gap-1.5 text-xs th-text-faint">
                              <Calendar size={12} />
                              {formatDateParis(dash.created_at)}
                            </span>
                          )}
                          <span className="flex items-center gap-1.5 text-xs th-text-faint">
                            <BarChart3 size={12} />
                            {t("chartsCount", { count: dash.component_count || 0 })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Dashboard Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card rounded-2xl p-6 w-full max-w-md animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold th-text">{t("newDashboardButton")}</h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewDashboard({ name: "", description: "" });
                }}
                className="p-2 rounded-lg hover:th-bg-surface-hover th-text-secondary transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium th-text mb-1.5">
                  {t("nameLabel")} <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newDashboard.name}
                  onChange={(e) => setNewDashboard((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder={t("myDashboardPlaceholder")}
                  className="glass-input w-full px-4 py-2.5 rounded-lg"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium th-text mb-1.5">
                  {t("descriptionLabel")}
                </label>
                <textarea
                  value={newDashboard.description}
                  onChange={(e) => setNewDashboard((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder={t("optionalDescriptionPlaceholder")}
                  rows={3}
                  className="glass-input w-full px-4 py-2.5 rounded-lg resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewDashboard({ name: "", description: "" });
                }}
                className="px-4 py-2.5 rounded-lg th-text-secondary hover:th-text hover:th-bg-surface-hover font-medium transition-colors"
              >
                {t("cancelButton")}
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !newDashboard.name.trim()}
                className="btn-brand flex items-center gap-2 px-5 py-2.5 text-white rounded-lg font-bold"
              >
                {creating && <Loader2 size={16} className="animate-spin" />}
                {t("createButton")}
              </button>
            </div>
          </div>
        </div>
      )}

      {renameTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card rounded-2xl p-6 w-full max-w-md animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold th-text">{t("renameDashboardHeading")}</h2>
              <button
                onClick={() => setRenameTarget(null)}
                className="p-2 rounded-lg hover:th-bg-surface-hover th-text-secondary transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium th-text mb-1.5">
                {t("nameLabel")} <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirmRename();
                  if (e.key === "Escape") setRenameTarget(null);
                }}
                placeholder={t("dashboardNamePlaceholder")}
                className="glass-input w-full px-4 py-2.5 rounded-lg"
                autoFocus
              />
            </div>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setRenameTarget(null)}
                className="px-4 py-2.5 rounded-lg th-text-secondary hover:th-text hover:th-bg-surface-hover font-medium transition-colors"
              >
                {t("cancelButton")}
              </button>
              <button
                onClick={confirmRename}
                disabled={!renameValue.trim()}
                className="btn-brand flex items-center gap-2 px-5 py-2.5 text-white rounded-lg font-bold"
              >
                {t("saveButton")}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmToast
          message={t("deleteConfirmMessage", { title: deleteTarget.title })}
          onConfirm={confirmDeleteDashboard}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
