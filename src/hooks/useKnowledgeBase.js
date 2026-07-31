"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  indexRagFiles,
  indexRagUrl,
  indexRagDb,
  indexRagDbNl,
  indexRagS3,
  listRagKnowledge,
} from "@/lib/api";
import { authStorage } from "@/lib/authStorage";

export function useKnowledgeBase(agentId, sessionId) {
  const [sources, setSources] = useState([]);
  const [isIndexing, setIsIndexing] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const [error, setError] = useState(null);

  // Ids des sources annulées par l'utilisateur : l'annulation doit rester
  // "collante" — un refresh()/poll qui relit le backend ("processing") ne doit
  // PAS la ressusciter ni rallumer isIndexing.
  const cancelledIdsRef = useRef(new Set());
  const applyCancelled = useCallback(
    (list) =>
      (list || []).map((s) =>
        cancelledIdsRef.current.has(s.knowledge_id)
          ? { ...s, status: "cancelled" }
          : s,
      ),
    [],
  );

  const activeSources = sources.filter((s) => s.status !== "cancelled");
  const isReady =
    activeSources.length > 0 &&
    activeSources.every((s) => s.status === "complete");

  // Load existing knowledge map
  const refresh = useCallback(async () => {
    if (!agentId) return;
    try {
      const data = await listRagKnowledge(agentId, sessionId);
      const list = applyCancelled(data.sources || []);
      setSources(list);
      // Une source annulée ne compte jamais comme "processing".
      setIsIndexing(list.some((s) => s.status === "processing"));
    } catch (err) {
      console.warn("[useKnowledgeBase] refresh failed:", err);
    }
  }, [agentId, sessionId, applyCancelled]);

  // SSE stream for real-time indexation updates with polling fallback
  useEffect(() => {
    if (!isIndexing || !agentId) return;

    let cancelled = false;
    let retryCount = 0;
    const MAX_RETRIES = 5;
    const abortController = new AbortController();

    const pollFallback = async () => {
      while (!cancelled) {
        try {
          const data = await listRagKnowledge(agentId, sessionId);
          if (cancelled) return;
          const newSources = applyCancelled(data.sources || []);
          setSources(newSources);
          if (!newSources.some((s) => s.status === "processing")) {
            setIsIndexing(false);
            return;
          }
        } catch (err) {
          if (!cancelled) console.warn("[useKnowledgeBase] poll failed:", err);
        }
        await new Promise((r) => setTimeout(r, 5000));
      }
    };

    const connectSSE = async () => {
      try {
        const token = authStorage.getToken();
        const params = new URLSearchParams();
        if (sessionId) params.set("session_id", sessionId);
        // CRIT-02 fix: correct URL is /api/rag/stream/ (not /api/rag-stream/)
        const url = `/api/rag/stream/${agentId}?${params}`;

        console.log(
          "[useKnowledgeBase] Connecting SSE stream for",
          agentId,
          `(attempt ${retryCount + 1}/${MAX_RETRIES})`,
        );

        const response = await fetch(url, {
          headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          signal: abortController.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.warn(
            "[useKnowledgeBase] SSE response not ok:",
            response.status,
            errorText,
          );
          // Fallback to polling
          if (!cancelled) {
            console.log(
              "[useKnowledgeBase] SSE unavailable, falling back to polling every 5s",
            );
            await pollFallback();
          }
          return;
        }

        const contentType = response.headers.get("content-type") || "";

        if (!contentType.includes("text/event-stream") && !response.body) {
          // Not an SSE stream — fallback to a single refresh
          console.warn(
            "[useKnowledgeBase] Backend did not return SSE stream, falling back to refresh",
          );
          if (!cancelled) {
            const data = await response.json();
            if (data.sources) setSources(data.sources);
          }
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            // Process any remaining buffer
            if (buffer.trim()) {
              processRemainingBuffer(
                buffer,
                cancelled,
                setSources,
                setIsIndexing,
                setError,
              );
            }
            console.log("[useKnowledgeBase] SSE stream ended");
            break;
          }

          if (cancelled) break;

          buffer += decoder.decode(value, { stream: true });

          // Split on double newline to get SSE blocks
          const blocks = buffer.split("\n\n");
          buffer = blocks.pop() || "";

          for (const block of blocks) {
            if (cancelled) return;

            const event = parseSSEBlock(block);
            if (!event) continue;

            console.log("[useKnowledgeBase] SSE event:", event.type);

            switch (event.type) {
              case "connected":
              case "status_update":
                if (event.sources) {
                  setSources(event.sources);
                }
                break;

              // CRIT-03 fix: handle "status" event for individual source updates
              case "status":
                if (event.knowledge_id && event.status) {
                  setSources((prev) =>
                    prev.map((s) =>
                      s.knowledge_id === event.knowledge_id
                        ? { ...s, status: event.status }
                        : s
                    )
                  );
                }
                break;

              case "complete":
                setIsIndexing(false);
                if (event.sources) {
                  setSources(event.sources);
                } else if (event.statuses) {
                  setSources((prev) =>
                    prev.map((s) => {
                      const newStatus = event.statuses[s.knowledge_id];
                      return newStatus ? { ...s, status: newStatus } : s;
                    })
                  );
                }
                // Do NOT call refresh() here — it would re-set isIndexing(true) if
                // knowledge map still has stale "processing" sources, causing a reconnection loop.
                return;

              case "timeout":
                if (event.sources) {
                  setSources(event.sources);
                }
                setIsIndexing(false);
                setError("Indexing timeout");
                return;

              default:
                break;
            }
          }
        }
      } catch (err) {
        if (err.name === "AbortError" || cancelled) return;

        retryCount++;
        if (retryCount >= MAX_RETRIES) {
          console.warn(
            "[useKnowledgeBase] SSE max retries reached, falling back to polling",
          );
          if (!cancelled) await pollFallback();
          return;
        }

        const delay = Math.min(5000 * Math.pow(2, retryCount - 1), 30000);
        console.warn(
          `[useKnowledgeBase] SSE connection error, retrying in ${delay / 1000}s (${retryCount}/${MAX_RETRIES}):`,
          err.message,
        );

        // Reconnect with exponential backoff
        if (!cancelled) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          if (!cancelled) {
            connectSSE();
          }
        }
      }
    };

    connectSSE();

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [isIndexing, agentId, sessionId, refresh]);

  // Garde-fou anti-boucle infinie : une indexation ne doit jamais rester
  // "processing" indéfiniment. Si une source ne signale jamais sa fin (cas
  // observé sur certains liens web), on l'échoue après un délai max et on coupe
  // l'attente — sans ça l'UI reconnecte/poll en boucle (cf. issue indexation web).
  useEffect(() => {
    if (!isIndexing) return;
    const MAX_PROCESSING_MS = 5 * 60 * 1000; // 5 min
    const timer = setTimeout(() => {
      setSources((prev) =>
        prev.map((s) =>
          s.status === "processing" ? { ...s, status: "failed" } : s,
        ),
      );
      setIsIndexing(false);
      setError(
        "Indexation interrompue : délai dépassé (la source n'a jamais signalé sa fin).",
      );
    }, MAX_PROCESSING_MS);
    return () => clearTimeout(timer);
  }, [isIndexing]);

  // Reset state when agentId or sessionId changes — inline async with cancellation
  // to prevent stale responses from a previous session overwriting the current one
  useEffect(() => {
    setSources([]);
    setError(null);
    setIsIndexing(false);

    if (!agentId) {
      setIsInitialLoading(false);
      return;
    }

    setIsInitialLoading(true);
    let cancelled = false;

    (async () => {
      try {
        const data = await listRagKnowledge(agentId, sessionId);
        if (cancelled) return;
        setSources(data.sources || []);
        const hasProcessing = (data.sources || []).some(
          (s) => s.status === "processing",
        );
        setIsIndexing(hasProcessing);
      } catch (err) {
        if (!cancelled) console.warn("[useKnowledgeBase] refresh failed:", err);
      } finally {
        if (!cancelled) setIsInitialLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [agentId, sessionId]);

  const addFiles = useCallback(
    async (files) => {
      if (!agentId) return;
      setError(null);
      try {
        const result = await indexRagFiles(files, agentId, sessionId);
        setSources((prev) => [...prev, ...(result.sources || [])]);
        setIsIndexing(true);
      } catch (err) {
        setError(err.message);
      }
    },
    [agentId, sessionId],
  );

  const addUrl = useCallback(
    async (url, name) => {
      if (!agentId) return;
      setError(null);
      try {
        const result = await indexRagUrl({
          agent_id: agentId,
          session_id: sessionId,
          url,
          name,
        });
        setSources((prev) => [...prev, result.source]);
        setIsIndexing(true);
      } catch (err) {
        setError(err.message);
      }
    },
    [agentId, sessionId],
  );

  const addDb = useCallback(
    async (toolConfigId, sqlQuery, name) => {
      if (!agentId) return;
      setError(null);
      try {
        const result = await indexRagDb({
          agent_id: agentId,
          session_id: sessionId,
          tool_config_id: toolConfigId,
          sql_query: sqlQuery,
          name,
        });
        setSources((prev) => [...prev, result.source]);
        setIsIndexing(true);
      } catch (err) {
        setError(err.message);
      }
    },
    [agentId, sessionId],
  );

  const addDbNl = useCallback(
    async (payload) => {
      if (!agentId) return;
      setError(null);
      try {
        const result = await indexRagDbNl({
          agent_id: agentId,
          session_id: sessionId,
          ...payload,
        });
        setSources((prev) => [...prev, result.source]);
        setIsIndexing(true);
        return { generated_sql: result.generated_sql, row_count: result.row_count };
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    [agentId, sessionId],
  );

  const addS3 = useCallback(
    async (toolConfigId, s3Urls, name) => {
      if (!agentId) return;
      setError(null);
      try {
        const result = await indexRagS3({
          agent_id: agentId,
          session_id: sessionId,
          tool_config_id: toolConfigId,
          s3_urls: s3Urls,
          name,
        });
        setSources((prev) => [...prev, ...(result.sources || [])]);
        setIsIndexing(true);
      } catch (err) {
        setError(err.message);
      }
    },
    [agentId, sessionId],
  );

  const cancelIndexing = useCallback(() => {
    // Stop listening to SSE — the backend task continues but we no longer wait for it.
    // Mark pending sources as "cancelled" so the UI reflects the decision immediately,
    // then refresh() to pick up any sources already completed on the backend.
    setIsIndexing(false);
    setIsCancelled(true);
    setSources((prev) => {
      // Mémorise les ids annulés -> refresh()/poll ne les rallumeront pas.
      prev.forEach((s) => {
        if (s.status === "processing" && s.knowledge_id) {
          cancelledIdsRef.current.add(s.knowledge_id);
        }
      });
      return prev.map((s) =>
        s.status === "processing" ? { ...s, status: "cancelled" } : s,
      );
    });
    // Resync : refresh() honore cancelledIdsRef (ne ressuscite pas l'annulation)
    // tout en récupérant les sources réellement terminées côté backend.
    refresh();
  }, [refresh]);

  return {
    sources,
    isIndexing,
    isCancelled,
    isInitialLoading,
    isReady,
    error,
    addFiles,
    addUrl,
    addDb,
    addDbNl,
    addS3,
    refresh,
    cancelIndexing,
  };
}

/**
 * Parse a single SSE block (text between \n\n delimiters).
 * Extracts the data: payload and parses it as JSON.
 * Returns the parsed event object, or null if invalid.
 */
function parseSSEBlock(block) {
  const trimmed = block.trim();
  if (!trimmed || trimmed.startsWith(":")) return null;

  let eventType = null;
  let dataStr = null;

  for (const line of trimmed.split("\n")) {
    const l = line.trimStart();
    if (l.startsWith("event:")) {
      eventType = l.slice(l.indexOf(":") + 1).trim();
    } else if (l.startsWith("data:")) {
      dataStr = l.slice(l.indexOf(":") + 1).trim();
    }
  }

  if (!dataStr || dataStr === "[DONE]") return null;

  try {
    const parsed = JSON.parse(dataStr);
    // Inject the SSE event type as `type` for switch/case dispatching
    parsed.type = eventType || parsed.event || parsed.type;
    return parsed;
  } catch {
    console.debug(
      "[useKnowledgeBase] Non-JSON SSE data, skipping:",
      dataStr.slice(0, 80),
    );
    return null;
  }
}

/**
 * Process any remaining buffer content when the SSE stream ends.
 * Handles the case where the stream closes with a partial buffer.
 */
function processRemainingBuffer(
  buffer,
  cancelled,
  setSources,
  setIsIndexing,
  setError,
) {
  if (cancelled) return;

  const blocks = buffer.split("\n\n");
  for (const block of blocks) {
    if (!block.trim()) continue;
    const event = parseSSEBlock(block);
    if (!event) continue;

    console.log("[useKnowledgeBase] SSE remaining event:", event.type);

    switch (event.type) {
      case "connected":
      case "status_update":
        if (event.sources) setSources(event.sources);
        break;
      case "status":
        if (event.knowledge_id && event.status) {
          setSources((prev) =>
            prev.map((s) =>
              s.knowledge_id === event.knowledge_id
                ? { ...s, status: event.status }
                : s
            )
          );
        }
        break;
      case "complete":
        if (event.sources) setSources(event.sources);
        setIsIndexing(false);
        break;
      case "timeout":
        if (event.sources) setSources(event.sources);
        setIsIndexing(false);
        setError("Indexing timeout");
        break;
      default:
        break;
    }
  }
}
