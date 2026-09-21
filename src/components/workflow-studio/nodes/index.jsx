"use client";

import { Zap, Bot, Sparkles, Wrench, GitBranch, Merge, Repeat, UserCheck, Clock, CheckCircle2, XCircle, ArrowRightLeft, Flag, ShieldAlert, Workflow } from "lucide-react";
import { useTranslations } from "use-intl";
import NodeShell from "./NodeShell";
import { NODE_FAMILIES } from "@/lib/workflowGraph";

function RunFooter({ runStatus, runDuration }) {
  const t = useTranslations("WorkflowExecutionPanel");
  if (!runStatus) return null;
  const Icon = runStatus === "done" ? CheckCircle2 : runStatus === "error" ? XCircle : Clock;
  const color = runStatus === "done" ? "text-blue-400" : runStatus === "error" ? "text-red-400" : "text-purple-300";
  return (
    <div className={`flex items-center gap-1 mt-1.5 text-[10px] font-medium ${color}`}>
      <Icon size={10} className={runStatus === "running" ? "animate-spin" : ""} />
      {t(runStatus === "running" ? "nodeRunning" : runStatus === "done" ? "nodeDone" : "nodeError")}
      {runDuration != null && runStatus !== "running" && (
        <span className="th-text-ghost">· {t("duration", { ms: runDuration })}</span>
      )}
    </div>
  );
}

// A route is either a plain string (router/classifier — the label a user
// typed IS the route value) or a {value, label} pair (try — the route value
// is fixed ("ok"/"error") but shown translated).
function RouteChips({ routes, taken }) {
  if (!routes || routes.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {routes.map((r) => {
        const value = typeof r === "string" ? r : r.value;
        const label = typeof r === "string" ? r : r.label;
        return (
          <span
            key={value}
            className={`px-1.5 py-0.5 text-[10px] font-medium rounded-md border ${
              taken === value
                ? "bg-blue-500/20 border-blue-400/50 text-blue-200"
                : "th-bg-surface th-text-faint border-white/8"
            }`}
          >
            {label}
          </span>
        );
      })}
    </div>
  );
}

function common(data, selected) {
  return {
    title: data.label,
    subtitle: data.subtitle,
    selected,
    dimmed: data.dimmed,
    errorCount: data.errorCount || 0,
    runStatus: data.runStatus,
    onDelete: data.onDelete,
    onDuplicate: data.onDuplicate,
  };
}

export function TriggerNode({ data, selected }) {
  const t = useTranslations("WorkflowPalette");
  return (
    <NodeShell
      {...common(data, selected)}
      title={data.label || t("nodeTrigger")}
      color={NODE_FAMILIES.trigger.color}
      icon={Zap}
      hasTarget={false}
    >
      <RunFooter runStatus={data.runStatus} runDuration={data.runDuration} />
    </NodeShell>
  );
}

export function AgentNode({ data, selected }) {
  const t = useTranslations("WorkflowPalette");
  return (
    <NodeShell
      {...common(data, selected)}
      title={data.label || t("nodeAgent")}
      color={NODE_FAMILIES.agent.color}
      icon={Bot}
    >
      <RunFooter runStatus={data.runStatus} runDuration={data.runDuration} />
    </NodeShell>
  );
}

export function ToolNode({ data, selected }) {
  const t = useTranslations("WorkflowPalette");
  return (
    <NodeShell
      {...common(data, selected)}
      title={data.label || t("nodeTool")}
      color={NODE_FAMILIES.tool.color}
      icon={Wrench}
    >
      <RunFooter runStatus={data.runStatus} runDuration={data.runDuration} />
    </NodeShell>
  );
}

export function RouterNode({ data, selected }) {
  const t = useTranslations("WorkflowPalette");
  const routes = (data.config?.rules || []).map((r) => r.route).filter(Boolean);
  if (data.config?.default_route) routes.push(data.config.default_route);
  return (
    <NodeShell
      {...common(data, selected)}
      title={data.label || t("nodeRouter")}
      color={NODE_FAMILIES.router.color}
      icon={GitBranch}
    >
      <RouteChips routes={[...new Set(routes)]} taken={data.runRoute} />
      <RunFooter runStatus={data.runStatus} runDuration={data.runDuration} />
    </NodeShell>
  );
}

export function ClassifierNode({ data, selected }) {
  const t = useTranslations("WorkflowPalette");
  const routes = (data.config?.routes || []).map((r) => r.route).filter(Boolean);
  return (
    <NodeShell
      {...common(data, selected)}
      title={data.label || t("nodeClassifier")}
      color={NODE_FAMILIES.classifier.color}
      icon={Sparkles}
    >
      <RouteChips routes={routes} taken={data.runRoute} />
      <RunFooter runStatus={data.runStatus} runDuration={data.runDuration} />
    </NodeShell>
  );
}

