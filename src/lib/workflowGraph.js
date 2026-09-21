/**
 * Pure graph logic for the Workflow Studio — no React, no fetch, no DOM.
 *
 * Owns the conversion between the backend graph shape
 * ({version, nodes:[{id,type,label,config,position}], edges:[{id?,source,target,route?}]})
 * and @xyflow/react's node/edge shape, plus the bits of validation that can
 * run instantly in the browser (route labels, template references). The
 * backend's `POST /defs/validate` stays authoritative — this is a fast
 * first pass for the validation badge, not a replacement.
 */

import dagre from "dagre";
import { validateTriggerConfig } from "./workflowTriggers";

export const NODE_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;

export const NODE_TYPES = [
  "trigger",
  "agent",
  "tool",
  "router",
  "classifier",
  "merge",
  "loop",
  "approval",
  "output",
  "convert",
];

/** What a convert node can turn its input into; mirrors the backend's CONVERT_TARGETS. */
export const CONVERT_TARGETS = ["text", "json", "number", "boolean", "list"];

// Present in the palette but the backend's /run and /validate reject it —
// kept in one place so the inspector, the palette badge and local
// validation agree. `loop` used to be here too; the backend runs it now
// (21/09), `approval` alone remains "soon".
export const UNRUNNABLE_NODE_TYPES = new Set(["approval"]);

export function isRunnableType(type) {
  return !UNRUNNABLE_NODE_TYPES.has(type);
}

export const LOOP_MAX_ITERATIONS_CAP = 100;
export const LOOP_OPERATORS = ["eq", "ne", "gt", "gte", "lt", "lte", "contains", "in", "exists"];

/** A loop body must contain exactly one trigger — this is that trigger, pre-created so a fresh loop node is already valid-shaped. */
export function createLoopBody() {
  return {
    version: 1,
    nodes: [{ id: "trigger1", type: "trigger", label: "", config: { kind: "manual" }, position: { x: 0, y: 0 } }],
    edges: [],
  };
}

// family/color are pure data so both the palette and the node badges (two
// different render layers) read from one source instead of drifting apart.
export const NODE_FAMILIES = {
  trigger: { family: "trigger", color: "amber" },
  agent: { family: "intelligence", color: "brand" },
  classifier: { family: "intelligence", color: "violet" },
  tool: { family: "tools", color: "emerald" },
  router: { family: "logic", color: "blue" },
  merge: { family: "logic", color: "blue" },
  loop: { family: "logic", color: "violet" },
  approval: { family: "logic", color: "violet" },
  convert: { family: "tools", color: "emerald" },
  output: { family: "output", color: "amber" },
};

export function createEmptyGraph() {
  return { version: 1, nodes: [], edges: [] };
}

/** Smallest free `${type}${n}` id that also satisfies NODE_ID_PATTERN. */
export function nextNodeId(type, existingIds = []) {
  const used = new Set(existingIds);
  let n = 1;
  let id = `${type}${n}`;
  while (used.has(id) || !NODE_ID_PATTERN.test(id)) {
    n += 1;
    id = `${type}${n}`;
  }
  return id;
}

function defaultConfig(type) {
  switch (type) {
    case "trigger":
      return { kind: "manual" };
    case "agent":
      return { agent_id: "" };
    case "tool":
      return { tool: "" };
    case "router":
      return { rules: [], default_route: "" };
    case "classifier":
      return { agent_id: "", routes: [] };
    case "loop":
      return { mode: "foreach", max_iterations: 10, items: "", body: createLoopBody() };
    case "convert":
      return { to: "text" };
    default:
      return {};
  }
}

export function createNode(type, { id, position, existingIds = [], label } = {}) {
  const nodeId = id || nextNodeId(type, existingIds);
  return {
    id: nodeId,
    type,
    label: label || "",
    config: defaultConfig(type),
    position: position || { x: 0, y: 0 },
  };
}

