"use client";

import React from "react";
import {
  Plus, Search, Database, Globe, Terminal, ExternalLink, Info, Trash2, Pencil,
} from "lucide-react";
import { useTranslations } from "use-intl";
import McpServerForm from "./McpServerForm";

/**
 * "MCP Servers" tab — list of configured MCP servers with a collapsible
 * form for adding a new one. The form state (template, newMcp, dbConfig)
 * lives in the parent hook.
 */
export default function McpServersTab({
  mcpSearch, setMcpSearch,
  filteredMcpConfigs,
  showMcpForm,
  openMcpForm,
  resetMcpForm,
  formProps,
  onDelete,
  onEdit,
  editingMcp,
}) {
  const t = useTranslations("McpServersTab");
  return (
    <div>
      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-purple-500/5 border border-purple-500/15 mb-4">
        <Info size={18} className="text-purple-400 shrink-0 mt-0.5" />
        <div className="text-xs th-text-secondary leading-relaxed">
          <span className="text-purple-400 font-semibold">MCP Servers</span>{" "}
          {t.rich("infoBanner", {
            toolset: (chunks) => <span className="th-text font-medium"> {chunks} </span>,
          })}
        </div>
      </div>

      {/* Search + Add Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="relative flex-1 min-w-50 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 th-text-faint" />
          <input
            type="text"
            placeholder={t("searchPlaceholder")}
            value={mcpSearch}
            onChange={(e) => setMcpSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 th-bg-surface border th-border rounded-xl text-sm th-text placeholder-[var(--text-faint)] focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 transition-all"
          />
        </div>
        <span className="text-xs th-text-faint ml-auto">
          {t("serversCount", { count: filteredMcpConfigs.length })}
        </span>
        <button
          onClick={openMcpForm}
          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-purple-500/20 hover:scale-105"
        >
          <Plus size={16} />
          {t("addMcpServer")}
        </button>
      </div>

      {showMcpForm && (
        <McpServerForm {...formProps} onCancel={resetMcpForm} />
      )}

      {filteredMcpConfigs.length === 0 && !showMcpForm ? (
        <div className="glass-card p-12 rounded-2xl text-center border border-dashed th-border">
          <Database size={48} className="mx-auto mb-4 th-text-faint" />
          <h3 className="text-xl font-bold th-text mb-2">{t("emptyTitle")}</h3>
          <p className="th-text-secondary mb-6 max-w-md mx-auto">
            {t("emptyDescription")}
          </p>
          <button
            onClick={openMcpForm}
            className="glass-btn px-6 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-purple-500/20"
          >
            <Plus size={20} className="inline mr-2" />
            {t("addMcpServer")}
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredMcpConfigs.map((mcp) => (
            <div
              key={mcp.mcp_config_id}
              className={`glass-card rounded-xl border p-4 transition-all ${
                String(editingMcp) === String(mcp.mcp_config_id)
                  ? "border-purple-500/60 ring-1 ring-purple-500/30"
                  : "th-border hover:border-purple-500/20"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-purple-500/10">
                    {mcp.transport === "stdio" ? (
                      <Terminal size={20} className="text-purple-400" />
                    ) : (
                      <Globe size={20} className="text-purple-400" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold th-text flex items-center gap-2">
                      {mcp.name}
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        mcp.transport === "stdio"
                          ? "bg-purple-500/15 text-purple-400 border border-purple-500/25"
                          : "bg-blue-400/15 text-blue-400 border border-blue-400/25"
                      }`}>
                        {mcp.transport === "stdio" ? "Stdio" : "HTTP/SSE"}
                      </span>
                      {mcp.toolset && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-400/80 border border-purple-500/20">
                          {mcp.toolset}
                        </span>
                      )}
                      {!mcp.toolset && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold th-bg-surface th-text-faint border th-border">
                          {t("allToolsBadge")}
                        </span>
                      )}
                    </h4>
                    <p className="text-xs th-text-muted font-mono mt-0.5">
                      {mcp.mcp_type === "toolbox-db" && mcp.db_config
                        ? `${mcp.db_config.db_type}://${mcp.db_config.user}@${mcp.db_config.host}:${mcp.db_config.port}/${mcp.db_config.database}`
                        : mcp.transport === "stdio"
                        ? `${mcp.command} ${(mcp.args || []).join(" ")}`
                        : mcp.url}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {onEdit && (
                    <button
                      onClick={() => onEdit(mcp)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-400/10 hover:bg-blue-400/20 text-blue-300 hover:text-blue-200 border border-blue-400/20 transition-all"
                    >
                      <Pencil size={12} /> {t("edit")}
                    </button>
                  )}
                  {mcp.transport !== "stdio" && mcp.url && (
                    <a
                      href={mcp.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold th-bg-surface hover:bg-white/10 th-text-muted hover:th-text-secondary border th-border transition-all"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink size={12} /> {t("open")}
                    </a>
                  )}
                  <button
                    onClick={() => onDelete(mcp.mcp_config_id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 transition-all"
                  >
                    <Trash2 size={12} /> {t("delete")}
                  </button>
                </div>
              </div>

              {mcp.transport !== "stdio" && Object.keys(mcp.headers || {}).length > 0 && (
                <div className="mt-3 pt-3 border-t th-border">
                  <p className="text-[10px] th-text-faint uppercase tracking-wider mb-1">{t("headersLabel")}</p>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(mcp.headers).map(([k, v]) => (
                      <span key={k} className="px-2 py-0.5 rounded text-[11px] font-mono th-bg-surface th-text-muted">
                        {k}: {v}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {mcp.transport === "stdio" && Object.keys(mcp.env || {}).length > 0 && (
                <div className="mt-3 pt-3 border-t th-border">
                  <p className="text-[10px] th-text-faint uppercase tracking-wider mb-1">{t("environmentLabel")}</p>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(mcp.env).map(([k]) => (
                      <span key={k} className="px-2 py-0.5 rounded text-[11px] font-mono th-bg-surface th-text-muted">
                        {k}=***
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
