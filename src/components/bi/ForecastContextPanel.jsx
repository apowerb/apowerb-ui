"use client";

import { useRef, useState } from "react";
import { useTranslations } from "use-intl";
import { Loader2, Sparkles, X } from "lucide-react";
import { interpretForecastContext } from "@/lib/api";
import { describeRanges, mergeContext, removeEvent, removeScenario } from "@/lib/forecast";

function Chip({ label, detail, onRemove, removeLabel }) {
  return (
    <li className="inline-flex items-center gap-1 max-w-full px-2 py-0.5 rounded-full border th-border th-bg-surface text-[11px]">
      <span className="font-medium th-text truncate">{label}</span>
      {detail && <span className="th-text-faint truncate">{detail}</span>}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          title={removeLabel}
          className="th-text-faint hover:text-red-400 flex-shrink-0"
        >
          <X size={11} />
        </button>
      )}
    </li>
  );
}

function scenarioDetail(t, s) {
  const parts = [];
  if (Array.isArray(s.events)) parts.push(t("contextScenarioEvents", { count: s.events.length }));
  for (const a of s.adjustments || []) {
    const value = a.percent != null ? `${a.percent > 0 ? "+" : ""}${a.percent} %` : `${a.add > 0 ? "+" : ""}${a.add}`;
    parts.push(`${describeRanges([a])} : ${value}`);
  }
  return parts.join(" · ");
}

/**
 * Panneau « Contexte et scénarios » du widget Prévision.
 *
 * Le texte libre part au cœur (POST /api/v1/forecast/interpret), qui renvoie
 * des événements datés et des scénarios déjà relus, plus ce qu'il a écarté
 * et pourquoi. Rien n'est appliqué sans relecture : la proposition s'affiche,
 * chaque élément peut être retiré, puis « Appliquer » recalcule la prévision.
 *
 * `bounds` : bornes de l'interprétation (contextWindow), null si inconnues.
 * `context` : { events, scenarios } appliqués. `onApply(next)` : applique
 * (et enregistre si possible) ; une promesse rejetée affiche son message.
 * `ignored` : noms d'événements que th2forecast n'a pas appris (`used: false`).
 * `onDone()` : appelé après l'application d'une proposition (retour au graphique).
 */
