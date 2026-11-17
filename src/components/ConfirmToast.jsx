"use client";

import { useId, useLayoutEffect, useRef } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";

const TONES = {
  danger: {
    Icon: Trash2,
    border: "border-red-500/40",
    wash: "bg-red-500/5",
    badge: "bg-red-500/15 border-red-500/25",
    icon: "text-red-500",
    button: "bg-red-600 hover:bg-red-500 focus-visible:outline-red-600",
  },
  neutral: {
    Icon: AlertTriangle,
    border: "border-amber-500/40",
    wash: "bg-amber-500/5",
    badge: "bg-amber-500/15 border-amber-500/25",
    icon: "text-amber-500",
    button: "bg-blue-600 hover:bg-blue-500 focus-visible:outline-blue-500",
  },
};

/**
 * Blocking confirmation on the native modal `<dialog>`. The browser provides
 * the top layer, the inert page, focus containment and Esc / back-gesture
 * dismissal, so none of that is rebuilt here. Only the focus return to the
 * control that opened it is done by hand (see the effect's cleanup).
 *
 * `message` drives it: a string opens the dialog, a falsy value closes it.
 */
export default function ConfirmToast({
  message,
  onConfirm,
  onCancel,
  confirmLabel = "Delete",
  hint = "This action cannot be undone.",
  tone = "danger",
}) {
  const dialogRef = useRef(null);
  const confirmRef = useRef(null);
  const cancelRef = useRef(onCancel);
  const titleId = useId();
  const open = Boolean(message);

  useLayoutEffect(() => {
    cancelRef.current = onCancel;
  });

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return undefined;
    const opener = document.activeElement;
    dialog.showModal();
    // showModal() focuses the first focusable control (Cancel); the callers
    // have always had Enter confirm, so the primary button takes focus.
    confirmRef.current?.focus();

    // `closedby="any"` lets a click on the backdrop dismiss. Where it is not
    // supported yet (Safari), do it by hand: press and release both outside.
    let removeFallback = () => {};
    if (!("closedBy" in HTMLDialogElement.prototype)) {
      const outside = (e) => {
        const r = dialog.getBoundingClientRect();
        return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      };
      let pressedOutside = false;
      const onDown = (e) => { pressedOutside = outside(e); };
      const onUp = (e) => { if (pressedOutside && outside(e)) cancelRef.current?.(); };
      dialog.addEventListener("pointerdown", onDown);
      dialog.addEventListener("pointerup", onUp);
      removeFallback = () => {
        dialog.removeEventListener("pointerdown", onDown);
        dialog.removeEventListener("pointerup", onUp);
      };
    }
    return () => {
      removeFallback();
      dialog.close();
      // React has already taken the <dialog> out of the page when this runs,
      // and the browser only returns focus from a dialog that is still in it.
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, [open]);

  if (!open) return null;

  const { Icon, border, wash, badge, icon, button } = TONES[tone] || TONES.danger;

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      aria-labelledby={titleId}
      onCancel={() => onCancel?.()}
      className={`m-auto w-[calc(100%-2rem)] max-w-md p-0 overflow-hidden glass-modal border ${border} rounded-2xl shadow-2xl animate-slide-up backdrop:bg-black/60 backdrop:backdrop-blur-sm`}
    >
      <div className={`absolute inset-0 ${wash} pointer-events-none`} />

      <div className="relative flex items-start gap-4 px-6 py-5">
        <div className={`p-2.5 ${badge} rounded-xl border shrink-0`}>
          <Icon size={20} className={icon} />
        </div>

        <div className="flex-1 min-w-0">
          <p id={titleId} className="th-text text-base font-semibold">{message}</p>
          {hint && <p className="th-text-muted text-sm mt-1">{hint}</p>}
        </div>
      </div>

      <div className="relative flex justify-end gap-2 px-6 py-4 border-t th-border-secondary">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm th-text-secondary hover:th-text border th-border hover:th-bg-surface-hover rounded-lg transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Cancel
        </button>
        <button
          ref={confirmRef}
          type="button"
          onClick={onConfirm}
          className={`px-4 py-2 text-sm text-white ${button} rounded-lg transition-all font-semibold shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2`}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
