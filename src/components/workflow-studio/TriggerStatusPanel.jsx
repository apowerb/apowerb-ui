"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Copy, Check, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import { useFormatter } from "use-intl";
import { getWorkflowTriggerState, rotateWorkflowTrigger } from "@/lib/api";
import { triggerInactiveReasonKey } from "@/lib/workflowTriggers";
import { isMissingRouteError } from "@/lib/triggerGuide";

function CopyButton({ text, t }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard permission denied or unavailable (older browser, non-HTTPS
      // preview) — the URL is still selectable/readable in the box itself.
    }
  };
  return (
    <button type="button" onClick={copy} title={t("copy")} aria-label={t("copy")} className="p-1 rounded-md th-text-ghost hover:th-text-secondary shrink-0">
      {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
    </button>
  );
}

function UrlBox({ url, t }) {
  return (
    <div className="flex items-center gap-1.5 mt-1 p-1.5 rounded-lg th-bg-elevated border th-border-secondary">
      <code className="flex-1 min-w-0 text-[10px] font-mono th-text-secondary truncate">{url}</code>
      <CopyButton text={url} t={t} />
    </div>
  );
}

/**
 * Live state of the workflow's trigger — active/inactive with a worded
 * reason, the webhook/form URL with a copy button, the webhook's rotate
 * flow (confirm -> new secret shown once -> hidden), and the next/last run.
 * `refreshKey` is bumped by the parent after publish/unpublish so this
 * refetches instead of showing a state from before the flip. `onState`
 * hands the loaded state (null on failure) to the usage guide, which builds
 * the call to copy from the live webhook URL.
 */
export default function TriggerStatusPanel({ workflowId, kind, refreshKey, onState, t }) {
  const format = useFormatter();
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const [rotating, setRotating] = useState(false);
  const [confirmingRotate, setConfirmingRotate] = useState(false);
  const [rotateError, setRotateError] = useState(null);
  const [rotatedSecret, setRotatedSecret] = useState(null);

  const load = useCallback(() => {
    if (!workflowId) return;
    getWorkflowTriggerState(workflowId)
      .then((data) => {
        setState(data);
        setError(null);
        onState?.(data);
      })
      .catch((err) => {
        setError(isMissingRouteError(err) ? { routeMissing: true } : { message: err.message });
        onState?.(null);
      });
  }, [workflowId, onState]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const handleRotate = async () => {
    setRotating(true);
    setRotateError(null);
    try {
      const result = await rotateWorkflowTrigger(workflowId);
      setRotatedSecret(result?.hmac_secret || null);
      setConfirmingRotate(false);
      load();
    } catch (err) {
      setRotateError(err.message);
    } finally {
      setRotating(false);
    }
  };

  if (error?.routeMissing) {
    return <p className="mt-3 text-[11px] text-amber-400">{t("triggerRouteMissing")}</p>;
  }
  if (error) {
    return <p className="mt-3 text-[11px] text-red-400">{t("triggerStatusFailed", { message: error.message })}</p>;
  }
  if (!state) {
    return <p className="mt-3 text-[11px] th-text-ghost">{t("triggerStatusLoading")}</p>;
  }

  // A manual trigger is never armed (the server answers active:false with no
  // reason) yet it is usable at any time: say so instead of "Inactive".
  if (kind === "manual" && !state.active && !state.reason) {
    return (
      <div className="mt-3 p-3 rounded-xl th-bg-surface border th-border-secondary flex items-start gap-1.5">
        <CheckCircle2 size={13} className="text-emerald-400 shrink-0 mt-0.5" />
        <span className="text-[11px] th-text-secondary">{t("triggerManualReady")}</span>
      </div>
    );
  }

  const reasonKey = !state.active && state.reason ? triggerInactiveReasonKey(state.reason) : null;
  const fmt = (iso) => format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="mt-3 p-3 rounded-xl th-bg-surface border th-border-secondary">
      <div className="flex items-center gap-1.5 mb-1">
        {state.active ? <CheckCircle2 size={13} className="text-emerald-400" /> : <AlertCircle size={13} className="text-amber-400" />}
        <span className="text-[11px] font-semibold th-text">{t(state.active ? "triggerActive" : "triggerInactive")}</span>
      </div>
      {reasonKey && <p className="text-[10px] th-text-ghost mb-2">{t(`triggerReason_${reasonKey}`)}</p>}
      {reasonKey === "integration_missing" && (
        <Link href="/integrations" className="inline-block mb-2 text-[10px] font-medium text-[#5B8AFF] hover:underline">
          {t("triggerReasonIntegrationsLink")}
        </Link>
      )}

      {kind === "webhook" && state.webhook_url && (
        <div className="mt-2">
          <span className="block text-[10px] font-semibold th-text-ghost">{t("webhookUrl")}</span>
          <UrlBox url={state.webhook_url} t={t} />

          {rotatedSecret && (
            <div className="mt-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <p className="text-[10px] text-amber-200 font-semibold mb-1">{t("hmacSecretWarning")}</p>
              <div className="flex items-center gap-1.5">
                <code className="flex-1 min-w-0 text-[10px] font-mono th-text-secondary truncate">{rotatedSecret}</code>
                <CopyButton text={rotatedSecret} t={t} />
              </div>
              <button type="button" onClick={() => setRotatedSecret(null)} className="mt-1.5 text-[10px] font-medium th-text-ghost hover:th-text-secondary">
                {t("hmacSecretHide")}
              </button>
            </div>
          )}

          {confirmingRotate ? (
            <div className="mt-2 p-2 rounded-lg bg-red-500/10 border border-red-500/30">
              <p className="text-[10px] text-red-300 mb-1.5">{t("rotateConfirmBody")}</p>
              {rotateError && <p className="text-[10px] text-red-400 mb-1.5">{t("rotateFailed", { message: rotateError })}</p>}
              <div className="flex gap-1.5">
                <button type="button" disabled={rotating} onClick={handleRotate} className="flex-1 px-2 py-1 text-[10px] font-semibold rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50">
                  {rotating ? t("rotating") : t("rotateConfirmAction")}
                </button>
                <button type="button" disabled={rotating} onClick={() => setConfirmingRotate(false)} className="px-2 py-1 text-[10px] font-medium rounded-lg th-bg-elevated th-text-secondary">
                  {t("cancel")}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmingRotate(true)} className="mt-2 flex items-center gap-1 text-[10px] font-medium th-text-ghost hover:th-text-secondary">
              <RefreshCw size={11} />
              {t("rotateButton")}
            </button>
          )}
        </div>
      )}

      {kind === "form" && state.form_url && (
        <div className="mt-2">
          <span className="block text-[10px] font-semibold th-text-ghost">{t("formUrl")}</span>
          <UrlBox url={state.form_url} t={t} />
        </div>
      )}

      {kind === "schedule" && state.next_run_at && (
        <p className="mt-2 text-[10px] th-text-secondary">{t("nextRunAt", { when: fmt(state.next_run_at) })}</p>
      )}

      {state.last_fired_at && (
        <p className="mt-2 text-[10px] th-text-ghost">{t("lastFired", { when: fmt(state.last_fired_at), status: state.last_status || "-" })}</p>
      )}
    </div>
  );
}
