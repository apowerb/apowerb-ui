"use client";

import { useTranslations } from "use-intl";

/**
 * Asked before every "Test up to here": the steps up to `nodeLabel` really
 * run, so the ones that reach outside the Studio (a message, a call, a
 * write, a model call) are listed first. Nothing runs until "Run".
 *
 * `retry`: the same question before a "Resume here" — the failed step and
 * the ones after it really run, the ones before are replayed and send
 * nothing again. `error` is a refusal of the server, shown in place.
 */
export default function TestUntilConfirm({ nodeLabel, effects, onConfirm, onCancel, retry = false, error = null, busy = false }) {
  const t = useTranslations("WorkflowInspector");
  const key = (name) => (retry ? `retryHere${name}` : `testUntil${name}`);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="test-until-title">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative w-full max-w-md rounded-2xl th-bg-modal border th-border-secondary shadow-2xl p-5">
        <h3 id="test-until-title" className="text-sm font-bold th-text mb-3">{t(key("ConfirmTitle"), { node: nodeLabel })}</h3>
        <p className="text-xs th-text-secondary mb-2">{t(key("ConfirmBody"), { node: nodeLabel })}</p>
        {effects.length ? (
          <>
            <p className="text-xs font-semibold th-text mb-1">{t("testUntilEffects")}</p>
            <ul className="mb-3 list-disc pl-5 text-xs th-text-secondary">
              {effects.map((e) => (
                <li key={e.id}>
                  {e.label} <span className="th-text-ghost">({t(`testUntilEffect_${e.type}`)})</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mb-3 text-xs th-text-ghost">{t("testUntilNoEffects")}</p>
        )}
        {error && (
          <p role="alert" className="mb-3 text-xs text-red-400">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="px-3 py-1.5 text-xs font-semibold rounded-lg th-text-secondary hover:th-bg-surface-hover">
            {t("testUntilCancel")}
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand text-white hover:opacity-90 disabled:opacity-40">
            {t(key("Run"))}
          </button>
        </div>
      </div>
    </div>
  );
}