export default function ForecastContextPanel({ bounds: win, context, interpretEnabled, onApply, onDone, ignored = [] }) {
  const t = useTranslations("ForecastChart");
  const [text, setText] = useState("");
  const [status, setStatus] = useState("idle"); // idle|loading|error
  const [error, setError] = useState(null);
  const [proposal, setProposal] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const abortRef = useRef(null);

  const interpret = async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus("loading");
    setError(null);
    setProposal(null);
    try {
      const res = await interpretForecastContext(
        { ...win, text: text.trim(), events: context.events },
        { signal: controller.signal },
      );
      setProposal(res);
      setStatus("idle");
    } catch (err) {
      if (err?.name === "AbortError") return;
      setError(err);
      setStatus("error");
    }
  };

  const apply = async (next) => {
    setSaveError(null);
    try {
      await onApply(next);
      return true;
    } catch (err) {
      setSaveError(err?.message || String(err));
      return false;
    }
  };

  const errorText = (() => {
    if (!error) return null;
    const code = error.detail?.code;
    if (code === "CONTEXT_OFF_TOPIC") return t("contextOffTopic");
    if (code === "CONTEXT_NOT_UNDERSTOOD")
      return t("contextNotUnderstood", { start: win.history_start, end: win.horizon_end });
    if (error.status === 402) return t("contextQuota");
    if (error.status === 503) return t("contextUnavailable");
    return error.message;
  })();
  const rejected = proposal?.rejected || error?.detail?.rejected || [];
  const notes = proposal?.notes || error?.detail?.notes || [];
  const hasProposal = proposal && (proposal.events.length > 0 || proposal.scenarios.length > 0);
  const hasContext = context.events.length > 0 || context.scenarios.length > 0;

  return (
    <div data-testid="forecast-context" className="flex flex-col gap-3 text-xs">
      <section>
        <h4 className="text-[11px] font-semibold th-text-secondary mb-1">{t("contextCurrent")}</h4>
        {hasContext ? (
          <ul className="flex flex-wrap gap-1.5">
            {context.events.map((e) => (
              <Chip
                key={`e-${e.name}`}
                label={e.name}
                detail={
                  ignored.includes(e.name) ? t("contextIgnoredShort") : describeRanges(e.ranges)
                }
                onRemove={() => apply(removeEvent(context, e.name))}
                removeLabel={t("contextRemove", { name: e.name })}
              />
            ))}
            {context.scenarios.map((s) => (
              <Chip
                key={`s-${s.name}`}
                label={`${t("scenarioLabel")} : ${s.name}`}
                detail={scenarioDetail(t, s)}
                onRemove={() => apply(removeScenario(context, s.name))}
                removeLabel={t("contextRemove", { name: s.name })}
              />
            ))}
          </ul>
        ) : (
          <p className="th-text-faint">{t("contextNone")}</p>
        )}
        {ignored.length > 0 && (
          <p className="mt-1 text-[11px] text-amber-400">{t("contextIgnored", { names: ignored.join(", ") })}</p>
        )}
        {saveError && <p className="mt-1 text-[11px] text-red-400">{t("contextSaveFailed", { message: saveError })}</p>}
      </section>

      {interpretEnabled && win && (
        <section>
          <label htmlFor="forecast-context-text" className="block text-[11px] font-semibold th-text-secondary mb-1">
            {t("contextTitle")}
          </label>
          <p className="th-text-faint mb-1.5">{t("contextHint", { start: win.history_start, end: win.horizon_end })}</p>
          <textarea
            id="forecast-context-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder={t("contextPlaceholder")}
            className="glass-input w-full px-3 py-2 rounded-lg text-xs"
          />
          <div className="flex items-center gap-2 mt-1.5">
            <button
              type="button"
              onClick={interpret}
              disabled={status === "loading" || text.trim().length < 3}
              className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 disabled:opacity-50"
            >
              {status === "loading" ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
              {status === "loading" ? t("contextInterpreting") : t("contextInterpret")}
            </button>
            {errorText && (
              <p role="alert" className="text-[11px] text-red-400">
                {errorText}
              </p>
            )}
          </div>
        </section>
      )}

      {hasProposal && (
        <section data-testid="forecast-context-proposal" className="p-2 rounded-lg border border-blue-500/20 bg-blue-500/5">
          <h4 className="text-[11px] font-semibold th-text-secondary mb-1">{t("contextProposal")}</h4>
          <ul className="flex flex-wrap gap-1.5">
            {proposal.events.map((e) => (
              <Chip
                key={`pe-${e.name}`}
                label={e.name}
                detail={[
                  describeRanges(e.ranges),
                  e.groups ? t("contextGroups", { groups: e.groups.join(", ") }) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                onRemove={() => setProposal({ ...proposal, events: proposal.events.filter((x) => x !== e) })}
                removeLabel={t("contextRemove", { name: e.name })}
              />
            ))}
            {proposal.scenarios.map((s) => (
              <Chip
                key={`ps-${s.name}`}
                label={`${t("scenarioLabel")} : ${s.name}`}
                detail={scenarioDetail(t, s)}
                onRemove={() => setProposal({ ...proposal, scenarios: proposal.scenarios.filter((x) => x !== s) })}
                removeLabel={t("contextRemove", { name: s.name })}
              />
            ))}
          </ul>
          <div className="flex items-center gap-2 mt-2">
            <button
              type="button"
              onClick={async () => {
                const saved = await apply(mergeContext(context, proposal));
                setProposal(null);
                setText("");
                if (saved) onDone?.();
              }}
              className="text-[11px] px-2.5 py-1 rounded bg-blue-500 text-white hover:bg-blue-600"
            >
              {t("contextApply")}
            </button>
            <button
              type="button"
              onClick={() => setProposal(null)}
              className="text-[11px] px-2.5 py-1 rounded border th-border th-text-secondary hover:th-text"
            >
              {t("contextDiscard")}
            </button>
          </div>
        </section>
      )}

      {(rejected.length > 0 || notes.length > 0) && (
        <ul className="space-y-0.5 text-[11px]">
          {rejected.map((r, i) => (
            <li key={`r-${i}`} className="text-amber-400">
              {t("contextRejected", { item: r.item, reason: r.reason })}
            </li>
          ))}
          {notes.map((n, i) => (
            <li key={`n-${i}`} className="th-text-faint">
              {n}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