// Encombrement d'un nœud sur le canvas (NodeShell), marge comprise.
export const NODE_BOX = { width: 220, height: 80 };
const NODE_GAP = { x: 60, y: 40 };

/**
 * Where to drop a node added from the palette: right of ``anchorId`` (the
 * selected node) or of the right-most node, on the first row that does not
 * overlap anything. Before, click-to-add used a fixed spot and stacked nodes
 * on top of each other.
 */
export function findFreePosition(nodes = [], anchorId) {
  if (!nodes.length) return { x: 0, y: 0 };
  const pos = (n) => n.position || { x: 0, y: 0 };
  const anchor = nodes.find((n) => n.id === anchorId)
    || nodes.reduce((a, b) => (pos(b).x > pos(a).x ? b : a));
  const x = pos(anchor).x + NODE_BOX.width + NODE_GAP.x;
  const collides = (y) => nodes.some((n) => {
    const p = pos(n);
    return x < p.x + NODE_BOX.width && p.x < x + NODE_BOX.width
      && y < p.y + NODE_BOX.height && p.y < y + NODE_BOX.height;
  });
  const step = NODE_BOX.height + NODE_GAP.y;
  // Même ligne que l'ancre, puis alternativement dessous et dessus.
  for (let i = 0; i < 200; i += 1) {
    const y = pos(anchor).y + Math.ceil(i / 2) * step * (i % 2 ? 1 : -1);
    if (!collides(y)) return { x, y };
  }
  return { x, y: Math.max(...nodes.map((n) => pos(n).y)) + step };
}

/** Deep-ish clone (config is JSON-safe) with a fresh id, offset a bit so it doesn't sit exactly on top of the original. */
export function duplicateNode(node, existingIds = []) {
  return {
    ...node,
    id: nextNodeId(node.type, existingIds),
    config: JSON.parse(JSON.stringify(node.config || {})),
    position: {
      x: (node.position?.x || 0) + 48,
      y: (node.position?.y || 0) + 48,
    },
  };
}

// --- graph <-> @xyflow/react -------------------------------------------

/** Server graph -> {nodes, edges} ready for <ReactFlow>. `type` doubles as the nodeTypes registry key. */
export function graphToFlow(graph) {
  const nodes = (graph?.nodes || []).map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position || { x: 0, y: 0 },
    data: { label: n.label || "", nodeType: n.type, config: n.config || {} },
  }));
  const edges = (graph?.edges || []).map((e, i) => ({
    id: e.id || `${e.source}->${e.target}#${e.route || i}`,
    source: e.source,
    target: e.target,
    type: "route",
    data: { route: e.route || null },
  }));
  return { nodes, edges };
}

/** xyflow nodes/edges -> server graph shape. Client-side edge ids are dropped — the server doesn't need them back. */
export function flowToGraph(nodes, edges) {
  return {
    version: 1,
    nodes: (nodes || []).map((n) => ({
      id: n.id,
      type: n.data?.nodeType || n.type,
      label: n.data?.label || "",
      config: n.data?.config || {},
      position: {
        x: Math.round(n.position?.x || 0),
        y: Math.round(n.position?.y || 0),
      },
    })),
    edges: (edges || []).map((e) => ({
      source: e.source,
      target: e.target,
      ...(e.data?.route ? { route: e.data.route } : {}),
    })),
  };
}

// --- upstream / templates -----------------------------------------------

/** All node ids reachable by walking edges backward from `nodeId` (not including itself). */
export function getUpstreamNodeIds(nodeId, edges = []) {
  const incoming = new Map();
  for (const e of edges) {
    if (!incoming.has(e.target)) incoming.set(e.target, []);
    incoming.get(e.target).push(e.source);
  }
  const visited = new Set();
  const stack = [...(incoming.get(nodeId) || [])];
  while (stack.length) {
    const cur = stack.pop();
    if (visited.has(cur) || cur === nodeId) continue;
    visited.add(cur);
    stack.push(...(incoming.get(cur) || []));
  }
  return [...visited];
}

