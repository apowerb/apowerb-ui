// Per-session composer drafts, persisted in localStorage so switching threads
// or reloading the page never loses an unsent message. SSR-safe and resilient
// to storage being disabled or full. Stored as a raw string under
// `th2chat:draft:<sessionId>` (kept simple for backward compatibility).

const DRAFT_PREFIX = "th2chat:draft:";

export function loadDraft(sessionId) {
  if (!sessionId || typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(DRAFT_PREFIX + sessionId) || "";
  } catch {
    return "";
  }
}

export function saveDraft(sessionId, value) {
  if (!sessionId || typeof window === "undefined") return;
  try {
    if (value) window.localStorage.setItem(DRAFT_PREFIX + sessionId, value);
    else window.localStorage.removeItem(DRAFT_PREFIX + sessionId);
  } catch {
    // storage disabled or quota exceeded - drafts are best-effort
  }
}

export function removeDraft(sessionId) {
  if (!sessionId || typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DRAFT_PREFIX + sessionId);
  } catch {
    // best-effort
  }
}
