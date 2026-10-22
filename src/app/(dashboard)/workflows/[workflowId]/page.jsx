"use client";

import { use } from "react";
import WorkflowStudio from "@/components/workflow-studio/WorkflowStudio";

export default function Page({ params, searchParams }) {
  const { workflowId } = use(params);
  // `?runs=1` (the Workflows page's link) opens the Runs drawer at once.
  const query = searchParams ? use(searchParams) : {};
  return <WorkflowStudio workflowId={workflowId} initialRunsOpen={query?.runs === "1"} />;
}
