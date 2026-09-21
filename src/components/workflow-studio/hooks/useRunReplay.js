import { useEffect, useMemo, useState } from "react";
import { replayDelay, replayStates } from "@/lib/workflowReplay";

/**
 * Replay of a recorded run: play/pause, step, seek and speed over the run's
 * events. `null` index means "not replaying" — the caller shows the live
 * run state instead. A new recording (a new run) ends the replay.
 */
export function useRunReplay(events) {
  const states = useMemo(() => replayStates(events), [events]);
  const last = states.length - 1;
  const [replay, setReplay] = useState({ events: null, index: null, playing: false, speed: 1 });
  // A replay belongs to the recording it started on.
  const current = replay.events === events ? replay : { ...replay, index: null, playing: false };

  useEffect(() => {
    if (!current.playing) return undefined;
    const id = setTimeout(() => {
      setReplay((r) => {
        const next = Math.min((r.index ?? 0) + 1, last);
        return { ...r, index: next, playing: next < last };
      });
    }, replayDelay(current.speed));
    return () => clearTimeout(id);
  }, [current.playing, current.index, current.speed, last]);

  const seek = (index, playing = false) =>
    setReplay((r) => ({ ...r, events, index: Math.max(0, Math.min(index, last)), playing }));

  return {
    active: current.index != null,
    index: current.index,
    total: last,
    playing: current.playing,
    speed: current.speed,
    state: current.index != null ? states[current.index] : null,
    play: () => seek(current.index == null || current.index >= last ? 0 : current.index, true),
    pause: () => setReplay((r) => ({ ...r, playing: false })),
    stepForward: () => seek((current.index ?? 0) + 1),
    stepBack: () => seek((current.index ?? last) - 1),
    seek: (index) => seek(index),
    setSpeed: (speed) => setReplay((r) => ({ ...r, speed })),
    exit: () => setReplay((r) => ({ ...r, index: null, playing: false })),
  };
}
