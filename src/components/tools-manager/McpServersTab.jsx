"use client";

import React, { useEffect, useRef } from "react";
import {
  Plus, Database, Globe, Terminal, ExternalLink, Trash2, Pencil, Server,
} from "lucide-react";
import { useTranslations } from "use-intl";
import McpServerForm from "./McpServerForm";
import { mcpEndpoint } from "./toolsManagerUtils";
import {
  Toolbar, SearchField, ResultCount, Card, EmptyPanel, IconButton,
  PrimaryButton, SecondaryButton, Badge,
} from "./ui";

function serverKind(mcp) {
  if (mcp.mcp_type === "toolbox-db") return { icon: Database, labelKey: "kindDatabase", tile: "bg-amber-500/15 text-amber-400" };
  if (mcp.transport === "stdio") return { icon: Terminal, labelKey: "kindStdio", tile: "bg-purple-500/15 text-purple-400" };
  return { icon: Globe, labelKey: "kindHttp", tile: "bg-blue-500/15 text-blue-400" };
}

function McpCard({ mcp, editing, onEdit, onDelete }) {
  const t = useTranslations("McpServersTab");
  const kind = serverKind(mcp);
  const Icon = kind.icon;
  const endpoint = mcpEndpoint(mcp);
  const secretKeys = mcp.transport === "stdio"
    ? Object.keys(mcp.env || {})
    : Object.keys(mcp.headers || {});
  const canOpen = mcp.transport !== "stdio" && mcp.mcp_type !== "toolbox-db" && /^https?:\/\//.test(endpoint);

  return (
    <Card
      className={`p-4 transition-colors ${
        editing ? "border-blue-500/50 ring-2 ring-blue-500/20" : "hover:border-blue-500/30"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${kind.tile}`}>
          <Icon size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold th-text truncate max-w-full" title={mcp.name}>{mcp.name}</h3>
            <Badge>{t(kind.labelKey)}</Badge>
          </div>
          <p className="text-xs th-text-muted font-mono truncate mt-1" title={endpoint}>{endpoint || "—"}</p>
        </div>
        <div className="flex items-center gap-0.5 shrink-0 -mr-1 -mt-1">
          <IconButton icon={Pencil} label={t("edit")} onClick={() => onEdit(mcp)} />
          {canOpen && (
            <a
              href={endpoint}
              target="_blank"
              rel="noopener noreferrer"
              title={t("open")}
              aria-label={t("open")}
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg th-text-muted hover:th-text hover:bg-white/10 transition-colors"
            >
              <ExternalLink size={15} />
            </a>
          )}
          <IconButton icon={Trash2} label={t("delete")} tone="danger" onClick={() => onDelete(mcp.mcp_config_id)} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t th-border">
        <span className="text-[11px] th-text-faint mr-0.5">{t("toolsetLabel")}</span>
        {mcp.toolset ? <Badge tone="blue" mono>{mcp.toolset}</Badge> : <Badge>{t("allToolsBadge")}</Badge>}
        {secretKeys.length > 0 && (
          <>
            <span className="text-[11px] th-text-faint ml-2 mr-0.5">
              {mcp.transport === "stdio" ? t("environmentLabel") : t("headersLabel")}
            </span>
            {secretKeys.map((k) => (
              // Values are credentials (Authorization, API keys…): only the name is shown.
              <Badge key={k} mono title={t("valueHidden")}>{k}: ••••</Badge>
            ))}
          </>
        )}
      </div>
    </Card>
  );
}

/**
 * "MCP Servers" tab — configured servers as cards, plus the add/edit panel
 * (template picker + connection form) that opens above the list.
 */
export default function McpServersTab({
  mcpSearch, setMcpSearch,
  filteredMcpConfigs,
  totalMcp,
  showMcpForm,
  openMcpForm,
  resetMcpForm,
  formProps,
  onDelete,
  onEdit,
  editingMcp,
}) {
  const t = useTranslations("McpServersTab");
  const formRef = useRef(null);

  useEffect(() => {
    if (showMcpForm) formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [showMcpForm, editingMcp]);

  const editingName = editingMcp
    ? filteredMcpConfigs.find((m) => String(m.mcp_config_id) === String(editingMcp))?.name
    : null;

  return (
    <div>
      {showMcpForm && (
        <div ref={formRef} className="scroll-mt-4">
          <McpServerForm {...formProps} editingName={editingName} isEditing={Boolean(editingMcp)} onCancel={resetMcpForm} />
        </div>
      )}

      {totalMcp === 0 ? (
        !showMcpForm && (
          <EmptyPanel icon={Server} title={t("emptyTitle")} description={t("emptyDescription")}>
            <PrimaryButton icon={Plus} onClick={openMcpForm}>{t("addMcpServer")}</PrimaryButton>
          </EmptyPanel>
        )
      ) : (
        <>
          <Toolbar>
            <SearchField
              value={mcpSearch}
              onChange={setMcpSearch}
              placeholder={t("searchPlaceholder")}
              clearLabel={t("clearSearch")}
            />
            <ResultCount>{t("serversCount", { count: filteredMcpConfigs.length })}</ResultCount>
          </Toolbar>

          {filteredMcpConfigs.length === 0 ? (
            <EmptyPanel icon={Server} title={t("noneMatch")}>
              <SecondaryButton onClick={() => setMcpSearch("")}>{t("clearSearch")}</SecondaryButton>
            </EmptyPanel>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredMcpConfigs.map((mcp) => (
                <McpCard
                  key={mcp.mcp_config_id}
                  mcp={mcp}
                  editing={String(editingMcp) === String(mcp.mcp_config_id)}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
