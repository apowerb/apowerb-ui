"use client";

import { Handle, Position } from "@xyflow/react";
import { GitBranch } from "lucide-react";
import NodeWrapper from "./NodeWrapper";
import NodeOutputPreview from "./NodeOutputPreview";

export default function ParallelNode({ data, selected }) {
  const { label, status, subAgents, subAgentLabels = {}, dimmed, onDelete, result, error, duration } = data;

  return (
    <NodeWrapper status={status} category="Parallel" selected={selected} dimmed={dimmed} onDelete={onDelete} className="min-w-[210px]">
      <Handle type="target" position={Position.Left} className="bg-blue-500! w-2.5! h-2.5! border-2! border-blue-400/40!" />
      <div className="px-4 py-3.5">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-2.5">
          <div className="p-1.5 rounded-xl bg-linear-to-br from-blue-500 to-blue-600 shadow-md">
            <GitBranch size={14} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-bold th-text truncate block leading-tight">
              {label}
            </span>
            <span className="text-[10px] th-text-faint uppercase tracking-wider">
              {subAgents?.length || 0} branches
            </span>
          </div>
        </div>

        {/* Sub-agents chips */}
        {subAgents && subAgents.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap mb-1">
            {subAgents.map((subId) => (
              <span
                key={subId}
                className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-500/8 text-blue-300/70 rounded-md border border-blue-500/15 truncate max-w-[110px]"
              >
                {subAgentLabels[subId] || subId}
              </span>
            ))}
          </div>
        )}
        <NodeOutputPreview result={result} error={error} duration={duration} status={status} />
      </div>
      <Handle type="source" position={Position.Right} className="bg-blue-500! w-2.5! h-2.5! border-2! border-blue-400/40!" />
    </NodeWrapper>
  );
}
