"use client";

import { useState } from "react";
import { StepSource } from "@/components/bi/AddChartWizard";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/Toast";

/**
 * Every data source a chart can read (imported file, Data pool dataset,
 * database table, OneDrive workbook, agents), offered to pick one dashboard
 * source. `onPick` receives the picker's raw choice; `toSourceSpec` turns it
 * into a spec source.
 */
export default function SourcePicker({ onPick }) {
  const toast = useToast();
  const { user } = useAuth();
  const organizationId = user?.email?.split("@")[1] || "default";
  const [mode, setMode] = useState(null);
  const [agentIds, setAgentIds] = useState([]);
  const [agentMessage, setAgentMessage] = useState("");

  const pick = (choice) => {
    setMode(null);
    setAgentIds([]);
    setAgentMessage("");
    onPick(choice);
  };

  return (
    <StepSource
      sourceMode={mode}
      setSourceMode={setMode}
      onDataSourceSelected={pick}
      toast={toast}
      organizationId={organizationId}
      agentIds={agentIds}
      setAgentIds={setAgentIds}
      agentMessage={agentMessage}
      setAgentMessage={setAgentMessage}
    />
  );
}
