/**
 * Shared border/background styles for action-card status.
 *
 * Consumed by every ActionCardShell + the 9 typed cards so that the visual
 * language stays consistent across the registry.
 */
export const STATUS_STYLES = {
  pending: "border-blue-500/30 bg-blue-500/5",
  done: "border-emerald-500/30 bg-emerald-500/5",
  cancelled: "border-gray-500/20 bg-gray-500/5 opacity-60",
  error: "border-red-500/30 bg-red-500/5",
};
