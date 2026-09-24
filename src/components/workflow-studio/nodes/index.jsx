"use client";

import { getToolCategoryLogo } from "@/components/icons/integrationLogos";
import { Zap, Bot, Sparkles, GitBranch, Merge, Repeat, UserCheck, Clock, CheckCircle2, XCircle, ArrowRightLeft, Flag, ListPlus, Split, ShieldAlert, Workflow, ScanText, BookOpen, Globe, Bell } from "lucide-react";
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
  // data.toolCategory is resolved by WorkflowStudio from toolOptions (same
  // lookup as data.subtitle), so the node shows the tool's provider logo
  // instead of the generic wrench icon when its category is known
  // (apowerb roadmap #103).
  return (
    <NodeShell
      {...common(data, selected)}
      title={data.label || t("nodeTool")}
      color={NODE_FAMILIES.tool.color}
      icon={getToolCategoryLogo(data.toolCategory)}
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

export function HttpNode({ data, selected }) {
  const t = useTranslations("WorkflowPalette");
  const method = data.config?.method || "GET";
  const url = data.config?.url;
  return (
    <NodeShell
      {...common(data, selected)}
      title={data.label || t("nodeHttp")}
      subtitle={url ? `${method} ${url}` : method}
      color={NODE_FAMILIES.http.color}
      icon={Globe}
    >
      <RunFooter runStatus={data.runStatus} runDuration={data.runDuration} />
    </NodeShell>
  );
}

export function ExtractNode({ data, selected }) {
  const t = useTranslations("WorkflowPalette");
  const tn = useTranslations("WorkflowNode");
  const fieldCount = (data.config?.fields || []).length;
  return (
    <NodeShell
      {...common(data, selected)}
      title={data.label || t("nodeExtract")}
      color={NODE_FAMILIES.extract.color}
      icon={ScanText}
    >
      {fieldCount > 0 && (
        <span className="inline-block px-1.5 py-0.5 text-[10px] font-semibold rounded-md border bg-violet-500/10 text-violet-300 border-violet-500/20">
          {tn("fieldsBadge", { count: fieldCount })}
        </span>
      )}
      <RunFooter runStatus={data.runStatus} runDuration={data.runDuration} />
    </NodeShell>
  );
}

export function SetNode({ data, selected }) {
  const t = useTranslations("WorkflowPalette");
  return (
    <NodeShell
      {...common(data, selected)}
      title={data.label || t("nodeSet")}
      color={NODE_FAMILIES.set.color}
      icon={ListPlus}
    >
      <RunFooter runStatus={data.runStatus} runDuration={data.runDuration} />
    </NodeShell>
  );
}

export function NotificationNode({ data, selected }) {
  const t = useTranslations("WorkflowPalette");
  const ti = useTranslations("WorkflowInspector");
  const channel = data.config?.channel || "app";
  const subtitle = channel === "email"
    ? `${ti("notificationChannel_email")} · ${(data.config?.to || []).length}`
    : ti(`notificationChannel_${channel}`);
  return (
    <NodeShell
      {...common(data, selected)}
      title={data.label || t("nodeNotification")}
      subtitle={subtitle}
      color={NODE_FAMILIES.notification.color}
      icon={Bell}
    >
      <RunFooter runStatus={data.runStatus} runDuration={data.runDuration} />
    </NodeShell>
  );
}

export function RagNode({ data, selected }) {
  const t = useTranslations("WorkflowPalette");
  const tn = useTranslations("WorkflowNode");
  const topK = data.config?.top_k;
  return (
    <NodeShell
      {...common(data, selected)}
      title={data.label || t("nodeRag")}
      color={NODE_FAMILIES.rag.color}
      icon={BookOpen}
    >
      {Number.isInteger(topK) && (
        <span className="inline-block px-1.5 py-0.5 text-[10px] font-semibold rounded-md border bg-blue-500/10 text-blue-300 border-blue-500/20">
          {tn("topKBadge", { count: topK })}
        </span>
      )}
      <RunFooter runStatus={data.runStatus} runDuration={data.runDuration} />
    </NodeShell>
  );
}

export function ConditionNode({ data, selected }) {
  const t = useTranslations("WorkflowPalette");
  const ti = useTranslations("WorkflowInspector");
  const trueLabel = ti("conditionRouteTrue");
  const falseLabel = ti("conditionRouteFalse");
  const taken = data.runRoute === "true" ? trueLabel : data.runRoute === "false" ? falseLabel : undefined;
  return (
    <NodeShell
      {...common(data, selected)}
      title={data.label || t("nodeCondition")}
      color={NODE_FAMILIES.condition.color}
      icon={Split}
    >
      <RouteChips routes={[trueLabel, falseLabel]} taken={taken} />
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
  http: HttpNode,
  notification: NotificationNode,
  extract: ExtractNode,
  rag: RagNode,
  set: SetNode,
  condition: ConditionNode,
  approval: ApprovalNode,
};
