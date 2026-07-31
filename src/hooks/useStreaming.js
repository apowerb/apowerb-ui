"use client";

import { useRef, useCallback } from "react";
import { authStorage } from "@/lib/authStorage";
import { parseQuotaError } from "@/lib/quota";
import { notifyRunFinished } from "@/extensions/registry";

export function useStreaming() {
  const abortControllerRef = useRef(null);
  const lastChunkRef = useRef("");
  const accumulatedContentRef = useRef("");
  const turnContentRef = useRef(""); // Tracks accumulated content for current model turn

  const startStreaming = useCallback(
    async ({
      agentId,
      userId,
      sessionId,
      message,
      onChunk,
      onThinking,
      onToolCall,
      onToolResult,
      onMeta,
      onComplete,
      onError,
    }) => {
      // Reset deduplication state for new stream
      lastChunkRef.current = "";
      accumulatedContentRef.current = "";
      turnContentRef.current = "";
      // Abort any existing stream
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      try {
        // Get auth token for authenticated requests
        const token = authStorage.getToken();
        const headers = {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        };

        const response = await fetch("/api/run-sse", {
          method: "POST",
          headers,
          body: JSON.stringify({
            agent_name: agentId,
            user_id: userId,
            session_id: sessionId,
            run_mode: "run_sse",
            streaming: true,
            new_message: message,
          }),
          signal: abortControllerRef.current.signal,
        });
        if (!response.ok) {
          const errorText = await response.text();
          // Quota mensuel épuisé : le backend refuse le run AVANT d'ouvrir
          // le flux. On enrichit l'erreur pour que l'UI puisse expliquer et
          // proposer une suite, au lieu d'afficher le JSON brut.
          const quota = parseQuotaError(response.status, errorText);
          if (quota) {
            const err = new Error(quota.message);
            err.quota = quota;
            throw err;
          }
          throw new Error(`HTTP error ${response.status}: ${errorText}`);
        }

        const contentType = response.headers.get("content-type") || "";

        // Handle SSE stream
        if (contentType.includes("text/event-stream") || response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          // Shared callbacks wrapper with deduplication.
          //
          // ADK sends ACCUMULATED text per model turn (not deltas).
          // Each SSE event contains all text generated so far in the
          // current turn.  After a tool call, the turn resets.
          //
          // Example flow for tool-using agent:
          //   Turn 1: "Hello" → "Hello world" → "Hello world!" + functionCall
          //   Tool result
          //   Turn 2: "Here" → "Here is" → "Here is your result"
          //
          // Without per-turn tracking, turn 2 events bypass prefix dedup
          // (accumulated starts with "Hello", chunk starts with "Here")
          // causing the full turn 2 text to be appended multiple times.
          const wrappedCallbacks = {
            onChunk: (chunk) => {
              if (!chunk || chunk === lastChunkRef.current) return;

              const accumulated = accumulatedContentRef.current;
              const turnContent = turnContentRef.current;

              // --- Per-turn dedup (handles ADK accumulated-per-turn events) ---
              if (turnContent.length > 0 && chunk.length > 0) {
                const cmpLen = Math.min(turnContent.length, chunk.length, 200);
                if (cmpLen >= 5 && chunk.slice(0, cmpLen) === turnContent.slice(0, cmpLen)) {
                  // Chunk is accumulated text for this turn
                  if (chunk.length <= turnContent.length) return; // pure dup
                  const tail = chunk.slice(turnContent.length);
                  lastChunkRef.current = chunk;
                  turnContentRef.current = chunk;
                  accumulatedContentRef.current += tail;
                  onChunk(tail);
                  return;
                }
              }

              // --- Global dedup (handles full-response re-sends) ---
              if (accumulated.length > 0 && chunk.length > 0) {
                // 1) Full re-send: chunk starts with same prefix as total accumulated
                const cmpLen = Math.min(accumulated.length, chunk.length, 100);
                if (
                  cmpLen >= 10 &&
                  chunk.slice(0, cmpLen) === accumulated.slice(0, cmpLen)
                ) {
                  if (chunk.length <= accumulated.length) return;
                  const tail = chunk.slice(accumulated.length);
                  lastChunkRef.current = chunk;
                  accumulatedContentRef.current += tail;
                  turnContentRef.current = chunk;
                  onChunk(tail);
                  return;
                }

                // 2) Partial re-send: chunk already present inside accumulated
                if (chunk.length >= 20 && accumulated.includes(chunk)) return;

                // 3) Suffix-prefix overlap: the chunk's beginning overlaps
                //    with the end of accumulated (catches near-miss re-sends
                //    e.g. when a word was split across events)
                if (chunk.length >= 30) {
                  const probe = chunk.slice(0, Math.min(40, chunk.length));
                  const searchZone = accumulated.slice(-Math.min(accumulated.length, 500));
                  const idx = searchZone.lastIndexOf(probe);
                  if (idx !== -1) {
                    const overlapFromEnd = searchZone.length - idx;
                    if (chunk.length <= overlapFromEnd) return;
                    const tail = chunk.slice(overlapFromEnd);
                    lastChunkRef.current = chunk;
                    accumulatedContentRef.current += tail;
                    turnContentRef.current = chunk;
                    onChunk(tail);
                    return;
                  }
                }
              }

              // New content — accept it
              lastChunkRef.current = chunk;
              accumulatedContentRef.current += chunk;
              turnContentRef.current += chunk;
              onChunk(chunk);
            },
            onThinking,
            onToolCall: (data) => {
              // Reset per-turn accumulator: next model output is a new turn
              turnContentRef.current = "";
              if (onToolCall) onToolCall(data);
            },
            onToolResult: (data) => {
              // Also reset on tool result (belt and suspenders)
              turnContentRef.current = "";
              if (onToolResult) onToolResult(data);
            },
            onMeta,
            onError,
          };

          const SSE_READ_TIMEOUT_MS = 300_000; // 5 minutes without data → abort

          while (true) {
            let timeoutId;
            const readPromise = reader.read();
            const timeoutPromise = new Promise((_, reject) => {
              timeoutId = setTimeout(
                () => reject(new Error("SSE read timeout: no data received for 5 minutes")),
                SSE_READ_TIMEOUT_MS,
              );
            });

            let result;
            try {
              result = await Promise.race([readPromise, timeoutPromise]);
            } finally {
              clearTimeout(timeoutId);
            }
            const { done, value } = result;

            if (done) {
              // Process remaining buffer — split on \n\n to handle multiple events
              if (buffer.trim()) {
                const remaining = buffer.split("\n\n");
                for (const block of remaining) {
                  if (block.trim()) {
                    processSSEBlock(block, wrappedCallbacks);
                  }
                }
              }
              onComplete();
              break;
            }

            buffer += decoder.decode(value, { stream: true });

            // Parse SSE format: "data: {...}\n\n"
            const lines = buffer.split("\n\n");
            buffer = lines.pop() || ""; // Keep incomplete chunk in buffer

            for (const line of lines) {
              processSSEBlock(line, wrappedCallbacks);
            }
          }
        } else {
          // Non-streaming JSON response - extract content
          const data = await response.json();
          const extracted = extractContent(data);
          if (extracted) {
            onChunk(extracted);
          }
          onComplete();
        }
      } catch (error) {
        if (error.name === "AbortError") {
          // User aborted, not an error
          onComplete();
          return;
        }
        console.error("[useStreaming] Error:", error);
        onError(error);
      } finally {
        // Le tour vient de consommer des tokens : on rafraîchit la jauge.
        // Dans un `finally` et non après `onComplete()` : une conversation
        // interrompue ou en erreur a elle aussi pu consommer, et un refus
        // pour quota dépassé doit se refléter immédiatement dans la barre.
        notifyRunFinished();
      }
    },
    [],
  );

  const abortStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  return { startStreaming, abortStreaming };
}

