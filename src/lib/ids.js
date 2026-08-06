/**
 * Session identifiers sent to the backend.
 *
 * `Math.random()` is used all over the interface to build React keys, which
 * is harmless -- those values never leave the tab. Session identifiers do:
 * they travel to the backend as `session_id` and name a conversation
 * thread. `Math.random()` is not built to be unpredictable; its internal
 * state can be recovered from a handful of draws.
 *
 * What this is not: an access flaw. The backend ignores the `user_id` in
 * the request body and scopes sessions to the authenticated user (see
 * `tests/test_idor_adk_runner.py` in the core). Guessing an identifier
 * grants nothing. What is real is the collision risk between two sessions
 * of the same account, and the fact that a predictable value has no reason
 * to be here when the alternative is one line.
 */

/**
 * 128 bits of cryptographic randomness, hex-encoded.
 *
 * `crypto.randomUUID()` requires a secure context (https or localhost) and
 * is therefore not available everywhere; `getRandomValues` has no such
 * constraint and serves as the fallback.
 */
function randomToken() {
  const webcrypto = globalThis.crypto;

  if (typeof webcrypto?.randomUUID === "function") {
    return webcrypto.randomUUID().split("-").join("");
  }

  const bytes = new Uint8Array(16);
  webcrypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** A fresh session identifier, prefixed the way the backend expects. */
export function newSessionId() {
  return `sess_${randomToken()}`;
}
