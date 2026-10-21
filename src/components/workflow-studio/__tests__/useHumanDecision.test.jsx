/**
 * The studio side of a human decision: the dialog opens when a run parks, a
 * refused answer changes nothing on screen, an accepted one replays the run
 * into the test panel with the same reducer, and a decision is reopened from
 * the URL after the tab was closed.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useRef, useState } from "react";

const { resumeWorkflowRun, listAwaitingDecisions } = vi.hoisted(() => ({
  resumeWorkflowRun: vi.fn(),
  listAwaitingDecisions: vi.fn(),
}));
vi.mock("@/lib/api", () => ({ resumeWorkflowRun, listAwaitingDecisions }));

import { useHumanDecision } from "@/components/workflow-studio/hooks/useHumanDecision";
import { applyRunEvent, createRunState } from "@/lib/workflowRunState";

const enc = new TextEncoder();
function sseResponse(events) {
  const body = new ReadableStream({
    start(controller) {
      for (const e of events) controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
      controller.close();
    },
  });
  return { ok: true, status: 200, body };
}

const AWAITING = [
  { event: "run_started", run_id: "r1" },
  { event: "node_start", node_id: "decision1", type: "approval" },
  { event: "awaiting_input", run_id: "r1", node_id: "decision1", question: "Valider ?", mode: "choices", choices: [{ route: "oui", label: "Oui" }, { route: "non", label: "Non" }], assignee: null },
];

const RESUME = [
  { event: "run_started", run_id: "r1" },
  { event: "node_start", node_id: "decision1", type: "approval", replayed: true },
  { event: "node_complete", node_id: "decision1", output: { choice: "oui", text: null } },
  { event: "route", node_id: "decision1", route: "oui" },
  { event: "done", output: "fini" },
];

const onResumed = vi.fn();

function useHarness(extra = {}) {
  const [liveRunState, setRunState] = useState(() => AWAITING.reduce(applyRunEvent, createRunState()));
  const [runEvents, setRunEvents] = useState(AWAITING);
  const [isRunning, setIsRunning] = useState(false);
  const runAbortRef = useRef(null);
  const decision = useHumanDecision({ workflowId: "w1", liveRunState, setRunState, setRunEvents, setIsRunning, runAbortRef, onResumed, ...extra });
  return { ...decision, liveRunState, runEvents, isRunning, setRunState };
}

beforeEach(() => {
  vi.clearAllMocks();
  listAwaitingDecisions.mockResolvedValue([]);
  window.history.replaceState({}, "", "/workflows/w1");
});
afterEach(() => window.history.replaceState({}, "", "/"));

describe("useHumanDecision", () => {
  it("opens the dialog on the parked run, and Later closes it without touching the run", () => {
    const { result } = renderHook(() => useHarness());
    expect(result.current.decision).toMatchObject({ runId: "r1", nodeId: "decision1", question: "Valider ?", mode: "choices" });
    act(() => result.current.close());
    expect(result.current.decision).toBeNull();
    expect(result.current.liveRunState.status).toBe("awaiting");
    expect(result.current.liveRunState.pendingDecision.runId).toBe("r1");
    // The panel's button brings it back.
    act(() => result.current.reopen());
    expect(result.current.decision).toMatchObject({ runId: "r1" });
  });

  it("does not open for a run that is not parked", () => {
    const { result } = renderHook(() => useHarness());
    act(() => result.current.setRunState(createRunState()));
    expect(result.current.decision).toBeNull();
  });

  it("an accepted answer resumes THAT run, resets the panel and replays the stream with the reducer", async () => {
    resumeWorkflowRun.mockResolvedValue(sseResponse(RESUME));
    const { result } = renderHook(() => useHarness());
    await act(async () => {
      await result.current.answer(result.current.decision, { choice: "oui" });
    });
    expect(resumeWorkflowRun).toHaveBeenCalledWith("r1", { choice: "oui" }, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    await waitFor(() => expect(result.current.liveRunState.status).toBe("done"));
    const s = result.current.liveRunState;
    expect(s.pendingDecision).toBeNull();
    expect(s.finalOutput).toBe("fini");
    const entry = s.timeline.find((e) => e.id === "decision1");
    expect(entry.status).toBe("done");
    expect(entry.output.choice).toBe("oui");
    expect(result.current.runEvents.map((e) => e.event)).toEqual(RESUME.map((e) => e.event));
    expect(result.current.decision).toBeNull();
    expect(result.current.isRunning).toBe(false);
    expect(onResumed).toHaveBeenCalledTimes(1);
  });

  it("a refused answer (409) throws to the dialog and leaves the run as it was", async () => {
    const refusal = Object.assign(new Error("x"), { status: 409, detail: { code: "decision_already_answered" } });
    resumeWorkflowRun.mockRejectedValue(refusal);
    const { result } = renderHook(() => useHarness());
    await expect(act(() => result.current.answer(result.current.decision, { choice: "oui" }))).rejects.toBe(refusal);
    expect(result.current.liveRunState.status).toBe("awaiting");
    expect(result.current.runEvents).toHaveLength(AWAITING.length);
    expect(result.current.decision).toMatchObject({ runId: "r1" });
    expect(result.current.isRunning).toBe(false);
  });

  it("another decision further on opens the dialog again", async () => {
    resumeWorkflowRun.mockResolvedValue(
      sseResponse([
        { event: "run_started", run_id: "r1" },
        { event: "node_complete", node_id: "decision1", output: { choice: "oui" } },
        { event: "node_start", node_id: "decision2", type: "approval" },
        { event: "awaiting_input", run_id: "r1", node_id: "decision2", question: "Et ensuite ?", mode: "text", choices: [], assignee: null },
      ]),
    );
    const { result } = renderHook(() => useHarness());
    await act(async () => {
      await result.current.answer(result.current.decision, { choice: "oui" });
    });
    await waitFor(() => expect(result.current.decision?.nodeId).toBe("decision2"));
    expect(result.current.liveRunState.status).toBe("awaiting");
  });

  it("a stream that breaks after the answer ends the run on an error, not on a spinner", async () => {
    const body = new ReadableStream({
      start(c) {
        c.enqueue(enc.encode(`data: ${JSON.stringify({ event: "run_started", run_id: "r1" })}\n\n`));
        c.error(new Error("network down"));
      },
    });
    resumeWorkflowRun.mockResolvedValue({ ok: true, status: 200, body });
    const { result } = renderHook(() => useHarness());
    await act(async () => {
      await result.current.answer(result.current.decision, { text: "x" });
    });
    await waitFor(() => expect(result.current.liveRunState.status).toBe("error"));
    expect(result.current.liveRunState.finalError.code).toBe("server_unreachable");
    expect(result.current.isRunning).toBe(false);
  });

  it("opens the decision named by ?decision= from the awaiting list", async () => {
    window.history.replaceState({}, "", "/workflows/w1?decision=r9");
    listAwaitingDecisions.mockResolvedValue([
      { run_id: "r8", workflow_id: "w1", node_id: "d", question: "autre", mode: "text", choices: [] },
      { run_id: "r9", workflow_id: "w1", workflow_name: "Achats", node_id: "decision1", question: "Rouvert ?", mode: "both", choices: [{ route: "oui", label: "Oui" }] },
    ]);
    const { result } = renderHook(() => useHarness());
    act(() => result.current.setRunState(createRunState()));
    await waitFor(() => expect(result.current.decision?.runId).toBe("r9"));
    expect(result.current.decision).toMatchObject({ question: "Rouvert ?", mode: "both" });
  });

  it("ignores ?decision= when that run is not in my list (finished, or not mine)", async () => {
    window.history.replaceState({}, "", "/workflows/w1?decision=gone");
    const { result } = renderHook(() => useHarness());
    act(() => result.current.setRunState(createRunState()));
    await waitFor(() => expect(listAwaitingDecisions).toHaveBeenCalled());
    expect(result.current.decision).toBeNull();
  });

  it("abandoning the parked run cancels it on screen", async () => {
    const { result } = renderHook(() => useHarness());
    act(() => result.current.abandoned({ runId: "r1" }));
    expect(result.current.liveRunState.status).toBe("cancelled");
    expect(result.current.liveRunState.pendingDecision).toBeNull();
    expect(result.current.runEvents.at(-1)).toEqual({ event: "cancelled" });
    expect(result.current.decision).toBeNull();
  });

  it("abandoning another run leaves the screen alone", () => {
    const { result } = renderHook(() => useHarness());
    act(() => result.current.abandoned({ runId: "elsewhere" }));
    expect(result.current.liveRunState.status).toBe("awaiting");
  });
});
