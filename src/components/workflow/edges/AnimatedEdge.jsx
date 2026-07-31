"use client";

import { useState, useCallback } from "react";
import { BaseEdge, getBezierPath, EdgeLabelRenderer } from "@xyflow/react";
import { Plus } from "lucide-react";
import { useTranslations } from "use-intl";

const statusColors = {
  running: "#a882ff",
  done: "#3b82f6",
  error: "#ef4444",
};

const statusWidths = {
  running: 3,
  done: 2,
  error: 2,
  idle: 2,
};

export default function AnimatedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style,
  source,
  target,
  selected,
  markerEnd,
  markerStart,
}) {
  const t = useTranslations("AnimatedEdge");
  const status = data?.status || "idle";
  const isLoopBack = data?.isLoopBack;
  const isRoute = data?.isRoute;
  const onDropOnEdge = data?.onDropOnEdge;
  const onInsertBetween = data?.onInsertBetween;

  const [dragOver, setDragOver] = useState(false);
  const [hovered, setHovered] = useState(false);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    curvature: isLoopBack ? 0.8 : undefined,
  });

  // Color priority: dragOver > selected > status
  let color;
  if (dragOver) {
    color = "#60a5fa";
  } else if (selected) {
    color = "#a882ff";
  } else {
    color = statusColors[status] || "var(--rf-edge-stroke)";
  }

  let strokeWidth;
  if (dragOver) {
    strokeWidth = 4;
  } else if (selected) {
    strokeWidth = 3;
  } else {
    strokeWidth = statusWidths[status] || 1.5;
  }

  const edgeStyle = {
    ...style,
    stroke: color,
    strokeWidth,
    ...(isRoute ? { strokeDasharray: "8 4" } : {}),
    ...(isLoopBack ? { strokeDasharray: "5 5" } : {}),
    ...(dragOver ? { filter: "drop-shadow(0 0 6px rgba(96,165,250,0.6))" } : {}),
    ...(selected ? { filter: "drop-shadow(0 0 8px rgba(245,158,11,0.5))" } : {}),
  };

  const handleDragOver = useCallback((e) => {
    if (!onDropOnEdge) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragOver(true);
  }, [onDropOnEdge]);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const agentId = e.dataTransfer.getData("agent-id");
    if (agentId && onDropOnEdge) {
      onDropOnEdge(agentId, source, target);
    }
  }, [onDropOnEdge, source, target]);

  // "+" button click — opens the agent picker popover
  const handleInsertClick = useCallback((e) => {
    e.stopPropagation();
    if (onInsertBetween) {
      // Convert React Flow viewport coordinates to screen coordinates
      // labelX/labelY are in flow coordinates; we need screen position for the popover
      const rect = e.currentTarget.getBoundingClientRect();
      onInsertBetween(source, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    }
  }, [onInsertBetween, source]);

  // Show "+" button on hover (not for loop-back edges)
  const showInsertButton = onInsertBetween && !isLoopBack && hovered && !dragOver && !selected;

  return (
    <>
      {/* BaseEdge handles rendering + interaction (selection, deletion, reconnection) */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={edgeStyle}
        interactionWidth={25}
        markerEnd={markerEnd}
        markerStart={markerStart}
      />
      {/* Hover detection overlay */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={30}
        style={{ pointerEvents: "stroke" }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      />
      {/* Running animation */}
      {status === "running" && (
        <circle r="4" fill={statusColors.running}>
          <animateMotion dur="1.5s" repeatCount="indefinite" path={edgePath} />
        </circle>
      )}
      {/* "+" button at midpoint — visible on hover */}
      {showInsertButton && (
        <EdgeLabelRenderer>
          <button
            onClick={handleInsertClick}
            className="absolute flex items-center justify-center w-5 h-5 rounded-full th-bg-surface border th-border-hover th-text-muted hover:bg-blue-500/80 hover:text-white hover:border-blue-400 transition-all duration-150 shadow-lg cursor-pointer"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "all",
            }}
            title={t("insertAgentHereTitle")}
          >
            <Plus size={12} />
          </button>
        </EdgeLabelRenderer>
      )}
      {/* "+" indicator when dragging over */}
      {dragOver && (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-500/40"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            +
          </div>
        </EdgeLabelRenderer>
      )}
      {/* Selected indicator */}
      {selected && (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute flex items-center justify-center px-2 py-1 rounded-md bg-purple-500/90 text-white text-[10px] font-medium shadow-lg"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY - 16}px)`,
            }}
          >
            {t("delToDisconnectHint")}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
