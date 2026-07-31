"use client";

/**
 * useWorkflowRunner — isolates workflow execution for the DiagramEditor.
 *
 * Handles both paths:
 *   - SSE multipart upload (file attached) via /api/workflows/run-sse
 *   - Legacy in-browser runner via @/lib/workflowRunner
 *
 * Exposes { workflowState, workflowFile, setWorkflowFile, handleRunWorkflow,
 * handleStopWorkflow }. The caller provides the currently active tab (for
 * canvas order) and the mapped `boxes` (for agent metadata).
 */

import { useCallback, useRef, useState } from "react";
import { runWorkflow } from "@/lib/workflowRunner";

function createInitialWorkflowState() {
  return {
    status: "idle",
    steps: [],
    error: null,
    currentRow: null,
    totalRows: null,
    pendingRows: null,
    skippedRows: null,
    processed: null,
    skipped: null,
    dynamicIterations: {},
  };
}

export function useWorkflowRunner({ activeTab, boxes }) {
  const [workflowState, setWorkflowState] = useState(
    createInitialWorkflowState(),
  );
  const [workflowFile, setWorkflowFile] = useState(null);
  const abortRef = useRef(null);
  const workflowRunIdRef = useRef(null);

  const handleWorkflowSSEEvent = useCallback((ev) => {
    switch (ev.event) {
      case "loop_iterations_set":
        setWorkflowState((prev) => ({
          ...prev,
          dynamicIterations: {
            ...(prev.dynamicIterations || {}),
            ...Object.fromEntries(
              (ev.loop_agent_ids || []).map((id) => [id, ev.iterations]),
            ),
          },
        }));
        break;

      case "file_parsed":
        setWorkflowState((prev) => ({
          ...prev,
          totalRows: ev.total_rows,
          pendingRows: ev.pending_rows ?? ev.total_rows,
          skippedRows: ev.skipped_rows ?? 0,
        }));
        break;

      case "row_skipped":
        setWorkflowState((prev) => ({
          ...prev,
          steps: [
            ...prev.steps,
            {
              id: `skip-${ev.row}`,
              label: `Row ${ev.row} — skipped (${ev.reason ?? "already sent"})`,
              status: "done",
              row: ev.row,
              result: null,
              error: null,
              duration: 0,
            },
          ],
        }));
        break;

      case "row_start":
        setWorkflowState((prev) => ({ ...prev, currentRow: ev.row }));
        break;

      case "agent_start": {
        const isLoad = ev.phase === "load";
        const stepLabel = isLoad
          ? `${ev.agent_label} (loading file…)`
          : ev.agent_label;
        setWorkflowState((prev) => ({
          ...prev,
          steps: [
            ...prev.steps,
            {
              id: `${ev.row}-${ev.agent_id}`,
              label: stepLabel,
              status: "running",
              row: isLoad ? null : ev.row,
              result: null,
              error: null,
              duration: null,
            },
          ],
        }));
        break;
      }

      case "agent_done":
        setWorkflowState((prev) => ({
          ...prev,
          steps: prev.steps.map((s) =>
            s.id === `${ev.row}-${ev.agent_id}`
              ? {
                  ...s,
                  status: "done",
                  result: ev.result,
                  duration: ev.duration_ms,
                }
              : s,
          ),
        }));
        break;

      case "agent_error":
        setWorkflowState((prev) => ({
          ...prev,
          steps: prev.steps.map((s) =>
            s.id === `${ev.row}-${ev.agent_id}`
              ? {
                  ...s,
                  status: "error",
                  error: ev.error,
                  duration: ev.duration_ms,
                }
              : s,
          ),
        }));
        break;

      case "done":
        setWorkflowState((prev) => ({
          ...prev,
          status: "done",
          processed: ev.processed ?? prev.totalRows,
          skipped: ev.skipped ?? 0,
        }));
        break;

      case "cancelled":
        setWorkflowState((prev) => ({
          ...prev,
          status: "error",
          error: "Workflow was cancelled.",
        }));
        break;

      case "error":
        setWorkflowState((prev) => ({
          ...prev,
          status: "error",
          error: ev.message,
        }));
        break;

      default:
        break;
    }
  }, []);

  const handleRunWorkflowSSE = useCallback(async () => {
    if (!activeTab || activeTab.canvasOrder.length === 0) return;

    const workflowId = `wf_${Date.now()}`;
    workflowRunIdRef.current = workflowId;

    setWorkflowState(createInitialWorkflowState());
    setWorkflowState((prev) => ({ ...prev, status: "running" }));

    const formData = new FormData();
    formData.append("canvas_agent_ids", JSON.stringify(activeTab.canvasOrder));
    formData.append("workflow_id", workflowId);

    if (workflowFile?.rawFile) {
      formData.append("file", workflowFile.rawFile, workflowFile.name);
    }

    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("th2_auth_token") || ""
        : "";

    try {
      const res = await fetch("/api/workflows/run-sse", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        setWorkflowState((prev) => ({
          ...prev,
          status: "error",
          error: `HTTP ${res.status}: ${text}`,
        }));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            handleWorkflowSSEEvent(ev);
          } catch {
            /* ignore malformed lines */
          }
        }
      }
    } catch (err) {
      setWorkflowState((prev) => ({
        ...prev,
        status: "error",
        error: err.message,
      }));
    }
  }, [activeTab, workflowFile, handleWorkflowSSEEvent]);

  const handleRunWorkflowLegacy = useCallback(async () => {
    if (!activeTab || activeTab.canvasOrder.length === 0) return;

    const agentsMap = new Map(boxes.map((b) => [b.id, b]));
    const controller = new AbortController();
    abortRef.current = controller;

    const initialSteps = activeTab.canvasOrder.map((id) => ({
      id,
      label: agentsMap.get(id)?.label || id,
      type: agentsMap.get(id)?.category?.toLowerCase() || "base",
      status: "pending",
      result: null,
      error: null,
      startTime: null,
      duration: null,
    }));

    setWorkflowState({
      ...createInitialWorkflowState(),
      status: "running",
      steps: initialSteps,
    });

    const callbacks = {
      onStepStart: (agentId) => {
        setWorkflowState((prev) => ({
          ...prev,
          steps: prev.steps.map((s) =>
            s.id === agentId
              ? { ...s, status: "running", startTime: Date.now() }
              : s,
          ),
        }));
      },
      onStepComplete: (agentId, result) => {
        setWorkflowState((prev) => ({
          ...prev,
          steps: prev.steps.map((s) =>
            s.id === agentId
              ? {
                  ...s,
                  status: "done",
                  result,
                  duration: s.startTime ? Date.now() - s.startTime : null,
                }
              : s,
          ),
        }));
      },
      onStepError: (agentId, err) => {
        setWorkflowState((prev) => ({
          ...prev,
          steps: prev.steps.map((s) =>
            s.id === agentId
              ? {
                  ...s,
                  status: "error",
                  error: err.message,
                  duration: s.startTime ? Date.now() - s.startTime : null,
                }
              : s,
          ),
        }));
      },
      onWorkflowStart: () => {},
      onWorkflowComplete: () => {
        setWorkflowState((prev) => ({ ...prev, status: "done" }));
      },
      onWorkflowError: (err) => {
        setWorkflowState((prev) => ({
          ...prev,
          status: "error",
          error:
            err.name === "AbortError" ? "Workflow stopped" : err.message,
        }));
      },
    };

    try {
      await runWorkflow(
        activeTab.canvasOrder,
        agentsMap,
        callbacks,
        controller.signal,
      );
    } catch {
      /* Error already handled in callbacks */
    }
  }, [activeTab, boxes]);

  const handleRunWorkflow = useCallback(() => {
    if (workflowFile) {
      return handleRunWorkflowSSE();
    }
    return handleRunWorkflowLegacy();
  }, [workflowFile, handleRunWorkflowSSE, handleRunWorkflowLegacy]);

  const handleStopWorkflow = useCallback(async () => {
    const wid = workflowRunIdRef.current;
    if (wid) {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("th2_auth_token") || ""
          : "";
      try {
        await fetch(`/api/workflows/${wid}/cancel`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
      } catch {
        /* ignore */
      }
      workflowRunIdRef.current = null;
    }
    abortRef.current?.abort();
    setWorkflowState((prev) => ({
      ...prev,
      status: "error",
      error: "Workflow stopped by user.",
    }));
  }, []);

  return {
    workflowState,
    workflowFile,
    setWorkflowFile,
    handleRunWorkflow,
    handleStopWorkflow,
  };
}
