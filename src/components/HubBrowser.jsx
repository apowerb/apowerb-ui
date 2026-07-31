"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "use-intl";
import {
  Search,
  Download,
  Tag,
  Users,
  Store,
  Loader2,
  Database,
  Zap,
  GitFork,
  Filter,
  RefreshCw,
  X,
  Trash2,
  Bot,
  Wrench,
  Shield,
  Activity,
  FileText,
  Clock,
} from "lucide-react";
import { listHubAgents, deleteFromHub } from "@/lib/api";
import EntityJumpButton from "@/components/EntityJumpButton";
import { useToast } from "./Toast";
import { useAuth } from "@/contexts/AuthContext";
import CloneWizardModal from "./CloneWizardModal";
import EmptyState from "./EmptyState";
import { SkeletonCard } from "./Skeleton";
import { formatDate as formatDateParis } from "@/lib/datetime";
import { HUB_SORTERS } from "./hubBrowserUtils";

const TYPE_COLORS = {
  base: "from-blue-500 to-blue-600",
  sequential: "from-purple-500 to-purple-600",
  parallel: "from-blue-500 to-blue-600",
  loop: "from-purple-500 to-purple-600",
  router: "from-purple-500 to-purple-600",
};

function parseStringList(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === "string" && val.startsWith("[")) {
    try { return JSON.parse(val.replace(/'/g, '"')); } catch { return []; }
  }
  return [];
}

function timeAgo(dateStr, t) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return t("minutesAgo", { min: diffMin });
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return t("hoursAgo", { h: diffH });
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return t("daysAgo", { d: diffD });
  return formatDateParis(date);
}

function SubAgentTree({ snapshot, depth = 0 }) {
  const t = useTranslations("HubBrowser");
  if (!snapshot || snapshot.length === 0) return null;
  return (
    <ul className={`${depth > 0 ? "ml-4" : ""} mt-1 space-y-1`}>
      {snapshot.map((sub, i) => (
        <li key={i} className="text-sm th-text-secondary">
          <span className="font-medium">{sub.agent_name}</span>
          <span className="text-xs th-text-faint ml-1">({sub.agent_type})</span>
          {sub.agent_tools?.length > 0 && (
            <span className="text-xs th-text-faint ml-1">
              · {t("toolsCountLabel", { count: sub.agent_tools.length })}
            </span>
          )}
          {sub.sub_agents_snapshot?.length > 0 && (
            <SubAgentTree snapshot={sub.sub_agents_snapshot} depth={depth + 1} />
          )}
        </li>
      ))}
    </ul>
  );
}

export default function HubBrowser() {
  const t = useTranslations("HubBrowser");
  const toast = useToast();
  const { user } = useAuth();
  const [hubAgents, setHubAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState("name-asc");
  const [wizardAgent, setWizardAgent] = useState(null);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const fetchHub = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listHubAgents();
      setHubAgents(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(t("failedLoadHubAgentsToast"));
    }
    setLoading(false);
  }, [toast, t]);

  useEffect(() => {
    fetchHub(); // eslint-disable-line react-hooks/set-state-in-effect -- async fetch with setState in callbacks
  }, [fetchHub]);

  const categories = [
    "all",
    ...new Set(hubAgents.map((a) => a.hub_category || "general")),
  ];

  const filtered = hubAgents.filter((a) => {
    const matchesSearch =
      a.hub_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.hub_description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === "all" || a.hub_category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const sorted = [...filtered].sort(HUB_SORTERS[sortBy] || HUB_SORTERS["name-asc"]);

  const openCloneWizard = (agent) => {
    setWizardAgent(agent);
    setSelectedAgent(null);
  };

  const handleDelete = async (hubId) => {
    setDeleting(hubId);
    try {
      const result = await deleteFromHub(hubId);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(t("agentRemovedToast"));
        setSelectedAgent(null);
        fetchHub();
      }
    } catch (err) {
      toast.error(t("deleteFailedToast", { error: err.message }));
    }
    setDeleting(null);
    setConfirmDelete(false);
  };

  const isOwner = (agent) => user?.email && agent.publisher_id === user.email;

  return (
    <div className="h-full flex flex-col th-bg-body overflow-hidden">
      {/* Header */}
      <header className="shrink-0 p-6 bg-linear-to-r from-brand/20 to-brand-secondary/20 border-b th-border backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-linear-to-br from-brand to-brand-secondary rounded-2xl shadow-lg">
              <Store size={32} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black th-text tracking-tight">{t("pageTitle")}</h1>
              <p className="th-text-secondary text-sm font-medium mt-1">
                {t("pageSubtitle")}
              </p>
            </div>
          </div>
          <button
            onClick={fetchHub}
            className="flex items-center gap-2 px-5 py-3 bg-brand hover:bg-brand-hover border border-brand/30 text-white rounded-xl font-bold transition-all hover:scale-105 disabled:opacity-50 shadow-lg shadow-blue-500/20"
            title={t("refreshLabel")}
          >
            <RefreshCw
              size={18}
              className={loading ? "animate-spin" : ""}
            />
          </button>
        </div>
      </header>

      {/* Search & Filters */}
      <div className="shrink-0 px-6 pt-4 pb-3 border-b th-border-secondary">
        <div className="relative mb-3">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 th-text-ghost"
          />
          <input
            type="text"
            placeholder={t("searchAgentsPlaceholder")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-sm focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all"
          />
        </div>

        <div className="flex items-center justify-end mb-3">
          <label htmlFor="hub-sort" className="text-xs th-text-faint mr-2">{t("sortLabel")}</label>
          <select
            id="hub-sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium th-bg-surface th-text-muted border th-border focus:outline-none focus:border-brand/50"
          >
            <option value="name-asc">{t("sortNameAsc")}</option>
            <option value="name-desc">{t("sortNameDesc")}</option>
            <option value="recent">{t("sortNewest")}</option>
            <option value="oldest">{t("sortOldest")}</option>
          </select>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? "bg-brand/20 text-brand border border-brand/30"
                  : "th-bg-surface th-text-muted border th-border hover:th-bg-surface-hover"
              }`}
            >
              {cat === "all" ? t("allCategoriesLabel") : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState
            icon={Store}
            title={
              searchTerm || selectedCategory !== "all"
                ? t("noMatchingAgentsTitle")
                : t("noAgentsPublishedTitle")
            }
            description={
              searchTerm || selectedCategory !== "all"
                ? t("tryDifferentSearchText")
                : t("publishFirstAgentText")
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {sorted.map((agent) => {
              const typeColor =
                TYPE_COLORS[agent.agent_type?.toLowerCase()] ||
                TYPE_COLORS.base;
              const publisherName =
                agent.publisher_id?.split("@")[0] || t("unknownPublisherFallback");
              const owned = isOwner(agent);
              const published = timeAgo(agent.published_at || agent.created_at, t);
              const tags = agent.hub_tags
                ? (Array.isArray(agent.hub_tags) ? agent.hub_tags : parseStringList(agent.hub_tags))
                : [];

              return (
                <div
                  key={agent.hub_id}
                  onClick={() => { setSelectedAgent(agent); setConfirmDelete(false); }}
                  className="group relative flex flex-col rounded-2xl border th-border th-bg-surface hover:th-border-hover backdrop-blur-sm transition-all duration-300 overflow-hidden cursor-pointer hover:scale-[1.02] hover:shadow-xl"
                >
                  {/* Colored top accent bar */}
                  <div className={`h-1 w-full bg-linear-to-r ${typeColor}`} />

                  <div className="flex flex-col flex-1 p-5">
                    {/* Top row: avatar + name + badges */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className={`shrink-0 w-10 h-10 rounded-xl bg-linear-to-br ${typeColor} flex items-center justify-center shadow-md`}>
                        <span className="text-white text-sm font-bold">
                          {(agent.hub_name || "A").charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="th-text font-bold text-sm truncate group-hover:text-brand transition-colors">
                          {agent.hub_name}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="th-text-ghost text-xs flex items-center gap-1 truncate">
                            <Users size={10} />
                            {publisherName}
                          </p>
                          {published && (
                            <span className="th-text-whisper text-[10px] flex items-center gap-1 shrink-0">
                              <Clock size={9} />
                              {published}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Badges row */}
                    <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                      <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-linear-to-r ${typeColor} text-white`}>
                        {agent.agent_type || "base"}
                      </span>
                      {owned && (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-purple-400/20 text-purple-400 border border-purple-400/30">
                          {t("yoursBadge")}
                        </span>
                      )}
                      {agent.memory_enabled && (
                        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25 flex items-center gap-1">
                          <Database size={9} /> {t("memoryBadge")}
                        </span>
                      )}
                      {agent.sub_agents_snapshot?.length > 0 && (
                        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/25 flex items-center gap-1">
                          <Users size={9} /> {t("subAgentsIncludedLabel", { count: agent.sub_agents_snapshot.length })}
                        </span>
                      )}
                    </div>

                    {/* Description */}
                    <p className="th-text-muted text-sm leading-relaxed line-clamp-2 mb-3 flex-1">
                      {agent.hub_description || agent.agent_description || t("noDescriptionText")}
                    </p>

                    {/* Tags */}
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {tags.slice(0, 4).map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 text-[10px] font-medium th-text-faint rounded-full bg-brand/8 border border-brand/15"
                          >
                            #{tag}
                          </span>
                        ))}
                        {tags.length > 4 && (
                          <span className="px-2 py-0.5 text-[10px] th-text-whisper rounded-full">
                            +{tags.length - 4}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-3 border-t th-border-secondary mt-auto">
                      <div className="flex items-center gap-1.5 th-text-ghost text-xs">
                        <GitFork size={12} className="text-brand/60" />
                        <span className="font-semibold th-text-secondary">{agent.clone_count || 0}</span>
                        <span>{t("clonesWord")}</span>
                      </div>
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {owned && (
                          <>
                            <EntityJumpButton
                              to="agents"
                              params={{ filter: `cloned_from:${agent.hub_id}` }}
                              title={t("openMyClonesTooltip")}
                            />
                            <button
                              onClick={() => { setSelectedAgent(agent); setConfirmDelete(true); }}
                              className="p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                              title={t("removeFromHubLabel")}
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => openCloneWizard(agent)}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand text-white text-xs font-bold border border-brand/30 hover:bg-brand-hover transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 hover:scale-105"
                        >
                          <Download size={13} />
                          {t("cloneButton")}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Agent Detail Modal */}
      {selectedAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center th-bg-overlay backdrop-blur-sm" onClick={() => setSelectedAgent(null)}>
          <div
            className="w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col rounded-2xl th-bg-modal border th-border shadow-2xl backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b th-border-secondary shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`p-2 rounded-lg bg-linear-to-r ${TYPE_COLORS[selectedAgent.agent_type?.toLowerCase()] || TYPE_COLORS.base}`}>
                  <Bot size={18} className="text-white" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="th-text font-bold truncate">{selectedAgent.hub_name}</h3>
                    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-linear-to-r ${TYPE_COLORS[selectedAgent.agent_type?.toLowerCase()] || TYPE_COLORS.base} text-white shrink-0`}>
                      {selectedAgent.agent_type || "base"}
                    </span>
                    {isOwner(selectedAgent) && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-purple-400/20 text-purple-400 border border-purple-400/30 shrink-0">
                        {t("yoursBadge")}
                      </span>
                    )}
                  </div>
                  <p className="th-text-faint text-xs flex items-center gap-1">
                    <Users size={11} />
                    {selectedAgent.publisher_id?.split("@")[0] || t("unknownPublisherFallback")}
                    {selectedAgent.published_at && (
                      <span className="ml-2 flex items-center gap-1">
                        <Clock size={11} />
                        {timeAgo(selectedAgent.published_at, t)}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedAgent(null)}
                className="p-1.5 rounded-lg hover:th-bg-surface-hover th-text-faint hover:th-text-secondary transition-colors shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body (scrollable) */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Description */}
              {(selectedAgent.hub_description || selectedAgent.agent_description) && (
                <div>
                  <label className="block text-xs font-semibold th-text-faint mb-1.5">{t("descriptionLabel")}</label>
                  <p className="th-text-secondary text-sm leading-relaxed">
                    {selectedAgent.hub_description || selectedAgent.agent_description}
                  </p>
                </div>
              )}

              {/* Instruction */}
              {selectedAgent.agent_instruction && (
                <div>
                  <label className="block text-xs font-semibold th-text-faint mb-1.5 flex items-center gap-1">
                    <FileText size={12} /> {t("instructionLabel")}
                  </label>
                  <pre className="p-4 th-bg-surface rounded-xl text-xs th-text-faint font-mono whitespace-pre-wrap break-words overflow-x-auto max-h-48 custom-scrollbar border th-border-secondary">
                    {selectedAgent.agent_instruction}
                  </pre>
                </div>
              )}

              {/* Metadata chips */}
              <div>
                <label className="block text-xs font-semibold th-text-faint mb-1.5">{t("capabilitiesLabel")}</label>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold th-bg-surface th-text-muted border th-border">
                    <Activity size={11} /> {selectedAgent.agent_model || t("defaultModelFallback")}
                  </span>
                  {(() => {
                    const tools = parseStringList(selectedAgent.agent_tools);
                    if (tools.length === 0) return null;
                    return (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-purple-400/10 text-purple-400 border border-purple-400/20">
                        <Wrench size={11} /> {t("toolsCountLabel", { count: tools.length })}
                      </span>
                    );
                  })()}
                  {(() => {
                    const subs = parseStringList(selectedAgent.sub_agents);
                    if (subs.length === 0) return null;
                    return (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        <Users size={11} /> {t("subAgentsCountLabel", { count: subs.length })}
                      </span>
                    );
                  })()}
                  {(selectedAgent.memory_enabled === true || selectedAgent.memory_enabled === "true") && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-400/10 text-blue-400 border border-blue-400/20">
                      <Database size={11} /> {t("memoryBadge")}
                    </span>
                  )}
                  {selectedAgent.guardrails_config && (typeof selectedAgent.guardrails_config === "string" ? selectedAgent.guardrails_config !== "{}" : Object.keys(selectedAgent.guardrails_config).length > 0) && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      <Shield size={11} /> {t("guardrailsBadge")}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold th-bg-surface th-text-faint border th-border">
                    <GitFork size={11} /> {t("cloneCountLabel", { count: selectedAgent.clone_count || 0 })}
                  </span>
                </div>
              </div>

              {/* Tools detail */}
              {(() => {
                const tools = parseStringList(selectedAgent.agent_tools);
                if (tools.length === 0) return null;
                return (
                  <div>
                    <label className="block text-xs font-semibold th-text-faint mb-1.5 flex items-center gap-1">
                      <Wrench size={12} /> {t("toolsLabel")}
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {tools.map((tool) => (
                        <span
                          key={tool}
                          className="px-2 py-0.5 text-[11px] bg-purple-500/5 text-purple-300/70 rounded-lg border border-purple-500/10 font-mono"
                        >
                          {tool.split("/").pop() || tool}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Sub-agents detail */}
              {(() => {
                const subs = parseStringList(selectedAgent.sub_agents);
                if (subs.length === 0) return null;
                return (
                  <div>
                    <label className="block text-xs font-semibold th-text-faint mb-1.5 flex items-center gap-1">
                      <Users size={12} /> {t("subAgentsLabel")}
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {subs.map((sub) => (
                        <span
                          key={sub}
                          className="px-2 py-0.5 text-[11px] bg-purple-500/5 text-purple-300/70 rounded-lg border border-purple-500/10 font-mono"
                        >
                          {sub}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Sub-agents snapshot tree */}
              {selectedAgent.sub_agents_snapshot?.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold th-text-faint mb-1.5 flex items-center gap-1">
                    <GitFork size={12} /> {t("subAgentsIncludedHeading")}
                  </label>
                  <div className="p-3 th-bg-surface rounded-xl border th-border-secondary">
                    <SubAgentTree snapshot={selectedAgent.sub_agents_snapshot} />
                  </div>
                </div>
              )}

              {/* Tags */}
              {(() => {
                const tags = parseStringList(selectedAgent.hub_tags);
                if (tags.length === 0) return null;
                return (
                  <div>
                    <label className="block text-xs font-semibold th-text-faint mb-1.5 flex items-center gap-1">
                      <Tag size={12} /> {t("tagsLabel")}
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2.5 py-0.5 text-[11px] th-bg-surface th-text-muted rounded-full border th-border"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="shrink-0 flex items-center justify-between p-5 border-t th-border-secondary">
              {isOwner(selectedAgent) ? (
                <div>
                  {!confirmDelete ? (
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm font-medium border border-red-500/20 hover:bg-red-500/20 transition-colors"
                    >
                      <Trash2 size={14} />
                      {t("removeFromHubLabel")}
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-red-400 text-xs font-medium">{t("areYouSureText")}</span>
                      <button
                        onClick={() => handleDelete(selectedAgent.hub_id)}
                        disabled={deleting}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/20 text-red-400 text-sm font-bold border border-red-500/30 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                      >
                        {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        {t("confirmDeleteButton")}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(false)}
                        className="px-3 py-2 rounded-lg text-sm th-text-muted hover:th-text-secondary hover:th-bg-surface-hover transition-colors"
                      >
                        {t("cancelButton")}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div />
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openCloneWizard(selectedAgent);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium border border-brand/30 hover:bg-brand-hover transition-colors shadow-lg shadow-blue-500/20"
              >
                <Download size={14} />
                {t("cloneThisAgentButton")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clone Wizard Modal */}
      <CloneWizardModal
        show={!!wizardAgent}
        hubAgent={wizardAgent}
        onClose={() => setWizardAgent(null)}
        onComplete={() => { setWizardAgent(null); fetchHub(); }}
      />
    </div>
  );
}