// Extract text content from various API response formats
function extractContent(data) {
  if (!data) return null;

  // Helper to check if a string is JSON and extract from it
  const tryExtractFromJSONString = (str) => {
    if (typeof str !== "string") return null;
    try {
      if (str.trim().startsWith("{") || str.trim().startsWith("[")) {
        const parsed = JSON.parse(str);
        const extracted = extractContent(parsed);
        if (extracted) return extracted;
      }
    } catch (e) {
      // Ignore parse errors
    }
    return str;
  };

  // String content
  if (typeof data === "string") {
    return tryExtractFromJSONString(data);
  }

  // Format: { content: { parts: [{ text: "..." }] } }
  if (data.content?.parts) {
    const texts = data.content.parts.filter((p) => p.text).map((p) => p.text);
    if (texts.length > 0) return texts.join("");
  }

  // Format: { content: "..." }
  if (typeof data.content === "string") {
    return tryExtractFromJSONString(data.content);
  }

  // Format: { response: "..." }
  if (typeof data.response === "string") {
    return tryExtractFromJSONString(data.response);
  }

  // Format: { text: "..." }
  if (typeof data.text === "string") {
    return tryExtractFromJSONString(data.text);
  }

  // Format: { delta: { content: "..." } }
  if (data.delta?.content) return data.delta.content;

  // Format: { choices: [{ delta: { content: "..." } }] }
  if (data.choices?.[0]?.delta?.content) return data.choices[0].delta.content;

  // Format: { choices: [{ message: { content: "..." } }] }
  if (data.choices?.[0]?.message?.content)
    return data.choices[0].message.content;

  return null;
}

