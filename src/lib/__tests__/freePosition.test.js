import { describe, it, expect } from "vitest";
import { findFreePosition, NODE_BOX } from "../workflowGraph";

// Un nœud ajouté par clic se posait à une position fixe, par-dessus les
// nœuds existants (mesuré sur la pile e2e, 21/09).
const box = (p) => ({ x1: p.x, y1: p.y, x2: p.x + NODE_BOX.width, y2: p.y + NODE_BOX.height });
const overlaps = (a, b) => a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;
const node = (id, x, y) => ({ id, position: { x, y } });

describe("findFreePosition", () => {
  it("places the first node at the origin of an empty canvas", () => {
    expect(findFreePosition([])).toEqual({ x: 0, y: 0 });
  });

  it("places a node to the right of the anchor, never on top of anything", () => {
    const nodes = [node("a", 0, 0), node("b", 0, 120), node("c", 300, 0)];
    const pos = findFreePosition(nodes, "a");
    expect(pos.x).toBeGreaterThan(0);
    for (const n of nodes) expect(overlaps(box(pos), box(n.position))).toBe(false);
  });

  it("without an anchor, goes right of the right-most node", () => {
    const nodes = [node("a", 0, 0), node("b", 500, 200)];
    const pos = findFreePosition(nodes);
    expect(pos.x).toBeGreaterThan(500);
    for (const n of nodes) expect(overlaps(box(pos), box(n.position))).toBe(false);
  });

  it("stays free even when the spot right of the anchor is taken", () => {
    const nodes = [node("a", 0, 0), node("b", 280, 0), node("c", 280, 120), node("d", 280, -120)];
    const pos = findFreePosition(nodes, "a");
    for (const n of nodes) expect(overlaps(box(pos), box(n.position))).toBe(false);
  });
});
