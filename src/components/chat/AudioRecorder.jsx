"use client";

import { useRef, useCallback, useEffect } from "react";
import { Mic, Loader2 } from "lucide-react";
import { useAudioStream } from "@/hooks/useAudioStream";
import StreamingAudioPlayer from "./StreamingAudioPlayer";

export default function AudioRecorder({ onTranscript, disabled, sessionId }) {
  const {
    isConnected,
    isListening,
    isSpeaking,
    modelState,
    transcript,
    finalTranscript,
    error,
    connect,
    disconnect,
    startListening,
    stopListening,
    stopSpeaking,
    setOnAudioChunk,
  } = useAudioStream();

  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const audioContextRef = useRef(null);
  const playerRef = useRef(null);
  const prevFinalRef = useRef("");
  const volumeBarsRef = useRef(null);
  const stopAnalyserRef = useRef(null);

  useEffect(() => {
    if (typeof window !== "undefined" && window.__audioDisconnectTimer) {
      clearTimeout(window.__audioDisconnectTimer);
      window.__audioDisconnectTimer = null;
    }
    if (sessionId && !isConnected) {
      connect(sessionId);
    }
  }, [sessionId, isConnected, connect]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined") {
        if (window.__audioDisconnectTimer) clearTimeout(window.__audioDisconnectTimer);
        window.__audioDisconnectTimer = setTimeout(() => disconnect(), 300);
      }
    };
  }, [disconnect]);

  useEffect(() => {
    if (finalTranscript && finalTranscript !== prevFinalRef.current) {
      prevFinalRef.current = finalTranscript;
      onTranscript?.(finalTranscript, true);
    }
  }, [finalTranscript, onTranscript]);

  useEffect(() => {
    setOnAudioChunk((arrayBuffer, format) => {
      playerRef.current?.enqueueChunk(arrayBuffer, format);
    });
  }, [setOnAudioChunk]);

  const startAnalyser = useCallback((stream) => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    audioContextRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    source.connect(analyser);
    analyserRef.current = analyser;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteFrequencyData(dataArray);
      const step = Math.max(1, Math.floor(dataArray.length / 5));
      if (volumeBarsRef.current) {
        const bars = volumeBarsRef.current.children;
        for (let i = 0; i < bars.length; i++) {
          const val = dataArray[i * step] || 0;
          const h = 4 + Math.min(1, val / 200) * 16;
          bars[i].style.height = `${h}px`;
        }
      }
      animFrameRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, []);

  const stopAnalyser = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    if (volumeBarsRef.current) {
      const bars = volumeBarsRef.current.children;
      for (let i = 0; i < bars.length; i++) {
        bars[i].style.height = "4px";
      }
    }
  }, []);

  useEffect(() => {
    stopAnalyserRef.current = stopAnalyser;
  }, [stopAnalyser]);

  const handleToggle = useCallback(async () => {
    if (disabled) return;

    if (isListening) {
      stopListening();
      stopAnalyser();
      return;
    }

    if (!isConnected) {
      if (sessionId) {
        connect(sessionId);
      }
      return;
    }

    const stream = await startListening();
    if (stream) {
      startAnalyser(stream);
    }
  }, [disabled, isListening, isConnected, sessionId, connect, startListening, stopListening, startAnalyser, stopAnalyser]);

  useEffect(() => {
    if (!isListening) {
      stopAnalyserRef.current?.();
    }
  }, [isListening]);

  const connecting = !!sessionId && !isConnected;

  const thinking = isListening && modelState === "thinking";
  const buttonClasses = (() => {
    const base = "shrink-0 w-10 h-10 flex items-center justify-center rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed relative";
    if (thinking) {
      return `${base} bg-amber-500/20 text-amber-400 ring-2 ring-amber-500/30`;
    }
    if (isListening) {
      return `${base} bg-red-500/20 text-red-400 ring-2 ring-red-500/30`;
    }
    if (connecting) {
      return `${base} th-bg-surface th-text-faint`;
    }
    return `${base} th-bg-surface hover:th-bg-surface-hover th-text-faint hover:th-text-secondary`;
  })();

  return (
    <div className="relative flex items-center gap-1">
      {isListening && transcript && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 th-bg-elevated border th-border rounded-lg shadow-lg max-w-xs z-50">
          <p className="text-xs th-text-muted whitespace-pre-wrap break-words">{transcript}</p>
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 th-bg-elevated border-b border-r th-border rotate-45 -mt-1" />
        </div>
      )}

      {isListening && (
        <div ref={volumeBarsRef} className="flex items-center gap-px mr-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="inline-block w-0.5 bg-red-400 rounded-full transition-none"
              style={{ height: "4px" }}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled || (!isConnected && !sessionId)}
        className={buttonClasses}
        title={thinking ? "Gemini is thinking..." : isListening ? "Stop recording" : "Voice input (streaming)"}
      >
        {connecting ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <Mic size={18} />
        )}
        {isListening && !thinking && (
          <span className="absolute inset-0 rounded-full animate-ping bg-red-500/20" />
        )}
        {thinking && (
          <span className="absolute inset-0 rounded-full animate-pulse bg-amber-500/30" />
        )}
      </button>

      {error && (
        <span className="absolute top-full left-0 mt-1 text-[10px] text-red-400 whitespace-nowrap">
          {error}
        </span>
      )}

      {isConnected && (
        <div
          className="absolute bottom-full right-0 mb-2 z-50"
          style={{ display: isSpeaking ? "block" : "none" }}
        >
          <StreamingAudioPlayer
            ref={playerRef}
            isActive={isSpeaking}
            onStop={stopSpeaking}
          />
        </div>
      )}
    </div>
  );
}