const TEMPLATE_RE = /\{\{\s*([A-Za-z][A-Za-z0-9_-]{0,63})((?:\.[A-Za-z0-9_$-]+)*)\s*\}\}/g;

/** Every `{{id.path}}` reference found anywhere inside a (possibly nested) config value. */
export function extractTemplateRefs(value, acc = []) {
  if (typeof value === "string") {
    TEMPLATE_RE.lastIndex = 0;
    let m;
    while ((m = TEMPLATE_RE.exec(value))) {
      acc.push({ raw: m[0], nodeId: m[1], path: m[2] ? m[2].slice(1) : "" });
    }
  } else if (Array.isArray(value)) {
    for (const v of value) extractTemplateRefs(v, acc);
  } else if (value && typeof value === "object") {
    for (const v of Object.values(value)) extractTemplateRefs(v, acc);
  }
  return acc;
}

/** Suggested `{{id...}}` snippets for a given upstream node, shown as one-click chips in the inspector. */
export function templateSuggestionsFor(node) {
  if (!node) return [];
  const base = [`{{${node.id}}}`];
  switch (node.type) {
    case "trigger":
      return [`{{${node.id}.payload}}`, ...base];
    case "router":
    case "classifier":
      return [`{{${node.id}.route}}`, `{{${node.id}.output}}`, ...base];
    default:
      return [`{{${node.id}.output}}`, ...base];
  }
}

// --- local validation -----------------------------------------------------

function declaredRoutes(node) {
  if (node.type === "router") {
    const routes = new Set((node.config?.rules || []).map((r) => r.route).filter(Boolean));
    if (node.config?.default_route) routes.add(node.config.default_route);
    return routes;
  }
  if (node.type === "classifier") {
    return new Set((node.config?.routes || []).map((r) => r.route).filter(Boolean));
  }
  return null; // not a routing node
}

function validateLoopConfig(node, context) {
  const errors = [];
  const cfg = node.config || {};
  const push = (message, extra) => errors.push({ nodeId: node.id, message, ...extra });

  const maxIter = cfg.max_iterations;
  if (!Number.isInteger(maxIter) || maxIter < 1 || maxIter > LOOP_MAX_ITERATIONS_CAP) {
    push(`loopMaxIterations:${maxIter}`);
  }

  if (cfg.mode === "foreach") {
    if (!cfg.items || typeof cfg.items !== "string" || !cfg.items.trim()) {
      push("loopItemsRequired");
    }
  } else if (cfg.mode === "until") {
    const until = cfg.until || {};
    if (!until.field || !until.op) push("loopUntilRequired");
    else if (!LOOP_OPERATORS.includes(until.op)) push(`loopUntilUnknownOp:${until.op}`);
  } else {
    push(`loopUnknownMode:${cfg.mode}`);
  }

  const body = cfg.body;
  if (!body || !Array.isArray(body.nodes)) {
    push("loopBodyMissing");
    return errors;
  }
  const triggerCount = body.nodes.filter((n) => n.type === "trigger").length;
  if (triggerCount !== 1) {
    push(`loopBodyTriggerCount:${triggerCount}`);
  }
  const bodyResult = validateGraphCore(body, context);
  for (const e of bodyResult.errors) {
    errors.push({ ...e, nodeId: `${node.id}.${e.nodeId}` });
  }
  return errors;
}

/**
 * Fast local pass: node id shape/uniqueness, dangling edges, missing/unknown
 * route labels on router|classifier outgoing edges, and templates pointing
 * outside their node's upstream set. Returns {valid, errors:[{nodeId, message}]}.
 *
 * `validateGraphLocal` is the public entry point for the main canvas.
 * `validateGraphCore` is also used recursively on a loop node's `body`
 * sub-graph, which is why the loop/template checks below never need to know
 * whether they're looking at the outer graph or a nested one.
 *
 * `context.currentWorkflowId` and `context.now` feed the trigger checks that
 * need to know more than the graph itself (a `workflow_done` trigger
 * refusing to listen to its own workflow, an `at` schedule refusing a past
 * date) — both default to safe values so most callers can omit `context`.
 */
