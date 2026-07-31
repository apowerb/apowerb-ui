"use client";

import { ChevronLeft, ChevronRight, GitBranch } from "lucide-react";

export default function BranchNavigator({
  branchCount,
  currentBranch,
  onNavigate,
}) {
  if (!branchCount || branchCount <= 1) return null;

  return (
    <div className="inline-flex items-center gap-0.5 ml-2">
      <button
        onClick={() => onNavigate(currentBranch - 1)}
        disabled={currentBranch <= 0}
        className="p-0.5 rounded hover:th-bg-surface-hover th-text-faint hover:th-text-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft size={12} />
      </button>
      <span className="text-[10px] th-text-faint tabular-nums flex items-center gap-0.5">
        <GitBranch size={10} />
        {currentBranch + 1}/{branchCount}
      </span>
      <button
        onClick={() => onNavigate(currentBranch + 1)}
        disabled={currentBranch >= branchCount - 1}
        className="p-0.5 rounded hover:th-bg-surface-hover th-text-faint hover:th-text-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight size={12} />
      </button>
    </div>
  );
}
