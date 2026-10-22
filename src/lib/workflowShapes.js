/**
 * Shape of a node's output, known before the whole workflow has run
 * (proactive Studio, step 2). A shape lists keys and types, never values:
 *
 *   { type: "string" | "number" | "boolean" | "null" | "any" }
 *   { type: "object", fields?: { key: shape }, truncated?: true }
 *   { type: "array", items?: shape }
 *
 * The server sends the same vocabulary from `POST /workflows/defs/node-shapes`
 * (`core/workflow_shapes.py`): the graph's configuration ("static") and the
 * last answer of each tool ("learned"). A run of this session ("run") wins
 * over both: it is what the node really returned.
 */

import { getUpstreamNodeIds } from "@/lib/workflowGraph";

const MAX_DEPTH = 4;
const MAX_KEYS = 50;
export const MAX_FIELD_CHIPS = 12;

/** Shape of a JS value: keys and types, no value. */
export function shapeOf(value, depth = MAX_DEPTH) {
  if (value === null || value === undefined) return { type: "null" };
  if (typeof value === "boolean") return { type: "boolean" };
  if (typeof value === "number") return { type: "number" };
  if (typeof value === "string") return { type: "string" };
  if (Array.isArray(value)) {
    if (depth <= 0 || value.length === 0) return { type: "array" };
    return { type: "array", items: shapeOf(value[0], depth - 1) };
  }
  if (typeof value === "object") {
    if (depth <= 0) return { type: "object" };
    const keys = Object.keys(value);
    const fields = {};
    for (const k of keys.slice(0, MAX_KEYS)) fields[k] = shapeOf(value[k], depth - 1);
    return keys.length > MAX_KEYS ? { type: "object", fields, truncated: true } : { type: "object", fields };
  }
  return { type: "any" };
}

/**
 * The paths a template can reach in `shape`, depth-first, objects only
 * (`{{node.a.b}}` — the engine never indexes into a list).
 */
export function shapeFieldPaths(shape, maxDepth = 3, prefix = "") {
  if (!shape || shape.type !== "object" || !shape.fields || maxDepth <= 0) return [];
  const out = [];
  for (const [key, sub] of Object.entries(shape.fields)) {
    const path = prefix ? `${prefix}.${key}` : key;
    out.push({ path, type: sub?.type || "any" });
    out.push(...shapeFieldPaths(sub, maxDepth - 1, path));
  }
  return out;
}

/**
 * Best known shape per node id: the last run's output when the node ran,
 * else what the server knows (`serverShapes`, `{id: {source, shape}}`).
 */
export function knownShapes(serverShapes, runState) {
  const out = { ...(serverShapes || {}) };
  for (const entry of runState?.timeline || []) {
    // A tool in "continue" mode that reported an error: its answer is not its shape.
    if (entry.reportedError) continue;
    if (entry.status === "done" && entry.output !== null && entry.output !== undefined) {
      out[entry.id] = { source: "run", shape: shapeOf(entry.output) };
    }
  }
  return out;
}

// Nodes whose run reaches outside the Studio: a message, a call, a write, or
// a model call that costs tokens. Listed before a "Test up to here".
export const EFFECT_NODE_TYPES = new Set([
  "notification",
  "http",
  "db_write",
  "tool",
  "agent",
  "extract",
  "classifier",
  "rag",
  "subworkflow",
]);

/** `nodeId` and every node above it. */
export function ancestorIdsOf(nodeId, edges) {
  return new Set([nodeId, ...getUpstreamNodeIds(nodeId, edges)]);
}

// A loop or try runs its `config.body` sub-graph: its effects are its body's,
// listed as "Loop › Step" (`inBody`), at any depth.
function bodyEffects(node, label) {
  const body = node.data?.config?.body ?? node.config?.body;
  return (body?.nodes || []).flatMap((child) => {
    const childLabel = `${label} › ${child.label || child.data?.label || child.id}`;
    const own = EFFECT_NODE_TYPES.has(child.type)
      ? [{ id: `${node.id}.${child.id}`, type: child.type, label: childLabel, inBody: true }]
      : [];
    return [...own, ...bodyEffects(child, childLabel)];
  });
}

function effectsOf(nodes, keep) {
  return nodes
    .filter((n) => keep(n.id))
    .flatMap((n) => {
      const label = n.data?.label || n.id;
      const own = EFFECT_NODE_TYPES.has(n.type) ? [{ id: n.id, type: n.type, label }] : [];
      return [...own, ...bodyEffects(n, label)];
    });
}

/** The nodes a "Test up to here" on `nodeId` would run that have an effect. */
export function effectfulNodesUpTo(nodeId, nodes, edges) {
  const ids = ancestorIdsOf(nodeId, edges);
  return effectsOf(nodes, (id) => ids.has(id));
}

/**
 * The nodes a "Resume here" may really run that have an effect: every node
 * the failed run had not finished (`done`) — the failed step and below, a
 * step added since, a branch that had not run yet — up to `until` when the
 * failed run was a "Test up to here". A loop or try that had not finished
 * starts over: its body is listed. Finished nodes are replayed, not run.
 */
export function effectfulNodesToResume(nodes, edges, { done, until = null }) {
  const bound = until ? ancestorIdsOf(until, edges) : null;
  return effectsOf(nodes, (id) => !done.has(id) && (!bound || bound.has(id)));
}

const INPUT_FIELD = {
  agent: "input",
  extract: "input",
  convert: "input",
  subworkflow: "input",
  rag: "query",
  notification: "body",
  output: "value",
  http: "body",
};

function lastSegment(path) {
  const parts = (path || "").split(".").filter(Boolean);
  return parts[parts.length - 1] || "value";
}

/**
 * Config patch that puts `{{sourceId.path}}` where `node` takes its input —
 * the Studio proposes, the person clicks. `null` when the node has no
 * single input field (a router's rules, a trigger…).
 */
export function insertFieldPatch(node, sourceId, path) {
  const snippet = path ? `{{${sourceId}.${path}}}` : `{{${sourceId}}}`;
  const config = node?.data?.config || {};
  if (node?.type === "set") {
    return { fields: [...(config.fields || []), { key: lastSegment(path), value: snippet }] };
  }
  if (node?.type === "tool") {
    const args = config.args && typeof config.args === "object" ? config.args : {};
    return { args: { ...args, [lastSegment(path)]: snippet } };
  }
  const field = INPUT_FIELD[node?.type];
  if (!field) return null;
  const current = typeof config[field] === "string" ? config[field] : "";
  return { [field]: current ? `${current} ${snippet}` : snippet };
}
