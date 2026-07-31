"use client";

import { useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from "react";
import { useTranslations } from "use-intl";
import { Volume2, Square } from "lucide-react";

const PCM_OUTPUT_RATE = 24000;

function pcmToAudioBuffer(ctx, arrayBuffer) {
  const int16 = new Int16Array(arrayBuffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768;
  }
  const audioBuffer = ctx.createBuffer(1, float32.length, PCM_OUTPUT_RATE);
  audioBuffer.getChannelData(0).set(float32);
  return audioBuffer;
}

const StreamingAudioPlayer = forwardRef(function StreamingAudioPlayer({ isActive, onStop }, ref) {
  const t = useTranslations("StreamingAudioPlayer");
  const audioContextRef = useRef(null);
  const nextStartTimeRef = useRef(0);
  const sourceNodesRef = useRef([]);
  const queueRef = useRef([]);
  const processingRef = useRef(false);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current || audioContextRef.current.state === "closed") {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  const scheduleBuffer = useCallback((ctx, audioBuffer) => {
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const startTime = Math.max(ctx.currentTime, nextStartTimeRef.current);
    source.start(startTime);
    nextStartTimeRef.current = startTime + audioBuffer.duration;

    sourceNodesRef.current.push(source);
    source.onended = () => {
      sourceNodesRef.current = sourceNodesRef.current.filter((s) => s !== source);
    };
  }, []);

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;

    const ctx = getAudioContext();

    while (queueRef.current.length > 0) {
      const { data, format } = queueRef.current.shift();
      try {
        if (format === "pcm24k") {
          const audioBuffer = pcmToAudioBuffer(ctx, data);
          scheduleBuffer(ctx, audioBuffer);
        } else {
          const audioBuffer = await ctx.decodeAudioData(data.slice(0));
          scheduleBuffer(ctx, audioBuffer);
        }
      } catch {
        // Skip undecodable chunk
      }
    }

    processingRef.current = false;
  }, [getAudioContext, scheduleBuffer]);

  const enqueueChunk = useCallback((arrayBuffer, format = "pcm24k") => {
    queueRef.current.push({ data: arrayBuffer, format });
    processQueue();
  }, [processQueue]);

  const stopAllSources = useCallback(() => {
    sourceNodesRef.current.forEach((source) => {
      try { source.stop(); } catch { /* already stopped */ }
    });
    sourceNodesRef.current = [];
    queueRef.current = [];
    nextStartTimeRef.current = 0;
    processingRef.current = false;
  }, []);

  const handleStop = useCallback(() => {
    stopAllSources();
    onStop?.();
  }, [onStop, stopAllSources]);

  useImperativeHandle(ref, () => ({
    enqueueChunk,
    stopPlayback: handleStop,
  }), [enqueueChunk, handleStop]);

  useEffect(() => {
    if (isActive) {
      nextStartTimeRef.current = 0;
    } else {
      stopAllSources();
    }
  }, [isActive, stopAllSources]);

  useEffect(() => {
    return () => {
      sourceNodesRef.current.forEach((source) => {
        try { source.stop(); } catch { /* noop */ }
      });
      sourceNodesRef.current = [];
      queueRef.current = [];
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close();
      }
    };
  }, []);

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 th-bg-elevated rounded-lg border th-border"
      style={{ display: isActive ? "flex" : "none" }}
    >
      <Volume2 size={14} className="th-text-muted shrink-0" />
      <div className="flex items-center gap-0.5">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="inline-block w-0.5 bg-blue-400 rounded-full"
            style={{
              animation: `audioWave 0.6s ease-in-out ${i * 0.1}s infinite alternate`,
            }}
          />
        ))}
      </div>
      <span className="text-xs th-text-muted">{t("speaking")}</span>
      <button
        type="button"
        onClick={handleStop}
        className="ml-auto p-1 rounded hover:th-bg-surface th-text-faint hover:th-text-muted transition-colors"
        title={t("stopSpeaking")}
      >
        <Square size={12} className="fill-current" />
      </button>
      <style jsx>{`
        @keyframes audioWave {
          from { height: 4px; }
          to { height: 14px; }
        }
      `}</style>
    </div>
  );
});

export default StreamingAudioPlayer;
