"use client";
import { use } from "react";
import DashboardDetail from "@/components/bi/DashboardDetail";

export default function DashboardPage({ params }) {
  const { dashboardId } = use(params);
  return <DashboardDetail dashboardId={dashboardId} />;
}
