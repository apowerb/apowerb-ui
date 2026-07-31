"use client";

import { useEffect } from "react";
import { Trash2 } from "lucide-react";

export default function ConfirmToast({ message, onConfirm, onCancel }) {
  useEffect(() => {
    if (!message) return;
    const handleKey = (e) => {
      if (e.key === "Escape") onCancel?.();
      if (e.key === "Enter") onConfirm?.();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [message, onConfirm, onCancel]);

  if (!message) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative glass-modal border border-red-500/40 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-0 bg-red-500/5 pointer-events-none" />

        <div className="relative flex items-start gap-4 px-6 py-5">
          <div className="p-2.5 bg-red-500/15 rounded-xl border border-red-500/25 shrink-0">
            <Trash2 size={20} className="text-red-500" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="th-text text-base font-semibold">{message}</p>
            <p className="th-text-muted text-sm mt-1">
              This action cannot be undone.
            </p>
          </div>
        </div>

        <div className="relative flex justify-end gap-2 px-6 py-4 border-t th-border-secondary">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm th-text-secondary hover:th-text border th-border hover:th-bg-surface-hover rounded-lg transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            autoFocus
            className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-500 rounded-lg transition-all font-semibold shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
