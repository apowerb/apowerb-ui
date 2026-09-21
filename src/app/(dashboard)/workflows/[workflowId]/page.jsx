"use client";

import { use } from "react";
import WorkflowStudio from "@/components/workflow-studio/WorkflowStudio";

export default function Page({ params }) {
  const { workflowId } = use(params);
  return <WorkflowStudio workflowId={workflowId} />;
}
