/**
 * SSE parsing for a workflow run (`POST /api/workflows/defs/{id}/run`).
 *
 * The parsing half (`parseSseChunk`/`parseSseBlock`) is pure text-in,
 * objects-out — no fetch, no timers — so it's testable with plain strings.
 * `consumeWorkflowRun` is the only part that touches a real Response/reader,
 * and it's a thin loop around the parser.
 *
 * Each frame is `data: {json}\n\n`. Following this codebase's existing SSE
 * convention (see `useWorkflowRunner.js`), the JSON payload carries its kind
 * in an `event` field: `run_started`, `node_start`, `node_complete`,
 * `node_error`, `route`, and exactly one terminal event per run —
 * `done` | `error` | `cancelled`.
 */

export const TERMINAL_EVENTS = new Set(["done", "error", "cancelled"]);

export function isTerminalEvent(evt) {
  return !!evt && TERMINAL_EVENTS.has(evt.event);
}

/** Extract the JSON payload from one `data: ...` (possibly multi-line) SSE block. Returns null on anything that isn't a usable data line. */
export function parseSseBlock(block) {
  const trimmed = (block || "").trim();
  if (!trimmed) return null;

  let dataStr = null;
  if (trimmed.startsWith("data:")) {
    dataStr = trimmed.startsWith("data: ") ? trimmed.slice(6) : trimmed.slice(5);
  } else if (trimmed.includes("\ndata:")) {
    const lines = trimmed
      .split("\n")
      .filter((l) => l.trimStart().startsWith("data:"))
      .map((l) => {
        const t = l.trimStart();
        return t.startsWith("data: ") ? t.slice(6) : t.slice(5);
      });
    if (lines.length > 0) dataStr = lines.join("\n");
  }

  if (!dataStr || dataStr === "[DONE]") return null;

  try {
    return JSON.parse(dataStr);
  } catch {
    return null;
  }
}

/**
 * Split a growing text buffer on the `\n\n` frame boundary, parse each
 * complete frame, and hand back whatever's left (an incomplete frame, kept
 * for the next chunk). Unparseable frames are silently dropped, same as the
 * chat SSE consumer does.
 */
export function parseSseChunk(buffer) {
  const parts = (buffer || "").split("\n\n");
  const remainder = parts.pop() || "";
  const events = [];
  for (const block of parts) {
    const evt = parseSseBlock(block);
    if (evt) events.push(evt);
  }
  return { events, remainder };
}

/**
 * Read a fetch Response's body as a workflow-run SSE stream, calling
 * `onEvent(evt)` for every frame in order. Resolves with the terminal event
 * (`done`/`error`/`cancelled`), or `null` if the stream closed without one
 * (network drop — the caller should treat that as a failure).
 *
 * `signal` is only used to know the read loop was aborted on purpose (the
 * fetch itself should already carry the same AbortSignal) so a user Cancel
 * doesn't get reported as a stream error.
 */
export async function consumeWorkflowRun(response, { onEvent, signal } = {}) {
  if (!response?.body) return null;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let terminal = null;

  try {
    while (!terminal) {
      const { done, value } = await reader.read();
      if (done) {
        if (buffer.trim()) {
          const evt = parseSseBlock(buffer);
          if (evt) {
            onEvent?.(evt);
            if (isTerminalEvent(evt)) terminal = evt;
          }
        }
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const { events, remainder } = parseSseChunk(buffer);
      buffer = remainder;
      for (const evt of events) {
        onEvent?.(evt);
        if (isTerminalEvent(evt)) {
          terminal = evt;
          break;
        }
      }
    }
  } catch (err) {
    if (signal?.aborted) return { event: "cancelled" };
    throw err;
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // already released by a prior read()/cancel() — nothing to do.
    }
  }

  return terminal;
}
