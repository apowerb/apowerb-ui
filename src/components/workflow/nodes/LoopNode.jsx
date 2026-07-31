"use client";

import { Handle, Position } from "@xyflow/react";
import { Repeat } from "lucide-react";
import NodeWrapper from "./NodeWrapper";
import NodeOutputPreview from "./NodeOutputPreview";

export default function LoopNode({ data, selected }) {
  const { label, status, subAgents, subAgentLabels = {}, loopMaxIterations, loopExitInstruction, dimmed, onDelete, result, error, duration } = data;

  const isConditional = !!loopExitInstruction;
  const loopLabel = isConditional
    ? "LLM conditional"
    : `${loopMaxIterations || "?"} iterations`;

  return (
    <NodeWrapper status={status} category="Loop" selected={selected} dimmed={dimmed} onDelete={onDelete} className="min-w-[210px]">
      <Handle type="target" position={Position.Left} className="bg-purple-500! w-2.5! h-2.5! border-2! border-purple-400/40!" />
      <div className="px-4 py-3.5">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-2.5">
          <div className="p-1.5 rounded-xl bg-linear-to-br from-purple-500 to-purple-600 shadow-md">
            <Repeat size={14} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-bold th-text truncate block leading-tight">
              {label}
            </span>
            <span className="text-[10px] th-text-faint uppercase tracking-wider">
              {subAgents?.length || 0} subs
            </span>
          </div>
        </div>

        {/* Loop mode badge */}
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2 py-0.5 text-[10px] font-semibold bg-purple-500/12 text-purple-300 rounded-full border border-purple-500/20">
            {loopLabel}
          </span>
        </div>

        {/* Sub-agents chips */}
        {subAgents && subAgents.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap mb-1">
            {subAgents.map((subId) => (
              <span
                key={subId}
                className="px-1.5 py-0.5 text-[10px] font-medium bg-purple-500/8 text-purple-300/70 rounded-md border border-purple-500/15 truncate max-w-[110px]"
              >
                {subAgentLabels[subId] || subId}
              </span>
            ))}
          </div>
        )}
        <NodeOutputPreview result={result} error={error} duration={duration} status={status} />
      </div>
      <Handle type="source" position={Position.Right} className="bg-purple-500! w-2.5! h-2.5! border-2! border-purple-400/40!" />
    </NodeWrapper>
  );
}
