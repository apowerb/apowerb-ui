"use client";

import { useState, useRef, useCallback } from "react";
import { Mic, Loader2 } from "lucide-react";
import { authStorage } from "@/lib/authStorage";

const MAX_DURATION_MS = 60_000;

export default function VoiceInput({ onTranscript, disabled }) {
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState(null);

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const stopTimerRef = useRef(null);

  const cleanupStream = useCallback(() => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    recorderRef.current = null;
  }, []);

  const transcribeBlob = useCallback(
    async (blob, mimeType) => {
      setTranscribing(true);
      setError(null);
      try {
        const ext = (mimeType || "").includes("ogg") ? "ogg" : "webm";
        const fd = new FormData();
        fd.append("file", blob, `dictation.${ext}`);
        const token = authStorage.getToken();
        const res = await fetch("/api/audio/transcribe", {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: fd,
        });
        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          throw new Error(`Transcription failed (${res.status}): ${detail.slice(0, 120)}`);
        }
        const data = await res.json();
        const text = (data?.text || "").trim();
        if (text) {
          onTranscript?.(text, true);
        }
      } catch (e) {
        console.error("[VoiceInput] transcribe error:", e);
        setError(e.message || "Transcription failed");
      } finally {
        setTranscribing(false);
      }
    },
    [onTranscript],
  );

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      let mimeType = "audio/webm;codecs=opus";
      if (typeof MediaRecorder !== "undefined" && !MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      }

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        const type = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        chunksRef.current = [];
        cleanupStream();
        if (blob.size > 1024) {
          await transcribeBlob(blob, type);
        }
      };

      recorder.start();
      setListening(true);
      stopTimerRef.current = setTimeout(() => stop(), MAX_DURATION_MS);
    } catch (e) {
      console.error("[VoiceInput] mic error:", e);
      setError(
        e.name === "NotAllowedError"
          ? "Microphone access denied"
          : "Could not access microphone",
      );
      cleanupStream();
      setListening(false);
    }
  }, [cleanupStream, transcribeBlob]);

  const stop = useCallback(() => {
    setListening(false);
    const r = recorderRef.current;
    if (r && r.state !== "inactive") {
      try { r.stop(); } catch { /* noop */ }
    } else {
      cleanupStream();
    }
  }, [cleanupStream]);

  const toggle = useCallback(() => {
    if (transcribing) return;
    if (listening) stop();
    else start();
  }, [listening, transcribing, start, stop]);

  const busy = transcribing;
  const title = transcribing
    ? "Transcribing..."
    : listening
    ? "Stop recording"
    : error
    ? error
    : "Voice input";

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled || busy}
      className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-full transition-all ${
        listening
          ? "bg-red-500/20 text-red-400 ring-2 ring-red-500/30"
          : transcribing
          ? "th-bg-surface th-text-faint"
          : "th-bg-surface hover:th-bg-surface-hover th-text-faint hover:th-text-secondary"
      } disabled:opacity-50 disabled:cursor-not-allowed`}
      title={title}
      aria-label={title}
    >
      {transcribing ? (
        <Loader2 size={18} className="animate-spin" />
      ) : listening ? (
        <div className="relative">
          <Mic size={18} />
          <span className="absolute inset-0 rounded-full animate-ping bg-red-500/20" />
        </div>
      ) : (
        <Mic size={18} />
      )}
    </button>
  );
}
