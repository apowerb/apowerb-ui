"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  listAllSessions,
  listArtifacts,
  listAgents,
  listArtifactLibrary,
} from "@/lib/api";

/**
 * How many session listings run at once.
 *
 * The backend exposes artifacts per session only, so a full library means one
 * request per session. Unbounded fan-out would open a request per session at
 * once — a user with a hundred sessions would hammer the API and hit the
 * browser's per-host connection limit. Six keeps it responsive without
 * flooding.
 */
const CONCURRENCY = 6;

/**
 * Scope holding the uploads that were made without a conversation.
 *
 * The upload API files a document under its session when it knows one and
 * under this agent-wide scope otherwise (apowerb.artifacts.input_scope). It
 * belongs to no session, so listing sessions alone would never reach it —
 * the file would be stored, billed and invisible.
 */
export const SHARED_SCOPE = "_shared";

/**
 * Normalises one entry of the single-call library endpoint.
 *
 * Same shape as `toItems` produces, so the screen cannot tell which path
 * answered.
 */
function fromLibrary(a) {
  const kind = ["input", "legacy"].includes(a.kind) ? a.kind : "output";
  return {
    id: `${a.agent_folder}/${a.session_id}/${kind}/${a.filename}`,
    filename: a.filename,
    language: a.language || "text",
    version: a.version ?? null,
    source: a.source || "adk",
    kind,
    agentName: a.agent_name || a.agent_folder,
    agentFolder: a.agent_folder,
    sessionId: a.session_id,
    updatedAt: a.updated_at ?? null,
  };
}

/**
 * Normalises one API listing into library items.
 *
 * `kind` tells an upload ("input") from something an agent produced
 * ("output"). Anything older than that field is an output: uploads were not
 * listed at all before it existed.
 */
function toItems(artifacts, { agentFolder, agentName, sessionId, updatedAt }) {
  if (!Array.isArray(artifacts)) return [];

  return artifacts.map((a) => {
    // "legacy" covers files written before the artifact layout existed —
    // 455 of them on dev, uploads and generated reports mixed together with
    // nothing left to tell them apart.
    const kind = ["input", "legacy"].includes(a.kind) ? a.kind : "output";
    return {
      // Kind is part of the identity: one session can hold an upload and a
      // generated artifact under the very same filename.
      id: `${agentFolder}/${sessionId}/${kind}/${a.filename}`,
      filename: a.filename,
      language: a.language || "text",
      version: a.version ?? null,
      source: a.source || "adk",
      kind,
      agentName,
      agentFolder,
      sessionId,
      updatedAt,
    };
  });
}

/**
 * Run `fn` over `items` with at most `limit` in flight, preserving input order.
 */
export async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index], index);
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => worker(),
  );
  await Promise.all(workers);

  return results;
}

/**
 * Collect every artifact the current user owns, across all of their sessions.
 *
 * The chat panel can only ever show the session in flight; this hook is what
 * makes an artifact reachable again once its conversation is closed.
 */
export function useArtifactLibrary({ userId }) {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(Boolean(userId));
  const [error, setError] = useState(null);
  const [reloadCounter, setReloadCounter] = useState(0);

  useEffect(() => {
    if (!userId) {
      setItems([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        // One request instead of one per session plus one per agent. On a
        // real account that was ~400 calls at ~200 ms each — six in flight,
        // so about fifteen seconds of blank screen, and that floor held
        // even for sessions holding nothing.
        const library = await listArtifactLibrary().catch(() => null);

        if (!cancelled && library?.supported && Array.isArray(library.items)) {
          setItems(library.items.map(fromLibrary));
          setIsLoading(false);
          return;
        }

        // Backend on its local-disk fallback, or older than this endpoint.
        const payload = await listAllSessions();
        const sessions = Array.isArray(payload)
          ? payload
          : payload?.sessions || [];

        const perSession = await mapWithConcurrency(
          sessions,
          CONCURRENCY,
          async (session) => {
            // Artifacts live under `artifacts_store/agent{id}/...`, which is the
            // folder name — passing the human-readable agent name would return
            // an empty list without ever failing.
            const agentFolder = session.agent_folder;
            if (!agentFolder || !session.id) return [];

            try {
              const artifacts = await listArtifacts(
                agentFolder,
                String(userId),
                session.id,
              );

              return toItems(artifacts, {
                agentFolder,
                agentName: session.agent_name || agentFolder,
                sessionId: session.id,
                updatedAt: session.update_time ?? session.create_time ?? null,
              });
            } catch {
              // One unreachable session must not empty the whole library.
              return [];
            }
          },
        );

        // One extra listing per agent, not per session: the shared scope
        // belongs to the agent, so asking once per session would return the
        // same uploads over and over.
        //
        // Built from the user's agents, not from the sessions: an agent can
        // hold uploads without ever having been talked to, and deriving the
        // list from sessions alone would leave those files unreachable —
        // exactly the blind spot this listing exists to close. Sessions
        // still contribute their own folders, so an agent that has since
        // been deleted keeps showing what it produced.
        const agents = new Map();
        for (const session of sessions) {
          const folder = session.agent_folder;
          if (folder && !agents.has(folder)) {
            agents.set(folder, session.agent_name || folder);
          }
        }

        try {
          const owned = await listAgents();
          for (const agent of Array.isArray(owned) ? owned : []) {
            const folder = agent.agent_folder || `agent${agent.agent_id}`;
            if (folder && !agents.has(folder)) {
              agents.set(folder, agent.agent_name || folder);
            }
          }
        } catch {
          // The agent list is an addition, not a prerequisite: without it the
          // library still shows everything the sessions carry.
        }

        const perAgentShared = await mapWithConcurrency(
          Array.from(agents),
          CONCURRENCY,
          async ([agentFolder, agentName]) => {
            try {
              const artifacts = await listArtifacts(
                agentFolder,
                String(userId),
                SHARED_SCOPE,
              );

              return toItems(artifacts, {
                agentFolder,
                agentName,
                sessionId: SHARED_SCOPE,
                updatedAt: null,
              });
            } catch {
              return [];
            }
          },
        );

        if (cancelled) return;

        const flat = [...perSession.flat(), ...perAgentShared.flat()];
        flat.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
        setItems(flat);
      } catch (err) {
        if (cancelled) return;
        setItems([]);
        setError(err?.message || "Failed to load artifacts");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, reloadCounter]);

  const reload = useCallback(() => setReloadCounter((c) => c + 1), []);

  const byAgent = useMemo(() => {
    const groups = new Map();
    for (const item of items) {
      if (!groups.has(item.agentName)) groups.set(item.agentName, []);
      groups.get(item.agentName).push(item);
    }
    return Array.from(groups, ([agentName, artifacts]) => ({
      agentName,
      artifacts,
    }));
  }, [items]);

  return { items, byAgent, isLoading, error, reload };
}
