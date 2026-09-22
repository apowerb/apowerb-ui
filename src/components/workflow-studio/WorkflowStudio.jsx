"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addEdge } from "@xyflow/react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "use-intl";
import {
  getWorkflowDef,
  updateWorkflowDef,
  listAgents,
  listTools,
  listToolConfigs,
  listWorkflowDefs,
  runWorkflowDef,
  cancelWorkflowRun,
} from "@/lib/api";
import { toolLeafName } from "@/components/tools-manager/toolsManagerUtils";
import {
  graphToFlow,
  flowToGraph,
  findFreePosition,
  validateGraphLocal,
  createNode,
  duplicateNode,
  autoLayout,
  renameNodeId,
} from "@/lib/workflowGraph";
import { triggerSamplePayloadFromSchema, triggerPayloadInitialMode, triggerScheduleDetail } from "@/lib/workflowTriggers";
import { createRunState, applyRunEvent, runStatusByNodeId } from "@/lib/workflowRunState";
import { consumeWorkflowRun } from "@/lib/workflowSse";
import { useUndoRedo } from "./hooks/useUndoRedo";
import { useRunReplay } from "./hooks/useRunReplay";
import { useToolSchemas } from "./hooks/useToolSchemas";
import StudioTopBar from "./StudioTopBar";
import StudioPalette from "./StudioPalette";
import StudioCanvas from "./StudioCanvas";
import StudioInspector from "./StudioInspector";
import ExecutionPanel from "./ExecutionPanel";
import VersionsDrawer from "./VersionsDrawer";
import LoopBodyEditor from "./LoopBodyEditor";

const GATEWAY_STATUSES = new Set([502, 503, 504]);

// The run request failed before any SSE frame. With no HTTP status (fetch
// rejected) or a gateway error, the server never answered: there is nothing
// of its own to show, so name that, retryably, instead of a proxy page.
function runRequestErrorEvent(err) {
  if (!err.status || GATEWAY_STATUSES.has(err.status)) {
    return { event: "error", code: "server_unreachable", detail: err.message, params: { status: err.status ?? "-" } };
  }
  return { event: "error", detail: err.message };
}

const AUTOSAVE_DELAY_MS = 1000;

// `ti` is the "WorkflowInspector" translator — kept as a plain argument
// (rather than a hook call in here) because this runs inside a `useMemo`,
// not as its own component.
function subtitleFor(node, agentOptions, toolOptions, workflowOptions, ti) {
  const cfg = node.data.config || {};
  if (node.type === "agent" || node.type === "classifier") {
    return agentOptions.find((a) => a.value === cfg.agent_id)?.label;
  }
  if (node.type === "tool") {
    return toolOptions.find((tt) => tt.value === cfg.tool)?.label;
  }
  if (node.type === "trigger") {
    return triggerSubtitle(cfg, ti);
  }
  if (node.type === "subworkflow") {
    return workflowOptions.find((w) => String(w.value) === String(cfg.workflow_id))?.label;
  }
  return undefined;
}

// "Planifié · jours ouvrés 9:00" — the kind's own label plus, for kinds that
// have one, a one-line detail. `manual` (the default) stays subtitle-less,
// matching the node's look before triggers had more than one kind.
function triggerSubtitle(cfg, ti) {
  const kind = cfg.kind || "manual";
  if (kind === "manual" || !ti) return undefined;
  const kindLabel = ti(`triggerKind_${kind}`);
  switch (kind) {
    case "schedule": {
      const detail = triggerScheduleDetail(cfg);
      const params = detail.key === "scheduleWeeklyAt" ? { ...detail.params, weekday: ti(`weekday_${detail.params.weekday}`) } : detail.params;
      return `${kindLabel} · ${ti(`triggerSubtitle_${detail.key}`, params)}`;
    }
    case "email":
      return `${kindLabel} · ${ti(`emailProvider_${cfg.provider || "outlook"}`)}`;
    case "agent_tool":
      return cfg.tool_name ? `${kindLabel} · ${cfg.tool_name}` : kindLabel;
    case "form":
      return cfg.title ? `${kindLabel} · ${cfg.title}` : kindLabel;
    case "file":
      return `${kindLabel} · ${ti(`fileProvider_${cfg.provider || "onedrive"}`)}`;
    default:
      return kindLabel;
  }
}

