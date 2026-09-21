"use client";

import { useEffect, useState } from "react";
import { X, RotateCcw, Loader2 } from "lucide-react";
import { useTranslations, useFormatter } from "use-intl";
import { listWorkflowRevisions, restoreWorkflowRevision } from "@/lib/api";

// Why a version was archived: the change that replaced it. `update` is what
// the first server release wrote for every edit.
const REASON_KEY = {
  edit: "reasonEdit",
  update: "reasonEdit",
  publish: "reasonPublish",
  unpublish: "reasonUnpublish",
  restore: "reasonRestore",
};

export default function VersionsDrawer({ workflowId, currentVersion, onClose, onRestored }) {
  const t = useTranslations("WorkflowVersions");
  const format = useFormatter();
  const [revisions, setRevisions] = useState(null);
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    listWorkflowRevisions(workflowId)
      .then((data) => { if (!cancelled) setRevisions(Array.isArray(data) ? data : []); })
      .catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [workflowId]);

  const handleRestore = async (revisionId) => {
    setRestoring(true);
    setRestoreError(null);
    try {
      const updated = await restoreWorkflowRevision(workflowId, revisionId);
      setConfirming(null);
      onRestored(updated);
    } catch (err) {
      setRestoreError(err.message);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-96 h-full th-bg-modal border-l th-border-secondary flex flex-col shadow-2xl">
        <div className="p-4 border-b th-border-secondary flex items-start justify-between">
          <div>
            <h3 className="text-sm font-bold th-text">{t("title")}</h3>
            <p className="text-xs th-text-ghost mt-0.5">{t("subtitle")}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg th-text-ghost hover:th-text">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {error && <p className="text-xs text-red-400 p-2">{t("loadFailed", { message: error })}</p>}
          {revisions === null && !error && (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={18} className="animate-spin th-text-ghost" />
            </div>
          )}
          {revisions && revisions.length === 0 && <p className="text-xs th-text-ghost p-2">{t("empty")}</p>}
          {revisions && revisions.length > 0 && (
            <ul className="flex flex-col gap-2">
              {revisions.map((rev) => {
                const isCurrent = rev.version === currentVersion;
                return (
                  <li key={rev.revision_id} className="p-3 rounded-xl th-bg-surface border th-border-secondary">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold th-text">v{rev.version}</span>
                      {isCurrent && (
                        <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-md bg-brand/15 text-[#5B8AFF]">{t("current")}</span>
                      )}
                    </div>
                    <p className="text-[11px] th-text-ghost mt-0.5">
                      {t(REASON_KEY[rev.reason] || "reasonEdit")} · {format.dateTime(new Date(rev.saved_at), { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                    {!isCurrent && (
                      confirming === rev.revision_id ? (
                        <div className="mt-2 flex flex-col gap-1.5">
                          <p className="text-[11px] th-text-secondary">
                            {t("restoreConfirmBody", { version: rev.version, reason: t(REASON_KEY[rev.reason] || "reasonEdit") })}
                          </p>
                          {restoreError && <p className="text-[11px] text-red-400">{t("restoreFailed", { message: restoreError })}</p>}
                          <div className="flex gap-1.5">
                            <button type="button" disabled={restoring} onClick={() => handleRestore(rev.revision_id)} className="flex-1 px-2 py-1 text-[11px] font-semibold rounded-lg bg-brand text-white hover:opacity-90 disabled:opacity-50">
                              {restoring ? t("restoring") : t("restoreConfirmAction")}
                            </button>
                            <button type="button" disabled={restoring} onClick={() => setConfirming(null)} className="px-2 py-1 text-[11px] font-medium rounded-lg th-bg-elevated th-text-secondary">
                              {t("close")}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirming(rev.revision_id)}
                          className="mt-2 flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium rounded-lg th-bg-elevated hover:th-bg-surface-hover th-text-secondary border th-border-secondary"
                        >
                          <RotateCcw size={11} />
                          {t("restore")}
                        </button>
                      )
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
