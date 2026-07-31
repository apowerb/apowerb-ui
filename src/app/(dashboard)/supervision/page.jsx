"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import SupervisionDashboard from "@/components/SupervisionDashboard";
import { useAuth } from "@/contexts/AuthContext";

function SupervisionInner() {
  const params = useSearchParams();
  return <SupervisionDashboard initialSearch={params.get("search") || ""} />;
}

export default function SupervisionPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  if (!isAdmin) {
    return (
      <div className="h-full flex items-center justify-center th-bg-body p-6">
        <div className="glass-card p-10 rounded-2xl border th-border text-center max-w-md">
          <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <ShieldAlert size={32} className="text-red-400" />
          </div>
          <h1 className="text-2xl font-bold th-text mb-2">
            Admin access required
          </h1>
          <p className="th-text-secondary text-sm">
            The Supervision Dashboard is restricted to administrators. Contact
            your workspace owner if you need access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={null}>
      <SupervisionInner />
    </Suspense>
  );
}
