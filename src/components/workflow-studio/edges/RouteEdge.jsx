"use client";

import { BaseEdge, EdgeLabelRenderer, getBezierPath } from "@xyflow/react";
import { useTranslations } from "use-intl";

/**
 * Edge with an optional route-name pill. `data.route` is set/edited from the
 * inspector (RouterOrClassifier edges must carry a declared route — see
 * workflowGraph.validateGraphLocal). `data.needsRoute` is true when the edge
 * leaves a router/classifier and has no route yet: rendered red/dashed so
 * the gap is visible on the canvas, not just in the validation badge.
 */
export default function RouteEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
}) {
  const t = useTranslations("WorkflowCanvas");
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const needsRoute = !!data?.needsRoute;
  const route = data?.route;

  let color = selected ? "#5B8AFF" : "rgba(255,255,255,0.35)";
  if (needsRoute) color = "#ef4444";

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: color,
          strokeWidth: selected ? 2.5 : 1.75,
          strokeDasharray: needsRoute ? "5 4" : undefined,
        }}
      />
      {(route || needsRoute) && (
        <EdgeLabelRenderer>
          <div
            role="button"
            tabIndex={-1}
            title={needsRoute ? t("chooseRoute") : route}
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "all",
            }}
            className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold border backdrop-blur-sm nodrag nopan ${
              needsRoute
                ? "bg-red-500/20 border-red-400/50 text-red-200"
                : "bg-black/40 border-white/15 text-white/90"
            }`}
          >
            {route || t("chooseRoute")}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
