import { CONDITION_ROUTES, TRY_ROUTES, createNode, findFreePosition, graphToFlow } from "@/lib/workflowGraph";

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
