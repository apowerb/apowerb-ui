"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { authStorage } from "@/lib/authStorage";

const RECONNECT_BASE_DELAY = 1000;
const RECONNECT_MAX_DELAY = 30000;
const MAX_RECONNECT_ATTEMPTS = 10;
const PING_INTERVAL = 30000;
const AUDIO_TIMESLICE = 250;
const PCM_SAMPLE_RATE = 16000;
const PCM_OUTPUT_RATE = 24000;

function getWsUrl(sessionId) {
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const wsBase = base.replace(/^http/, "ws");
  const token = authStorage.getToken();
  if (!token || token === "null" || token === "undefined") return null;
  return `${wsBase}/api/audio/ws/${sessionId}?token=${token}`;
}

export function useAudioStream() {
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [modelState, setModelState] = useState("listening");
  const [transcript, setTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [error, setError] = useState(null);
  const [mode, setMode] = useState(null);

  const wsRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const workletNodeRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef(null);
  const sessionIdRef = useRef(null);
  const intentionalCloseRef = useRef(false);
  const onAudioChunkRef = useRef(null);
  const onFinalTranscriptRef = useRef(null);
  const connectRef = useRef(null);
  const audioFormatRef = useRef(null);

  const cleanup = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (wsRef.current) {
      const ws = wsRef.current;
      if (ws.readyState === WebSocket.CONNECTING) {
        ws.addEventListener("open", () => ws.close(), { once: true });
      } else {
        ws.close();
      }
      wsRef.current = null;
    }
    setIsConnected(false);
    setIsListening(false);
    setIsSpeaking(false);
    setMode(null);
    audioFormatRef.current = null;
  }, []);

  const handleMessage = useCallback((event) => {
    if (event.data instanceof Blob || event.data instanceof ArrayBuffer) {
      if (onAudioChunkRef.current) {
        const format = audioFormatRef.current || "pcm24k";
        if (event.data instanceof Blob) {
          event.data.arrayBuffer().then((buf) => onAudioChunkRef.current?.(buf, format));
        } else {
          onAudioChunkRef.current(event.data, format);
        }
      }
      return;
    }

    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }

    switch (msg.type) {
      case "transcript":
        if (msg.direction === "input") {
          if (msg.is_final) {
            setFinalTranscript(msg.text);
            onFinalTranscriptRef.current?.("user", msg.text);
          }
          setTranscript(msg.text);
        } else if (msg.direction === "output") {
          if (msg.is_final) {
            onFinalTranscriptRef.current?.("assistant", msg.text);
          }
        }
        break;
      case "tts_start":
        setIsSpeaking(true);
        break;
      case "tts_end":
        setIsSpeaking(false);
        break;
      case "audio_chunk":
        audioFormatRef.current = msg.format || "pcm24k";
        break;
      case "listening_started":
        setIsListening(true);
        if (msg.mode) setMode(msg.mode);
        break;
      case "listening_stopped":
        setIsListening(false);
        break;
      case "error":
        setError(msg.message);
        break;
      case "state":
        setModelState(msg.state || "listening");
        break;
      case "pong":
        break;
      default:
        break;
    }
  }, []);

  const startPing = useCallback(() => {
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    pingIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "ping" }));
      }
    }, PING_INTERVAL);
  }, []);

  const createWebSocket = useCallback((sessionId) => {
    if (typeof window !== "undefined" && window.__audioHookCleanupTimer) {
      clearTimeout(window.__audioHookCleanupTimer);
      window.__audioHookCleanupTimer = null;
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (wsRef.current?.readyState === WebSocket.CONNECTING) return;

    intentionalCloseRef.current = false;
    sessionIdRef.current = sessionId;
    setError(null);

    const url = getWsUrl(sessionId);
    if (!url) {
      setError("Authentication token missing. Please refresh the page.");
      return;
    }
    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setError(null);
      audioFormatRef.current = "pcm24k";
      // Reset retry counter only if connection stays open ≥3s, otherwise
      // a backend that accepts then crashes immediately would loop forever.
      setTimeout(() => {
        if (wsRef.current === ws && ws.readyState === WebSocket.OPEN) {
          reconnectAttemptRef.current = 0;
        }
      }, 3000);
      startPing();
    };

    ws.onmessage = handleMessage;

    ws.onclose = (ev) => {
      console.warn("[useAudioStream] WS closed", { code: ev.code, reason: ev.reason, intentional: intentionalCloseRef.current });
      setIsConnected(false);
      setIsListening(false);
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      if (ev.code === 4001 || ev.code === 4003 || ev.code === 1000) {
        return;
      }
      if (
        !intentionalCloseRef.current &&
        reconnectAttemptRef.current < MAX_RECONNECT_ATTEMPTS &&
        sessionIdRef.current
      ) {
        reconnectAttemptRef.current += 1;
        const backoff = Math.min(
          RECONNECT_BASE_DELAY * 2 ** (reconnectAttemptRef.current - 1),
          RECONNECT_MAX_DELAY
        );
        reconnectTimeoutRef.current = setTimeout(() => {
          connectRef.current?.(sessionIdRef.current);
        }, backoff);
      } else if (
        !intentionalCloseRef.current &&
        reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS
      ) {
        setError(`Connection lost after ${MAX_RECONNECT_ATTEMPTS} retries. Check network and refresh.`);
      }
    };

    ws.onerror = () => {
      setError("WebSocket connection error");
    };
  }, [handleMessage, startPing]);

  const connect = useCallback((sessionId) => {
    reconnectAttemptRef.current = 0;
    createWebSocket(sessionId);
  }, [createWebSocket]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true;
    sessionIdRef.current = null;
    cleanup();
  }, [cleanup]);

  const startListeningPCM = useCallback(async (language, extras = {}) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: PCM_SAMPLE_RATE,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    mediaStreamRef.current = stream;

    const ctx = new AudioContext({ sampleRate: PCM_SAMPLE_RATE });
    audioContextRef.current = ctx;

    await ctx.audioWorklet.addModule("/audio-worklet-processor.js");
    const source = ctx.createMediaStreamSource(stream);
    const worklet = new AudioWorkletNode(ctx, "pcm-processor");

    worklet.port.onmessage = (e) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(e.data);
      }
    };

    source.connect(worklet);
    workletNodeRef.current = worklet;

    wsRef.current.send(JSON.stringify({ type: "start_listening", language, ...extras }));
    return stream;
  }, []);

  const startListeningWebM = useCallback(async (language, extras = {}) => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaStreamRef.current = stream;

    let mimeType = "audio/webm;codecs=opus";
    if (typeof MediaRecorder !== "undefined" && !MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = "audio/webm";
    }

    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
        e.data.arrayBuffer().then((buf) => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(buf);
          }
        });
      }
    };

    wsRef.current.send(JSON.stringify({ type: "start_listening", language, ...extras }));
    recorder.start(AUDIO_TIMESLICE);
    return stream;
  }, []);

  const startListening = useCallback(async (optsOrLang = "auto") => {
    const opts = typeof optsOrLang === "string" ? { language: optsOrLang } : (optsOrLang || {});
    const language = opts.language || "auto";
    const extras = {};
    if (opts.agentName) extras.agent_name = opts.agentName;
    if (opts.agentDisplayName) extras.agent_display_name = opts.agentDisplayName;
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError("WebSocket not connected");
      return null;
    }

    try {
      setTranscript("");
      setError(null);

      const supportsWorklet = typeof AudioWorkletNode !== "undefined"
        && typeof AudioContext !== "undefined";

      const stream = supportsWorklet
        ? await startListeningPCM(language, extras)
        : await startListeningWebM(language, extras);

      return stream;
    } catch (err) {
      if (err.name === "NotAllowedError") {
        setError("Microphone access denied");
      } else if (err.name === "NotFoundError") {
        setError("No microphone found");
      } else {
        setError("Failed to access microphone");
      }
      return null;
    }
  }, [startListeningPCM, startListeningWebM]);

  const stopListening = useCallback(() => {
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "stop_listening" }));
    }
    setIsListening(false);
  }, []);

  const speak = useCallback((text, voice = "Kore") => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError("WebSocket not connected");
      return;
    }
    wsRef.current.send(JSON.stringify({ type: "start_speaking", text, voice }));
  }, []);

  const sendText = useCallback((text) => {
    const trimmed = (text || "").trim();
    if (!trimmed) return false;
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError("WebSocket not connected");
      return false;
    }
    wsRef.current.send(JSON.stringify({ type: "start_speaking", text: trimmed }));
    return true;
  }, []);

  const stopSpeaking = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "stop_speaking" }));
    }
    setIsSpeaking(false);
  }, []);

  const setOnAudioChunk = useCallback((callback) => {
    onAudioChunkRef.current = callback;
  }, []);

  const setOnFinalTranscript = useCallback((callback) => {
    onFinalTranscriptRef.current = callback;
  }, []);

  useEffect(() => {
    return () => {
      const t = setTimeout(() => {
        intentionalCloseRef.current = true;
        cleanup();
      }, 300);
      if (typeof window !== "undefined") {
        if (window.__audioHookCleanupTimer) clearTimeout(window.__audioHookCleanupTimer);
        window.__audioHookCleanupTimer = t;
      }
    };
  }, [cleanup]);

  return {
    isConnected,
    isListening,
    isSpeaking,
    modelState,
    transcript,
    finalTranscript,
    error,
    mode,
    connect,
    disconnect,
    startListening,
    stopListening,
    speak,
    sendText,
    stopSpeaking,
    setOnAudioChunk,
    setOnFinalTranscript,
  };
}
