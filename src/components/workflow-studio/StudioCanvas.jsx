"use client";

import { useCallback, useEffect, useRef } from "react";
import { ReactFlow, Background, Controls, MiniMap, ReactFlowProvider, useReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Undo2, Redo2, LayoutGrid, Workflow as WorkflowIcon } from "lucide-react";
import { useTranslations } from "use-intl";
import { studioNodeTypes } from "./nodes";
import RouteEdge from "./edges/RouteEdge";
import { NODE_BOX } from "@/lib/workflowGraph";

const nodeTypes = studioNodeTypes;
const edgeTypes = { route: RouteEdge };

const MINIMAP_COLORS = {
  trigger: "#f59e0b",
  agent: "var(--color-brand)",
  classifier: "#8b5cf6",
  tool: "#10b981",
  router: "#3b82f6",
  merge: "#3b82f6",
  loop: "#8b5cf6",
  approval: "#8b5cf6",
};

function Toolbar({ canUndo, canRedo, onUndo, onRedo, onAutoLayout }) {
  const t = useTranslations("WorkflowCanvas");
  const { fitView } = useReactFlow();
  return (
    <div className="absolute top-3 left-3 z-10 flex items-center gap-1 p-1 rounded-xl th-bg-elevated border th-border-secondary shadow-lg backdrop-blur-xl">
      <button type="button" disabled={!canUndo} onClick={onUndo} title={t("undo")} className="p-1.5 rounded-lg th-text-secondary hover:th-text hover:th-bg-surface-hover disabled:opacity-30 disabled:hover:bg-transparent">
        <Undo2 size={15} />
      </button>
      <button type="button" disabled={!canRedo} onClick={onRedo} title={t("redo")} className="p-1.5 rounded-lg th-text-secondary hover:th-text hover:th-bg-surface-hover disabled:opacity-30 disabled:hover:bg-transparent">
        <Redo2 size={15} />
      </button>
      <div className="w-px h-4 th-bg-surface mx-0.5" />
      <button type="button" onClick={onAutoLayout} title={t("autoLayout")} className="p-1.5 rounded-lg th-text-secondary hover:th-text hover:th-bg-surface-hover">
        <LayoutGrid size={15} />
      </button>
      <button type="button" onClick={() => fitView({ padding: 0.2, duration: 200, maxZoom: 1 })} title={t("fitView")} className="p-1.5 rounded-lg th-text-secondary hover:th-text hover:th-bg-surface-hover">
        <WorkflowIcon size={15} />
      </button>
    </div>
  );
}

function EmptyState() {
  const t = useTranslations("WorkflowCanvas");
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="text-center max-w-xs px-6">
        <p className="text-sm font-semibold th-text-secondary mb-1">{t("emptyTitle")}</p>
        <p className="text-xs th-text-ghost">{t("emptyBody")}</p>
      </div>
    </div>
  );
}

function StudioCanvasInner({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  isValidConnection,
  onNodeClick,
  onEdgeClick,
  onPaneClick,
  onNodesDelete,
  onEdgesDelete,
  onDropNodeType,
  onDuplicateSelected,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onAutoLayout,
  focusRequest,
}) {
  const wrapperRef = useRef(null);
  const { screenToFlowPosition, setCenter, getZoom } = useReactFlow();

  // Un nœud ajouté depuis la palette peut tomber hors du cadre : on y amène la vue.
  useEffect(() => {
    if (!focusRequest) return;
    setCenter(focusRequest.x + NODE_BOX.width / 2, focusRequest.y + NODE_BOX.height / 2, {
      zoom: getZoom(),
      duration: 250,
    });
  }, [focusRequest, setCenter, getZoom]);

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      const type = e.dataTransfer.getData("application/workflow-node-type");
      if (!type) return;
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      onDropNodeType?.(type, position);
    },
    [screenToFlowPosition, onDropNodeType],
  );

  const onKeyDown = useCallback(
    (e) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) onRedo?.();
        else onUndo?.();
      } else if (meta && e.key.toLowerCase() === "d") {
        e.preventDefault();
        onDuplicateSelected?.();
      }
    },
    [onUndo, onRedo, onDuplicateSelected],
  );

  return (
    <div
      ref={wrapperRef}
      className="relative w-full h-full"
      onDragOver={onDragOver}
      onDrop={onDrop}
      onKeyDown={onKeyDown}
      tabIndex={0}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={(_e, node) => onNodeClick?.(node)}
        onEdgeClick={(_e, edge) => onEdgeClick?.(edge)}
        onPaneClick={onPaneClick}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        deleteKeyCode={["Backspace", "Delete"]}
        multiSelectionKeyCode="Shift"
        selectionKeyCode="Shift"
        fitView
        fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
        minZoom={0.2}
        maxZoom={2}
        defaultEdgeOptions={{ type: "route", deletable: true }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="rgba(255,255,255,0.06)" gap={20} size={1} />
        <Controls showInteractive={false} className="react-flow__controls" />
        <MiniMap
          nodeColor={(node) => MINIMAP_COLORS[node.type] || "#6b7280"}
          maskColor="rgba(0,0,0,0.6)"
          className="react-flow__minimap"
        />
      </ReactFlow>
      <Toolbar canUndo={canUndo} canRedo={canRedo} onUndo={onUndo} onRedo={onRedo} onAutoLayout={onAutoLayout} />
      {nodes.length === 0 && <EmptyState />}
    </div>
  );
}

/** Wraps the inner canvas with its own ReactFlowProvider so fitView/screenToFlowPosition work — needed both on the main studio canvas and inside the loop body editor's nested one. */
export default function StudioCanvas(props) {
  return (
    <ReactFlowProvider>
      <StudioCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
