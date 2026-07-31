import dagre from "dagre";

/**
 * Apply dagre layout (Left → Right) to React Flow nodes and edges.
 * Only positions parent nodes; children keep relative position.
 *
 * @param {Array} nodes - React Flow nodes
 * @param {Array} edges - React Flow edges
 * @param {object} options - { rankdir, nodesep, ranksep }
 * @returns {{ nodes: Array, edges: Array }}
 */
export function applyDagreLayout(nodes, edges, options = {}) {
  const { rankdir = "LR", nodesep = 80, ranksep = 150 } = options;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir, nodesep, ranksep });

  // Only lay out top-level nodes (no parentId)
  const topLevelNodes = nodes.filter((n) => !n.parentId);
  const childNodes = nodes.filter((n) => n.parentId);

  for (const node of topLevelNodes) {
    const width = node.measured?.width || node.width || 220;
    const height = node.measured?.height || node.height || 100;
    g.setNode(node.id, { width, height });
  }

  for (const edge of edges) {
    // Only add edges between top-level nodes
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      g.setEdge(edge.source, edge.target);
    }
  }

  dagre.layout(g);

  const layoutedNodes = topLevelNodes.map((node) => {
    const pos = g.node(node.id);
    const width = node.measured?.width || node.width || 220;
    const height = node.measured?.height || node.height || 100;
    return {
      ...node,
      position: {
        x: pos.x - width / 2,
        y: pos.y - height / 2,
      },
    };
  });

  return {
    nodes: [...layoutedNodes, ...childNodes],
    edges,
  };
}
