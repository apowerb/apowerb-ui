"use client";

import React from "react";
import { Plus, Wrench } from "lucide-react";
import { useTranslations } from "use-intl";
import ToolConfigModal from "./ToolConfigModal";
import { SkeletonList } from "./Skeleton";
import StatsBar from "./tools-manager/StatsBar";
import AvailableToolsTab from "./tools-manager/AvailableToolsTab";
import ConfigsTab from "./tools-manager/ConfigsTab";
import McpServersTab from "./tools-manager/McpServersTab";
import SkillsTab from "./tools-manager/SkillsTab";
import SkillModal from "./tools-manager/SkillModal";
import HelpPage from "./HelpPage";
import { useToolsManager } from "./tools-manager/useToolsManager";
import { TABS } from "./tools-manager/toolsManagerUtils";

/**
 * Orchestrator for the Tool Box & MCP page.
 *
 * All state and business logic lives in `useToolsManager`. This component
 * only renders the layout (header, stats, tab bar) and delegates each tab
 * to its dedicated sub-component.
 */
export default function ToolsManager() {
  const t = useTranslations("ToolsManager");
  const vm = useToolsManager();

  const mcpFormProps = {
    newMcp: vm.newMcp,
    setNewMcp: vm.setNewMcp,
    dbConfig: vm.dbConfig,
    setDbConfig: vm.setDbConfig,
    selectedTemplate: vm.selectedTemplate,
    onApplyTemplate: vm.applyMcpTemplate,
    onSave: vm.handleSaveMcp,
  };

  return (
    <div className="h-full flex flex-col th-bg-body overflow-hidden">
      {/* ── Header ── */}
      <header className="shrink-0 p-6 bg-linear-to-r from-brand/20 to-brand-secondary/20 border-b th-border backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-linear-to-br from-brand to-brand-secondary rounded-2xl shadow-lg">
              <Wrench size={32} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black th-text tracking-tight">{t("title")}</h1>
              <p className="th-text-secondary text-sm font-medium mt-1">{t("subtitle")}</p>
            </div>
          </div>
          <button
            onClick={() => vm.openCreateModal()}
            className="glass-btn flex items-center gap-2 px-5 py-3 bg-brand hover:bg-brand-hover text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20 hover:scale-105"
          >
            <Plus size={20} />
            {t("newToolConfig")}
          </button>
        </div>
      </header>

      {/* ── Content ── */}
      <div className="flex-1 overflow-auto p-6">
        {vm.loading ? (
          <div className="max-w-7xl mx-auto">
            <SkeletonList count={6} />
          </div>
        ) : (
          <div className="max-w-7xl mx-auto space-y-6">
            <StatsBar stats={vm.stats} />

            {/* Tab bar */}
            <div className="flex items-center border-b th-border">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = vm.activeTab === tab.key;
                const badge = vm.tabBadges[tab.key];
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => vm.changeTab(tab.key)}
                    className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold transition-all border-b-2 ${
                      isActive
                        ? "border-blue-500 text-blue-400"
                        : "border-transparent th-text-muted hover:th-text-secondary"
                    }`}
                  >
                    <Icon size={16} />
                    {tab.label}
                    {badge > 0 && (
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums ${
                        isActive ? "bg-blue-500/20 text-blue-400" : "th-bg-surface th-text-muted"
                      }`}>
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Active tab */}
            {vm.activeTab === "available-tools" && (
              <AvailableToolsTab
                toolSearch={vm.toolSearch}
                setToolSearch={vm.setToolSearch}
                categoryFilter={vm.categoryFilter}
                setCategoryFilter={vm.setCategoryFilter}
                filterOptions={vm.filterOptions}
                sortedEntries={vm.sortedEntries}
                toolSortKey={vm.toolSortKey}
                expandedCategory={vm.expandedCategory}
                setExpandedCategory={vm.setExpandedCategory}
                onSort={vm.handleToolSort}
                onConfigure={vm.openCreateModal}
              />
            )}

            {vm.activeTab === "my-configurations" && (
              <ConfigsTab
                configSearch={vm.configSearch}
                setConfigSearch={vm.setConfigSearch}
                configCategoryFilter={vm.configCategoryFilter}
                setConfigCategoryFilter={vm.setConfigCategoryFilter}
                filterOptions={vm.filterOptions}
                filteredConfigs={vm.filteredConfigs}
                onCreate={vm.openCreateModal}
                onEdit={vm.openEditModal}
                onDelete={vm.handleDeleteConfig}
              />
            )}

            {vm.activeTab === "mcp-servers" && (
              <McpServersTab
                mcpSearch={vm.mcpSearch}
                setMcpSearch={vm.setMcpSearch}
                filteredMcpConfigs={vm.filteredMcpConfigs}
                showMcpForm={vm.showMcpForm}
                openMcpForm={vm.openMcpForm}
                resetMcpForm={vm.resetMcpForm}
                formProps={mcpFormProps}
                onDelete={vm.handleDeleteMcp}
                onEdit={vm.handleEditMcp}
                editingMcp={vm.editingMcp}
              />
            )}

            {vm.activeTab === "skills" && (
              <SkillsTab
                skillSearch={vm.skillSearch}
                setSkillSearch={vm.setSkillSearch}
                skillFilter={vm.skillFilter}
                setSkillFilter={vm.setSkillFilter}
                filteredSkills={vm.filteredSkills}
                exportDropdownId={vm.exportDropdownId}
                setExportDropdownId={vm.setExportDropdownId}
                openNewSkill={vm.openNewSkill}
                onImport={vm.handleImportSkill}
                onEdit={vm.handleEditSkill}
                onDelete={vm.handleDeleteSkill}
                onExport={vm.handleExportSkill}
              />
            )}

            {vm.activeTab === "help" && <HelpPage embedded />}
          </div>
        )}
      </div>

      {/* Tool Config Modal */}
      <ToolConfigModal
        show={vm.showModal}
        editingConfig={vm.editingConfig}
        newConfig={vm.newConfig}
        setNewConfig={vm.setNewConfig}
        availableTools={vm.allTools}
        existingConfigs={vm.toolConfigs}
        onClose={() => vm.setShowModal(false)}
        onSave={vm.handleSaveConfig}
      />

      {/* Skill Modal */}
      <SkillModal
        show={vm.showSkillForm}
        editingSkill={vm.editingSkill}
        newSkill={vm.newSkill}
        setNewSkill={vm.setNewSkill}
        onClose={vm.resetSkillForm}
        onSave={vm.handleSaveSkill}
      />
    </div>
  );
}
