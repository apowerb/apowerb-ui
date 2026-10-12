"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { patchDashboardSpec } from "@/lib/api";
import { inverseOps, newId, parsePatchError } from "./lib";

/**
 * State machine of the editor: sends PatchOps, tracks the save status and
 * keeps the undo/redo stacks.
 *
 * Undo choice: each applied batch stores its *inverse ops*, computed from the
 * dashboard as it was before the batch (update_visual → previous values of the
 * touched keys, add_visual → remove_component, remove_component → add_visual
 * with the same id/position, upsert_* → previous upsert or remove, ...).
 * Undo sends these inverse ops through the same endpoint, so the server stays
 * the single source of truth and validates the restored state. Redo replays the
 * original ops. Batches that cannot be inverted are applied but not undoable.
 *
 * Requests are chained so ops always reach the server in the order they were
 * issued (a debounced text field may commit while a previous save is in flight).
 */
export function useSpecEditor({ dashboard, onDashboardChange }) {
  const [status, setStatus] = useState("idle"); // idle | saving | saved | error
  const [error, setError] = useState(null);
  const [counts, setCounts] = useState({ past: 0, future: 0 });
  const dashRef = useRef(dashboard);
  const cbRef = useRef(onDashboardChange);
  const past = useRef([]);
  const future = useRef([]);
  const chain = useRef(Promise.resolve());
  const mounted = useRef(true);

  useEffect(() => {
    dashRef.current = dashboard;
    cbRef.current = onDashboardChange;
  });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const sync = () => setCounts({ past: past.current.length, future: future.current.length });

  const send = useCallback(async (ops, field) => {
    const prev = dashRef.current;
    if (mounted.current) {
      setStatus("saving");
      setError(null);
    }
    try {
      const res = await patchDashboardSpec(prev.id, { ops, dry_run: false });
      const next = res?.dashboard ?? res;
      dashRef.current = next;
      cbRef.current?.(next);
      if (mounted.current) setStatus("saved");
      return next;
    } catch (err) {
      if (mounted.current) {
        setError({ ...parsePatchError(err), field: field || null });
        setStatus("error");
      }
      return null;
    }
  }, []);

  const enqueue = (fn) => {
    const run = chain.current.then(fn, fn);
    chain.current = run.catch(() => {});
    return run;
  };

  /** Apply ops; resolves with the new dashboard, or null on error. */
  const apply = useCallback((rawOps, { field = null } = {}) => {
    const ops = rawOps.map((o) => (o.op === "add_visual" && !o.component_id ? { ...o, component_id: newId() } : o));
    return enqueue(async () => {
      const inverse = inverseOps(dashRef.current, ops);
      const next = await send(ops, field);
      if (next) {
        if (inverse) {
          past.current.push({ ops, inverse });
          if (past.current.length > 100) past.current.shift();
        } else {
          past.current = [];
        }
        future.current = [];
        if (mounted.current) sync();
      }
      return next;
    });
  }, [send]);

  const undo = useCallback(() => enqueue(async () => {
    const entry = past.current[past.current.length - 1];
    if (!entry) return null;
    const next = await send(entry.inverse, null);
    if (next) {
      past.current.pop();
      future.current.push(entry);
      if (mounted.current) sync();
    }
    return next;
  }), [send]);

  const redo = useCallback(() => enqueue(async () => {
    const entry = future.current[future.current.length - 1];
    if (!entry) return null;
    const next = await send(entry.ops, null);
    if (next) {
      future.current.pop();
      past.current.push(entry);
      if (mounted.current) sync();
    }
    return next;
  }), [send]);

  /** Validate + compute without saving: resolves {dashboard, data} or throws a parsed error. */
  const dryRun = useCallback(async (ops) => {
    try {
      return await patchDashboardSpec(dashRef.current.id, { ops, dry_run: true });
    } catch (err) {
      const parsed = parsePatchError(err);
      const e = new Error(parsed.message);
      e.parsed = parsed;
      throw e;
    }
  }, []);

  return {
    status,
    error,
    clearError: () => setError(null),
    canUndo: counts.past > 0,
    canRedo: counts.future > 0,
    apply,
    undo,
    redo,
    dryRun,
  };
}
