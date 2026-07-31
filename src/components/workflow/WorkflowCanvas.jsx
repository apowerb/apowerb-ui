"use client";

import { useCallback, useMemo, useEffect, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import BaseNode from "./nodes/BaseNode";
import ParallelNode from "./nodes/ParallelNode";
import SequentialNode from "./nodes/SequentialNode";
import LoopNode from "./nodes/LoopNode";
import RouterNode from "./nodes/RouterNode";
import AnimatedEdge from "./edges/AnimatedEdge";
import ContextMenu from "./ContextMenu";
import AgentPickerPopover from "./AgentPickerPopover";
import NodeInfoPanel from "./NodeInfoPanel";
import { useWorkflowState } from "./hooks/useWorkflowState";
import { useWorkflowDragDrop } from "./hooks/useWorkflowDragDrop";
import { agentToNode, generateEdges } from "./utils/agentToNode";
import { applyDagreLayout } from "./utils/layoutEngine";

const nodeTypes = {
  baseNode: BaseNode,
  parallelNode: ParallelNode,
  sequentialNode: SequentialNode,
  loopNode: LoopNode,
  routerNode: RouterNode,
};

const edgeTypes = {
  animatedEdge: AnimatedEdge,
};

/**
 * WorkflowCanvas - React Flow based interactive canvas for agent workflows.
 *
 * Supports: select, delete, connect, disconnect, drag-drop insert, context menu.
 */
export default function WorkflowCanvas({
  agents = [],
  canvasAgentIds = [],
  workflowSteps = [],
  onNodeClick,
  onNodeDoubleClick,
  onRemoveNode,
  onDeleteNodes,
  onDrop,
  onInsertBetween,
  onInsertBefore,
  onInsertAfter,
  onConnectNodes,
  onDisconnectNodes,
  allAgents: allAgentsProp,
}) {
  const agentsArray = useMemo(
    () => (Array.isArray(agents) ? agents : []),
    [agents],
  );

  // All agents (for the picker — includes agents not on canvas)
  const allAgentsArray = useMemo(
    () => (Array.isArray(allAgentsProp) ? allAgentsProp : agentsArray),
    [allAgentsProp, agentsArray],
  );

  // Selected node tracking
  const [selectedNodeId, setSelectedNodeId] = useState(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    agentId: null,
    agentLabel: null,
    agentCategory: null,
  });

  // Agent picker popover state (for insert before/after/between)
  const [insertPicker, setInsertPicker] = useState({
    visible: false,
    x: 0,
    y: 0,
    mode: null, // 'before' | 'after' | 'between'
    referenceId: null,
  });

  // Resolve agent name from ID
  const resolveAgentName = useCallback(
    (agentId) => {
      const agent = agentsArray.find((a) => a.id === agentId);
      return agent?.label || agentId;
    },
    [agentsArray],
  );

  // Callback for edge drops
  const handleDropOnEdge = useCallback(
    (agentId, sourceNodeId, targetNodeId) => {
      onInsertBetween?.(agentId, sourceNodeId, targetNodeId);
    },
    [onInsertBetween],
  );

  // Callback for "+" button on edges — opens picker in "between" mode
  const handleInsertBetweenFromEdge = useCallback(
    (sourceId, position) => {
      setInsertPicker({
        visible: true,
        x: position.x,
        y: position.y,
        mode: "between",
        referenceId: sourceId,
      });
    },
    [],
  );

  // Context menu "Insert before" — opens picker
  const handleContextInsertBefore = useCallback(
    (referenceId) => {
      setInsertPicker({
        visible: true,
        x: contextMenu.x,
        y: contextMenu.y,
        mode: "before",
        referenceId,
      });
    },
    [contextMenu.x, contextMenu.y],
  );

  // Context menu "Insert after" — opens picker
  const handleContextInsertAfter = useCallback(
    (referenceId) => {
      setInsertPicker({
        visible: true,
        x: contextMenu.x,
        y: contextMenu.y,
        mode: "after",
        referenceId,
      });
    },
    [contextMenu.x, contextMenu.y],
  );

  // Picker selection handler
  const handlePickerSelect = useCallback(
    (agentId) => {
      if (insertPicker.mode === "before") {
        onInsertBefore?.(agentId, insertPicker.referenceId);
      } else if (insertPicker.mode === "after") {
        onInsertAfter?.(agentId, insertPicker.referenceId);
      } else if (insertPicker.mode === "between") {
        onInsertAfter?.(agentId, insertPicker.referenceId);
      }
      setInsertPicker({ visible: false, x: 0, y: 0, mode: null, referenceId: null });
    },
    [insertPicker, onInsertBefore, onInsertAfter],
  );

  const closeInsertPicker = useCallback(() => {
    setInsertPicker({ visible: false, x: 0, y: 0, mode: null, referenceId: null });
  }, []);

  // Build nodes and edges
  const { initialNodes, initialEdges } = useMemo(() => {
    const canvasAgents = canvasAgentIds
      .map((id) => agentsArray.find((a) => a.id === id))
      .filter(Boolean);

    const collectSubAgentNodes = (agents, allAgents, visited = new Set()) => {
      const subNodes = [];
      for (const agent of agents) {
        if (!agent.subAgents || agent.subAgents.length === 0) continue;
        for (const subId of agent.subAgents) {
          if (visited.has(subId)) continue;
          visited.add(subId);
          const subAgent = allAgents.find((a) => a.id === subId);
          if (subAgent) {
            subNodes.push(agentToNode(subAgent, { workflowSteps, allAgents: agentsArray }));
            subNodes.push(
              ...collectSubAgentNodes([subAgent], allAgents, visited),
            );
          }
        }
      }
      return subNodes;
    };

    const rawNodes = canvasAgents.map((agent) =>
      agentToNode(agent, { workflowSteps, allAgents: agentsArray }),
    );

    const subNodes = collectSubAgentNodes(
      canvasAgents,
      agentsArray,
      new Set(canvasAgentIds),
    );
    rawNodes.push(...subNodes);

    // Compute connected node IDs for dimming
    const connectedIds = new Set();
    if (selectedNodeId) {
      connectedIds.add(selectedNodeId);
      const selectedAgent = agentsArray.find((a) => a.id === selectedNodeId);
      if (selectedAgent?.subAgents) {
        selectedAgent.subAgents.forEach((id) => connectedIds.add(id));
      }
      const idx = canvasAgentIds.indexOf(selectedNodeId);
      if (idx > 0) connectedIds.add(canvasAgentIds[idx - 1]);
      if (idx < canvasAgentIds.length - 1) connectedIds.add(canvasAgentIds[idx + 1]);
    }

    // Inject dimmed + onDelete into node data
    const enrichedNodes = rawNodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        dimmed: selectedNodeId ? !connectedIds.has(node.id) : false,
        onDelete: canvasAgentIds.includes(node.id)
          ? () => onRemoveNode?.(node.id)
          : undefined,
      },
    }));

    const rawEdges = generateEdges(canvasAgentIds, agentsArray, workflowSteps);

    // Inject onDropOnEdge + onInsertBetween into edge data + make edges selectable/deletable/reconnectable
    const enrichedEdges = rawEdges.map((edge) => ({
      ...edge,
      selectable: true,
      deletable: true,
      reconnectable: true,
      data: {
        ...edge.data,
        onDropOnEdge: handleDropOnEdge,
        onInsertBetween: handleInsertBetweenFromEdge,
      },
    }));

    if (enrichedNodes.length === 0) {
      return { initialNodes: [], initialEdges: [] };
    }

    const { nodes: layoutedNodes, edges: layoutedEdges } = applyDagreLayout(
      enrichedNodes,
      enrichedEdges,
    );

    return { initialNodes: layoutedNodes, initialEdges: layoutedEdges };
  }, [canvasAgentIds, agentsArray, workflowSteps, selectedNodeId, onRemoveNode, handleDropOnEdge, handleInsertBetweenFromEdge]);

  const {
    nodes,
    edges,
    setNodes,
    setEdges,
    onNodesChange,
    onEdgesChange,
    pushHistory,
  } = useWorkflowState(initialNodes, initialEdges);

  // Re-layout when agents or canvas order changes
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
    pushHistory(initialNodes, initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges, pushHistory]);

  // Drag-drop from sidebar
  const { reactFlowWrapper, onDragOver, onDropHandler } =
    useWorkflowDragDrop(onDrop, onInsertBetween);

  // --- Node handlers ---

  const handleNodeClick = useCallback(
    (_event, node) => {
      setSelectedNodeId(node.data.agentId);
      onNodeClick?.(node.data.agentId);
      // Ensure React Flow pane has focus for keyboard shortcuts
      const pane = reactFlowWrapper.current?.querySelector(".react-flow__renderer");
      if (pane) pane.focus({ preventScroll: true });
    },
    [onNodeClick, reactFlowWrapper],
  );

  const handleNodeDoubleClick = useCallback(
    (_event, node) => {
      onNodeDoubleClick?.(node.data.agentId);
    },
    [onNodeDoubleClick],
  );

  const handleNodeContextMenu = useCallback(
    (event, node) => {
      event.preventDefault();
      setContextMenu({
        visible: true,
        x: event.clientX,
        y: event.clientY,
        agentId: node.data.agentId,
        agentLabel: node.data.label,
        agentCategory: node.data.category,
      });
    },
    [],
  );

  const handleNodesDelete = useCallback(
    (deletedNodes) => {
      const ids = deletedNodes
        .map((n) => n.data?.agentId)
        .filter(Boolean);
      if (ids.length > 0) {
        onDeleteNodes?.(ids);
      }
    },
    [onDeleteNodes],
  );

  // --- Edge handlers ---

  // Focus the React Flow pane when an edge is clicked so keyboard shortcuts (Delete) work
  const handleEdgeClick = useCallback(() => {
    const pane = reactFlowWrapper.current?.querySelector(".react-flow__renderer");
    if (pane) pane.focus({ preventScroll: true });
  }, [reactFlowWrapper]);

  // Validate that a new connection won't create a cycle or self-loop
  const isValidConnection = useCallback(
    (connection) => {
      if (!connection.source || !connection.target) return false;
      // No self-connections
      if (connection.source === connection.target) return false;
      // Check if target → source path already exists (would create a cycle)
      const visited = new Set();
      const hasPath = (from, to) => {
        if (from === to) return true;
        if (visited.has(from)) return false;
        visited.add(from);
        const agent = agentsArray.find((a) => a.id === from);
        if (!agent?.subAgents) return false;
        return agent.subAgents.some((subId) => hasPath(subId, to));
      };
      // If there's already a path from target to source, connecting source→target creates a cycle
      return !hasPath(connection.target, connection.source);
    },
    [agentsArray],
  );

  // Create a connection by dragging from handle to handle
  const handleConnect = useCallback(
    (connection) => {
      if (connection.source && connection.target) {
        onConnectNodes?.(connection.source, connection.target);
      }
    },
    [onConnectNodes],
  );

  // Delete selected edges (Delete/Backspace key)
  const handleEdgesDelete = useCallback(
    (deletedEdges) => {
      for (const edge of deletedEdges) {
        if (edge.source && edge.target) {
          onDisconnectNodes?.(edge.source, edge.target);
        }
      }
    },
    [onDisconnectNodes],
  );

  // Reconnect an edge: drag endpoint to a different node
  const handleReconnect = useCallback(
    (oldEdge, newConnection) => {
      if (!newConnection.source || !newConnection.target) return;
      if (newConnection.source === newConnection.target) return;
      // Disconnect old
      onDisconnectNodes?.(oldEdge.source, oldEdge.target);
      // Connect new
      onConnectNodes?.(newConnection.source, newConnection.target);
    },
    [onDisconnectNodes, onConnectNodes],
  );

  // --- Context menu & pane ---

  const closeContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, visible: false }));
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
    closeContextMenu();
    closeInsertPicker();
  }, [closeContextMenu, closeInsertPicker]);

  // Selected agent for info panel
  const selectedAgent = selectedNodeId
    ? agentsArray.find((a) => a.id === selectedNodeId)
    : null;

  // IDs of agents currently on the canvas (for greying out in picker)
  const existingNodeIds = useMemo(() => {
    const ids = new Set(canvasAgentIds);
    // Also include sub-agent nodes visible on canvas
    for (const node of nodes) {
      if (node.data?.agentId) ids.add(node.data.agentId);
    }
    return [...ids];
  }, [canvasAgentIds, nodes]);

  return (
    <div ref={reactFlowWrapper} className="w-full h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        /* Node interactions */
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onNodeContextMenu={handleNodeContextMenu}
        onNodesDelete={handleNodesDelete}
        /* Edge interactions */
        onEdgeClick={handleEdgeClick}
        onConnect={handleConnect}
        isValidConnection={isValidConnection}
        onEdgesDelete={handleEdgesDelete}
        edgesReconnectable
        onReconnect={handleReconnect}
        /* Pane interactions */
        onPaneClick={handlePaneClick}
        onDragOver={onDragOver}
        onDrop={onDropHandler}
        /* Keyboard */
        deleteKeyCode={["Backspace", "Delete"]}
        multiSelectionKeyCode="Shift"
        selectionKeyCode="Shift"
        /* View */
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={2}
        defaultEdgeOptions={{ type: "animatedEdge", deletable: true, reconnectable: true }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="rgba(255, 255, 255, 0.05)" gap={20} size={1} />
        <Controls showInteractive={false} className="react-flow__controls" />
        <MiniMap
          nodeColor={(node) => {
            const colors = {
              baseNode: "var(--color-brand)",
              parallelNode: "#3b82f6",
              sequentialNode: "#a882ff",
              loopNode: "#8b5cf6",
              routerNode: "#60a5fa",
            };
            return colors[node.type] || "#6b7280";
          }}
          maskColor="rgba(0, 0, 0, 0.6)"
          className="react-flow__minimap"
        />
      </ReactFlow>

      {/* Context Menu */}
      <ContextMenu
        visible={contextMenu.visible}
        x={contextMenu.x}
        y={contextMenu.y}
        agentId={contextMenu.agentId}
        agentLabel={contextMenu.agentLabel}
        agentCategory={contextMenu.agentCategory}
        onEdit={(id) => onNodeDoubleClick?.(id)}
        onDelete={(id) => onRemoveNode?.(id)}
        onInsertBefore={(id) => {
          handleContextInsertBefore(id);
        }}
        onInsertAfter={(id) => {
          handleContextInsertAfter(id);
        }}
        onClose={closeContextMenu}
      />

      {/* Agent Picker Popover (insert before/after/between) */}
      <AgentPickerPopover
        visible={insertPicker.visible}
        x={insertPicker.x}
        y={insertPicker.y}
        agents={allAgentsArray}
        existingAgentIds={existingNodeIds}
        onSelect={handlePickerSelect}
        onClose={closeInsertPicker}
      />

      {/* Info Panel */}
      <NodeInfoPanel
        agent={selectedAgent}
        resolveAgentName={resolveAgentName}
        onClose={() => setSelectedNodeId(null)}
      />
    </div>
  );
}
