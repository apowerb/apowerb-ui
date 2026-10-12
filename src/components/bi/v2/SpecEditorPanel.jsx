"use client";

import SpecEditor from "@/components/bi/v2/editor/SpecEditor";
import { useDashboardData } from "./DashboardDataContext";

/**
 * Mount point of the spec editor: gives it the dashboard and its computed data
 * from the shared context (the data refetches by itself when the spec changes).
 */
export default function SpecEditorPanel({ selectedComponentId, onSelectComponent, onDashboardChange, controller = null }) {
  const { dashboard, data } = useDashboardData();
  return (
    <SpecEditor
      dashboard={dashboard}
      data={data}
      selectedComponentId={selectedComponentId}
      onSelectComponent={onSelectComponent}
      controller={controller}
      onDashboardChange={onDashboardChange}
    />
  );
}
