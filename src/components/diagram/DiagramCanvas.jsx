"use client";

/**
 * DiagramCanvas — thin wrapper around WorkflowCanvas + WorkflowPanel.
 *
 * Centralises the canvas layout (flex-1 scroll area + pinned bottom panel)
 * and forwards interaction handlers from the hook.
 */

import WorkflowCanvas from "../workflow/WorkflowCanvas";
import WorkflowPanel from "../WorkflowPanel";

export default function DiagramCanvas({
  boxes,
  activeTab,
  workflowState,
  workflowFile,
  setWorkflowFile,
  onOpenAgent,
  onRemoveFromCanvas,
  onDeleteNodes,
  onDropFromSidebar,
  onInsertBetween,
  onInsertBefore,
  onInsertAfter,
  onConnectNodes,
  onDisconnectNodes,
  onRun,
  onStop,
}) {
  const canvasAgentIds = activeTab ? activeTab.canvasOrder : [];
  const canvasEmpty = !activeTab || activeTab.canvasOrder.length === 0;

  return (
    <>
      <div className="flex-1 overflow-auto">
        <WorkflowCanvas
          agents={boxes}
          canvasAgentIds={canvasAgentIds}
          workflowSteps={workflowState.steps}
          workflowFile={workflowFile}
          dynamicIterations={workflowState.dynamicIterations || {}}
          onNodeClick={(agentId) => onOpenAgent(agentId)}
          onNodeDoubleClick={(agentId) => onOpenAgent(agentId)}
          onRemoveNode={(agentId) => onRemoveFromCanvas(agentId)}
          onDeleteNodes={onDeleteNodes}
          onDrop={(agentId) => onDropFromSidebar(agentId)}
          onInsertBetween={onInsertBetween}
          onInsertBefore={onInsertBefore}
          onInsertAfter={onInsertAfter}
          onConnectNodes={onConnectNodes}
          onDisconnectNodes={onDisconnectNodes}
          allAgents={boxes}
        />
      </div>

      <WorkflowPanel
        workflowState={workflowState}
        onRun={onRun}
        onStop={onStop}
        canvasEmpty={canvasEmpty}
        workflowFile={workflowFile}
        onFileChange={setWorkflowFile}
        requiresFile={false}
      />
    </>
  );
}