export function validateGraphLocal(graph, context = {}) {
  return validateGraphCore(graph, context);
}

function validateGraphCore(graph, context = {}) {
  const nodes = graph?.nodes || [];
  const edges = graph?.edges || [];
  const errors = [];
  const ids = new Set();

  for (const n of nodes) {
    if (!NODE_ID_PATTERN.test(n.id)) {
      errors.push({ nodeId: n.id, message: `invalidId:${n.id}` });
    }
    if (ids.has(n.id)) {
      errors.push({ nodeId: n.id, message: `duplicateId:${n.id}` });
    }
    ids.add(n.id);
    if (!NODE_TYPES.includes(n.type)) {
      errors.push({ nodeId: n.id, message: `unknownType:${n.type}` });
    }
  }

  for (const e of edges) {
    if (!ids.has(e.source)) errors.push({ nodeId: e.source, message: `danglingEdgeSource:${e.source}` });
    if (!ids.has(e.target)) errors.push({ nodeId: e.target, message: `danglingEdgeTarget:${e.target}` });
  }

  for (const n of nodes) {
    const declared = declaredRoutes(n);
    if (declared) {
      const outgoing = edges.filter((e) => e.source === n.id);
      for (const e of outgoing) {
        if (!e.route) {
          errors.push({ nodeId: n.id, message: `missingRoute:${n.id}->${e.target}` });
        } else if (!declared.has(e.route)) {
          errors.push({ nodeId: n.id, message: `unknownRoute:${e.route}` });
        }
      }
      if (n.type === "classifier" && (n.config?.routes || []).length < 2) {
        errors.push({ nodeId: n.id, message: "classifierNeedsTwoRoutes" });
      }
    }
    if (UNRUNNABLE_NODE_TYPES.has(n.type)) {
      errors.push({ nodeId: n.id, message: `notRunnable:${n.type}`, level: "warning" });
    }
    if (n.type === "loop") {
      errors.push(...validateLoopConfig(n, context));
    }
    if (n.type === "convert" && !CONVERT_TARGETS.includes(n.config?.to)) {
      errors.push({ nodeId: n.id, message: `convertUnknownTarget:${n.config?.to}` });
    }
    if (n.type === "output" && edges.some((e) => e.source === n.id)) {
      errors.push({ nodeId: n.id, message: "outputHasSuccessor" });
    }
    if (n.type === "trigger") {
      errors.push(...validateTriggerConfig(n, context));
    }
  }

  for (const n of nodes) {
    const refs = extractTemplateRefs(n.config);
    if (refs.length === 0) continue;
    const upstream = new Set(getUpstreamNodeIds(n.id, edges));
    for (const ref of refs) {
      // "iteration" is a reserved pseudo-node inside a loop's `until.field`
      // ({{iteration.output.x}} / {{iteration.index}}) — it names the
      // current pass, not a graph node, so it never resolves against ids.
      if (ref.nodeId === "iteration") continue;
      if (ref.nodeId === n.id) {
        errors.push({ nodeId: n.id, message: `templateSelfRef:${ref.raw}` });
      } else if (!ids.has(ref.nodeId)) {
        errors.push({ nodeId: n.id, message: `templateUnknownNode:${ref.raw}` });
      } else if (!upstream.has(ref.nodeId)) {
        errors.push({ nodeId: n.id, message: `templateNotUpstream:${ref.raw}` });
      }
    }
  }

  return {
    valid: errors.every((e) => e.level === "warning"),
    errors,
  };
}

