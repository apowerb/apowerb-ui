"use client";

import { useState } from "react";
import { useRouter } from "@/lib/navigation";
import { useTranslations } from "use-intl";
import {
  Server,
  ChevronDown,
  ChevronRight,
  Plus,
  X,
  Trash2,
  Bookmark,
  Database,
  Pencil,
  Eye,
  EyeOff,
} from "lucide-react";
import { saveMcpConfig } from "@/lib/api";
import HeadersTextarea from "./HeadersTextarea";

export default function McpServersSection({
  mcpServers = [],
  onChange,
  savedConfigs = [],
  onRefreshConfigs,
}) {
  const t = useTranslations("McpServersSection");
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);
  const servers = mcpServers || [];

  const addServer = () => {
    onChange([...servers, {
      id: `mcp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: "", transport: "http",
      url: "", headers: {}, params: {},
      command: "", args: [], env: {},
    }]);
  };

  const removeServer = (index) => {
    onChange(servers.filter((_, i) => i !== index));
  };

  const updateServer = (index, key, value) => {
    const updated = servers.map((s, i) => (i === index ? { ...s, [key]: value } : s));
    onChange(updated);
  };

  const addParam = (serverIndex) => {
    const server = servers[serverIndex];
    const tempKey = `param_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const params = { ...server.params, [tempKey]: "" };
    updateServer(serverIndex, "params", params);
  };

  const removeParam = (serverIndex, paramKey) => {
    const server = servers[serverIndex];
    const { [paramKey]: _, ...rest } = server.params;
    updateServer(serverIndex, "params", rest);
  };

  const updateParamKey = (serverIndex, oldKey, newKey) => {
    const server = servers[serverIndex];
    const entries = Object.entries(server.params || {});
    const newParams = {};
    entries.forEach(([k, v]) => {
      newParams[k === oldKey ? newKey : k] = v;
    });
    updateServer(serverIndex, "params", newParams);
  };

  const updateParamValue = (serverIndex, paramKey, newValue) => {
    const server = servers[serverIndex];
    updateServer(serverIndex, "params", { ...server.params, [paramKey]: newValue });
  };

  const addEnv = (serverIndex) => {
    const server = servers[serverIndex];
    const tempKey = `ENV_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    updateServer(serverIndex, "env", { ...server.env, [tempKey]: "" });
  };

  const removeEnv = (serverIndex, envKey) => {
    const server = servers[serverIndex];
    const { [envKey]: _, ...rest } = server.env;
    updateServer(serverIndex, "env", rest);
  };

  const updateEnvKey = (serverIndex, oldKey, newKey) => {
    const server = servers[serverIndex];
    const entries = Object.entries(server.env || {});
    const newEnv = {};
    entries.forEach(([k, v]) => {
      newEnv[k === oldKey ? newKey : k] = v;
    });
    updateServer(serverIndex, "env", newEnv);
  };

  const updateEnvValue = (serverIndex, envKey, newValue) => {
    const server = servers[serverIndex];
    updateServer(serverIndex, "env", { ...server.env, [envKey]: newValue });
  };

  return (
    <div className="border th-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 th-bg-surface hover:th-bg-surface-hover transition-colors"
      >
        <div className="flex items-center gap-2">
          <Server size={16} className="text-blue-400" />
          <span className="text-sm font-bold th-text">{t("title")}</span>
          {servers.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-400/20 text-blue-400">
              {servers.length}
            </span>
          )}
        </div>
        {isOpen ? <ChevronDown size={16} className="th-text-faint" /> : <ChevronRight size={16} className="th-text-faint" />}
      </button>

      {isOpen && (
        <div className="p-4 space-y-3 th-bg-overlay">
          {/* Saved MCP Configs — quick add */}
          {savedConfigs.length > 0 && (
            <div className="mb-3">
              <label className="block text-xs font-medium th-text-faint mb-1.5">{t("savedConfigsLabel")}</label>
              <div className="flex flex-wrap gap-1.5">
                {savedConfigs.map((cfg) => (
                  <button
                    key={cfg.mcp_config_id}
                    type="button"
                    onClick={() => {
                      const newServer = {
                        id: `mcp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                        name: cfg.name || "",
                        transport: cfg.transport || "http",
                        url: cfg.url || "",
                        headers: cfg.headers || {},
                        params: cfg.params || {},
                        command: cfg.command || "",
                        args: cfg.args || [],
                        env: cfg.env || {},
                        mcp_config_id: cfg.mcp_config_id,
                        // Propagate semantic info so the backend can pick the
                        // right ADK Toolset (toolbox-db → ToolboxToolset).
                        mcp_type: cfg.mcp_type || "",
                        toolset: cfg.toolset || "",
                        db_type: cfg.db_config?.db_type || "",
                        // Real database name (e.g. "PMI"), surfaced in the
                        // agent's instruction preamble so it refers to the
                        // DB by its actual name, not the wrapper config.
                        db_database: cfg.db_config?.database || "",
                      };
                      onChange([...servers, newServer]);
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-blue-400/10 hover:bg-blue-400/20 border border-blue-400/20 text-blue-300 hover:text-blue-200 transition-all"
                  >
                    <Plus size={12} />
                    {cfg.name || cfg.mcp_config_id}
                    <span className="th-text-ghost">
                      ({cfg.mcp_type === "toolbox-db"
                        ? t("databaseToolboxLabel", { dbType: cfg.db_config?.db_type || "db" })
                        : cfg.transport})
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {servers.map((server, idx) => {
            // Compact card: when this server is linked to a saved MCP config
            // (clicked from "Saved configs"), the editable source of truth
            // lives in /tool-box. We show a read-only summary + a quick
            // shortcut to edit it there.
            if (server.mcp_config_id) {
              const isToolboxDb = server.mcp_type === "toolbox-db";
              const dbKindLabel = {
                postgres: "PostgreSQL",
                mysql: "MySQL",
                mssql: "SQL Server",
              }[server.db_type] || server.db_type || t("unknownDatabase");
              const dbDisplay = server.db_database || server.name || t("unknownDatabase");
              const subtitle = isToolboxDb
                ? `${dbDisplay} · ${dbKindLabel}${server.toolset ? ` · toolset: ${server.toolset}` : ""}`
                : server.transport === "stdio"
                ? `Stdio · ${server.command || ""}${server.args?.length ? ` ${(Array.isArray(server.args) ? server.args : []).join(" ")}` : ""}`
                : `${(server.transport || "http").toUpperCase()} · ${server.url || ""}`;
              return (
                <div
                  key={server.id || idx}
                  className="border th-border rounded-lg p-3 flex items-center justify-between gap-3 bg-white/3"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="p-2 rounded-lg bg-blue-400/10 flex-shrink-0">
                      <Database size={16} className="text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold th-text truncate">
                        {server.name || `MCP #${server.mcp_config_id}`}
                      </p>
                      <p className="text-xs th-text-faint truncate font-mono">{subtitle}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => router.push(`/tool-box?edit=${server.mcp_config_id}`)}
                      className="p-1.5 rounded text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 transition-colors"
                      title={t("editInToolBox")}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeServer(idx)}
                      className="p-1.5 rounded text-red-400 hover:text-red-300 hover:bg-red-400/10 transition-colors"
                      title={t("detachFromAgent")}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            }
            return (
            <div key={server.id || idx} className="border th-border rounded-lg p-3 space-y-2 bg-white/3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold th-text-faint">{t("serverLabel", { number: idx + 1 })}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await saveMcpConfig({
                          config_name: server.name || `MCP Server ${idx + 1}`,
                          name: server.name || "",
                          transport: server.transport || "http",
                          url: server.url || "",
                          headers: server.headers || {},
                          params: server.params || {},
                          command: server.command || "",
                          args: server.args || [],
                          env: server.env || {},
                        });
                        onRefreshConfigs?.();
                      } catch (err) {
                        console.error("Failed to save MCP config:", err);
                      }
                    }}
                    className="text-blue-400 hover:text-blue-300 transition-colors"
                    title={t("saveAsReusableConfig")}
                  >
                    <Bookmark size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeServer(idx)}
                    className="text-red-400 hover:text-red-300 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-medium th-text-muted mb-1">{t("nameLabel")}</label>
                <input
                  type="text"
                  value={server.name || ""}
                  onChange={(e) => updateServer(idx, "name", e.target.value)}
                  placeholder={t("namePlaceholder")}
                  className="glass-input w-full px-3 py-2 rounded-lg text-sm"
                />
              </div>

              {/* Transport */}
              <div>
                <label className="block text-xs font-medium th-text-muted mb-1">{t("transportLabel")}</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => updateServer(idx, "transport", "http")}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      (server.transport || "http") === "http"
                        ? "bg-blue-400/20 border-blue-400/50 text-blue-300"
                        : "th-bg-surface th-border text-white/50 hover:th-bg-surface-hover"
                    }`}
                  >
                    HTTP
                  </button>
                  <button
                    type="button"
                    onClick={() => updateServer(idx, "transport", "sse")}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      server.transport === "sse"
                        ? "bg-blue-400/20 border-blue-400/50 text-blue-300"
                        : "th-bg-surface th-border text-white/50 hover:th-bg-surface-hover"
                    }`}
                  >
                    SSE
                  </button>
                  <button
                    type="button"
                    onClick={() => updateServer(idx, "transport", "stdio")}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      server.transport === "stdio"
                        ? "bg-blue-400/20 border-blue-400/50 text-blue-300"
                        : "th-bg-surface th-border text-white/50 hover:th-bg-surface-hover"
                    }`}
                  >
                    Stdio
                  </button>
                </div>
              </div>

              {(server.transport || "http") === "http" || server.transport === "sse" ? (
                <>
                  {/* URL */}
                  <div>
                    <label className="block text-xs font-medium th-text-muted mb-1">{t("urlLabel")}</label>
                    <input
                      type="url"
                      value={server.url || ""}
                      onChange={(e) => updateServer(idx, "url", e.target.value)}
                      placeholder="https://mcp.example.com/mcp/"
                      className="glass-input w-full px-3 py-2 rounded-lg text-sm"
                    />
                  </div>

                  {/* Headers (JSON textarea) */}
                  <div>
                    <label className="block text-xs font-medium th-text-muted mb-1">
                      {t("headersLabel")} <span className="th-text-ghost">{t("jsonOptional")}</span>
                    </label>
                    <HeadersTextarea
                      value={server.headers}
                      onChange={(parsed) => updateServer(idx, "headers", parsed)}
                    />
                  </div>

                  {/* Params (key-value pairs) */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium th-text-muted">{t("paramsLabel")}</label>
                      <button
                        type="button"
                        onClick={() => setShowSecrets(!showSecrets)}
                        className="th-text-faint hover:th-text-secondary transition-colors"
                        title={showSecrets ? t("hideValues") : t("showValues")}
                      >
                        {showSecrets ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      {Object.entries(server.params || {}).map(([pKey, pValue], pIdx) => (
                        <div key={pIdx} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={pKey}
                            onChange={(e) => updateParamKey(idx, pKey, e.target.value)}
                            placeholder={t("keyPlaceholder")}
                            className="glass-input flex-1 px-2 py-1.5 rounded-lg text-xs font-mono"
                          />
                          <input
                            type={showSecrets ? "text" : "password"}
                            value={pValue}
                            onChange={(e) => updateParamValue(idx, pKey, e.target.value)}
                            placeholder={t("valuePlaceholder")}
                            className="glass-input flex-1 px-2 py-1.5 rounded-lg text-xs font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => removeParam(idx, pKey)}
                            className="text-red-400 hover:text-red-300 shrink-0"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addParam(idx)}
                        className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors mt-1"
                      >
                        <Plus size={12} /> {t("addParam")}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Command */}
                  <div>
                    <label className="block text-xs font-medium th-text-muted mb-1">{t("commandLabel")}</label>
                    <input
                      type="text"
                      value={server.command || ""}
                      onChange={(e) => updateServer(idx, "command", e.target.value)}
                      placeholder="npx"
                      className="glass-input w-full px-3 py-2 rounded-lg text-sm font-mono"
                    />
                  </div>

                  {/* Args */}
                  <div>
                    <label className="block text-xs font-medium th-text-muted mb-1">{t("argumentsLabel")}</label>
                    <input
                      type="text"
                      value={(server.args || []).join(" ")}
                      onChange={(e) => updateServer(idx, "args", e.target.value.split(/\s+/).filter(Boolean))}
                      placeholder="-y @modelcontextprotocol/server-github"
                      className="glass-input w-full px-3 py-2 rounded-lg text-sm font-mono"
                    />
                  </div>

                  {/* Environment Variables */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium th-text-muted">{t("environmentVariablesLabel")}</label>
                      <button
                        type="button"
                        onClick={() => setShowSecrets(!showSecrets)}
                        className="th-text-faint hover:th-text-secondary transition-colors"
                        title={showSecrets ? t("hideValues") : t("showValues")}
                      >
                        {showSecrets ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      {Object.entries(server.env || {}).map(([eKey, eValue], eIdx) => (
                        <div key={eIdx} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={eKey}
                            onChange={(e) => updateEnvKey(idx, eKey, e.target.value)}
                            placeholder="ENV_VAR"
                            className="glass-input flex-1 px-2 py-1.5 rounded-lg text-xs font-mono"
                          />
                          <input
                            type={showSecrets ? "text" : "password"}
                            value={eValue}
                            onChange={(e) => updateEnvValue(idx, eKey, e.target.value)}
                            placeholder={t("valuePlaceholder")}
                            className="glass-input flex-1 px-2 py-1.5 rounded-lg text-xs font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => removeEnv(idx, eKey)}
                            className="text-red-400 hover:text-red-300 shrink-0"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addEnv(idx)}
                        className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors mt-1"
                      >
                        <Plus size={12} /> {t("addEnvVar")}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
            );
          })}

          <button
            type="button"
            onClick={addServer}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-blue-400 hover:text-blue-300 bg-blue-400/10 hover:bg-blue-400/20 border border-blue-400/20 transition-all"
          >
            <Plus size={14} /> {t("addMcpServer")}
          </button>
        </div>
      )}
    </div>
  );
}
