/** A dashboard is "v2" when it declares a spec version >= 2 or holds visual blocks. */
export function isV2Dashboard(dashboard) {
  if (!dashboard) return false;
  if ((dashboard.spec_version || 0) >= 2) return true;
  return (dashboard.components || []).some((c) => c.component_type === "visual");
}

/** Below this container width a v2 grid collapses to two columns. */
export const NARROW_PX = 640;
