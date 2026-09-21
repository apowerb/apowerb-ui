"use client";

import { Play, Pause, SkipBack, SkipForward, X } from "lucide-react";
import { REPLAY_SPEEDS } from "@/lib/workflowReplay";

const btn = "p-1 rounded-md th-text-secondary hover:th-text hover:th-bg-surface-hover disabled:opacity-30";

/** Play/pause, step, seek and speed for the replay of the last run. */
export default function ReplayControls({ replay, t }) {
  const { active, index, total, playing, speed } = replay;
  return (
    <div className="mt-2 p-2 rounded-lg th-bg-surface border th-border-secondary" role="group" aria-label={t("replayTitle")}>
      <div className="flex items-center gap-1">
        <button type="button" className={btn} onClick={replay.stepBack} disabled={!active || index <= 0} aria-label={t("replayStepBack")} title={t("replayStepBack")}>
          <SkipBack size={13} />
        </button>
        {playing ? (
          <button type="button" className={btn} onClick={replay.pause} aria-label={t("replayPause")} title={t("replayPause")}>
            <Pause size={13} />
          </button>
        ) : (
          <button type="button" className={btn} onClick={replay.play} aria-label={t("replayPlay")} title={t("replayPlay")}>
            <Play size={13} />
          </button>
        )}
        <button type="button" className={btn} onClick={replay.stepForward} disabled={active && index >= total} aria-label={t("replayStepForward")} title={t("replayStepForward")}>
          <SkipForward size={13} />
        </button>
        <select
          value={speed}
          onChange={(e) => replay.setSpeed(Number(e.target.value))}
          aria-label={t("replaySpeed")}
          className="ml-auto px-1 py-0.5 text-[10px] rounded-md th-bg-elevated border th-border-secondary th-text"
        >
          {REPLAY_SPEEDS.map((s) => <option key={s} value={s}>{`${s}×`}</option>)}
        </select>
        {active && (
          <button type="button" className={btn} onClick={replay.exit} aria-label={t("replayExit")} title={t("replayExit")}>
            <X size={13} />
          </button>
        )}
      </div>
      <input
        type="range"
        min={0}
        max={total}
        value={active ? index : total}
        onChange={(e) => replay.seek(Number(e.target.value))}
        aria-label={t("replayPosition")}
        className="w-full mt-1"
      />
      <p className="text-[10px] th-text-ghost">
        {active ? t("replayStep", { index, total }) : t("replayHint")}
      </p>
    </div>
  );
}
