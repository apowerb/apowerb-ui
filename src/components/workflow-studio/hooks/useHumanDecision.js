import { useCallback, useEffect, useRef, useState } from "react";
import { listAwaitingDecisions, resumeWorkflowRun } from "@/lib/api";
import { applyRunEvent, createRunState } from "@/lib/workflowRunState";
import { consumeWorkflowRun } from "@/lib/workflowSse";
import { decisionFromRow } from "../AwaitingDecisionsList";

const keyOf = (d) => (d ? `${d.runId}:${d.nodeId}` : null);

/**
 * The studio side of a human decision (`approval` node).
 *
 * - `decision` is the one to show in the dialog: the run that just parked
 *   (live state `awaiting`), or one reopened from the list / the panel / the
 *   `?decision=<run_id>` of the URL. "Later" (`close`) only hides it: the run
 *   stays parked and `reopen` brings it back.
 * - `answer(decision, {choice}|{text})` resumes that run. A refusal (404, 409,
 *   422) is thrown to the dialog BEFORE anything changes on screen; once the
 *   stream is accepted the test panel is reset and fed with the same reducer
 *   as a normal run (replayed nodes, the answer, the rest of the run).
 */
export function useHumanDecision({ liveRunState, setRunState, setRunEvents, setIsRunning, liveRunRef, onResumed }) {
  const [manual, setManual] = useState(null);
  const [dismissed, setDismissed] = useState(null);
  const [resumes, setResumes] = useState(0);
  // A resumption is never cut from here: leaving its stream does not stop it
  // on the engine. A replaced stream (another answer) or one that outlives the
  // studio is only no longer listened to; Stop cancels it by its run id.
  const generationRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const pending = liveRunState.status === "awaiting" ? liveRunState.pendingDecision : null;
  const pendingKey = keyOf(pending);
  const decision = manual ?? (pending && dismissed !== pendingKey ? pending : null);

  // Back from a closed tab: the workflows page links here with the run's id.
  useEffect(() => {
    const runId = new URLSearchParams(window.location.search).get("decision");
    if (!runId) return undefined;
    let cancelled = false;
    Promise.resolve(listAwaitingDecisions())
      .then((rows) => {
        const row = (Array.isArray(rows) ? rows : []).find((r) => r.run_id === runId);
        if (row && !cancelled) setManual(decisionFromRow(row));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const close = useCallback(() => {
    setManual(null);
    setDismissed(pendingKey);
  }, [pendingKey]);

  const reopen = useCallback(() => {
    if (pending) setManual(pending);
  }, [pending]);

  const answer = useCallback(
    async (target, body) => {
      const controller = new AbortController();
      const response = await resumeWorkflowRun(target.runId, body, { signal: controller.signal });
      // Accepted: from here on the run is shown again, from its start.
      setManual(null);
      setDismissed(keyOf(target));
      const generation = ++generationRef.current;
      const listened = () => mountedRef.current && generationRef.current === generation;
      liveRunRef.current = { runId: target.runId, detached: true };
      setRunState(createRunState());
      setRunEvents([]);
      setIsRunning(true);
      onResumed?.();
      consumeWorkflowRun(response, {
        signal: controller.signal,
        onEvent: (evt) => {
          if (!listened()) return;
          setRunEvents((list) => [...list, evt]);
          setRunState((s) => applyRunEvent(s, evt));
        },
      })
        .catch((err) => {
          if (controller.signal.aborted || !listened()) return;
          const evt = { event: "error", code: "server_unreachable", detail: err?.message, params: { status: "-" } };
          setRunEvents((list) => [...list, evt]);
          setRunState((s) => applyRunEvent(s, evt));
        })
        .finally(() => {
          if (!listened()) return;
          setIsRunning(false);
          setResumes((n) => n + 1);
        });
    },
    [liveRunRef, onResumed, setIsRunning, setRunEvents, setRunState],
  );

  // A run given up from the list: if it is the one on screen, it is over.
  const abandoned = useCallback(
    (item) => {
      setManual((m) => (m && m.runId === item.runId ? null : m));
      if (pending && pending.runId === item.runId) {
        const evt = { event: "cancelled" };
        setRunEvents((list) => [...list, evt]);
        setRunState((s) => applyRunEvent(s, evt));
      }
    },
    [pending, setRunEvents, setRunState],
  );

  return { decision, close, reopen, answer, abandoned, refreshKey: `${pendingKey ?? "-"}:${resumes}` };
}
