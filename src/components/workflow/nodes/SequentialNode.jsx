"use client";

import { Handle, Position } from "@xyflow/react";
import { Layers } from "lucide-react";
import NodeWrapper from "./NodeWrapper";
import NodeOutputPreview from "./NodeOutputPreview";

export default function SequentialNode({ data, selected }) {
  const { label, status, subAgents, subAgentLabels = {}, dimmed, onDelete, result, error, duration } = data;

  return (
    <NodeWrapper status={status} category="Sequential" selected={selected} dimmed={dimmed} onDelete={onDelete} className="min-w-[210px]">
      <Handle type="target" position={Position.Left} className="bg-purple-500! w-2.5! h-2.5! border-2! border-purple-400/40!" />
      <div className="px-4 py-3.5">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-2.5">
          <div className="p-1.5 rounded-xl bg-linear-to-br from-purple-500 to-purple-700 shadow-md">
            <Layers size={14} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-bold th-text truncate block leading-tight">
              {label}
            </span>
            <span className="text-[10px] th-text-faint uppercase tracking-wider">
              {subAgents?.length || 0} steps
            </span>
          </div>
        </div>

        {/* Sub-agents list */}
        {subAgents && subAgents.length > 0 && (
          <div className="flex flex-col gap-1 mb-1">
            {subAgents.map((subId, i) => (
              <div key={subId} className="flex items-center gap-1.5">
                <span className="shrink-0 w-4 h-4 rounded-md bg-purple-500/15 flex items-center justify-center text-[9px] font-bold text-purple-300/60">
                  {i + 1}
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-purple-500/8 text-purple-300/70 rounded-md border border-purple-500/15 truncate max-w-[130px]">
                  {subAgentLabels[subId] || subId}
                </span>
              </div>
            ))}
          </div>
        )}
        <NodeOutputPreview result={result} error={error} duration={duration} status={status} />
      </div>
      <Handle type="source" position={Position.Right} className="bg-purple-500! w-2.5! h-2.5! border-2! border-purple-400/40!" />
    </NodeWrapper>
  );
}
