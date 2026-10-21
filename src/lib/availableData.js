/**
 * What the upstream nodes of a node produced in the last test run, as the
 * inspector's "Available data" panel needs it: the outputs by node id, their
 * shape (JSON tree, table, text, files), the `{{node.path}}` paths they offer,
 * and the references of a field that the last run would not resolve.
 *
 * Paths follow the engine's `_lookup` (core `workflow_graph.py`): an object is
 * walked by key, a list by a digits-only index (`node.0.field`), and a path
 * that goes through a text or a number is refused at run time.
 */
import { extractTemplateRefs } from "@/lib/workflowGraph";

const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/**
 * `{found: true, value}`, `{found: false}` when a key or an index is missing
 * (the engine renders `""`), or `{found: false, scalar: true}` when the path
 * goes through a scalar (the engine fails with `template_ref_invalid`).
 */
export function lookupPath(value, path) {
  let cur = value;
  for (const key of (path || "").split(".").filter(Boolean)) {
    if (isPlainObject(cur)) {
      if (!Object.hasOwn(cur, key)) return { found: false };
      cur = cur[key];
    } else if (Array.isArray(cur) && /^\d+$/.test(key) && Number(key) < cur.length) {
      cur = cur[Number(key)];
    } else if (["string", "number", "boolean"].includes(typeof cur)) {
      return { found: false, scalar: true };
    } else {
      return { found: false };
    }
  }
  return { found: true, value: cur };
}

// A trigger's attachments, as `email_envelope` / `workflow_attachments` write
// them: `{name, size, content_type, ref}` — never the file itself.
function isFileEntry(v) {
  return isPlainObject(v) && typeof v.name === "string" && "content_type" in v && "size" in v;
}

/** `"files" | "table" | "json" | "text" | "empty"`: how the panel renders a value. */
export function shapeOf(value) {
  if (value === null || value === undefined || value === "") return "empty";
  if (Array.isArray(value)) {
    if (value.length === 0) return "empty";
    if (value.every(isFileEntry)) return "files";
    if (value.every(isPlainObject)) return "table";
    return "json";
  }
  if (isPlainObject(value)) return "json";
  return "text";
}

/**
 * Every `{path, value}` reachable inside `value`, parents before children.
 * Capped: an output can weigh up to the engine's per-node limit.
 */
export function pathsOf(value, { maxDepth = 6, maxItems = 20 } = {}, prefix = "", depth = 0, acc = []) {
  if (depth >= maxDepth) return acc;
  let children = [];
  if (isPlainObject(value)) children = Object.entries(value);
  else if (Array.isArray(value)) children = value.slice(0, maxItems).map((v, i) => [String(i), v]);
  for (const [key, child] of children) {
    const path = prefix ? `${prefix}.${key}` : key;
    acc.push({ path, value: child });
    pathsOf(child, { maxDepth, maxItems }, path, depth + 1, acc);
  }
  return acc;
}

/**
 * `{nodeId: output}` for every top-level node the run finished. Loop / try
 * inner passes are left out: a node outside the body cannot reference them.
 */
export function outputsByNodeId(runState) {
  const outputs = {};
  for (const entry of runState?.timeline || []) {
    if (entry.status === "done") outputs[entry.id] = entry.output;
  }
  return outputs;
}

/**
 * The `{{node.path}}` references of a field (string or nested object) whose
 * node ran but whose last output has no such path. A node that has not run
 * yet says nothing: its fields are unknown, not missing.
 */
export function missingRefs(fieldValue, outputs = {}) {
  const seen = new Set();
  const missing = [];
  for (const ref of extractTemplateRefs(fieldValue)) {
    if (!ref.path || !Object.hasOwn(outputs, ref.nodeId) || seen.has(ref.raw)) continue;
    seen.add(ref.raw);
    const hit = lookupPath(outputs[ref.nodeId], ref.path);
    if (!hit.found) missing.push({ raw: ref.raw, nodeId: ref.nodeId, path: ref.path, scalar: Boolean(hit.scalar) });
  }
  return missing;
}
