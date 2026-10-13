"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "use-intl";
import { X } from "lucide-react";
import { BTN_CLS } from "./editor/fields";

/** Centered dialog: title, scrolling body, footer. Escape and the close button call `onClose`. */
export default function ModalShell({ title, onClose, subheader, footer, size = "max-w-2xl", children }) {
  const t = useTranslations("biTemplate");
  const titleId = useId();
  const dialogRef = useRef(null);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  function onKeyDown(e) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    }
  }

  // Portal: a header with a backdrop filter would otherwise become the containing block of this fixed overlay.
  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        className={`glass-card rounded-2xl p-4 sm:p-6 w-full ${size} max-h-[92vh] flex flex-col animate-scale-in focus:outline-none`}
      >
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h2 id={titleId} className="text-xl font-bold th-text">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="p-2 rounded-lg hover:th-bg-surface-hover th-text-secondary transition-colors focus-visible:outline-2 focus-visible:outline-brand"
          >
            <X size={20} />
          </button>
        </div>
        {subheader}
        <div className="flex-1 overflow-y-auto min-h-0 space-y-4 px-1 -mx-1">{children}</div>
        {footer && <div className="flex items-center justify-between gap-3 mt-4 shrink-0">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function CancelButton({ onClick, label }) {
  return (
    <button type="button" onClick={onClick} className={BTN_CLS + " !text-sm !px-4 !py-2"}>
      {label}
    </button>
  );
}
