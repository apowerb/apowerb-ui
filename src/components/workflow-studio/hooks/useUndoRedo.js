"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useNodesState, useEdgesState } from "@xyflow/react";

const MAX_HISTORY = 50;

/**
 * xyflow nodes/edges state with undo/redo — the Studio's equivalent of
 * src/components/workflow/hooks/useWorkflowState.js, generalised so the
 * main canvas and the loop body editor's nested canvas can each own an
 * independent history instead of sharing one hook instance.
 *
 * A history entry is pushed on drag-end, on connect/disconnect, and
 * whenever the caller replaces the graph wholesale (e.g. loading a
 * workflow, restoring a revision) via `resetHistory`.
 */
export function useUndoRedo(initialNodes = [], initialEdges = []) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const historyRef = useRef([{ nodes: initialNodes, edges: initialEdges }]);
  const indexRef = useRef(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [nodes, edges]);

  const isRestoringRef = useRef(false);

  const syncFlags = useCallback(() => {
    setCanUndo(indexRef.current > 0);
    setCanRedo(indexRef.current < historyRef.current.length - 1);
  }, []);

  const pushHistory = useCallback(
    (nextNodes, nextEdges) => {
      if (isRestoringRef.current) return;
      const trimmed = historyRef.current.slice(0, indexRef.current + 1);
      trimmed.push({ nodes: nextNodes, edges: nextEdges });
      if (trimmed.length > MAX_HISTORY) trimmed.shift();
      historyRef.current = trimmed;
      indexRef.current = trimmed.length - 1;
      syncFlags();
    },
    [syncFlags],
  );

  /** Replace the whole graph and reset history to a single entry — used on load/restore, never as an undo step. */
  const resetHistory = useCallback(
    (nextNodes, nextEdges) => {
      setNodes(nextNodes);
      setEdges(nextEdges);
      historyRef.current = [{ nodes: nextNodes, edges: nextEdges }];
      indexRef.current = 0;
      syncFlags();
    },
    [setNodes, setEdges, syncFlags],
  );

  const undo = useCallback(() => {
    if (indexRef.current <= 0) return;
    isRestoringRef.current = true;
    indexRef.current -= 1;
    const state = historyRef.current[indexRef.current];
    setNodes(state.nodes);
    setEdges(state.edges);
    syncFlags();
    requestAnimationFrame(() => {
      isRestoringRef.current = false;
    });
  }, [setNodes, setEdges, syncFlags]);

  const redo = useCallback(() => {
    if (indexRef.current >= historyRef.current.length - 1) return;
    isRestoringRef.current = true;
    indexRef.current += 1;
    const state = historyRef.current[indexRef.current];
    setNodes(state.nodes);
    setEdges(state.edges);
    syncFlags();
    requestAnimationFrame(() => {
      isRestoringRef.current = false;
    });
  }, [setNodes, setEdges, syncFlags]);

  const wrappedOnNodesChange = useCallback(
    (changes) => {
      onNodesChange(changes);
      const dragEnd = changes.some((c) => c.type === "position" && c.dragging === false);
      const removed = changes.some((c) => c.type === "remove");
      if (dragEnd || removed) {
        requestAnimationFrame(() => pushHistory(nodesRef.current, edgesRef.current));
      }
    },
    [onNodesChange, pushHistory],
  );

  const wrappedOnEdgesChange = useCallback(
    (changes) => {
      onEdgesChange(changes);
      const removed = changes.some((c) => c.type === "remove");
      if (removed) {
        requestAnimationFrame(() => pushHistory(nodesRef.current, edgesRef.current));
      }
    },
    [onEdgesChange, pushHistory],
  );

  return {
    nodes,
    edges,
    setNodes,
    setEdges,
    onNodesChange: wrappedOnNodesChange,
    onEdgesChange: wrappedOnEdgesChange,
    pushHistory,
    resetHistory,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}
