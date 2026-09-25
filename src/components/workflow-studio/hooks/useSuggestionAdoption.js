import { useCallback, useEffect, useRef } from "react";

/**
 * Were the next-step chips taken, and whose — the rules' or the model's
 * (roadmap#88)? One event per step: the most chips each source showed while
 * it lasted and the one picked, if any. A step ends when its slot changes
 * (another node selected, this one wired) or the studio is left; the server
 * only adds the counts to daily totals.
 *
 * Hiding the tab does not end a step: coming back to it is the same step.
 */
export function useSuggestionAdoption(slot, suggestions, send) {
  const stepRef = useRef(null);
  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  });

  const report = useCallback((keepalive) => {
    const step = stepRef.current;
    stepRef.current = null;
    if (!step || !(step.rules || step.ai)) return;
    sendRef
      .current({ rules_shown: step.rules, ai_shown: step.ai, accepted: step.accepted }, { keepalive })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (stepRef.current && stepRef.current.slot !== slot) report(false);
    if (slot == null) return;
    const ai = suggestions.filter((s) => s.source === "ai").length;
    const step = stepRef.current ?? { slot, rules: 0, ai: 0, accepted: null };
    stepRef.current = {
      ...step,
      rules: Math.max(step.rules, suggestions.length - ai),
      ai: Math.max(step.ai, ai),
    };
  }, [slot, suggestions, report]);

  useEffect(() => {
    const onPageHide = () => report(true);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      report(true);
    };
  }, [report]);

  return useCallback((suggestion) => {
    const step = stepRef.current;
    if (step && !step.accepted) {
      step.accepted = { source: suggestion.source === "ai" ? "ai" : "rules", type: suggestion.type };
    }
  }, []);
}
