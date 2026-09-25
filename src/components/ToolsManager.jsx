"use client";

import React, { useEffect, useRef } from "react";
import { Plus, Wrench, Upload, Info } from "lucide-react";
import { useTranslations } from "use-intl";
import ToolConfigModal from "./ToolConfigModal";
import { SkeletonList } from "./Skeleton";
import AvailableToolsTab from "./tools-manager/AvailableToolsTab";
import ConfigsTab from "./tools-manager/ConfigsTab";
import McpServersTab from "./tools-manager/McpServersTab";
import SkillsTab from "./tools-manager/SkillsTab";
import SkillModal from "./tools-manager/SkillModal";
import { PrimaryButton, SecondaryButton } from "./tools-manager/ui";
import HelpPage from "./HelpPage";
import { useToolsManager } from "./tools-manager/useToolsManager";
import { TABS } from "./tools-manager/toolsManagerUtils";

/**
 * Orchestrator for the Tool Box & MCP page.
 *
 * All state and business logic lives in `useToolsManager`. This component
 * renders the header (title, the active tab's primary action, tab bar) and
 * delegates each tab to its dedicated sub-component.
 */
export default function ToolsManager() {
  const t = useTranslations("ToolsManager");
  const vm = useToolsManager();
  const importInputRef = useRef(null);
  const tabRefs = useRef({});
  const activeTab = TABS.find((tab) => tab.key === vm.activeTab) || TABS[0];

  // On narrow screens the tab bar scrolls: keep the active tab visible.
  useEffect(() => {
    tabRefs.current[vm.activeTab]?.scrollIntoView?.({ block: "nearest", inline: "center" });
  }, [vm.activeTab]);

  const mcpFormProps = {
    newMcp: vm.newMcp,
    setNewMcp: vm.setNewMcp,
    dbConfig: vm.dbConfig,
    setDbConfig: vm.setDbConfig,
    selectedTemplate: vm.selectedTemplate,
    onApplyTemplate: vm.applyMcpTemplate,
    onSave: vm.handleSaveMcp,
  };

  // Arrow keys move between tabs (WAI-ARIA tabs pattern).
  const onTabKeyDown = (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const i = TABS.findIndex((tab) => tab.key === vm.activeTab);
    const next = TABS[(i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length];
    vm.changeTab(next.key);
    tabRefs.current[next.key]?.focus();
  };

  const headerActions = {
    newConfig: (
      <PrimaryButton icon={Plus} onClick={() => vm.openCreateModal()}>{t("newToolConfig")}</PrimaryButton>
    ),
    newMcp: !vm.showMcpForm && (
      <PrimaryButton icon={Plus} onClick={vm.openMcpForm}>{t("newMcpServer")}</PrimaryButton>
    ),
    newSkill: (
      <>
        <SecondaryButton icon={Upload} onClick={() => importInputRef.current?.click()}>{t("importSkill")}</SecondaryButton>
        <PrimaryButton icon={Plus} onClick={vm.openNewSkill}>{t("newSkill")}</PrimaryButton>
      </>
    ),
  };

  return (
    <div className="h-full flex flex-col th-bg-body overflow-hidden">
      {/* ── Header ── */}
      <header className="shrink-0 border-b th-border backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="shrink-0 w-10 h-10 rounded-xl bg-linear-to-br from-brand to-brand-secondary flex items-center justify-center shadow-md">
                <Wrench size={20} className="text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-bold th-text tracking-tight">{t("title")}</h1>
                <p className="text-sm th-text-muted truncate">{t("subtitle")}</p>
              </div>
            </div>
            {!vm.loading && activeTab.action && (
              <div className="flex items-center gap-2">{headerActions[activeTab.action]}</div>
            )}
          </div>

          <div role="tablist" aria-label={t("title")} className="flex gap-1 mt-4 -mb-px overflow-x-auto">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = vm.activeTab === tab.key;
              const badge = vm.tabBadges[tab.key];
              return (
                <button
                  key={tab.key}
                  ref={(el) => { tabRefs.current[tab.key] = el; }}
                  type="button"
                  role="tab"
                  id={`toolbox-tab-${tab.key}`}
                  aria-selected={isActive}
                  aria-controls="toolbox-panel"
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => vm.changeTab(tab.key)}
                  onKeyDown={onTabKeyDown}
                  className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors focus:outline-none focus-visible:bg-white/10 rounded-t-lg ${
                    isActive
                      ? "border-blue-500 th-text"
                      : "border-transparent th-text-muted hover:th-text-secondary hover:border-[var(--border-primary)]"
                  }`}
                >
                  <Icon size={16} className={isActive ? "text-blue-400" : ""} />
                  {t(tab.labelKey)}
                  {badge > 0 && (
                    <span className={`min-w-5 px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums text-center ${
                      isActive ? "bg-blue-500/20 text-blue-400" : "bg-white/10 th-text-muted"
                    }`}>
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <div className="flex-1 overflow-auto">
        <div
          id="toolbox-panel"
          role="tabpanel"
          aria-labelledby={`toolbox-tab-${activeTab.key}`}
          className="max-w-7xl mx-auto px-4 sm:px-6 py-6"
        >
          <p className="flex items-start gap-2 text-sm th-text-muted mb-5">
            <Info size={16} className="shrink-0 mt-0.5 th-text-faint" />
            {t(activeTab.hintKey)}
          </p>

          {vm.loading ? (
            <SkeletonList count={6} />
          ) : (
            <>
              {vm.activeTab === "available-tools" && (
                <AvailableToolsTab
                  toolSearch={vm.toolSearch}
                  setToolSearch={vm.setToolSearch}
                  categoryFilter={vm.categoryFilter}
                  setCategoryFilter={vm.setCategoryFilter}
                  filterOptions={vm.filterOptions}
                  sortedEntries={vm.sortedEntries}
                  configCountByCategory={vm.configCountByCategory}
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
                  totalConfigs={vm.stats.totalConfigs}
                  resolveCategory={vm.resolveConfigCategory}
                  onCreate={vm.openCreateModal}
                  onEdit={vm.openEditModal}
                  onDelete={vm.handleDeleteConfig}
                  onBrowseTools={() => vm.changeTab("available-tools")}
                />
              )}

              {vm.activeTab === "mcp-servers" && (
                <McpServersTab
                  mcpSearch={vm.mcpSearch}
                  setMcpSearch={vm.setMcpSearch}
                  filteredMcpConfigs={vm.filteredMcpConfigs}
                  totalMcp={vm.stats.totalMcp}
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
                  totalSkills={vm.stats.totalSkills}
                  exportDropdownId={vm.exportDropdownId}
                  setExportDropdownId={vm.setExportDropdownId}
                  importInputRef={importInputRef}
                  openNewSkill={vm.openNewSkill}
                  onImport={vm.handleImportSkill}
                  onEdit={vm.handleEditSkill}
                  onDelete={vm.handleDeleteSkill}
                  onExport={vm.handleExportSkill}
                />
              )}

              {vm.activeTab === "help" && <HelpPage embedded />}
            </>
          )}
        </div>
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
