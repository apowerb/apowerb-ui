"use client";

import { useEffect, useMemo, useState } from "react";
import { getWorkflowNodeShapes } from "@/lib/api";
import { flowToGraph } from "@/lib/workflowGraph";

/**
 * What the server knows of each node's output shape without running it
 * (`POST /workflows/defs/node-shapes`): the graph's configuration plus the
 * last answer of each tool. Asked again, after a pause, whenever the graph's
 * structure or a configuration changes — moving a node does not count — and
 * when `refreshKey` changes (a run just taught the server a tool's shape).
 *
 * A failed request keeps the shapes already known: the hint is a help, not
 * a gate.
 */
export function useNodeShapes(nodes, edges, refreshKey = 0, { delayMs = 600 } = {}) {
  const [shapes, setShapes] = useState({});
  const graph = useMemo(() => {
    const g = flowToGraph(nodes, edges);
    return { ...g, nodes: g.nodes.map(({ position: _position, ...rest }) => rest) };
  }, [nodes, edges]);
  const key = useMemo(() => JSON.stringify(graph), [graph]);

  useEffect(() => {
    if (graph.nodes.length === 0) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      Promise.resolve()
        .then(() => getWorkflowNodeShapes(graph, { signal: controller.signal }))
        .then((res) => {
          if (!controller.signal.aborted && res && typeof res.shapes === "object") setShapes(res.shapes || {});
        })
        .catch(() => {});
    }, delayMs);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // `key` stands for `graph`'s content: a new object with the same content must not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, refreshKey, delayMs]);

  return shapes;
}
