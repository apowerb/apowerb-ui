"use client";
import { useState, useEffect, useMemo } from "react";
import { useTranslations } from "use-intl";
import { BookOpen, Search, ChevronDown, ChevronRight, Wrench, Key, Code, FileText, Loader2 } from "lucide-react";
import { getToolsDocs } from "@/lib/api";

// Map category names to friendly display names and icons
function getCategoryMeta(t) {
  return {
    api_call: { label: t("categoryApiCallLabel"), description: t("categoryApiCallDescription") },
    audio: { label: t("categoryAudioLabel"), description: t("categoryAudioDescription") },
    basic: { label: t("categoryBasicLabel"), description: t("categoryBasicDescription") },
    business_intelligence: { label: t("categoryBusinessIntelligenceLabel"), description: t("categoryBusinessIntelligenceDescription") },
    campaign_tracker: { label: t("categoryCampaignTrackerLabel"), description: t("categoryCampaignTrackerDescription") },
    database: { label: t("categoryDatabaseLabel"), description: t("categoryDatabaseDescription") },
    database_mcp: { label: t("categoryDatabaseMcpLabel"), description: t("categoryDatabaseMcpDescription") },
    data_handler: { label: t("categoryDataHandlerLabel"), description: t("categoryDataHandlerDescription") },
    db_to_rag: { label: t("categoryDbToRagLabel"), description: t("categoryDbToRagDescription") },
    emailing: { label: t("categoryEmailingLabel"), description: t("categoryEmailingDescription") },
    followup_tracker: { label: t("categoryFollowupTrackerLabel"), description: t("categoryFollowupTrackerDescription") },
    google_auth: { label: t("categoryGoogleAuthLabel"), description: t("categoryGoogleAuthDescription") },
    google_calendar: { label: t("categoryGoogleCalendarLabel"), description: t("categoryGoogleCalendarDescription") },
    google_docs: { label: t("categoryGoogleDocsLabel"), description: t("categoryGoogleDocsDescription") },
    google_drive: { label: t("categoryGoogleDriveLabel"), description: t("categoryGoogleDriveDescription") },
    google_gmail: { label: t("categoryGoogleGmailLabel"), description: t("categoryGoogleGmailDescription") },
    google_sheets: { label: t("categoryGoogleSheetsLabel"), description: t("categoryGoogleSheetsDescription") },
    image_generation: { label: t("categoryImageGenerationLabel"), description: t("categoryImageGenerationDescription") },
    marketing: { label: t("categoryMarketingLabel"), description: t("categoryMarketingDescription") },
    memory: { label: t("categoryMemoryLabel"), description: t("categoryMemoryDescription") },
    microsoft_auth: { label: t("categoryMicrosoftAuthLabel"), description: t("categoryMicrosoftAuthDescription") },
    onedrive: { label: "OneDrive", description: t("categoryOnedriveDescription") },
    outlook_mail: { label: t("categoryOutlookMailLabel"), description: t("categoryOutlookMailDescription") },
    rag: { label: "RAG", description: t("categoryRagDescription") },
    s3_tools: { label: t("categoryS3ToolsLabel"), description: t("categoryS3ToolsDescription") },
    teams: { label: t("categoryTeamsLabel"), description: t("categoryTeamsDescription") },
    text_to_sql: { label: t("categoryTextToSqlLabel"), description: t("categoryTextToSqlDescription") },
    thaink2: { label: "Thaink2", description: t("categoryThaink2Description") },
    visualization: { label: t("categoryVisualizationLabel"), description: t("categoryVisualizationDescription") },
    web_search_mcp: { label: t("categoryWebSearchMcpLabel"), description: t("categoryWebSearchMcpDescription") },
  };
}

