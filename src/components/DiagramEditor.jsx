"use client";

/**
 * DiagramEditor — top-level orchestrator for the agent diagram view.
 *
 * Previously a ~2000-line monolith; now a thin shell that composes the
 * stateful hook (`useDiagramState`) with the display pieces
 * (`DiagramToolbar`, `DiagramHeaderPanel`, `DiagramCanvas`) and the modals.
 *
 * See `src/components/diagram/` for sub-modules.
 */

import { Suspense } from "react";
import { useTranslations } from "use-intl";
import { Loader2, Plus, Upload, X } from "lucide-react";
import AgentSidebar from "./AgentSidebar";
import AgentDetailsModal from "./AgentDetailsModal";
import ConnectSnippetModal from "./ConnectSnippetModal";
import AgentModal from "./AgentModal";
import ProspectOnboardingModal from "./ProspectOnboardingModal";
import ConfirmToast from "./ConfirmToast";
import { useDiagramState } from "./diagram/useDiagramState";
import DiagramToolbar from "./diagram/DiagramToolbar";
import DiagramHeaderPanel from "./diagram/DiagramHeaderPanel";
import DiagramCanvas from "./diagram/DiagramCanvas";
import { categoryColors } from "./diagram/diagramUtils";
import { useToast } from "./Toast";

