/**
 * Step-by-step replay of the last run (request D, 21/09).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render, screen, renderHook } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { replayStates, replayDelay } from "@/lib/workflowReplay";
import { useRunReplay } from "@/components/workflow-studio/hooks/useRunReplay";
import ExecutionPanel from "@/components/workflow-studio/ExecutionPanel";
import { createRunState } from "@/lib/workflowRunState";

const EVENTS = [
  { event: "run_started", wid: "w1" },
  { event: "node_start", node_id: "t", type: "trigger" },
  { event: "node_complete", node_id: "t", output: { x: 1 }, duration_ms: 1 },
  { event: "node_start", node_id: "a", type: "agent" },
  { event: "node_complete", node_id: "a", output: "hi", duration_ms: 5 },
  { event: "done", output: "hi" },
];

describe("replayStates", () => {
  it("rebuilds every intermediate state, ending on the live one", () => {
    const states = replayStates(EVENTS);
    expect(states).toHaveLength(EVENTS.length + 1);
    expect(states[0].status).toBe("idle");
    expect(states[4].timeline.map((e) => [e.id, e.status])).toEqual([["t", "done"], ["a", "running"]]);
    expect(states.at(-1).status).toBe("done");
    expect(states.at(-1).finalOutput).toBe("hi");
  });

  it("scales the step delay with the speed", () => {
    expect(replayDelay(2)).toBe(replayDelay(1) / 2);
  });
});

describe("useRunReplay", () => {
  afterEach(() => vi.useRealTimers());

  it("steps, seeks and plays to the end", () => {
    vi.useFakeTimers();
    const { result } = renderHook(({ events }) => useRunReplay(events), { initialProps: { events: EVENTS } });
    expect(result.current.active).toBe(false);

    act(() => result.current.stepForward());
    expect(result.current.index).toBe(1);
    act(() => result.current.seek(4));
    expect(result.current.state.timeline[1].status).toBe("running");
    act(() => result.current.stepBack());
    expect(result.current.index).toBe(3);

    act(() => result.current.play());
    for (let i = 0; i < EVENTS.length + 2; i += 1) act(() => vi.advanceTimersByTime(replayDelay(1)));
    expect(result.current.index).toBe(EVENTS.length);
    expect(result.current.playing).toBe(false);
  });

  it("ends when a new run is recorded", () => {
    const { result, rerender } = renderHook(({ events }) => useRunReplay(events), { initialProps: { events: EVENTS } });
    act(() => result.current.seek(2));
    expect(result.current.active).toBe(true);
    rerender({ events: [...EVENTS] });
    expect(result.current.active).toBe(false);
  });
});

it("shows replay controls once a run is recorded, and drives the timeline", async () => {
  const user = userEvent.setup();
  function Harness() {
    const replay = useRunReplay(EVENTS);
    const live = replayStates(EVENTS).at(-1);
    return (
      <ExecutionPanel
        open
        onToggle={() => {}}
        payloadText="{}"
        onPayloadTextChange={() => {}}
        payloadError={null}
        isRunning={false}
        runState={replay.state || live}
        replay={replay}
        onRun={() => {}}
        onCancel={() => {}}
      />
    );
  }
  render(<Harness />);
  expect(screen.getByText(/Completed/)).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /Step forward/i }));
  await user.click(screen.getByRole("button", { name: /Step forward/i }));
  expect(screen.getByText(/Step 2 \/ 6/)).toBeInTheDocument();
  expect(screen.getAllByText("t")).toHaveLength(1);
  expect(screen.queryByText("a")).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /Exit replay/i }));
  expect(screen.getByText("a")).toBeInTheDocument();
});

it("hides replay controls before any run", () => {
  render(
    <ExecutionPanel open onToggle={() => {}} payloadText="{}" onPayloadTextChange={() => {}} payloadError={null} isRunning={false} runState={createRunState()} onRun={() => {}} onCancel={() => {}} />,
  );
  expect(screen.queryByRole("group", { name: /Replay/i })).not.toBeInTheDocument();
});