/**
 * `validateGraphLocal` packs each error as `"code:value"` (or bare `"code"`)
 * so it stays a plain, comparable string in tests. The UI layer needs the
 * two parts back apart to look `code` up as an i18n key and interpolate
 * `value` — kept here, next to where the codes are produced, so the two
 * never drift.
 */
export function parseValidationMessage(message) {
  const idx = (message || "").indexOf(":");
  if (idx === -1) return { code: message, value: null };
  return { code: message.slice(0, idx), value: message.slice(idx + 1) };
}

// --- layout ---------------------------------------------------------------

/** Left-to-right dagre layout over xyflow nodes; returns nodes with new `position`, edges untouched. */
export function autoLayout(nodes, edges, options = {}) {
  if (!nodes || nodes.length === 0) return nodes || [];
  const { rankdir = "LR", nodesep = 60, ranksep = 140 } = options;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir, nodesep, ranksep });

  const sizeOf = (n) => ({
    width: n.measured?.width || n.width || 220,
    height: n.measured?.height || n.height || 90,
  });

  for (const n of nodes) {
    const { width, height } = sizeOf(n);
    g.setNode(n.id, { width, height });
  }
  for (const e of edges || []) {
    if (g.hasNode(e.source) && g.hasNode(e.target)) g.setEdge(e.source, e.target);
  }

  dagre.layout(g);

  return nodes.map((n) => {
    const pos = g.node(n.id);
    if (!pos) return n;
    const { width, height } = sizeOf(n);
    return { ...n, position: { x: pos.x - width / 2, y: pos.y - height / 2 } };
  });
}

// --- rename / tool search -----------------------------------------------

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renameInValue(value, re, newId) {
  if (typeof value === "string") return value.replace(re, (_, open) => `${open}${newId}`);
  if (Array.isArray(value)) return value.map((v) => renameInValue(v, re, newId));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, renameInValue(v, re, newId)]));
  }
  return value;
}

// A loop body runs as its own workflow: its templates resolve against its own
// nodes only, so a body is a separate id space and is never rewritten from here.
function renameInConfig(node, re, newId) {
  const config = node.data?.config || {};
  if (!config.body) return renameInValue(config, re, newId);
  const { body, ...rest } = config;
  return { ...renameInValue(rest, re, newId), body };
}

/**
 * Rename a node and everything that points at it: incoming/outgoing edges and
 * every `{{oldId...}}` template in the configs of the same graph. Loop bodies
 * are a separate id space and stay untouched. Route labels (`rules[].route`,
 * `default_route`) name branches, not nodes, so they are left alone. Returns
 * new arrays; inputs are not mutated.
 */
export function renameNodeId(nodes, edges, oldId, newId) {
  if (oldId === newId) return { nodes, edges };
  const re = new RegExp(`(\\{\\{\\s*)${escapeRegExp(oldId)}(?=\\s*\\}\\}|\\.)`, "g");
  const nextNodes = nodes.map((n) => ({
    ...n,
    id: n.id === oldId ? newId : n.id,
    data: { ...n.data, config: renameInConfig(n, re, newId) },
  }));
  const nextEdges = edges.map((e) => ({
    ...e,
    source: e.source === oldId ? newId : e.source,
    target: e.target === oldId ? newId : e.target,
  }));
  return { nodes: nextNodes, edges: nextEdges };
}

/** Why `candidate` cannot replace `currentId`: "invalid" (server pattern), "duplicate", or null. */
export function nodeIdRenameError(candidate, currentId, existingIds = []) {
  if (candidate === currentId) return null;
  if (!NODE_ID_PATTERN.test(candidate || "")) return "invalid";
  if (existingIds.includes(candidate)) return "duplicate";
  return null;
}

function fold(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Tool options whose label or value contains every word of `query` (case/accent-insensitive). */
export function filterToolOptions(options = [], query = "") {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return options;
  return options.filter((o) => {
    const hay = `${fold(o.label)} ${fold(o.value)}`;
    return words.every((w) => hay.includes(w));
  });
}
