"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { addEdge } from "@xyflow/react";
import { X, AlertTriangle } from "lucide-react";
import { useTranslations } from "use-intl";
import StudioPalette from "./StudioPalette";
import StudioCanvas from "./StudioCanvas";
import StudioInspector from "./StudioInspector";
import { useUndoRedo } from "./hooks/useUndoRedo";
import {
  graphToFlow,
  flowToGraph,
  findFreePosition,
  createNode,
  duplicateNode,
  autoLayout,
  nextNodeId,
} from "@/lib/workflowGraph";

const HIDDEN_TYPES = new Set(["loop", "approval"]);

/**
 * Full-screen modal editing a loop node's `config.body` sub-graph. Reuses
 * the same canvas/palette/inspector as the main studio — a loop body is
 * just another {version,nodes,edges} graph — minus `loop`/`approval` in the
 * palette, so a body can't nest another loop in this pass (see the
 * project's `loopUncappedNesting` note: nesting is legal per spec but
 * building a fully recursive editor wasn't worth it this round).
 */
export default function LoopBodyEditor({ loopNode, body, onChange, onClose, agentOptions, toolOptions, toolSchemas = {}, ensureToolSchema = () => {} }) {
  const t = useTranslations("LoopBodyEditor");
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => graphToFlow(body), [body]);
  const {
    nodes, edges, setNodes, setEdges, onNodesChange, onEdgesChange,
    pushHistory, undo, redo, canUndo, canRedo,
  } = useUndoRedo(initialNodes, initialEdges);

  const [selection, setSelection] = useState(null);

  // Same prefetch as the main studio (see WorkflowStudio.jsx): a tool node
  // already inside this body, or one the user just configured here, gets
  // its schema fetched through the cache shared with the outer canvas.
  const toolRefsInUse = useMemo(
    () => [...new Set(nodes.filter((n) => n.type === "tool" && n.data?.config?.tool).map((n) => n.data.config.tool))],
    [nodes],
  );
  useEffect(() => {
    for (const toolRef of toolRefsInUse) ensureToolSchema(toolRef);
  }, [toolRefsInUse, ensureToolSchema]);

  // Push every change up as a graph — the parent studio treats this like any
  // other config edit, so the outer autosave picks it up without a second
  // save button in here.
  useEffect(() => {
    onChange(flowToGraph(nodes, edges));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  const existingIds = useCallback(() => nodes.map((n) => n.id), [nodes]);

  const addNodeAt = useCallback(
    (type, position) => {
      const graphNode = createNode(type, { position, existingIds: existingIds() });
      const flowNode = graphToFlow({ nodes: [graphNode], edges: [] }).nodes[0];
      const next = [...nodes, flowNode];
      setNodes(next);
      pushHistory(next, edges);
      setSelection({ kind: "node", node: flowNode });
    },
    [nodes, edges, setNodes, pushHistory, existingIds],
  );

  const [focusRequest, setFocusRequest] = useState(null);

  const addNodeCentered = useCallback(
    (type) => {
      const position = findFreePosition(nodes, selection?.kind === "node" ? selection.node.id : undefined);
      addNodeAt(type, position);
      setFocusRequest({ ...position, seq: Date.now() });
    },
    [addNodeAt, nodes, selection],
  );

  const onConnect = useCallback(
    (connection) => {
      const nextEdges = addEdge({ ...connection, type: "route", data: { route: null } }, edges);
      setEdges(nextEdges);
      pushHistory(nodes, nextEdges);
    },
    [edges, nodes, setEdges, pushHistory],
  );

  const patchNodeConfig = useCallback(
    (nodeId, partial) => {
      const next = nodes.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, config: { ...n.data.config, ...partial } } } : n));
      setNodes(next);
      setSelection((sel) => (sel?.kind === "node" && sel.node.id === nodeId ? { kind: "node", node: next.find((n) => n.id === nodeId) } : sel));
    },
    [nodes, setNodes],
  );

  const changeLabel = useCallback(
    (nodeId, label) => {
      const next = nodes.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, label } } : n));
      setNodes(next);
      setSelection((sel) => (sel?.kind === "node" && sel.node.id === nodeId ? { kind: "node", node: next.find((n) => n.id === nodeId) } : sel));
    },
    [nodes, setNodes],
  );

  const deleteNode = useCallback(
    (nodeId) => {
      const nextNodes = nodes.filter((n) => n.id !== nodeId);
      const nextEdges = edges.filter((e) => e.source !== nodeId && e.target !== nodeId);
      setNodes(nextNodes);
      setEdges(nextEdges);
      pushHistory(nextNodes, nextEdges);
      setSelection(null);
    },
    [nodes, edges, setNodes, setEdges, pushHistory],
  );

  const changeEdgeRoute = useCallback(
    (edgeId, route) => {
      const next = edges.map((e) => (e.id === edgeId ? { ...e, data: { ...e.data, route: route || null } } : e));
      setEdges(next);
      setSelection((sel) => (sel?.kind === "edge" && sel.edge.id === edgeId ? { kind: "edge", edge: next.find((e) => e.id === edgeId) } : sel));
    },
    [edges, setEdges],
  );

  const deleteEdge = useCallback(
    (edgeId) => {
      const next = edges.filter((e) => e.id !== edgeId);
      setEdges(next);
      pushHistory(nodes, next);
      setSelection(null);
    },
    [edges, nodes, setEdges, pushHistory],
  );

  const duplicateSelected = useCallback(() => {
    if (selection?.kind !== "node") return;
    const copy = duplicateNode({ id: selection.node.id, type: selection.node.type, config: selection.node.data.config, position: selection.node.position, label: selection.node.data.label }, existingIds());
    const flowNode = graphToFlow({ nodes: [copy], edges: [] }).nodes[0];
    const next = [...nodes, flowNode];
    setNodes(next);
    pushHistory(next, edges);
  }, [selection, nodes, edges, setNodes, pushHistory, existingIds]);

  const handleAutoLayout = useCallback(() => {
    const laidOut = autoLayout(nodes, edges);
    setNodes(laidOut);
    pushHistory(laidOut, edges);
  }, [nodes, edges, setNodes, pushHistory]);

  const triggerCount = nodes.filter((n) => n.type === "trigger").length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col th-bg-body" role="dialog" aria-modal="true">
      <div className="h-14 px-4 flex items-center gap-3 border-b th-border-secondary th-bg-sidebar shrink-0">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold th-text truncate">{t("title", { label: loopNode?.data?.label || loopNode?.id })}</h3>
          <p className="text-[11px] th-text-ghost truncate">{t("subtitle")}</p>
        </div>
        {triggerCount !== 1 && (
          <span className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium bg-amber-500/15 text-amber-300 shrink-0">
            <AlertTriangle size={12} />
            {t("triggerCountWarning", { count: triggerCount })}
          </span>
        )}
        <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-linear-to-r from-brand to-brand-secondary text-white hover:opacity-90 shrink-0">
          {t("close")}
        </button>
      </div>
      <div className="relative flex-1 min-h-0 flex">
        <StudioPalette onAdd={addNodeCentered} hiddenTypes={HIDDEN_TYPES} />
        <div className="flex-1 min-w-0">
          <StudioCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(node) => setSelection({ kind: "node", node })}
            onEdgeClick={(edge) => setSelection({ kind: "edge", edge })}
            onPaneClick={() => setSelection(null)}
            onNodesDelete={(deleted) => {
              const ids = new Set(deleted.map((n) => n.id));
              pushHistory(nodes.filter((n) => !ids.has(n.id)), edges.filter((e) => !ids.has(e.source) && !ids.has(e.target)));
              setSelection(null);
            }}
            onEdgesDelete={(deleted) => {
              const ids = new Set(deleted.map((e) => e.id));
              pushHistory(nodes, edges.filter((e) => !ids.has(e.id)));
            }}
            onDropNodeType={addNodeAt}
              focusRequest={focusRequest}
            onDuplicateSelected={duplicateSelected}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
            onAutoLayout={handleAutoLayout}
          />
        </div>
        <StudioInspector
          selection={selection}
          nodes={nodes}
          edges={edges}
          agentOptions={agentOptions}
          toolOptions={toolOptions}
          toolSchemas={toolSchemas}
          ensureToolSchema={ensureToolSchema}
          onChangeLabel={changeLabel}
          onPatchConfig={patchNodeConfig}
          onChangeEdgeRoute={changeEdgeRoute}
          onDeleteNode={deleteNode}
          onDeleteEdge={deleteEdge}
          onOpenLoopBody={() => {}}
        />
      </div>
    </div>
  );
}
