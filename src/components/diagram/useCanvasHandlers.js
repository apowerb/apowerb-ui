"use client";

/**
 * useCanvasHandlers — drag/drop, insert, connect/disconnect, delete and
 * double-click handlers for the WorkflowCanvas.
 *
 * Keeps the circular-reference guard close to the handlers that use it so
 * the rest of the state hook stays focused on tabs/fetching.
 */

import { useCallback } from "react";
import { useToast } from "../Toast";

export function useCanvasHandlers({
  activeTab,
  activeTabId,
  boxes,
  updateCanvasOrder,
  openAgentTab,
}) {
  const toast = useToast();

  const getAgentDescendants = useCallback(
    (agentId, visited = new Set()) => {
      if (visited.has(agentId)) return visited;
      visited.add(agentId);
      const agent = boxes.find((b) => b.id === agentId);
      if (agent?.subAgents) {
        for (const subId of agent.subAgents) {
          getAgentDescendants(subId, visited);
        }
      }
      return visited;
    },
    [boxes],
  );

  const wouldCreateCircularReference = useCallback(
    (agentId) => {
      if (agentId === activeTabId) return true;
      if (activeTabId && activeTabId !== "new") {
        const descendants = getAgentDescendants(agentId);
        if (descendants.has(activeTabId)) return true;
      }
      return false;
    },
    [activeTabId, getAgentDescendants],
  );

  const handleDropFromSidebar = (agentId) => {
    if (!activeTab || activeTab.canvasOrder.includes(agentId)) return;
    if (wouldCreateCircularReference(agentId)) {
      toast.warning(
        "Cannot add this agent: it would create a circular reference",
      );
      return;
    }
    updateCanvasOrder([...activeTab.canvasOrder, agentId]);
  };

  const removeFromCanvas = (id) => {
    if (!activeTab) return;
    updateCanvasOrder(activeTab.canvasOrder.filter((cid) => cid !== id));
  };

  const handleDeleteNodes = (agentIds) => {
    if (!activeTab || !agentIds?.length) return;
    const idsToRemove = new Set(agentIds);
    updateCanvasOrder(
      activeTab.canvasOrder.filter((cid) => !idsToRemove.has(cid)),
    );
  };

  const handleInsertBetween = (agentId, sourceNodeId, _targetNodeId) => {
    if (!activeTab) return;
    if (activeTab.canvasOrder.includes(agentId)) {
      toast.warning("This agent is already on the canvas");
      return;
    }
    if (wouldCreateCircularReference(agentId)) {
      toast.warning("Cannot add: this would create a circular reference");
      return;
    }
    const order = [...activeTab.canvasOrder];
    const sourceIdx = order.indexOf(sourceNodeId);
    if (sourceIdx === -1) {
      order.push(agentId);
    } else {
      order.splice(sourceIdx + 1, 0, agentId);
    }
    updateCanvasOrder(order);
  };

  const handleInsertBefore = useCallback(
    (agentId, referenceId) => {
      if (!activeTab) return;
      if (activeTab.canvasOrder.includes(agentId)) {
        toast.warning("This agent is already on the canvas");
        return;
      }
      if (wouldCreateCircularReference(agentId)) {
        toast.warning("Cannot add: this would create a circular reference");
        return;
      }
      const order = [...activeTab.canvasOrder];
      const refIdx = order.indexOf(referenceId);
      if (refIdx === -1) {
        order.unshift(agentId);
      } else {
        order.splice(refIdx, 0, agentId);
      }
      updateCanvasOrder(order);
    },
    [activeTab, toast, updateCanvasOrder, wouldCreateCircularReference],
  );

  const handleInsertAfter = useCallback(
    (agentId, referenceId) => {
      if (!activeTab) return;
      if (activeTab.canvasOrder.includes(agentId)) {
        toast.warning("This agent is already on the canvas");
        return;
      }
      if (wouldCreateCircularReference(agentId)) {
        toast.warning("Cannot add: this would create a circular reference");
        return;
      }
      const order = [...activeTab.canvasOrder];
      const refIdx = order.indexOf(referenceId);
      if (refIdx === -1) {
        order.push(agentId);
      } else {
        order.splice(refIdx + 1, 0, agentId);
      }
      updateCanvasOrder(order);
    },
    [activeTab, toast, updateCanvasOrder, wouldCreateCircularReference],
  );

  const handleConnectNodes = (sourceId, targetId) => {
    if (!activeTab) return;
    const order = [...activeTab.canvasOrder];
    const sourceIdx = order.indexOf(sourceId);
    const targetIdx = order.indexOf(targetId);
    if (sourceIdx === -1 || targetIdx === -1) return;
    if (targetIdx === sourceIdx + 1) return;
    order.splice(targetIdx, 1);
    const newSourceIdx = order.indexOf(sourceId);
    order.splice(newSourceIdx + 1, 0, targetId);
    updateCanvasOrder(order);
  };

  const handleDisconnectNodes = (_sourceId, targetId) => {
    if (!activeTab) return;
    const order = [...activeTab.canvasOrder];
    const targetIdx = order.indexOf(targetId);
    if (targetIdx === -1) return;
    order.splice(targetIdx, 1);
    order.push(targetId);
    updateCanvasOrder(order);
  };

  const handleDoubleClickAgent = (agentId) => {
    const agent = boxes.find((b) => b.id === agentId);
    if (agent && ["Sequential", "Parallel", "Loop"].includes(agent.category)) {
      openAgentTab(agentId);
    }
  };

  return {
    handleDropFromSidebar,
    removeFromCanvas,
    handleDeleteNodes,
    handleInsertBetween,
    handleInsertBefore,
    handleInsertAfter,
    handleConnectNodes,
    handleDisconnectNodes,
    handleDoubleClickAgent,
  };
}