export default function WorkflowStudio({ workflowId }) {
  const t = useTranslations("WorkflowStudio");
  const ti = useTranslations("WorkflowInspector");

  const [loadState, setLoadState] = useState("loading");
  const [loadError, setLoadError] = useState(null);
  const [workflowMeta, setWorkflowMeta] = useState(null); // { name, status, version }
  const expectedVersionRef = useRef(null);

  const { nodes, edges, setNodes, setEdges, onNodesChange, onEdgesChange, pushHistory, resetHistory, undo, redo, canUndo, canRedo } =
    useUndoRedo([], []);

  const [selection, setSelection] = useState(null);
  const [saveState, setSaveState] = useState("idle");
  const [conflict, setConflict] = useState(null);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [bodyEditorNodeId, setBodyEditorNodeId] = useState(null);

  const [agentOptions, setAgentOptions] = useState([]);
  const [toolOptions, setToolOptions] = useState([]);
  const { schemas: toolSchemas, ensure: ensureToolSchema } = useToolSchemas();
  const [workflowOptions, setWorkflowOptions] = useState([]);
  // Bumped after publish/unpublish so the trigger status panel (webhook URL,
  // active/inactive reason…) refetches instead of showing a stale state.
  const [triggerRefreshKey, setTriggerRefreshKey] = useState(0);

  const lastSavedSnapshotRef = useRef(null);
  // Mirrors lastSavedSnapshotRef for rendering: the top bar must say
  // "Unsaved changes" as soon as the graph differs, not once the timer fires.
  const [savedSnapshot, setSavedSnapshot] = useState(null);
  const saveTimeoutRef = useRef(null);
  const conflictRef = useRef(false);

  // --- load picker data (agents/tools/workflows) ----------------------------
  useEffect(() => {
    Promise.allSettled([listAgents(), listTools(), listToolConfigs(), listWorkflowDefs()]).then(
      ([agentsR, toolsR, configsR, workflowsR]) => {
        if (agentsR.status === "fulfilled") {
          setAgentOptions(
            (agentsR.value || [])
              .filter((a) => a.agent_id != null)
              .map((a) => ({ value: `agent${a.agent_id}`, label: a.agent_name || `agent${a.agent_id}` })),
          );
        }
        const opts = [];
        if (toolsR.status === "fulfilled") {
          const raw = toolsR.value;
          if (raw && typeof raw === "object" && !Array.isArray(raw)) {
            for (const [category, list] of Object.entries(raw)) {
              for (const name of list || []) {
                opts.push({ value: name, label: `${toolLeafName(name)} (${category.replace(/^tools_/, "")})` });
              }
            }
          }
        }
        if (configsR.status === "fulfilled") {
          for (const c of configsR.value || []) {
            opts.push({ value: `tool_config${c.tool_config_id}`, label: c.tool_config_name });
          }
        }
        setToolOptions(opts);
        if (workflowsR.status === "fulfilled") {
          setWorkflowOptions(
            (workflowsR.value || []).map((w) => ({ value: String(w.workflow_id), label: w.name || String(w.workflow_id) })),
          );
        }
      },
    );
  }, []);

  // --- tool arg schemas ------------------------------------------------------
  // Prefetches the schema for every tool node's `config.tool` already on the
  // canvas — both "an existing tool node loads with the graph" and "the
  // user just picked a tool" funnel through this same effect, since both
  // change `nodes`. `ensure()` is a no-op for a tool_ref already cached or
  // in flight, so switching selection or re-saving never re-fetches.
  const toolRefsInUse = useMemo(
    () => [...new Set(nodes.filter((n) => n.type === "tool" && n.data?.config?.tool).map((n) => n.data.config.tool))],
    [nodes],
  );
  useEffect(() => {
    for (const toolRef of toolRefsInUse) ensureToolSchema(toolRef);
  }, [toolRefsInUse, ensureToolSchema]);

  // --- load the workflow ---------------------------------------------------
  const loadWorkflow = useCallback(
    (id) => {
      setLoadState("loading");
      setLoadError(null);
      return getWorkflowDef(id)
        .then((wf) => {
          const { nodes: n, edges: e } = graphToFlow(wf.graph);
          resetHistory(n, e);
          setWorkflowMeta({ name: wf.name, status: wf.status, version: wf.version });
          expectedVersionRef.current = wf.version;
          lastSavedSnapshotRef.current = JSON.stringify({ name: wf.name, graph: flowToGraph(n, e) });
          setSavedSnapshot(lastSavedSnapshotRef.current);
          setConflict(null);
          conflictRef.current = false;
          setLoadState("loaded");
          return wf;
        })
        .catch((err) => {
          setLoadError(err.status === 404 ? "notfound" : err.message);
          setLoadState(err.status === 404 ? "notfound" : "error");
        });
    },
    [resetHistory],
  );

  useEffect(() => {
    loadWorkflow(workflowId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowId]);

  // --- validation ------------------------------------------------------------
  const validation = useMemo(
    () => validateGraphLocal(flowToGraph(nodes, edges), { toolSchemas, currentWorkflowId: workflowId, now: new Date() }),
    [nodes, edges, toolSchemas, workflowId],
  );
  const errorsByNode = useMemo(() => {
    const map = {};
    for (const err of validation.errors) {
      if (err.level === "warning") continue;
      const top = (err.nodeId || "").split(".")[0];
      map[top] = (map[top] || 0) + 1;
    }
    return map;
  }, [validation]);

  // --- run state ---------------------------------------------------------
  const [testOpen, setTestOpen] = useState(false);
  const [payloadText, setPayloadText] = useState("{}");
  const [payloadError, setPayloadError] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [liveRunState, setRunState] = useState(createRunState());
  // Every event of the last run, in order: the replay rebuilds the run from them.
  const [runEvents, setRunEvents] = useState([]);
  const replay = useRunReplay(runEvents);
  const runState = replay.state || liveRunState;
  const runAbortRef = useRef(null);
  const prefilledPayloadRef = useRef(false);

  useEffect(() => {
    if (prefilledPayloadRef.current || !testOpen) return;
    const trigger = nodes.find((n) => n.type === "trigger");
    const cfg = trigger?.data?.config;
    // agent_tool / form declare their own payload shape (input_schema /
    // fields): that beats a hand-written sample_payload, which is the only
    // option left for every other kind.
    const schemaPayload = cfg && triggerSamplePayloadFromSchema(cfg);
    if (schemaPayload) {
      setPayloadText(JSON.stringify(schemaPayload, null, 2));
    } else if (cfg?.sample_payload) {
      setPayloadText(JSON.stringify(cfg.sample_payload, null, 2));
    }
    prefilledPayloadRef.current = true;
  }, [testOpen, nodes]);

  const payloadInitialMode = useMemo(() => {
    const trigger = nodes.find((n) => n.type === "trigger");
    return triggerPayloadInitialMode(trigger?.data?.config);
  }, [nodes]);

  const handlePayloadTextChange = (text) => {
    setPayloadText(text);
    try {
      JSON.parse(text);
      setPayloadError(null);
    } catch (err) {
      setPayloadError(err.message);
    }
  };

  const runStatusMap = useMemo(() => runStatusByNodeId(runState), [runState]);
  const runDurationById = useMemo(() => {
    const map = {};
    for (const entry of runState.timeline) map[entry.id] = entry.duration;
    return map;
  }, [runState]);
  const runRouteById = useMemo(() => {
    const map = {};
    for (const entry of runState.timeline) if (entry.route) map[entry.id] = entry.route;
    return map;
  }, [runState]);

  const handleRun = useCallback(async () => {
    if (payloadError) return;
    let payload = {};
    try {
      payload = payloadText.trim() ? JSON.parse(payloadText) : {};
    } catch {
      return;
    }
    setRunState(createRunState());
    setRunEvents([]);
    setIsRunning(true);
    const controller = new AbortController();
    runAbortRef.current = controller;
    try {
      const response = await runWorkflowDef(workflowId, payload, { signal: controller.signal });
      await consumeWorkflowRun(response, {
        signal: controller.signal,
        onEvent: (evt) => {
          setRunEvents((list) => [...list, evt]);
          setRunState((s) => applyRunEvent(s, evt));
        },
      });
    } catch (err) {
      if (!controller.signal.aborted) {
        const evt = runRequestErrorEvent(err);
        setRunEvents((list) => [...list, evt]);
        setRunState((s) => applyRunEvent(s, evt));
      }
    } finally {
      setIsRunning(false);
      runAbortRef.current = null;
    }
  }, [workflowId, payloadText, payloadError]);

  const handleCancelRun = useCallback(() => {
    runAbortRef.current?.abort();
    cancelWorkflowRun(workflowId).catch(() => {});
    setRunState((s) => applyRunEvent(s, { event: "cancelled" }));
  }, [workflowId]);

  // --- autosave --------------------------------------------------------------
  const doSave = useCallback(
    async (overrides = {}, { keepalive = false } = {}) => {
      if (conflictRef.current) return;
      const graph = flowToGraph(nodes, edges);
      const name = overrides.name ?? workflowMeta?.name ?? "";
      const body = {
        expected_version: expectedVersionRef.current,
        name,
        graph,
        ...overrides,
      };
      setSaveState("saving");
      try {
        const updated = keepalive
          ? await updateWorkflowDef(workflowId, body, { keepalive: true })
          : await updateWorkflowDef(workflowId, body);
        expectedVersionRef.current = updated.version;
        setWorkflowMeta({ name: updated.name, status: updated.status, version: updated.version });
        lastSavedSnapshotRef.current = JSON.stringify({ name, graph });
        setSavedSnapshot(lastSavedSnapshotRef.current);
        setSaveState("idle");
        return updated;
      } catch (err) {
        if (err.status === 409) {
          conflictRef.current = true;
          setConflict({ currentVersion: err.detail?.current_version ?? null });
        }
        setSaveState("error");
        throw err;
      }
    },
    [workflowId, nodes, edges, workflowMeta?.name],
  );

  useEffect(() => {
    if (loadState !== "loaded" || conflictRef.current) return;
    const snapshot = JSON.stringify({ name: workflowMeta?.name, graph: flowToGraph(nodes, edges) });
    if (snapshot === lastSavedSnapshotRef.current) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      doSave().catch(() => {});
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(saveTimeoutRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, workflowMeta?.name, loadState]);

  const currentSnapshot = useMemo(
    () => JSON.stringify({ name: workflowMeta?.name, graph: flowToGraph(nodes, edges) }),
    [nodes, edges, workflowMeta?.name],
  );
  const dirty = loadState === "loaded" && savedSnapshot !== null && currentSnapshot !== savedSnapshot;
  const shownSaveState = saveState === "idle" && dirty ? "dirty" : saveState;

  // Leaving the studio (in-app navigation, hidden tab, closed page) must not
  // wait for the autosave timer: the pending change would be lost. The refs
  // give the listeners the latest save and whether one is pending.
  const doSaveRef = useRef(doSave);
  const dirtyRef = useRef(false);
  useEffect(() => {
    doSaveRef.current = doSave;
    dirtyRef.current = dirty;
  });
  useEffect(() => {
    const flush = (keepalive) => {
      if (!dirtyRef.current || conflictRef.current) return;
      dirtyRef.current = false;
      clearTimeout(saveTimeoutRef.current);
      doSaveRef.current({}, { keepalive }).catch(() => {});
    };
    const onPageHide = () => flush(true);
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush(true);
    };
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      flush(false);
    };
  }, []);

  const handleReloadConflict = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    loadWorkflow(workflowId);
  }, [loadWorkflow, workflowId]);

  const handleNameChange = useCallback(
    (name) => {
      setWorkflowMeta((m) => ({ ...m, name }));
    },
    [],
  );

  const handlePublish = useCallback(async () => {
    setPublishing(true);
    try {
      await doSave({ status: "published" });
      // A trigger only activates once published — refetch its status panel.
      setTriggerRefreshKey((k) => k + 1);
    } catch {
      // surfaced via saveState/conflict already
    } finally {
      setPublishing(false);
    }
  }, [doSave]);

  const handleUnpublish = useCallback(async () => {
    setPublishing(true);
    try {
      await doSave({ status: "draft" });
      setTriggerRefreshKey((k) => k + 1);
    } catch {
      // surfaced via saveState/conflict already
    } finally {
      setPublishing(false);
    }
  }, [doSave]);

  const handleRestored = useCallback(
    (updated) => {
      const { nodes: n, edges: e } = graphToFlow(updated.graph);
      resetHistory(n, e);
      setWorkflowMeta({ name: updated.name, status: updated.status, version: updated.version });
      expectedVersionRef.current = updated.version;
      lastSavedSnapshotRef.current = JSON.stringify({ name: updated.name, graph: flowToGraph(n, e) });
      setSavedSnapshot(lastSavedSnapshotRef.current);
      setVersionsOpen(false);
    },
    [resetHistory],
  );

  // `selection` keeps the node/edge object it was made with. Resolve it against
  // the current graph so a restore or an undo never leaves the inspector
  // showing (and writing back) the values of the replaced version.
  const liveSelection = useMemo(() => {
    if (selection?.kind === "node") {
      const node = nodes.find((n) => n.id === selection.node.id);
      return node ? { kind: "node", node } : null;
    }
    if (selection?.kind === "edge") {
      const edge = edges.find((e) => e.id === selection.edge.id);
      return edge ? { kind: "edge", edge } : null;
    }
    return selection;
  }, [selection, nodes, edges]);

  // --- node/edge editing ------------------------------------------------------
  const existingIds = useCallback(() => nodes.map((n) => n.id), [nodes]);

  const addNodeAt = useCallback(
    (type, position) => {
      const graphNode = createNode(type, { position, existingIds: existingIds() });
      const flowNode = graphToFlow({ nodes: [graphNode], edges: [] }).nodes[0];
      const next = [...nodes, flowNode];
      setNodes(next);
      pushHistory(next, edges);
      setSelection({ kind: "node", node: flowNode });
    },
    [nodes, edges, setNodes, pushHistory, existingIds],
  );

  const [focusRequest, setFocusRequest] = useState(null);

  const addNodeCentered = useCallback(
    (type) => {
      const position = findFreePosition(nodes, selection?.kind === "node" ? selection.node.id : undefined);
      addNodeAt(type, position);
      setFocusRequest({ ...position, seq: Date.now() });
    },
    [addNodeAt, nodes, selection],
  );

  const onConnect = useCallback(
    (connection) => {
      const nextEdges = addEdge({ ...connection, type: "route", data: { route: null } }, edges);
      setEdges(nextEdges);
      pushHistory(nodes, nextEdges);
    },
    [edges, nodes, setEdges, pushHistory],
  );

  const patchNodeConfig = useCallback(
    (nodeId, partial) => {
      const next = nodes.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, config: { ...n.data.config, ...partial } } } : n));
      setNodes(next);
      setSelection((sel) => (sel?.kind === "node" && sel.node.id === nodeId ? { kind: "node", node: next.find((n) => n.id === nodeId) } : sel));
    },
    [nodes, setNodes],
  );

  const changeLabel = useCallback(
    (nodeId, label) => {
      const next = nodes.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, label } } : n));
      setNodes(next);
      setSelection((sel) => (sel?.kind === "node" && sel.node.id === nodeId ? { kind: "node", node: next.find((n) => n.id === nodeId) } : sel));
    },
    [nodes, setNodes],
  );

  const renameNode = useCallback(
    (oldId, newId) => {
      const { nodes: nextNodes, edges: nextEdges } = renameNodeId(nodes, edges, oldId, newId);
      setNodes(nextNodes);
      setEdges(nextEdges);
      pushHistory(nextNodes, nextEdges);
      setSelection((sel) => (sel?.kind === "node" && sel.node.id === oldId ? { kind: "node", node: nextNodes.find((n) => n.id === newId) } : sel));
    },
    [nodes, edges, setNodes, setEdges, pushHistory],
  );

  const deleteNode = useCallback(
    (nodeId) => {
      const nextNodes = nodes.filter((n) => n.id !== nodeId);
      const nextEdges = edges.filter((e) => e.source !== nodeId && e.target !== nodeId);
      setNodes(nextNodes);
      setEdges(nextEdges);
      pushHistory(nextNodes, nextEdges);
      setSelection(null);
    },
    [nodes, edges, setNodes, setEdges, pushHistory],
  );

  const changeEdgeRoute = useCallback(
    (edgeId, route) => {
      const next = edges.map((e) => (e.id === edgeId ? { ...e, data: { ...e.data, route: route || null } } : e));
      setEdges(next);
      setSelection((sel) => (sel?.kind === "edge" && sel.edge.id === edgeId ? { kind: "edge", edge: next.find((e) => e.id === edgeId) } : sel));
    },
    [edges, setEdges],
  );

  const deleteEdge = useCallback(
    (edgeId) => {
      const next = edges.filter((e) => e.id !== edgeId);
      setEdges(next);
      pushHistory(nodes, next);
      setSelection(null);
    },
    [edges, nodes, setEdges, pushHistory],
  );

  const duplicateSelected = useCallback(() => {
    if (selection?.kind !== "node") return;
    const src = selection.node;
    const copy = duplicateNode({ id: src.id, type: src.type, config: src.data.config, position: src.position, label: src.data.label }, existingIds());
    const flowNode = graphToFlow({ nodes: [copy], edges: [] }).nodes[0];
    const next = [...nodes, flowNode];
    setNodes(next);
    pushHistory(next, edges);
  }, [selection, nodes, edges, setNodes, pushHistory, existingIds]);

  const handleAutoLayout = useCallback(() => {
    const laidOut = autoLayout(nodes, edges);
    setNodes(laidOut);
    pushHistory(laidOut, edges);
  }, [nodes, edges, setNodes, pushHistory]);

  // --- derived, enriched nodes for rendering ----------------------------------
  const displayNodes = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        selected: selection?.kind === "node" && selection.node.id === n.id,
        data: {
          ...n.data,
          subtitle: subtitleFor(n, agentOptions, toolOptions, workflowOptions, ti),
          errorCount: errorsByNode[n.id] || 0,
          runStatus: runStatusMap[n.id],
          runDuration: runDurationById[n.id],
          runRoute: runRouteById[n.id],
          onDelete: () => deleteNode(n.id),
          onDuplicate: () => {
            const copy = duplicateNode({ id: n.id, type: n.type, config: n.data.config, position: n.position, label: n.data.label }, existingIds());
            const flowNode = graphToFlow({ nodes: [copy], edges: [] }).nodes[0];
            const next = [...nodes, flowNode];
            setNodes(next);
            pushHistory(next, edges);
          },
          onOpenBody: n.type === "loop" || n.type === "try" ? () => setBodyEditorNodeId(n.id) : undefined,
        },
      })),
    [nodes, edges, selection, agentOptions, toolOptions, workflowOptions, ti, errorsByNode, runStatusMap, runDurationById, runRouteById, deleteNode, existingIds, setNodes, pushHistory],
  );

  const displayEdges = useMemo(
    () =>
      edges.map((e) => {
        const sourceNode = nodes.find((n) => n.id === e.source);
        const isRouting = sourceNode && (sourceNode.type === "router" || sourceNode.type === "classifier" || sourceNode.type === "condition");
        return {
          ...e,
          selected: selection?.kind === "edge" && selection.edge.id === e.id,
          data: { ...e.data, needsRoute: isRouting && !e.data?.route },
        };
      }),
    [edges, nodes, selection],
  );

  const bodyEditorNode = bodyEditorNodeId ? nodes.find((n) => n.id === bodyEditorNodeId) : null;

  if (loadState === "loading") {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={24} className="animate-spin th-text-ghost" />
      </div>
    );
  }
  if (loadState === "notfound") {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <p className="text-sm font-semibold th-text mb-1">{t("notFoundTitle")}</p>
        <p className="text-xs th-text-ghost">{t("notFoundBody")}</p>
      </div>
    );
  }
  if (loadState === "error") {
    return (
      <div className="flex items-center justify-center h-full px-6 text-center">
        <p className="text-sm text-red-400">{t("loadFailed", { message: loadError })}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <StudioTopBar
        name={workflowMeta.name}
        onNameChange={handleNameChange}
        status={workflowMeta.status}
        version={workflowMeta.version}
        saveState={shownSaveState}
        validation={validation}
        onOpenVersions={() => setVersionsOpen(true)}
        testOpen={testOpen}
        onToggleTest={() => setTestOpen((v) => !v)}
        onPublish={handlePublish}
        onUnpublish={handleUnpublish}
        publishing={publishing}
        conflict={conflict}
        onReloadConflict={handleReloadConflict}
      />
      <div className="relative flex-1 min-h-0 flex">
        <StudioPalette onAdd={addNodeCentered} />
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex-1 min-h-0">
            <StudioCanvas
              nodes={displayNodes}
              edges={displayEdges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={(node) => setSelection({ kind: "node", node: nodes.find((n) => n.id === node.id) || node })}
              onEdgeClick={(edge) => setSelection({ kind: "edge", edge: edges.find((e) => e.id === edge.id) || edge })}
              onPaneClick={() => setSelection(null)}
              onNodesDelete={(deleted) => {
                const ids = new Set(deleted.map((n) => n.id));
                const nextNodes = nodes.filter((n) => !ids.has(n.id));
                const nextEdges = edges.filter((e) => !ids.has(e.source) && !ids.has(e.target));
                pushHistory(nextNodes, nextEdges);
                setSelection(null);
              }}
              onEdgesDelete={(deleted) => {
                const ids = new Set(deleted.map((e) => e.id));
                pushHistory(nodes, edges.filter((e) => !ids.has(e.id)));
              }}
              onDropNodeType={addNodeAt}
              focusRequest={focusRequest}
              onDuplicateSelected={duplicateSelected}
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={undo}
              onRedo={redo}
              onAutoLayout={handleAutoLayout}
            />
          </div>
          <ExecutionPanel
            open={testOpen}
            onToggle={() => setTestOpen((v) => !v)}
            payloadText={payloadText}
            onPayloadTextChange={handlePayloadTextChange}
            payloadError={payloadError}
            payloadInitialMode={payloadInitialMode}
            isRunning={isRunning}
            runState={runState}
            replay={replay}
            onRun={handleRun}
            onCancel={handleCancelRun}
          />
        </div>
        <StudioInspector
          selection={liveSelection}
          nodes={nodes}
          edges={edges}
          agentOptions={agentOptions}
          toolOptions={toolOptions}
          workflowId={workflowId}
          triggerRefreshKey={triggerRefreshKey}
          toolSchemas={toolSchemas}
          ensureToolSchema={ensureToolSchema}
          workflowOptions={workflowOptions}
          currentWorkflowId={workflowId}
          onChangeLabel={changeLabel}
          onRenameNode={renameNode}
          onPatchConfig={patchNodeConfig}
          onChangeEdgeRoute={changeEdgeRoute}
          onDeleteNode={deleteNode}
          onDeleteEdge={deleteEdge}
          onOpenLoopBody={(nodeId) => setBodyEditorNodeId(nodeId)}
        />
      </div>

      {versionsOpen && (
        <VersionsDrawer
          workflowId={workflowId}
          currentVersion={workflowMeta.version}
          published={workflowMeta.status === "published"}
          onClose={() => setVersionsOpen(false)}
          onRestored={handleRestored}
        />
      )}

      {bodyEditorNode && (
        <LoopBodyEditor
          node={bodyEditorNode}
          body={bodyEditorNode.data.config.body}
          onChange={(body) => patchNodeConfig(bodyEditorNode.id, { body })}
          onClose={() => setBodyEditorNodeId(null)}
          agentOptions={agentOptions}
          toolOptions={toolOptions}
          toolSchemas={toolSchemas}
          ensureToolSchema={ensureToolSchema}
          workflowOptions={workflowOptions}
          currentWorkflowId={workflowId}
        />
      )}
    </div>
  );
}
