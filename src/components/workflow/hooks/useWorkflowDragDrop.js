"use client";

import { useCallback, useRef } from "react";

/**
 * Drag-and-drop hook for adding agents from sidebar to the React Flow canvas.
 *
 * @param {function} onDrop - Callback when an agent is dropped on canvas: (agentId) => void
 * @param {function} onInsertBetween - Callback when agent dropped on edge: (agentId, sourceNodeId, targetNodeId) => void
 * @returns {{ reactFlowWrapper, onDragOver, onDropHandler, onDropOnEdge, setReactFlowInstance }}
 */
export function useWorkflowDragDrop(onDrop, onInsertBetween) {
  const reactFlowWrapper = useRef(null);
  const reactFlowInstanceRef = useRef(null);

  const setReactFlowInstance = useCallback((instance) => {
    reactFlowInstanceRef.current = instance;
  }, []);

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const onDropHandler = useCallback(
    (e) => {
      e.preventDefault();
      const agentId = e.dataTransfer.getData("agent-id");
      if (!agentId) return;

      if (onDrop) {
        onDrop(agentId);
      }
    },
    [onDrop],
  );

  // Called by AnimatedEdge when an agent is dropped on an edge
  const onDropOnEdge = useCallback(
    (agentId, sourceNodeId, targetNodeId) => {
      if (onInsertBetween) {
        onInsertBetween(agentId, sourceNodeId, targetNodeId);
      }
    },
    [onInsertBetween],
  );

  return {
    reactFlowWrapper,
    onDragOver,
    onDropHandler,
    onDropOnEdge,
    setReactFlowInstance,
  };
}