export default function HelpPage({ embedded = false }) {
  const t = useTranslations("HelpPage");
  const CATEGORY_META = useMemo(() => getCategoryMeta(t), [t]);
  const [docs, setDocs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedCategories, setExpandedCategories] = useState(new Set());
  const [expandedTools, setExpandedTools] = useState(new Set());

  useEffect(() => {
    (async () => {
      try {
        const data = await getToolsDocs();
        setDocs(data);
        // Expand first category by default
        const firstCat = Object.keys(data)[0];
        if (firstCat) setExpandedCategories(new Set([firstCat]));
      } catch (err) {
        console.error("Failed to load tools docs:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Filter categories and tools based on search
  const filtered = useMemo(() => {
    if (!docs) return {};
    if (!search.trim()) return docs;
    const q = search.toLowerCase();
    const result = {};
    for (const [cat, catData] of Object.entries(docs)) {
      const matchingTools = catData.tools.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          cat.toLowerCase().includes(q)
      );
      if (matchingTools.length > 0) {
        result[cat] = { ...catData, tools: matchingTools };
      }
    }
    return result;
  }, [docs, search]);

  const totalTools = docs ? Object.values(docs).reduce((sum, c) => sum + c.tools.length, 0) : 0;
  const totalCategories = docs ? Object.keys(docs).length : 0;

  const toggleCategory = (cat) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const toggleTool = (toolName) => {
    setExpandedTools((prev) => {
      const next = new Set(prev);
      if (next.has(toolName)) next.delete(toolName);
      else next.add(toolName);
      return next;
    });
  };

  // Determine if a param is a secret (password field)
  const isSecret = (key) => /KEY|SECRET|PASSWORD|TOKEN/i.test(key);

  if (loading) {
    return (
      <div className={`flex items-center justify-center ${embedded ? "py-16" : "h-full"}`}>
        <Loader2 className="animate-spin text-blue-400" size={32} />
      </div>
    );
  }

  return (
    <div className={embedded ? "flex flex-col" : "h-full flex flex-col overflow-hidden"}>
      {/* Header */}
      <div className={embedded ? "shrink-0 pb-4" : "shrink-0 px-6 pt-6 pb-4"}>
        {!embedded && (
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-linear-to-br from-brand to-brand-secondary shadow-md">
                <BookOpen size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold th-text">{t("helpCenterTitle")}</h1>
                <p className="text-sm th-text-muted">{t("helpCenterSubtitle")}</p>
              </div>
            </div>
          </div>
        )}

        {/* Stats bar */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg th-bg-surface border th-border text-xs th-text-muted">
            <Wrench size={12} /> {t("toolsCount", { count: totalTools })}
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg th-bg-surface border th-border text-xs th-text-muted">
            <FileText size={12} /> {t("categoriesCount", { count: totalCategories })}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 th-text-ghost" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-sm focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all"
          />
        </div>
      </div>

      {/* Content */}
      <div className={embedded ? "space-y-3" : "flex-1 overflow-y-auto px-6 pb-6 space-y-3"}>
        {Object.entries(filtered).map(([cat, catData]) => {
          const meta = CATEGORY_META[cat] || { label: cat, description: "" };
          const isExpanded = expandedCategories.has(cat);

          return (
            <div key={cat} className="th-bg-surface border th-border rounded-xl overflow-hidden">
              {/* Category header */}
              <button
                onClick={() => toggleCategory(cat)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:th-bg-elevated transition-colors text-left"
              >
                <span className="th-text-ghost">
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold th-text">{meta.label}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full th-bg-elevated th-text-ghost">
                      {t("toolsCountBadge", { count: catData.tools.length })}
                    </span>
                  </div>
                  {meta.description && (
                    <p className="text-xs th-text-muted mt-0.5">{meta.description}</p>
                  )}
                </div>
              </button>

              {/* Tools list */}
              {isExpanded && (
                <div className="border-t th-border divide-y th-border">
                  {catData.tools.map((tool) => {
                    const isToolExpanded = expandedTools.has(tool.name);
                    return (
                      <div key={tool.name} className="px-4">
                        {/* Tool header */}
                        <button
                          onClick={() => toggleTool(tool.name)}
                          className="w-full flex items-center gap-2 py-2.5 text-left"
                        >
                          <Code size={14} className="text-blue-400 shrink-0" />
                          <span className="text-xs font-mono font-medium text-blue-300">
                            {tool.function_name}
                          </span>
                          <span className="text-[10px] th-text-ghost ml-auto">
                            {isToolExpanded ? t("collapseLabel") : t("expandLabel")}
                          </span>
                        </button>

                        {/* Tool details */}
                        {isToolExpanded && (
                          <div className="pb-3 space-y-3">
                            {/* Description */}
                            <p className="text-xs th-text-muted leading-relaxed">
                              {tool.description}
                            </p>

                            {/* Function parameters */}
                            {tool.parameters?.length > 0 && (
                              <div>
                                <h4 className="text-[10px] font-semibold th-text-ghost uppercase tracking-wider mb-1.5">
                                  {t("parametersHeading")}
                                </h4>
                                <div className="space-y-1">
                                  {tool.parameters.map((p) => (
                                    <div key={p.name} className="flex items-center gap-2 text-xs">
                                      <span className="font-mono text-blue-400">{p.name}</span>
                                      <span className="th-text-ghost">({p.type})</span>
                                      {p.default !== undefined && (
                                        <span className="th-text-ghost">
                                          = <span className="text-purple-400">{p.default || t("noneValueFallback")}</span>
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Required env vars / config */}
                            {tool.env_vars?.length > 0 && (
                              <div>
                                <h4 className="text-[10px] font-semibold th-text-ghost uppercase tracking-wider mb-1.5">
                                  {t("requiredConfigHeading")}
                                </h4>
                                <div className="flex flex-wrap gap-1.5">
                                  {tool.env_vars.map((v) => (
                                    <span
                                      key={v.key}
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono ${
                                        isSecret(v.key)
                                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                          : "th-bg-elevated th-text-muted border th-border"
                                      }`}
                                    >
                                      {isSecret(v.key) && <Key size={10} />}
                                      {v.key}
                                      {v.default && (
                                        <span className="th-text-ghost"> = {v.default}</span>
                                      )}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Full docstring (collapsible) */}
                            {tool.full_docstring && tool.full_docstring.length > (tool.description || "").length + 20 && (
                              <details className="text-xs">
                                <summary className="th-text-ghost cursor-pointer hover:th-text-muted text-[10px] uppercase tracking-wider font-semibold">
                                  {t("fullDocumentationLabel")}
                                </summary>
                                <pre className="mt-1.5 p-3 rounded-lg th-bg-elevated text-[11px] th-text-muted whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto">
                                  {tool.full_docstring}
                                </pre>
                              </details>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {Object.keys(filtered).length === 0 && (
          <div className="text-center py-12 th-text-ghost">
            <Search size={32} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm">{t("noToolsFound", { query: search })}</p>
          </div>
        )}
      </div>
    </div>
  );
}
