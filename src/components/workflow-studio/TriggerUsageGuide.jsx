"use client";

import { useState } from "react";
import { useTranslations } from "use-intl";
import { Copy, Check } from "lucide-react";
import { TRIGGER_GUIDE, triggerCall, curlSnippet, jsSnippet, pythonSnippet } from "@/lib/triggerGuide";

const LANGS = [
  ["curl", curlSnippet],
  ["js", jsSnippet],
  ["python", pythonSnippet],
];

function CodeBlock({ code, t }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable (permission, non-HTTPS preview) — the code stays selectable
    }
  };
  return (
    <div className="relative mt-1.5">
      <pre className="p-2 pr-7 rounded-lg th-bg-elevated border th-border-secondary text-[9px] font-mono th-text-faint overflow-x-auto whitespace-pre">{code}</pre>
      <button type="button" onClick={copy} title={t("copyCode")} aria-label={t("copyCode")} className="absolute top-1 right-1 p-1 rounded-md th-text-ghost hover:th-text-secondary">
        {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
      </button>
    </div>
  );
}

function CallExample({ call, t }) {
  const [lang, setLang] = useState("curl");
  const build = LANGS.find(([l]) => l === lang)[1];
  return (
    <div className="mt-2">
      <div role="tablist" className="flex gap-1">
        {LANGS.map(([l]) => (
          <button
            key={l}
            type="button"
            role="tab"
            aria-selected={lang === l}
            onClick={() => setLang(l)}
            className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-md ${lang === l ? "th-bg-elevated th-text" : "th-text-ghost hover:th-text-secondary"}`}
          >
            {t(`lang_${l}`)}
          </button>
        ))}
      </div>
      <CodeBlock code={build(call)} t={t} />
    </div>
  );
}

/**
 * Step-by-step "how to use" for the selected trigger kind: what it allows,
 * whether publishing is needed, numbered steps, the exact call to copy
 * (real workflow id, sample payload, live webhook URL once the server gives
 * it), what comes back and how to check it ran. Static text keeps working
 * when the server can't report the live trigger state.
 */
export default function TriggerUsageGuide({ kind, config, workflowId, nodeId, webhookUrl }) {
  const t = useTranslations("WorkflowTriggerGuide");
  const guide = TRIGGER_GUIDE[kind];
  if (!guide) return null;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const call = workflowId
    ? triggerCall(kind, { origin, workflowId, webhookUrl, webhookUrlPlaceholder: t("webhookUrlPlaceholder"), config })
    : null;
  const steps = Array.from({ length: guide.steps }, (_, i) => t(`${kind}_step${i + 1}`, { id: nodeId }));

  return (
    <details open className="mt-3 mb-3 rounded-xl th-bg-surface border th-border-secondary p-2.5 text-[11px] leading-relaxed">
      <summary className="cursor-pointer font-semibold th-text-secondary">{t("title")}</summary>
      <p className="mt-1.5 th-text-secondary">{t(`${kind}_what`)}</p>
      <p className={`mt-1 font-medium ${guide.publish ? "text-amber-400" : "text-emerald-400"}`}>
        {t(guide.publish ? "publishRequired" : "publishNotRequired")}
      </p>
      <ol className="mt-1.5 list-decimal pl-4 space-y-0.5 th-text-secondary">
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>

      {guide.call && !workflowId && <p className="mt-2 th-text-ghost">{t("saveFirst")}</p>}
      {call && (
        <>
          <p className="mt-2 font-semibold th-text-secondary">{t("callTitle")}</p>
          <CallExample call={call} t={t} />
          {guide.call === "run" && <p className="mt-1.5 th-text-ghost">{t("tokenHelp")}</p>}
          {call.signed && <p className="mt-1.5 th-text-ghost">{t("hmacHelp")}</p>}
        </>
      )}
      {guide.response && <p className="mt-1.5 th-text-ghost">{t(`response_${guide.response}`)}</p>}
      <p className="mt-1.5 th-text-ghost">{t(kind === "manual" ? "verify_manual" : "verify_automatic")}</p>
    </details>
  );
}
