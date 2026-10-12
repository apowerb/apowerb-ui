/**
 * Text blocks take the height of their content, not the height the spec gave
 * them: a summary of two lines in a 136 px cell leaves a big hole. The block
 * reports the pixel height of its content; the rows below move up (or down)
 * by the difference. Positions stay a display matter: nothing is saved.
 */
export const ROW_PX = 60;
export const GAP_PX = 16;

/** Rows needed for a block whose outer height (content + chrome) is `px`. */
export function rowsForPx(px) {
  return Math.max(1, Math.ceil((px + GAP_PX) / (ROW_PX + GAP_PX)));
}

const FIT_TYPES = new Set(["text", "table"]);

/**
 * `heights` maps a component id to its outer needed height in px. Text blocks
 * follow their content both ways; tables only shrink (they scroll beyond the
 * height the spec gave them).
 */
export function fitTextBlocks(components, heights) {
  const texts = components
    .filter((c) => c.component_type === "visual" && FIT_TYPES.has(c.visual?.type) && heights[c.id] > 0)
    .sort((a, b) => a.position.row - b.position.row);
  if (texts.length === 0) return components;
  const out = components.map((c) => ({ ...c, position: { ...c.position } }));
  const byId = new Map(out.map((c) => [c.id, c]));
  for (const t of texts) {
    const cur = byId.get(t.id);
    const oldH = cur.position.height;
    let newH = rowsForPx(heights[t.id]);
    if (t.visual.type === "table") newH = Math.min(newH, oldH);
    const delta = newH - oldH;
    if (delta === 0) continue;
    const bottom = cur.position.row + oldH;
    cur.position.height = newH;
    for (const c of out) {
      if (c !== cur && c.position.row >= bottom) c.position.row += delta;
    }
  }
  return out;
}
