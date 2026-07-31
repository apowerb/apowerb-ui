"use client";

import { Handle, Position } from "@xyflow/react";
import {
  Box,
  Database,
  DatabaseZap,
  Image as ImageIcon,
  Mail,
  BarChart3,
  TrendingUp,
  BookOpen,
  Brain,
  Wrench,
  Cpu,
  Mic,
  Headphones,
} from "lucide-react";
import NodeWrapper from "./NodeWrapper";
import NodeOutputPreview from "./NodeOutputPreview";

const SUPERAGENT_ICONS = {
  rag_agent: Database,
  text_to_sql_agent: DatabaseZap,
  image_analyst: ImageIcon,
  image_creator: ImageIcon,
  email_marketing_agent: Mail,
  data_analyst_agent: BarChart3,
  forecasting_agent: TrendingUp,
  knowledge_assistant: BookOpen,
  audio_transcriber: Mic,
  audio_assistant: Headphones,
};

export default function BaseNode({ data, selected }) {
  const { label, status, modelShort, toolsCount, description, memoryEnabled, dimmed, onDelete, superagentTemplateId, result, error, duration, hasOutputSchema } = data;

  const Icon = (superagentTemplateId && SUPERAGENT_ICONS[superagentTemplateId]) || Cpu;

  return (
    <NodeWrapper status={status} category="Base" selected={selected} dimmed={dimmed} onDelete={onDelete}>
      <Handle type="target" position={Position.Left} className="bg-brand! w-2.5! h-2.5! border-2! border-brand/40!" />
      <div className="px-4 py-3.5 min-w-48 max-w-64">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-2">
          <div className="p-1.5 rounded-xl bg-linear-to-br from-brand to-brand-secondary shadow-md">
            <Icon size={14} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-bold th-text truncate block leading-tight">
              {label}
            </span>
            {description && (
              <p className="text-[10px] th-text-ghost truncate leading-tight">{description}</p>
            )}
          </div>
        </div>

        {/* Metadata badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {modelShort && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-brand/10 text-[#5B8AFF] rounded-md border border-brand/15 truncate max-w-30">
              {modelShort}
            </span>
          )}
          {toolsCount > 0 && (
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium th-bg-surface th-text-faint rounded-md border border-white/8">
              <Wrench size={8} />
              {toolsCount}
            </span>
          )}
          {memoryEnabled && (
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium bg-violet-500/10 text-violet-300/70 rounded-md border border-violet-500/15">
              <Brain size={8} />
              mem
            </span>
          )}
          {hasOutputSchema && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-purple-500/10 text-purple-300/70 rounded-md border border-purple-500/15">
              fmt
            </span>
          )}
        </div>
        <NodeOutputPreview result={result} error={error} duration={duration} status={status} />
      </div>
      <Handle type="source" position={Position.Right} className="bg-brand! w-2.5! h-2.5! border-2! border-brand/40!" />
    </NodeWrapper>
  );
}
