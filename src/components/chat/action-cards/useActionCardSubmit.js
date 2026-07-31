"use client";

import { useState, useCallback } from "react";

/**
 * State hook shared by every interactive action-card.
 *
 * Why we keep `submitting=true` after the call:
 * the parent `respondToActionCard` updates the card status right after the user
 * acts (to `done` / `cancelled` / `error`). Re-enabling the button between the
 * call and the status update would open a double-submit window. The card
 * disappears or changes its render path as soon as the status moves away from
 * "pending", so we don't need to reset the local state.
 *
 * @param {object} card - the card ({ status, ... })
 * @returns {{ submitting: boolean, isPending: boolean, handleSubmit: (fn: () => void | Promise<void>) => Promise<void> }}
 */
export default function useActionCardSubmit(card) {
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async (fn) => {
    setSubmitting(true);
    // Allow the fn to throw — callers decide whether to catch or propagate.
    await fn();
  }, []);

  const isPending = card?.status === "pending" && !submitting;

  return { submitting, isPending, handleSubmit };
}
