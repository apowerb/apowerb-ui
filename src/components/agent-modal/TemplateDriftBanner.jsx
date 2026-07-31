"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "use-intl";
import { RefreshCw, AlertTriangle } from "lucide-react";
import {
  getAgentTemplateStatus,
  resyncAgentTemplate,
} from "@/lib/api";

/**
 * Banner shown on the agent edit page when the source SuperAgent template
 * has evolved since this agent was created (drift detected by the backend
 * via SHA-256 of agent_instruction / agent_tools / tags).
 *
 * Renders nothing when the agent has no template, when the template is
 * unknown to the backend, or when is_in_sync is true.
 *
 * Confirms before applying — resync overwrites the agent's instruction,
 * tools and tags with the template's current version. Other fields
 * (model, model_params, mcp_servers, guardrails, memory/artifacts toggles,
 * agent_skills) are NOT touched.
 *
 * Props:
 *   agentId   — numeric DB id (e.g. 6) or "agent6" prefixed form
 *   onResynced(updatedAgent) — optional callback fired after a successful
 *                              resync, useful for the parent to refresh
 *                              its cached agent data
 */
export default function TemplateDriftBanner({ agentId, onResynced }) {
  const t = useTranslations("TemplateDriftBanner");
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [resyncing, setResyncing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(null);

  const cleanId = String(agentId ?? "").replace(/^agent/, "");

  const refresh = useCallback(async () => {
    if (!cleanId) {
      setStatus(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const s = await getAgentTemplateStatus(cleanId);
      setStatus(s);
    } catch (err) {
      setError(err?.message || t("templateStatusCheckFailed"));
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [cleanId, t]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleResync = async () => {
    setResyncing(true);
    setError(null);
    try {
      const updated = await resyncAgentTemplate(cleanId);
      setStatus(updated);
      setConfirming(false);
      if (typeof onResynced === "function") {
        onResynced(updated);
      }
    } catch (err) {
      setError(err?.message || t("resyncFailed"));
    } finally {
      setResyncing(false);
    }
  };

  if (loading || !status) return null;
  if (!status.template_id) return null; // free-form agent
  if (status.template_unknown) return null; // template removed from registry
  if (status.is_in_sync) return null;

  const driftFields = status.drift_fields || [];

  return (
    <div className="mb-4 rounded-md border border-amber-400/60 bg-amber-50 dark:bg-amber-900/20 p-3">
      <div className="flex items-start gap-3">
        <AlertTriangle
          className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400"
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
            {t.rich("templateUpdated", {
              templateId: status.template_id,
              code: (chunks) => <code className="font-mono">{chunks}</code>,
            })}
          </p>
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
            {t("driftIntro")}{" "}
            {driftFields.length > 0 ? (
              <span className="font-mono">{driftFields.join(", ")}</span>
            ) : (
              <span>{t("noIdentifiableFieldHash")}</span>
            )}
            . {t("driftOutro")}
          </p>

          {error && (
            <p className="mt-2 text-xs text-red-700 dark:text-red-300">
              {error}
            </p>
          )}

          <div className="mt-3 flex items-center gap-2">
            {!confirming ? (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded border border-amber-500 bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900 hover:bg-amber-200 dark:bg-amber-800/40 dark:text-amber-100 dark:hover:bg-amber-800/60"
                onClick={() => setConfirming(true)}
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                {t("updateFromTemplate")}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={resyncing}
                  className="inline-flex items-center gap-1.5 rounded bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                  onClick={handleResync}
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${resyncing ? "animate-spin" : ""}`}
                    aria-hidden="true"
                  />
                  {resyncing ? t("resyncing") : t("confirmResync")}
                </button>
                <button
                  type="button"
                  disabled={resyncing}
                  className="rounded border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-50"
                  onClick={() => setConfirming(false)}
                >
                  {t("cancel")}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
