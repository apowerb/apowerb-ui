"use client";

import { ShieldAlert } from "lucide-react";

import LoggingPage from "@/components/LoggingPage";
import { useAuth } from "@/contexts/AuthContext";
import { isAdminUser } from "@/lib/roles";

/**
 * The Logging screen is an operations view over the whole deployment, and
 * the proxy behind it refuses non-admins with a 403.
 *
 * This says so before the request rather than after: a refusal rendered as
 * an empty list is indistinguishable from a broken pipeline, and that exact
 * confusion is what this feature was built to end.
 */
export default function LoggingRoute() {
  const { user } = useAuth();

  if (!isAdminUser(user)) {
    return (
      <div className="h-full flex items-center justify-center th-bg-body p-6">
        <div className="glass-card p-10 rounded-2xl border th-border text-center max-w-md">
          <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-[var(--c-red-500-10)] border border-[var(--c-red-500-20)] flex items-center justify-center">
            <ShieldAlert size={32} className="text-red-400" />
          </div>
          <h1 className="text-2xl font-bold th-text mb-2">
            Admin access required
          </h1>
          <p className="th-text-secondary text-sm">
            Logging shows the telemetry of the whole deployment, so it is
            restricted to administrators. Ask a workspace administrator if you
            need access.
          </p>
        </div>
      </div>
    );
  }

  return <LoggingPage />;
}
