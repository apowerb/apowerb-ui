"use client";

import { X, Wrench, Plus, Trash2, Eye, EyeOff, Mail, ExternalLink, Loader2, CheckCircle, CheckSquare, Square } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useTranslations } from "use-intl";
import { getToolExpectedParams, getOutlookAuthUrl, getOutlookStatus } from "../lib/api";
import { useFocusTrap } from "@/hooks/useFocusTrap";

const _EMAIL_CATEGORIES = ["outlook_mail", "emailing"];

export default function ToolConfigModal({
  show,
  editingConfig,
  newConfig,
  setNewConfig,
  availableTools = [],
  existingConfigs = [],
  onClose,
  onSave,
}) {
  const t = useTranslations("ToolConfigModal");
  const modalRef = useFocusTrap(show);

  useEffect(() => {
    function handleEscape(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const [paramKey, setParamKey] = useState("");
  const [paramValue, setParamValue] = useState("");
  const [visibleParams, setVisibleParams] = useState({});
  const [expectedParamKeys, setExpectedParamKeys] = useState(new Set());
  const [selectedCategory, setSelectedCategory] = useState(() => {
    if (!show) return "";
    return availableTools.find((t) => t.name === newConfig.tool_name)?.category || newConfig.tool_category || "";
  });
  const prevToolNameRef = useRef(newConfig.tool_name);

  // Multi-select: checked tools (used in create mode when no single tool is pre-selected)
  const [checkedTools, setCheckedTools] = useState(new Set());

  // Email provider OAuth state
  const [outlookConnected, setOutlookConnected] = useState(false);
  const [outlookLoading, setOutlookLoading] = useState(false);

  const isEmailCategory = _EMAIL_CATEGORIES.includes(selectedCategory);

  // Check if an Outlook config already exists for this user
  const outlookAlreadyConfigured = existingConfigs.some(
    (c) => c.tool_category === "outlook_mail" && c.status === "active"
  );

  // Check Outlook status when modal opens
  useEffect(() => {
    if (!show) return;
    let cancelled = false;
    getOutlookStatus()
      .then((data) => { if (!cancelled) setOutlookConnected(!!data.connected); })
      .catch(() => { if (!cancelled) setOutlookConnected(false); });
    return () => { cancelled = true; };
  }, [show]);

  // Listen for postMessage from OAuth popup
  useEffect(() => {
    if (!show) return;
    const handler = (event) => {
      if (event.data?.type === "outlook-connected" && event.data?.success) {
        setOutlookConnected(true);
        setOutlookLoading(false);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [show]);

  // Derive unique categories from availableTools
  const categories = [...new Set(availableTools.map((t) => t.category))].sort();

  // Tools filtered by selected category
  const toolsInCategory = selectedCategory
    ? availableTools.filter((t) => t.category === selectedCategory)
    : availableTools;

  // Parse tool_name which may be a JSON array string or a single tool name
  const _parseToolNames = (raw) => {
    if (!raw) return [];
    const trimmed = raw.trim();
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.filter((n) => typeof n === "string" && n.trim());
      } catch {}
    }
    return [trimmed];
  };

  // Sync selectedCategory when modal opens with an existing config
  const [prevShow, setPrevShow] = useState(show);
  if (show && !prevShow) {
    const toolNames = _parseToolNames(newConfig.tool_name);
    const firstTool = toolNames[0] || "";
    const matchedCategory = availableTools.find((t) => t.name === firstTool)?.category || newConfig.tool_category || "";
    setSelectedCategory(matchedCategory);
    // Pre-check the existing tool(s)
    if (editingConfig && toolNames.length > 0) {
      setCheckedTools(new Set(toolNames));
    }
  }
  if (show !== prevShow) {
    setPrevShow(show);
  }

  // When category changes: check all tools in that category by default (create mode),
  // or keep existing checked tools that belong to the new category (edit mode)
  const handleCategoryChange = (cat) => {
    setSelectedCategory(cat);
    if (!editingConfig) {
      const toolsInNewCat = availableTools.filter((t) => t.category === cat);
      setCheckedTools(new Set(toolsInNewCat.map((t) => t.name)));
    } else {
      // In edit mode, keep only checked tools that belong to the new category
      const toolsInNewCat = new Set(availableTools.filter((t) => t.category === cat).map((t) => t.name));
      setCheckedTools((prev) => {
        const next = new Set();
        for (const name of prev) {
          if (toolsInNewCat.has(name)) next.add(name);
        }
        return next;
      });
    }
    setNewConfig((prev) => ({ ...prev, tool_category: cat }));
  };

  const toggleTool = (toolName) => {
    setCheckedTools((prev) => {
      const next = new Set(prev);
      if (next.has(toolName)) {
        next.delete(toolName);
      } else {
        next.add(toolName);
      }
      return next;
    });
  };

  const toggleAll = () => {
    const allInCategory = toolsInCategory.map((t) => t.name);
    const allChecked = allInCategory.every((name) => checkedTools.has(name));
    if (allChecked) {
      setCheckedTools((prev) => {
        const next = new Set(prev);
        allInCategory.forEach((name) => next.delete(name));
        return next;
      });
    } else {
      setCheckedTools((prev) => {
        const next = new Set(prev);
        allInCategory.forEach((name) => next.add(name));
        return next;
      });
    }
  };

  // Expose checked tools to parent via onSave
  const handleSave = () => {
    onSave([...checkedTools]);
  };

  // Auto-populate expected params based on first checked tool
  const primaryTool = [...checkedTools][0] || "";

  useEffect(() => {
    const previousToolName = prevToolNameRef.current;
    prevToolNameRef.current = primaryTool;

    if (!primaryTool || primaryTool === previousToolName) return;

    let cancelled = false;

    getToolExpectedParams(primaryTool)
      .then((params) => {
        if (cancelled || !Array.isArray(params)) return;
        const newExpectedKeys = new Set(params.map((p) => p.key));
        setExpectedParamKeys(newExpectedKeys);
        setNewConfig((prev) => {
          const existingParams = prev.tool_config_params || {};
          const merged = { ...existingParams };
          for (const param of params) {
            if (!(param.key in merged)) {
              merged[param.key] = param.default != null ? String(param.default) : "";
            }
          }
          return { ...prev, tool_config_params: merged };
        });
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [primaryTool, setNewConfig]);

  if (!show) return null;

  const gradient = "from-blue-500/80 to-blue-600/80";
  const checkedCount = checkedTools.size;
  const allInCategoryChecked = toolsInCategory.length > 0 && toolsInCategory.every((t) => checkedTools.has(t.name));

  const addParameter = () => {
    if (paramKey.trim() && paramValue.trim()) {
      setNewConfig((prev) => ({
        ...prev,
        tool_config_params: { ...prev.tool_config_params, [paramKey]: paramValue },
      }));
      setParamKey("");
      setParamValue("");
    }
  };

  const removeParameter = (key) => {
    setNewConfig((prev) => {
      const params = { ...prev.tool_config_params };
      delete params[key];
      return { ...prev, tool_config_params: params };
    });
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[40] perspective-1000"
      onClick={onClose}
    >
      <div className="absolute inset-0 th-bg-overlay backdrop-blur-md animate-fade-in" />

      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tool-config-modal-title"
        className="relative w-full max-w-3xl mx-4 animate-scale-up-center max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`absolute -inset-1 bg-linear-to-r ${gradient} rounded-2xl blur-lg opacity-40 animate-breathe`} />

        <div className="relative flex flex-col glass-modal rounded-2xl shadow-2xl overflow-hidden h-full">

          {/* Header */}
          <div className={`shrink-0 h-28 bg-linear-to-br ${gradient} p-6 relative overflow-hidden`}>
            <div className="absolute inset-0 overflow-hidden rounded-t-2xl">
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
            </div>
            <div className="relative flex justify-between items-start z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 backdrop-blur-md rounded-xl border border-white/20 shadow-lg">
                  <Wrench size={24} className="text-white" />
                </div>
                <div>
                  <h2 id="tool-config-modal-title" className="text-2xl font-black text-white tracking-tight drop-shadow-md">
                    {editingConfig ? t("editTitle") : t("createTitle")}
                  </h2>
                  <p className="text-white/70 text-sm font-medium">
                    {checkedCount > 0 ? t("configureToolsWithCount", { count: checkedCount }) : t("configureTools")}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="bg-white/20 hover:bg-black/40 text-white/80 hover:text-white p-2 rounded-full transition-all backdrop-blur-sm border border-white/20 ring-1 ring-transparent hover:ring-white/20"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-6">

            {/* Config Name */}
            <div>
              <label className="block text-sm font-medium th-text-muted mb-2 pl-1">
                {t("configNameLabel")} <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={newConfig.tool_config_name}
                onChange={(e) => setNewConfig((prev) => ({ ...prev, tool_config_name: e.target.value }))}
                placeholder={editingConfig ? t("configNamePlaceholderEdit") : t("configNamePlaceholderCreate")}
                className="glass-input w-full px-4 py-3 rounded-xl focus:ring-2 focus:ring-white/20"
              />
            </div>

            {/* ── Tool Selection ── */}
            <div className="space-y-3">
              <label className="block text-sm font-medium th-text-muted pl-1">
                {t("selectToolLabel", { count: editingConfig ? 1 : 2 })} <span className="text-red-400">*</span>
              </label>

              {/* Step 1 — Category select box */}
              <div>
                <p className="text-xs th-text-faint mb-2 pl-1">{t("chooseCategoryStep")}</p>
                <select
                  value={selectedCategory}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="glass-input w-full px-4 py-3 rounded-xl appearance-none cursor-pointer"
                >
                  <option value="" className="th-bg-modal th-text">{t("selectCategoryOption")}</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat} className="th-bg-modal th-text capitalize">
                      {cat.replace(/^tools_/, "")}
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 2 — Checkboxes for both create and edit modes */}
              {selectedCategory && (
                <div>
                  <div className="flex items-center justify-between mb-2 pl-1">
                    <p className="text-xs th-text-faint">{t("selectToolsStep")}</p>
                    <button
                      type="button"
                      onClick={toggleAll}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                    >
                      {allInCategoryChecked ? <Square size={12} /> : <CheckSquare size={12} />}
                      {allInCategoryChecked ? t("uncheckAll") : t("checkAll")}
                    </button>
                  </div>
                  <div className="glass-card rounded-xl border border-white/10 max-h-56 overflow-y-auto custom-scrollbar">
                    {toolsInCategory.map((tool) => {
                      const checked = checkedTools.has(tool.name);
                      const shortName = tool.name.split(".").pop().replace(/^tool_/, "");
                      return (
                        <label
                          key={tool.name}
                          className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0 ${
                            checked ? "bg-blue-500/10" : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleTool(tool.name)}
                            className="sr-only"
                          />
                          <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                            checked
                              ? "bg-blue-500 border-blue-400"
                              : "border-white/20 bg-white/5"
                          }`}>
                            {checked && (
                              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </div>
                          <span className="text-sm th-text-secondary font-mono">{shortName}</span>
                          <span className="text-xs th-text-ghost ml-auto">{tool.name}</span>
                        </label>
                      );
                    })}
                  </div>
                  {checkedCount > 0 && (
                    <p className="text-xs text-blue-400/70 mt-2 pl-1">
                      {t("toolsSelectedCount", { count: checkedCount })}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Tool Parameters — or OAuth connect buttons for email categories */}
            {isEmailCategory ? (
              <div>
                <label className="block text-sm font-medium th-text-muted mb-2 pl-1">{t("connectAccountLabel")}</label>
                <div className="flex gap-2">
                  {/* Outlook */}
                  <button
                    type="button"
                    disabled={outlookLoading}
                    onClick={async () => {
                      try {
                        setOutlookLoading(true);
                        setOutlookConnected(false);
                        const data = await getOutlookAuthUrl();
                        if (data.auth_url) {
                          const popup = window.open(data.auth_url, "outlook-auth", "width=600,height=700,popup=yes");
                          if (popup) {
                            const pollTimer = setInterval(() => { if (popup.closed) { clearInterval(pollTimer); setOutlookLoading(false); } }, 500);
                          } else { setOutlookLoading(false); }
                        } else { setOutlookLoading(false); }
                      } catch { setOutlookLoading(false); }
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border transition-all text-sm font-semibold ${
                      outlookConnected
                        ? "border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/15"
                        : "border-white/10 bg-white/5 hover:bg-blue-600/20 hover:border-blue-500/30 text-white disabled:opacity-50"
                    }`}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" className="shrink-0">
                      <rect x="0" y="3.2" width="9.6" height="9.6" rx="0.8" fill="#0078D4"/>
                      <rect x="5.6" y="0" width="4.8" height="7.2" rx="0.4" fill="#0364B8"/>
                      <rect x="8.8" y="4" width="4.8" height="7.2" rx="0.4" fill="#0078D4"/>
                      <rect x="5.6" y="8.8" width="4.8" height="7.2" rx="0.4" fill="#28A8EA"/>
                      <text x="3.6" y="9.2" fontSize="5" fontWeight="bold" fill="white" textAnchor="middle">O</text>
                    </svg>
                    {outlookLoading ? <Loader2 size={13} className="animate-spin" /> : outlookConnected ? <><CheckCircle size={13} /> {t("connectedAddAnother")}</> : "Outlook"}
                  </button>
                  {/* Gmail */}
                  <button type="button" disabled className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white/30 text-sm font-semibold cursor-not-allowed">
                    <svg width="16" height="12" viewBox="0 0 16 12" className="shrink-0">
                      <path d="M1.6 0h12.8C15.28 0 16 .72 16 1.6v8.8c0 .88-.72 1.6-1.6 1.6H1.6C.72 12 0 11.28 0 10.4V1.6C0 .72.72 0 1.6 0z" fill="#4285F4" opacity=".5"/>
                      <path d="M16 1.6L8 7.2 0 1.6" stroke="#fff" strokeWidth="1.2" fill="none" opacity=".7"/>
                    </svg>
                    Gmail — {t("comingSoon")}
                  </button>
                </div>
                {outlookAlreadyConfigured && !outlookConnected && (
                  <p className="text-xs text-purple-400/70 mt-1.5 pl-1">{t("outlookAlreadyConfiguredHint")}</p>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium th-text-muted mb-2 pl-1">{t("toolParametersLabel")}</label>
                <div className="glass-card rounded-xl p-4 mb-3 border border-white/10">
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={paramKey}
                      onChange={(e) => setParamKey(e.target.value)}
                      placeholder={t("parameterKeyPlaceholder")}
                      className="glass-input flex-1 px-3 py-2 rounded-lg text-sm"
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addParameter(); } }}
                    />
                    <input
                      type="password"
                      value={paramValue}
                      onChange={(e) => setParamValue(e.target.value)}
                      placeholder={t("parameterValuePlaceholder")}
                      className="glass-input flex-1 px-3 py-2 rounded-lg text-sm"
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addParameter(); } }}
                    />
                    <button
                      onClick={addParameter}
                      className="glass-btn px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg font-medium transition-all text-sm border border-blue-500/20"
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  {Object.entries(newConfig.tool_config_params).length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                      {Object.entries(newConfig.tool_config_params).map(([key, value]) => (
                        <div
                          key={key}
                          className="flex items-center gap-2 p-3 bg-white/5 rounded-lg border border-white/10 group hover:border-blue-500/30 transition-all"
                        >
                          <div className="flex-1 grid grid-cols-2 gap-2 text-sm font-mono">
                            <span className="text-blue-400 font-semibold truncate flex items-center gap-1.5" title={key}>
                              {key}
                              {expectedParamKeys.has(key) && (
                                <span className="text-[10px] font-sans font-medium text-blue-400/80 bg-blue-400/10 border border-blue-400/20 px-1.5 py-0.5 rounded-md leading-none shrink-0">
                                  {t("expectedBadge")}
                                </span>
                              )}
                            </span>
                            <input
                              type={visibleParams[key] ? "text" : "password"}
                              value={value}
                              onChange={(e) =>
                                setNewConfig((prev) => ({
                                  ...prev,
                                  tool_config_params: { ...prev.tool_config_params, [key]: e.target.value },
                                }))
                              }
                              placeholder={t("enterValuePlaceholder")}
                              className="bg-transparent text-white/70 text-sm font-mono outline-none border-b border-transparent focus:border-white/30 transition-all w-full"
                            />
                          </div>
                          <button
                            onClick={() => setVisibleParams((prev) => ({ ...prev, [key]: !prev[key] }))}
                            className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white/80 transition-all"
                          >
                            {visibleParams[key] ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                          <button
                            onClick={() => removeParameter(key)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/20 rounded-lg text-white/60 hover:text-red-400 transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center th-text-ghost text-xs py-2">{t("noParamsAddedYet")}</div>
                  )}
                </div>
              </div>
            )}

            {/* Status & Type */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium th-text-muted mb-2 pl-1">{t("statusLabel")}</label>
                <select
                  value={newConfig.status}
                  onChange={(e) => setNewConfig((prev) => ({ ...prev, status: e.target.value }))}
                  className="glass-input w-full px-4 py-3 rounded-xl"
                >
                  <option value="active" className="th-bg-modal">{t("activeOption")}</option>
                  <option value="inactive" className="th-bg-modal">{t("inactiveOption")}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium th-text-muted mb-2 pl-1">{t("configTypeLabel")}</label>
                <select
                  value={newConfig.tool_config_type}
                  onChange={(e) => setNewConfig((prev) => ({ ...prev, tool_config_type: e.target.value }))}
                  className="glass-input w-full px-4 py-3 rounded-xl"
                >
                  <option value="active" className="th-bg-modal">{t("activeOption")}</option>
                  <option value="inactive" className="th-bg-modal">{t("inactiveOption")}</option>
                </select>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="shrink-0 p-6 th-bg-overlay border-t th-border-secondary flex gap-3">
            <button
              onClick={onClose}
              className="glass-btn flex-1 px-4 py-3 border th-border th-text-secondary rounded-xl hover:th-bg-surface hover:th-text font-semibold transition-all"
            >
              {t("cancel")}
            </button>
            <button
              onClick={handleSave}
              disabled={checkedCount === 0}
              className={`glass-btn flex-1 px-4 py-3 text-white rounded-xl font-bold transition-all shadow-lg hover:scale-[1.02] active:scale-[0.98] bg-linear-to-r ${gradient} disabled:opacity-40 disabled:hover:scale-100`}
            >
              {editingConfig
                ? t("saveChanges")
                : checkedCount > 1
                  ? t("createConfigsCount", { count: checkedCount })
                  : t("createConfig")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
