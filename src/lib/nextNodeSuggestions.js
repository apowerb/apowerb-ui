import { CONDITION_ROUTES, TRY_ROUTES, NODE_BOX, createNode, findFreePosition, graphToFlow } from "@/lib/workflowGraph";

/**
 * What to offer after a node, so building a workflow never means staring at
 * an 18-type palette wondering which one comes next. Rules only: the graph
 * says everything needed here, and a suggestion has to be instant and the
 * same every time.
 *
 * Read as "after this type, these usually follow", most likely first. A
 * routing node (router/classifier/condition/try) suggests what to put on a
 * branch that has no edge yet, one branch at a time.
 */
const AFTER = {
  trigger: ["agent", "classifier", "convert"],
  agent: ["output", "condition", "notification"],
  rag: ["agent", "output"],
  extract: ["condition", "output", "notification"],
  tool: ["convert", "output", "notification"],
  http: ["convert", "output", "notification"],
  convert: ["agent", "condition", "output"],
  set: ["http", "output", "notification"],
  loop: ["output", "notification"],
  merge: ["agent", "output"],
  subworkflow: ["output", "notification"],
  approval: ["notification", "output"],
  notification: ["output"],
  router: ["agent", "output"],
  classifier: ["agent", "output"],
  condition: ["agent", "output"],
  try: ["agent", "notification"],
  output: [],
};

const ROUTING_ROUTES = {
  condition: () => CONDITION_ROUTES,
  try: () => TRY_ROUTES,
  router: (config) => [...(config?.rules || []).map((r) => r?.route), config?.default_route],
  classifier: (config) => (config?.routes || []).map((r) => r?.route),
};

const MAX_SUGGESTIONS = 3;

/** A node's config, wherever it sits: canvas nodes keep it under `data`. */
export function configOf(node) {
  return node?.config ?? node?.data?.config ?? {};
}

/** The branch names a routing node declares, in order, without duplicates or blanks. */
export function declaredRoutesOf(node) {
  const routes = ROUTING_ROUTES[node?.type]?.(configOf(node));
  return routes ? [...new Set(routes.filter(Boolean))] : null;
}

/** The first declared branch with no edge yet, or null (also null for a plain node). */
export function firstUnwiredRoute(node, edges = []) {
  const routes = declaredRoutesOf(node);
  if (!routes) return null;
  const wired = new Set(edges.filter((e) => e.source === node.id).map((e) => e.data?.route).filter(Boolean));
  return routes.find((r) => !wired.has(r)) ?? null;
}

/** Which node's output a suggested node should read: the branch's own source. */
function templateRef(node) {
  return `{{${node.id}}}`;
}

/**
 * The config a suggested node starts with, so the obvious field is already
 * filled: what it should read is almost always the node it hangs off.
 */
export function prefillFor(type, sourceNode) {
  const ref = templateRef(sourceNode);
  switch (type) {
    case "output":
      return { value: ref };
    case "notification":
      return { body: ref };
    case "agent":
    case "extract":
    case "convert":
    case "subworkflow":
      return { input: ref };
    case "rag":
      return { query: ref };
    default:
      return {};
  }
}

/**
 * Up to three node types to put after `node`, each with the branch it would
 * wire and the config it would start with. Empty when the node is terminal
 * or already has everything wired — no suggestion is better than a wrong one.
 */
export function suggestNextNodes(node, nodes = [], edges = []) {
  if (!node) return [];
  const route = firstUnwiredRoute(node, edges);
  const isRouting = declaredRoutesOf(node) !== null;
  if (isRouting && !route) return [];
  if (!isRouting && edges.some((e) => e.source === node.id)) return [];

  let types = AFTER[node.type] ?? [];
  // An unfinished workflow needs an Output more than anything else: nothing
  // runs to a result without one.
  if (!nodes.some((n) => n.type === "output") && types.includes("output")) {
    types = ["output", ...types.filter((t) => t !== "output")];
  }
  return types.slice(0, MAX_SUGGESTIONS).map((type) => ({
    type,
    route,
    config: prefillFor(type, node),
  }));
}

/**
 * Apply a suggestion: the new node lands right of its source with its
 * pre-filled config, and the edge carries the branch it was suggested for.
 * Returns the next canvas nodes/edges plus the node itself, for the caller
 * to select and push onto the history.
 */
export function applySuggestion(nodes = [], edges = [], sourceNode, suggestion) {
  const position = findFreePosition(nodes, sourceNode.id);
  const graphNode = createNode(suggestion.type, { position, existingIds: nodes.map((n) => n.id) });
  graphNode.config = { ...graphNode.config, ...suggestion.config };
  const node = graphToFlow({ nodes: [graphNode], edges: [] }).nodes[0];
  const edge = graphToFlow({ nodes: [], edges: [{ source: sourceNode.id, target: node.id, route: suggestion.route || undefined }] }).edges[0];
  return { nodes: [...nodes, node], edges: [...edges, edge], node };
}

/** Chip strip size in canvas pixels; the strip does not scale with the zoom. */
export const CHIPS_BOX = { width: 176, header: 18, row: 28, gap: 4, margin: 8 };

/**
 * Where to draw the chips, in canvas pixels, always inside the canvas:
 * right of the node when they fit, else under it, else left of it. Under
 * comes before left because the left side is where the previous node sits —
 * chips there cover the very node the user just came from.
 */
export function chipsPosition(anchor, viewport, canvas, count) {
  const { x: vx = 0, y: vy = 0, zoom = 1 } = viewport || {};
  const width = CHIPS_BOX.width;
  const height = CHIPS_BOX.header + count * (CHIPS_BOX.row + CHIPS_BOX.gap);
  const m = CHIPS_BOX.margin;
  const nodeLeft = anchor.x * zoom + vx;
  const nodeTop = anchor.y * zoom + vy;
  const right = nodeLeft + (NODE_BOX.width + 24) * zoom;
  const below = nodeTop + NODE_BOX.height * zoom + m;
  const clampLeft = (x) => Math.min(Math.max(m, x), Math.max(m, canvas.width - width - m));
  const clampTop = (y) => Math.min(Math.max(m, y), Math.max(m, canvas.height - height - m));
  if (right + width + m <= canvas.width) return { left: clampLeft(right), top: clampTop(nodeTop) };
  if (below + height + m <= canvas.height) return { left: clampLeft(nodeLeft), top: below };
  return { left: clampLeft(nodeLeft - width - 24 * zoom), top: clampTop(nodeTop) };
}

/**
 * How much of the canvas is really visible: below the `xl` breakpoint the
 * inspector is laid over the canvas' right side instead of beside it.
 */
export function visibleCanvasWidth(canvasRect, coverRect) {
  const full = canvasRect.right - canvasRect.left;
  if (!coverRect || coverRect.left >= canvasRect.right || coverRect.left <= canvasRect.left) return full;
  return coverRect.left - canvasRect.left;
}
