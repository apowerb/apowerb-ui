"use client";

import { Hand, Webhook, Clock, Mail, Bot, ClipboardList, FolderInput, GitCommitHorizontal, HelpCircle } from "lucide-react";
import { useTranslations } from "use-intl";
import { TRIGGER_KINDS } from "@/lib/workflowTriggers";

const ICONS = {
  manual: Hand,
  webhook: Webhook,
  schedule: Clock,
  email: Mail,
  agent_tool: Bot,
  form: ClipboardList,
  file: FolderInput,
  workflow_done: GitCommitHorizontal,
};

/**
 * Icon + short label for a run's `trigger.kind` (the contract has every run
 * carry `run.trigger = {kind, detail}`) — reused wherever a run's source
 * needs to be shown: the runs list, a run detail header, etc.
 */
export default function TriggerSourceBadge({ kind, className = "" }) {
  const t = useTranslations("WorkflowInspector");
  const Icon = ICONS[kind] || HelpCircle;
  const label = TRIGGER_KINDS.includes(kind) ? t(`triggerKind_${kind}`) : kind || "-";
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium th-text-faint ${className}`}>
      <Icon size={11} />
      {label}
    </span>
  );
}