function DiagramEditorContent() {
  const t = useTranslations("DiagramEditor");
  const toast = useToast();
  const {
    // Query params
    selectParam,
    activeFilter,

    // Loading + boxes
    loading,
    boxes,
    availableTools,
    toolConfigs,
    mcpConfigs,

    // Tabs
    tabs,
    activeTab,
    activeTabId,
    setActiveTabId,
    updateAgentData,
    openAgentTab,
    createNewTab,
    closeTab,

    // Header
    expandedHeader,
    setExpandedHeader,
    showApiKey,
    setShowApiKey,

    // Save
    isSaving,
    handleSave,

    // Canvas
    handleDropFromSidebar,
    removeFromCanvas,
    handleDeleteNodes,
    handleInsertBetween,
    handleInsertBefore,
    handleInsertAfter,
    handleConnectNodes,
    handleDisconnectNodes,

    // Modals
    showDetailsModal,
    viewingAgent,
    openDetailsModal,
    closeDetailsModal,
    deleteConfirm,
    requestDelete,
    confirmDelete,
    cancelDelete,
    connectAgent,
    setConnectAgent,

    // Publish
    publishAgent,
    openPublishModal,
    closePublishModal,
    publishForm,
    setPublishForm,
    publishing,
    handlePublish,

    // Create / Edit modal
    showCreateModal,
    newAgent,
    setNewAgent,
    editingAgentId,
    openCreateModal,
    closeCreateModal,
    openEditModal,
    handleCreateFromModal,
    handleEditFromModal,

    // Workflow
    workflowState,
    workflowFile,
    setWorkflowFile,
    handleRunWorkflow,
    handleStopWorkflow,

    // Data
    fetchData,
  } = useDiagramState();

  if (loading) {
    return (
      <div className="min-h-screen th-bg-body flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center animate-pulse-glow">
            <Loader2 size={24} className="text-purple-400 animate-spin" />
          </div>
          <p className="th-text-muted text-sm font-medium">{t("loadingAgents")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 w-full th-bg-body p-4 animate-fade-in flex flex-col overflow-hidden">
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left: Agent Sidebar */}
        <AgentSidebar
          agents={boxes}
          canvasOrder={activeTab?.canvasOrder || []}
          categoryColors={categoryColors}
          toolConfigs={toolConfigs}
          selectedAgentId={selectParam || null}
          activeFilter={activeFilter}
          onAddAgent={openCreateModal}
          onViewDetails={openDetailsModal}
          onEdit={(box) => openEditModal(box)}
          onDoubleClick={(box) => openAgentTab(box.id)}
          onRemove={requestDelete}
          onConnect={setConnectAgent}
          onPublish={openPublishModal}
        />

        {/* Right: Tabs + Header + Canvas */}
        <div className="flex-1 flex flex-col glass rounded-2xl overflow-hidden h-full">
          {/* Tab Bar */}
          <div className="th-bg-surface border-b th-border-secondary flex items-center px-2 shrink-0">
            <div className="flex-1 flex items-center overflow-x-auto">
              {tabs.map((tab) => (
                <div
                  key={tab.id}
                  className={`flex items-center gap-2 px-4 py-2.5 cursor-pointer border-b-2 transition-all duration-200 ${
                    activeTabId === tab.id
                      ? "border-brand th-bg-elevated th-text font-semibold"
                      : "border-transparent th-text-faint hover:th-text-secondary hover:th-bg-surface"
                  }`}
                  onClick={() => setActiveTabId(tab.id)}
                >
                  <span className="truncate max-w-37.5">
                    {tab.agentData.agent_name || t("newAgent")}
                    {tab.isDirty && " •"}
                  </span>
                  {tabs.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(tab.id);
                      }}
                      className="p-1 hover:th-bg-surface-hover rounded-lg transition-colors"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={createNewTab}
              className="p-2 th-text-ghost hover:th-text hover:th-bg-surface-hover rounded-lg transition-all"
              title={t("newAgent")}
            >
              <Plus size={18} />
            </button>
          </div>

          {/* Agent Header */}
          {activeTab && (
            <div className="th-bg-surface border-b th-border-secondary shrink-0">
              <DiagramToolbar
                agentData={activeTab.agentData}
                updateAgentData={updateAgentData}
                onSave={handleSave}
                isSaving={isSaving}
                isNewTab={activeTab.isNew}
                expandedHeader={expandedHeader}
                setExpandedHeader={setExpandedHeader}
              />
              {expandedHeader && (
                <DiagramHeaderPanel
                  agentData={activeTab.agentData}
                  updateAgentData={updateAgentData}
                  canvasOrderLength={activeTab.canvasOrder?.length || 0}
                  showApiKey={showApiKey}
                  setShowApiKey={setShowApiKey}
                  toolConfigs={toolConfigs}
                />
              )}
            </div>
          )}

          {/* Canvas + Workflow Panel */}
          <DiagramCanvas
            boxes={boxes}
            activeTab={activeTab}
            workflowState={workflowState}
            workflowFile={workflowFile}
            setWorkflowFile={setWorkflowFile}
            onOpenAgent={openAgentTab}
            onRemoveFromCanvas={removeFromCanvas}
            onDeleteNodes={handleDeleteNodes}
            onDropFromSidebar={handleDropFromSidebar}
            onInsertBetween={handleInsertBetween}
            onInsertBefore={handleInsertBefore}
            onInsertAfter={handleInsertAfter}
            onConnectNodes={handleConnectNodes}
            onDisconnectNodes={handleDisconnectNodes}
            onRun={handleRunWorkflow}
            onStop={handleStopWorkflow}
          />
        </div>
      </div>

      {/* Details Modal */}
      {showDetailsModal && viewingAgent && (
        <AgentDetailsModal
          agent={viewingAgent}
          boxes={boxes}
          onClose={closeDetailsModal}
          onViewSubAgent={(subId) => {
            closeDetailsModal();
            openAgentTab(subId);
          }}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <ConfirmToast
          message={t("deleteConfirmMessage", { label: deleteConfirm.label })}
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        />
      )}

      {/* Create Agent Modal */}
      <AgentModal
        show={showCreateModal}
        editingAgent={editingAgentId}
        newAgent={newAgent}
        setNewAgent={setNewAgent}
        boxes={boxes}
        categories={["Base", "Sequential", "Parallel", "Loop", "Router"]}
        availableTools={availableTools}
        toolConfigs={toolConfigs}
        mcpConfigs={mcpConfigs}
        onClose={closeCreateModal}
        onSave={editingAgentId ? handleEditFromModal : handleCreateFromModal}
        onToast={toast.warning}
        onRefreshTools={fetchData}
      />

      {/* th2prospect onboarding (etape 0) — auto-contenu, ecoute l'event creation */}
      <ProspectOnboardingModal />

      {/* Connect Snippet Modal */}
      <ConnectSnippetModal
        show={!!connectAgent}
        agent={connectAgent}
        onClose={() => setConnectAgent(null)}
      />

      {/* Publish to Hub Modal */}
      {publishAgent && (
        <div className="fixed inset-0 th-bg-overlay backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass-modal rounded-2xl w-full max-w-md shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b th-border">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20 border border-blue-500/30">
                  <Upload size={18} className="text-blue-400" />
                </div>
                <h2 className="th-text font-semibold">{t("publishToHubTitle")}</h2>
              </div>
              <button
                onClick={closePublishModal}
                className="p-1.5 rounded-lg th-text-faint hover:th-text hover:th-bg-surface-hover transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            {/* Form */}
            <div className="p-5 space-y-4">
              <div>
                <label className="block th-text-muted text-xs font-medium mb-1.5">
                  {t("nameInHubLabel")}
                </label>
                <input
                  type="text"
                  value={publishForm.hub_name}
                  onChange={(e) =>
                    setPublishForm((p) => ({ ...p, hub_name: e.target.value }))
                  }
                  className="glass-input w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
                  placeholder={t("agentNameInHubPlaceholder")}
                />
              </div>
              <div>
                <label className="block th-text-muted text-xs font-medium mb-1.5">
                  {t("descriptionLabel")}
                </label>
                <textarea
                  value={publishForm.hub_description}
                  onChange={(e) =>
                    setPublishForm((p) => ({
                      ...p,
                      hub_description: e.target.value,
                    }))
                  }
                  rows={3}
                  className="glass-input w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500/50 transition-colors resize-none"
                  placeholder={t("describeAgentPlaceholder")}
                />
              </div>
              <div>
                <label className="block th-text-muted text-xs font-medium mb-1.5">
                  {t("tagsLabel")}
                </label>
                <input
                  type="text"
                  value={publishForm.hub_tags}
                  onChange={(e) =>
                    setPublishForm((p) => ({ ...p, hub_tags: e.target.value }))
                  }
                  className="glass-input w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
                  placeholder={t("tagsPlaceholder")}
                />
              </div>
            </div>
            {/* Footer */}
            <div className="flex justify-end gap-3 p-5 border-t th-border-secondary">
              <button
                onClick={closePublishModal}
                className="px-4 py-2 rounded-lg th-text-muted text-sm hover:th-bg-surface transition-colors"
              >
                {t("cancelAction")}
              </button>
              <button
                onClick={handlePublish}
                disabled={publishing || !publishForm.hub_name}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/20 text-blue-400 text-sm font-medium border border-blue-500/30 hover:bg-blue-500/30 transition-colors disabled:opacity-50"
              >
                {publishing ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    {t("publishingEllipsis")}
                  </>
                ) : (
                  <>
                    <Upload size={14} />
                    {t("publishAction")}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DiagramEditor() {
  return (
    <Suspense fallback={null}>
      <DiagramEditorContent />
    </Suspense>
  );
}