/**
 * Process an SSE block (text between \n\n delimiters).
 * A block may contain multiple lines: event:, data:, id:, etc.
 * We extract all data: lines, join them, and parse as JSON.
 */
export function processSSEBlock(block, callbacks) {
  const { onChunk, onThinking, onToolCall, onToolResult, onMeta, onError } = callbacks;
  const trimmed = block.trim();
  if (!trimmed) return;

  // Extract data payload from the block.
  // A block can be a single "data: {...}" line or multi-line with event:/id:/data: fields.
  let dataStr = null;

  if (trimmed.startsWith("data:")) {
    // Single-line block: "data: {...}" or "data:{...}"
    dataStr = trimmed.slice(trimmed.startsWith("data: ") ? 6 : 5);
  } else if (trimmed.includes("\ndata:")) {
    // Multi-line block (e.g., "event: message\ndata: {...}\nid: 123")
    // Extract all data: lines and join with newlines
    const dataLines = trimmed
      .split("\n")
      .filter((l) => l.trimStart().startsWith("data:"))
      .map((l) => {
        const t = l.trimStart();
        return t.startsWith("data: ") ? t.slice(6) : t.slice(5);
      });
    if (dataLines.length > 0) {
      dataStr = dataLines.join("\n");
    }
  }

  if (!dataStr || dataStr === "[DONE]") return;

  // Parse JSON — if it fails, skip silently (never send raw JSON to chat)
  let data;
  try {
    data = JSON.parse(dataStr);
  } catch {
    console.debug("[SSE] Non-JSON data line, skipping:", dataStr.slice(0, 80));
    return;
  }

  // --- Handle error events from ADK/backend ---
  if (data.error) {
    console.error("[SSE] Backend error:", data.error);
    const errStr =
      typeof data.error === "string" ? data.error : JSON.stringify(data.error);
    if (/session not found/i.test(errStr)) {
      onChunk(
        "\n\n⚠️ **Session expired** — the backend was restarted and lost the conversation state. " +
          "Click **New chat** (or reload the page) to start a fresh session, then re-send your message.\n\n",
      );
      if (onError) onError({ code: "session_expired", message: errStr });
    } else {
      onChunk(`\n\n⚠️ **Error:** ${errStr}\n\n`);
    }
    return;
  }

  // --- Handle typed events from our custom SSE format ---
  if (data.type) {
    switch (data.type) {
      case "thinking":
        if (onThinking && data.text) onThinking(data.text);
        return;
      case "tool_use":
        if (onToolCall && data.name)
          onToolCall({ name: data.name, args: data.args || {} });
        return;
      case "done":
        if (onMeta && data.usage)
          onMeta({
            tokens: data.usage,
            cost: data.cost,
            duration: data.duration_ms,
          });
        return;
      case "content":
        if (data.text) onChunk(data.text);
        return;
      default:
        return;
    }
  }

  // --- Handle ADK format: content.parts ---
  if (data.content?.parts) {
    for (const part of data.content.parts) {
      if (part.thought && part.text) {
        if (onThinking) onThinking(part.text);
      } else if (part.functionCall) {
        const fc = part.functionCall;
        if (onToolCall) onToolCall({ name: fc.name, args: fc.args || {} });
      } else if (part.functionResponse) {
        if (onToolResult) {
          const resp = part.functionResponse.response || {};
          onToolResult({ name: part.functionResponse.name, result: resp });
        }
      } else if (part.text) {
        onChunk(part.text);
      }
    }
    return;
  }

  // --- Handle usage metadata (ADK uses usageMetadata) ---
  if (data.usageMetadata) {
    if (onMeta) onMeta({ tokens: data.usageMetadata });
    return;
  }
  if (data.usage) {
    if (onMeta)
      onMeta({
        tokens: data.usage,
        cost: data.cost,
        duration: data.duration_ms,
      });
    return;
  }

  // --- Fallback: extract text content from other response formats ---
  const extracted = extractContent(data);
  if (extracted) onChunk(extracted);
}