export function MergeNode({ data, selected }) {
  const t = useTranslations("WorkflowPalette");
  return (
    <NodeShell
      {...common(data, selected)}
      title={data.label || t("nodeMerge")}
      color={NODE_FAMILIES.merge.color}
      icon={Merge}
    >
      <RunFooter runStatus={data.runStatus} runDuration={data.runDuration} />
    </NodeShell>
  );
}

export function LoopNode({ data, selected }) {
  const t = useTranslations("WorkflowPalette");
  const tn = useTranslations("WorkflowNode");
  const cfg = data.config || {};
  return (
    <NodeShell
      {...common(data, selected)}
      title={data.label || t("nodeLoop")}
      subtitle={data.subtitle || (cfg.mode === "until" ? "until" : "foreach")}
      color={NODE_FAMILIES.loop.color}
      icon={Repeat}
      footer={
        data.onOpenBody && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); data.onOpenBody(); }}
            className="mt-2 w-full text-[11px] font-semibold px-2 py-1 rounded-lg th-bg-surface hover:th-bg-surface-hover th-text-secondary border th-border-secondary nodrag"
          >
            {tn("editBody")}
          </button>
        )
      }
    >
      {Number.isInteger(cfg.max_iterations) && (
        <span className="inline-block px-1.5 py-0.5 text-[10px] font-semibold rounded-md border bg-violet-500/10 text-violet-300 border-violet-500/20">
          {tn("maxIterationsBadge", { count: cfg.max_iterations })}
        </span>
      )}
      <RunFooter runStatus={data.runStatus} runDuration={data.runDuration} />
    </NodeShell>
  );
}

export function ApprovalNode({ data, selected }) {
  const t = useTranslations("WorkflowPalette");
  return (
    <NodeShell
      {...common(data, selected)}
      title={data.label || t("nodeApproval")}
      color={NODE_FAMILIES.approval.color}
      icon={UserCheck}
      soon
    />
  );
}

export function TryNode({ data, selected }) {
  const t = useTranslations("WorkflowPalette");
  const tn = useTranslations("WorkflowNode");
  const ti = useTranslations("WorkflowInspector");
  const cfg = data.config || {};
  const routes = [
    { value: "ok", label: ti("tryRoute_ok") },
    { value: "error", label: ti("tryRoute_error") },
  ];
  return (
    <NodeShell
      {...common(data, selected)}
      title={data.label || t("nodeTry")}
      color={NODE_FAMILIES.try.color}
      icon={ShieldAlert}
      footer={
        data.onOpenBody && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); data.onOpenBody(); }}
            className="mt-2 w-full text-[11px] font-semibold px-2 py-1 rounded-lg th-bg-surface hover:th-bg-surface-hover th-text-secondary border th-border-secondary nodrag"
          >
            {tn("editTryBody")}
          </button>
        )
      }
    >
      {cfg.retries > 0 && (
        <span className="inline-block px-1.5 py-0.5 text-[10px] font-semibold rounded-md border bg-violet-500/10 text-violet-300 border-violet-500/20">
          {tn("tryRetriesBadge", { count: cfg.retries })}
        </span>
      )}
      <RouteChips routes={routes} taken={data.runRoute} />
      <RunFooter runStatus={data.runStatus} runDuration={data.runDuration} />
    </NodeShell>
  );
}

export function SubworkflowNode({ data, selected }) {
  const t = useTranslations("WorkflowPalette");
  return (
    <NodeShell
      {...common(data, selected)}
      title={data.label || t("nodeSubworkflow")}
      subtitle={data.subtitle}
      color={NODE_FAMILIES.subworkflow.color}
      icon={Workflow}
    >
      <RunFooter runStatus={data.runStatus} runDuration={data.runDuration} />
    </NodeShell>
  );
}

export function ConvertNode({ data, selected }) {
  const t = useTranslations("WorkflowPalette");
  const ti = useTranslations("WorkflowInspector");
  const to = data.config?.to;
  return (
    <NodeShell
      {...common(data, selected)}
      title={data.label || t("nodeConvert")}
      subtitle={to ? `→ ${ti(`convertTo_${to}`)}` : undefined}
      color={NODE_FAMILIES.convert.color}
      icon={ArrowRightLeft}
    >
      <RunFooter runStatus={data.runStatus} runDuration={data.runDuration} />
    </NodeShell>
  );
}

export function OutputNode({ data, selected }) {
  const t = useTranslations("WorkflowPalette");
  return (
    <NodeShell
      {...common(data, selected)}
      title={data.label || t("nodeOutput")}
      color={NODE_FAMILIES.output.color}
      icon={Flag}
      hasSource={false}
    >
      <RunFooter runStatus={data.runStatus} runDuration={data.runDuration} />
    </NodeShell>
  );
}

export const studioNodeTypes = {
  trigger: TriggerNode,
  agent: AgentNode,
  tool: ToolNode,
  router: RouterNode,
  classifier: ClassifierNode,
  merge: MergeNode,
  loop: LoopNode,
  try: TryNode,
  subworkflow: SubworkflowNode,
  convert: ConvertNode,
  output: OutputNode,
  approval: ApprovalNode,
};
