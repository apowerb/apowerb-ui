"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useNodesState, useEdgesState } from "@xyflow/react";

const MAX_HISTORY = 50;

/**
 * State management for workflow nodes/edges with undo/redo.
 *
 * History is pushed automatically on:
 * - Node drag end (position changes)
 * - External layout changes (parent sets new nodes/edges)
 */
export function useWorkflowState(initialNodes = [], initialEdges = []) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // History stack for undo/redo
  const historyRef = useRef([{ nodes: initialNodes, edges: initialEdges }]);
  const historyIndexRef = useRef(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Refs to access latest state from callbacks
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [nodes, edges]);

  // Flag to skip history push during undo/redo
  const isRestoringRef = useRef(false);

  const updateUndoRedoState = useCallback(() => {
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  }, []);

  const pushHistory = useCallback(
    (newNodes, newEdges) => {
      if (isRestoringRef.current) return;

      const history = historyRef.current;
      const index = historyIndexRef.current;

      // Remove future states if we're not at the end
      const trimmed = history.slice(0, index + 1);
      trimmed.push({ nodes: newNodes, edges: newEdges });

      // Limit history size
      if (trimmed.length > MAX_HISTORY) {
        trimmed.shift();
      }

      historyRef.current = trimmed;
      historyIndexRef.current = trimmed.length - 1;
      updateUndoRedoState();
    },
    [updateUndoRedoState],
  );

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    isRestoringRef.current = true;
    historyIndexRef.current -= 1;
    const state = historyRef.current[historyIndexRef.current];
    setNodes(state.nodes);
    setEdges(state.edges);
    updateUndoRedoState();
    // Reset flag after React processes the state update
    requestAnimationFrame(() => {
      isRestoringRef.current = false;
    });
  }, [setNodes, setEdges, updateUndoRedoState]);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    isRestoringRef.current = true;
    historyIndexRef.current += 1;
    const state = historyRef.current[historyIndexRef.current];
    setNodes(state.nodes);
    setEdges(state.edges);
    updateUndoRedoState();
    requestAnimationFrame(() => {
      isRestoringRef.current = false;
    });
  }, [setNodes, setEdges, updateUndoRedoState]);

  // Wrap onNodesChange to detect drag-end and push history
  const wrappedOnNodesChange = useCallback(
    (changes) => {
      onNodesChange(changes);

      const hasDragEnd = changes.some(
        (c) => c.type === "position" && c.dragging === false,
      );
      if (hasDragEnd) {
        // Push after React processes the position update
        requestAnimationFrame(() => {
          pushHistory(nodesRef.current, edgesRef.current);
        });
      }
    },
    [onNodesChange, pushHistory],
  );

  // Keyboard shortcuts are handled by the parent (DiagramEditor)
  // to coordinate canvas-order undo with visual undo.

  return {
    nodes,
    edges,
    setNodes,
    setEdges,
    onNodesChange: wrappedOnNodesChange,
    onEdgesChange,
    pushHistory,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}
