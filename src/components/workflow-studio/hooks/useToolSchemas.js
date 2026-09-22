"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getToolSchema } from "@/lib/api";

/**
 * Per-studio-session cache of `GET /api/workflows/tools/schema`, keyed by
 * `tool_ref` (a tool node's `config.tool`). One `useToolSchemas()` call is
 * meant to be lifted to the top of a studio (`WorkflowStudio`, and the
 * loop-body editor it opens) and its `{schemas, ensure}` passed down, so
 * every tool node — selected or not, on the canvas or inside a loop body —
 * shares the same cache: a tool used by two nodes is fetched once, and
 * re-rendering or re-selecting a node never re-fetches an already-known or
 * in-flight tool.
 *
 * `schemas[toolRef]` is `undefined` (never asked for), `{status: "loading"}`,
 * `{status: "ready", schema}` or `{status: "error", error}`.
 */
export function useToolSchemas() {
  const [schemas, setSchemas] = useState({});
  const controllersRef = useRef({});

  const ensure = useCallback((toolRef) => {
    if (!toolRef) return;
    setSchemas((prev) => {
      // Already cached or already in flight for this exact tool_ref — the
      // functional updater form makes this check-and-mark atomic even if
      // two callers `ensure()` the same brand-new tool in the same tick.
      if (prev[toolRef]) return prev;
      const controller = new AbortController();
      controllersRef.current[toolRef] = controller;
      getToolSchema(toolRef, { signal: controller.signal })
        .then((schema) => {
          setSchemas((s) => ({ ...s, [toolRef]: { status: "ready", schema } }));
        })
        .catch((err) => {
          if (err?.name === "AbortError") return;
          setSchemas((s) => ({ ...s, [toolRef]: { status: "error", error: err } }));
        })
        .finally(() => {
          delete controllersRef.current[toolRef];
        });
      return { ...prev, [toolRef]: { status: "loading" } };
    });
  }, []);

  // Abort whatever is still in flight when the studio session ends (unmount)
  // rather than letting it resolve into a state nobody reads anymore.
  useEffect(() => {
    const controllers = controllersRef.current;
    return () => {
      for (const controller of Object.values(controllers)) controller.abort();
    };
  }, []);

  return useMemo(() => ({ schemas, ensure }), [schemas, ensure]);
}
