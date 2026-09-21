import { applyRunEvent, createRunState } from "@/lib/workflowRunState";

export const REPLAY_SPEEDS = [0.5, 1, 2, 4];
export const REPLAY_STEP_MS = 700;

/**
 * Every intermediate run state of a recorded run: `states[0]` is the idle
 * state, `states[i]` the state once the first `i` events are applied. The
 * replay shows `states[index]`, so the canvas and the panel animate exactly
 * as they did live, one event per step.
 */
export function replayStates(events = []) {
  const states = [createRunState()];
  for (const evt of events) states.push(applyRunEvent(states[states.length - 1], evt));
  return states;
}

export function replayDelay(speed) {
  return Math.round(REPLAY_STEP_MS / (speed || 1));
}
