import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("@/lib/workflowReplay", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, replayStates: vi.fn(actual.replayStates) };
});

import { replayStates } from "@/lib/workflowReplay";
import { useRunReplay } from "../hooks/useRunReplay";

const EVENTS = [
  { type: "run_started", run_id: "r1" },
  { type: "node_started", node_id: "a" },
  { type: "node_completed", node_id: "a", output: "x" },
];

describe("useRunReplay", () => {
  it("does not rebuild replay states while a run streams and no replay is active", () => {
    replayStates.mockClear();
    const { result, rerender } = renderHook(({ events }) => useRunReplay(events), {
      initialProps: { events: EVENTS.slice(0, 1) },
    });
    rerender({ events: EVENTS.slice(0, 2) });
    rerender({ events: EVENTS });
    expect(replayStates).not.toHaveBeenCalled();
    expect(result.current.total).toBe(EVENTS.length);
    expect(result.current.active).toBe(false);
  });

  it("builds the states once a replay starts", () => {
    replayStates.mockClear();
    const { result } = renderHook(() => useRunReplay(EVENTS));
    act(() => result.current.seek(1));
    expect(result.current.active).toBe(true);
    expect(result.current.state).not.toBeNull();
    expect(replayStates).toHaveBeenCalledTimes(1);
  });
});
