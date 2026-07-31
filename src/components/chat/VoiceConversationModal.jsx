"use client";

import { useTranslations } from "use-intl";
import { useRef, useCallback, useEffect, useState } from "react";
import { X, Mic, MicOff, Loader2, PhoneOff, Sparkles, AudioLines, Square, Copy, RotateCcw, Check, Keyboard, Send } from "lucide-react";
import { useAudioStream } from "@/hooks/useAudioStream";
import { useChatContext, ACTIONS } from "@/contexts/ChatContext";

const BARGE_IN_THRESHOLD = 40;

const STATE_THEME = {
  listening: {
    core: "radial-gradient(circle at 30% 30%, #fecaca 0%, #f43f5e 35%, #9f1239 75%, #4c0519 100%)",
    halo: "rgba(244,63,94,0.55)",
    ring: "rgba(244,63,94,0.35)",
    accent: "#fb7185",
    label: "text-rose-300",
    bg: "from-rose-950/40 via-black/60 to-black",
  },
  thinking: {
    core: "radial-gradient(circle at 30% 30%, #fde68a 0%, #f59e0b 35%, #b45309 75%, #451a03 100%)",
    halo: "rgba(245,158,11,0.5)",
    ring: "rgba(245,158,11,0.3)",
    accent: "#fbbf24",
    label: "text-amber-300",
    bg: "from-amber-950/40 via-black/60 to-black",
  },
  speaking: {
    core: "radial-gradient(circle at 30% 30%, #bae6fd 0%, #3b82f6 35%, #4338ca 75%, #1e1b4b 100%)",
    halo: "rgba(59,130,246,0.6)",
    ring: "rgba(99,102,241,0.35)",
    accent: "#60a5fa",
    label: "text-sky-300",
    bg: "from-indigo-950/40 via-black/60 to-black",
  },
  idle: {
    core: "radial-gradient(circle at 30% 30%, #cbd5e1 0%, #64748b 35%, #334155 75%, #0f172a 100%)",
    halo: "rgba(100,116,139,0.4)",
    ring: "rgba(148,163,184,0.25)",
    accent: "#94a3b8",
    label: "text-slate-300",
    bg: "from-slate-900/60 via-black/70 to-black",
  },
  muted: {
    core: "radial-gradient(circle at 30% 30%, #e9d5ff 0%, #a855f7 35%, #6b21a8 75%, #2e1065 100%)",
    halo: "rgba(168,85,247,0.45)",
    ring: "rgba(168,85,247,0.3)",
    accent: "#c084fc",
    label: "text-purple-300",
    bg: "from-purple-950/40 via-black/70 to-black",
  },
};

export default function VoiceConversationModal({ isOpen, onClose, sessionId, agentName, agentDisplayName }) {
  const t = useTranslations("VoiceConversationModal");
  const STATE_META = {
    listening: { label: t("stateListening"), icon: Mic },
    thinking: { label: t("stateThinking"), icon: Sparkles },
    speaking: { label: t("stateSpeaking"), icon: AudioLines },
    muted: { label: t("stateMuted"), icon: MicOff },
    idle: { label: t("stateReady"), icon: Mic },
  };
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
    sendText,
    setOnAudioChunk,
    setOnFinalTranscript,
  } = useAudioStream();

  const { dispatch } = useChatContext();

  const [muted, setMuted] = useState(false);
  const [agentTranscript, setAgentTranscript] = useState("");
  const [scale, setScale] = useState(1);
  const [speakPulse, setSpeakPulse] = useState(1);
  const [copied, setCopied] = useState(false);
  const [typingOpen, setTypingOpen] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [typedEcho, setTypedEcho] = useState("");
  const typedInputRef = useRef(null);

  const analyserRef = useRef(null);
  const audioCtxRef = useRef(null);
  const rafRef = useRef(null);
  const startedRef = useRef(false);
  const audioPlayerCtxRef = useRef(null);
  const nextStartTimeRef = useRef(0);
  const activeSourcesRef = useRef([]);

  // --- UI state derivation ---
  const uiState = (() => {
    if (!isOpen) return "idle";
    if (!isConnected) return "idle";
    if (isSpeaking) return "speaking";
    if (modelState === "thinking") return "thinking";
    if (isListening) return "listening";
    // When muted between turns (model not thinking/speaking yet), keep a
    // distinct "muted" state instead of flashing grey "Ready".
    if (muted) return "muted";
    return "idle";
  })();

  // --- Audio playback (agent voice) ---
  const getPlayerCtx = useCallback(() => {
    if (!audioPlayerCtxRef.current || audioPlayerCtxRef.current.state === "closed") {
      audioPlayerCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioPlayerCtxRef.current.state === "suspended") {
      audioPlayerCtxRef.current.resume();
    }
    return audioPlayerCtxRef.current;
  }, []);

  const playChunk = useCallback((arrayBuffer, format) => {
    const ctx = getPlayerCtx();
    try {
      let audioBuffer;
      if (format === "pcm24k") {
        const int16 = new Int16Array(arrayBuffer);
        const float32 = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;
        audioBuffer = ctx.createBuffer(1, float32.length, 24000);
        audioBuffer.getChannelData(0).set(float32);
        scheduleBuffer(ctx, audioBuffer);
      } else {
        ctx.decodeAudioData(arrayBuffer.slice(0)).then((buf) => scheduleBuffer(ctx, buf)).catch(() => {});
      }
    } catch {
      /* noop */
    }
    // pulse on incoming chunks
    setSpeakPulse((p) => (p === 1 ? 1.08 : 1));
  }, [getPlayerCtx]);

  const scheduleBuffer = (ctx, audioBuffer) => {
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    const startTime = Math.max(ctx.currentTime, nextStartTimeRef.current);
    source.start(startTime);
    nextStartTimeRef.current = startTime + audioBuffer.duration;
    activeSourcesRef.current.push(source);
    source.onended = () => {
      activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);
    };
  };

  const stopAllPlayback = useCallback(() => {
    activeSourcesRef.current.forEach((s) => {
      try { s.stop(); } catch { /* noop */ }
    });
    activeSourcesRef.current = [];
    nextStartTimeRef.current = 0;
  }, []);

  useEffect(() => {
    setOnAudioChunk((buf, format) => playChunk(buf, format));
  }, [setOnAudioChunk, playChunk]);

  useEffect(() => {
    if (!sessionId) return;
    setOnFinalTranscript((role, text) => {
      const trimmed = (text || "").trim();
      if (!trimmed) return;
      dispatch({
        type: ACTIONS.ADD_MESSAGE,
        payload: {
          sessionId,
          message: {
            id: `voice-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            role,
            content: trimmed,
            timestamp: Date.now(),
            source: "voice",
          },
        },
      });
      if (role === "assistant") setAgentTranscript(trimmed);
    });
    return () => setOnFinalTranscript(null);
  }, [sessionId, setOnFinalTranscript, dispatch]);

  useEffect(() => {
    if (!isSpeaking) stopAllPlayback();
  }, [isSpeaking, stopAllPlayback]);

  // --- Connect on open, disconnect on close ---
  useEffect(() => {
    if (!isOpen) return;
    if (!sessionId) return;
    if (!isConnected) {
      connect(sessionId);
    }
  }, [isOpen, sessionId, isConnected, connect]);

  useEffect(() => {
    if (!isOpen) {
      startedRef.current = false;
      return;
    }
    if (isConnected && !isListening && !muted && !isSpeaking) {
      startListening({ agentName, agentDisplayName }).then((stream) => {
        if (stream) attachAnalyser(stream);
      });
    }
  }, [isOpen, isConnected, isListening, muted, isSpeaking, startListening]);

  useEffect(() => {
    if (!isOpen) {
      detachAnalyser();
      stopAllPlayback();
      disconnect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    return () => {
      detachAnalyser();
      stopAllPlayback();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Track agent transcript (use finalTranscript input + speaking events would need backend text; fallback to user transcript only) ---
  useEffect(() => {
    if (finalTranscript) setAgentTranscript("");
  }, [finalTranscript]);

  // --- Auto-open keyboard input when agent suggests typing (ambiguous name/email/code) ---
  useEffect(() => {
    if (!agentTranscript) return;
    const transcript = agentTranscript.toLowerCase();
    const triggers = [
      "bouton clavier",
      "utilise le clavier",
      "tape avec le clavier",
      "tape-le avec le clavier",
      "taper avec le clavier",
      "taper le nom",
      "taper l'email",
      "écris-le",
      "écris le",
      "keyboard button",
      "type it with the keyboard",
      "type the exact",
      "pulsante tastiera",
      "usa la tastiera",
    ];
    if (triggers.some((p) => transcript.includes(p)) && !typingOpen) {
      setTypingOpen(true);
      setTimeout(() => typedInputRef.current?.focus(), 60);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentTranscript]);

  // Keep latest uiState accessible inside RAF loop (declared before attachAnalyser)
  const uiStateRef = useRef(uiState);
  useEffect(() => {
    uiStateRef.current = uiState;
  }, [uiState]);

  // --- Mic analyser for volume-driven animations ---
  const attachAnalyser = useCallback((stream) => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtxRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    source.connect(analyser);
    analyserRef.current = analyser;

    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const avg = sum / data.length;

      if (uiStateRef.current === "listening") {
        const s = 1 + Math.min(0.35, avg / 180);
        setScale(s);
      }

      // Barge-in: if agent is speaking and user speaks loud enough, interrupt
      if (uiStateRef.current === "speaking" && avg > BARGE_IN_THRESHOLD) {
        stopSpeaking();
        stopAllPlayback();
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, [stopSpeaking, stopAllPlayback]);

  const detachAnalyser = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close();
    }
    audioCtxRef.current = null;
    analyserRef.current = null;
    setScale(1);
  }, []);

  // --- Mute toggle ---
  const handleToggleMute = useCallback(() => {
    if (muted) {
      setMuted(false);
      if (isConnected && !isListening) {
        startListening({ agentName, agentDisplayName }).then((stream) => {
          if (stream) attachAnalyser(stream);
        });
      }
    } else {
      setMuted(true);
      stopListening();
      detachAnalyser();
    }
  }, [muted, isConnected, isListening, startListening, stopListening, attachAnalyser, detachAnalyser]);

  const handleInterrupt = useCallback(() => {
    stopSpeaking();
    stopAllPlayback();
  }, [stopSpeaking, stopAllPlayback]);

  const handleClearTranscripts = useCallback(() => {
    setAgentTranscript("");
  }, []);

  const handleCopyTranscript = useCallback(async () => {
    const parts = [];
    if (transcript) parts.push(`You: ${transcript}`);
    if (agentTranscript) parts.push(`Agent: ${agentTranscript}`);
    if (!parts.length) return;
    try {
      await navigator.clipboard.writeText(parts.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* noop */
    }
  }, [transcript, agentTranscript]);

  const handleSendTyped = useCallback(() => {
    const text = typedText.trim();
    if (!text || !isConnected) return;
    const ok = sendText(text);
    if (ok) {
      if (sessionId) {
        dispatch({
          type: ACTIONS.ADD_MESSAGE,
          payload: {
            sessionId,
            message: {
              id: `voice-typed-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              role: "user",
              content: text,
              timestamp: Date.now(),
              source: "voice-typed",
            },
          },
        });
      }
      setTypedEcho(text);
      setTypedText("");
    }
  }, [typedText, isConnected, sendText, sessionId, dispatch]);

  const handleToggleTyping = useCallback(() => {
    setTypingOpen((prev) => {
      const next = !prev;
      if (next) setTimeout(() => typedInputRef.current?.focus(), 50);
      return next;
    });
  }, []);

  const handleClose = useCallback(() => {
    stopListening();
    detachAnalyser();
    stopAllPlayback();
    onClose?.();
  }, [stopListening, detachAnalyser, stopAllPlayback, onClose]);

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      const inInput = e.target?.tagName === "INPUT" || e.target?.tagName === "TEXTAREA";
      if (e.key === "Escape") {
        if (typingOpen) {
          setTypingOpen(false);
          setTypedText("");
        } else {
          handleClose();
        }
      } else if (!inInput && (e.key === "m" || e.key === "M") && !e.metaKey && !e.ctrlKey) {
        handleToggleMute();
      } else if (!inInput && (e.key === "t" || e.key === "T") && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleToggleTyping();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, handleClose, handleToggleMute, handleToggleTyping, typingOpen]);

  if (!isOpen) return null;

  const transform =
    uiState === "listening"
      ? `scale(${scale})`
      : uiState === "speaking"
      ? `scale(${speakPulse})`
      : "scale(1)";

  const theme = STATE_THEME[uiState];
  const meta = STATE_META[uiState];
  const StateIcon = meta.icon;
  const haloIntensity = uiState === "listening" ? Math.min(1, (scale - 1) / 0.35) : uiState === "speaking" ? (speakPulse > 1 ? 0.7 : 0.4) : uiState === "thinking" ? 0.5 : 0.25;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("voiceConversationDialog")}
      className="fixed inset-0 z-[100] overflow-hidden"
    >
      <style jsx>{`
        @keyframes vc-ring {
          0% { transform: translate(-50%, -50%) scale(0.9); opacity: 0.55; }
          100% { transform: translate(-50%, -50%) scale(1.9); opacity: 0; }
        }
        @keyframes vc-float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-6px) rotate(1deg); }
        }
        @keyframes vc-rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes vc-fadein {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .vc-ring {
          position: absolute;
          top: 50%; left: 50%;
          width: 260px; height: 260px;
          border-radius: 9999px;
          border: 1.5px solid var(--ring-color);
          animation: vc-ring 2.6s ease-out infinite;
          pointer-events: none;
        }
        .vc-orb-float { animation: vc-float 5s ease-in-out infinite; }
        .vc-orb-rotate { animation: vc-rotate 14s linear infinite; }
        .vc-transcript { animation: vc-fadein 280ms ease-out; }
      `}</style>

      {/* Ambient backdrop */}
      <div className={`absolute inset-0 bg-gradient-to-b ${theme.bg} backdrop-blur-2xl transition-colors duration-700`} />
      <div
        className="absolute inset-0 opacity-40 transition-opacity duration-700"
        style={{
          background: `radial-gradient(circle at 50% 45%, ${theme.halo} 0%, transparent 55%)`,
        }}
      />

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${theme.accent}33, ${theme.accent}11)`, border: `1px solid ${theme.accent}44` }}>
            <StateIcon size={16} style={{ color: theme.accent }} />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">{t("voiceChatLabel")}</span>
            <span className="text-sm font-medium text-white/90">{agentDisplayName || agentName || t("assistantFallback")}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 backdrop-blur transition"
          title={t("closeEsc")}
          aria-label={t("close")}
        >
          <X size={18} />
        </button>
      </div>

      {/* Main stage */}
      <div className="relative h-full w-full flex flex-col items-center justify-center gap-10 px-6">
        {/* Orb + ambient rings */}
        <div className="relative flex items-center justify-center" style={{ width: 320, height: 320 }}>
          {(uiState === "listening" || uiState === "speaking") && (
            <>
              <span className="vc-ring" style={{ "--ring-color": theme.ring, animationDelay: "0s" }} />
              <span className="vc-ring" style={{ "--ring-color": theme.ring, animationDelay: "0.9s" }} />
              <span className="vc-ring" style={{ "--ring-color": theme.ring, animationDelay: "1.8s" }} />
            </>
          )}

          {/* Outer glow halo */}
          <div
            className="absolute rounded-full pointer-events-none transition-all duration-300"
            style={{
              width: 280,
              height: 280,
              background: `radial-gradient(circle, ${theme.halo} 0%, transparent 70%)`,
              opacity: 0.35 + haloIntensity * 0.5,
              filter: "blur(8px)",
            }}
          />

          {/* Rotating conic accent ring (thinking) */}
          {uiState === "thinking" && (
            <div
              className="absolute rounded-full vc-orb-rotate"
              style={{
                width: 240,
                height: 240,
                background: `conic-gradient(from 0deg, transparent 0deg, ${theme.accent}88 90deg, transparent 180deg, ${theme.accent}55 270deg, transparent 360deg)`,
                mask: "radial-gradient(circle, transparent 54%, black 56%, black 64%, transparent 66%)",
                WebkitMask: "radial-gradient(circle, transparent 54%, black 56%, black 64%, transparent 66%)",
              }}
            />
          )}

          {/* Main orb */}
          <div
            className="relative rounded-full vc-orb-float"
            style={{
              width: 200,
              height: 200,
              transform,
              transition: uiState === "listening" ? "transform 80ms ease-out" : "transform 220ms cubic-bezier(.22,1,.36,1)",
              background: theme.core,
              boxShadow: `0 0 ${60 + haloIntensity * 80}px ${theme.halo}, inset 0 0 40px rgba(255,255,255,0.12), inset 0 -30px 60px rgba(0,0,0,0.4)`,
            }}
          >
            {/* Specular highlight */}
            <div
              className="absolute rounded-full pointer-events-none"
              style={{
                top: "12%",
                left: "18%",
                width: "45%",
                height: "35%",
                background: "radial-gradient(ellipse at center, rgba(255,255,255,0.55) 0%, transparent 70%)",
                filter: "blur(4px)",
              }}
            />
            {/* Subtle grain overlay */}
            <div
              className="absolute inset-0 rounded-full pointer-events-none opacity-30 mix-blend-overlay"
              style={{
                background: "radial-gradient(circle at 70% 75%, rgba(0,0,0,0.5) 0%, transparent 55%)",
              }}
            />
          </div>
        </div>

        {/* Status pill */}
        <div className="flex flex-col items-center gap-2">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border backdrop-blur-md text-sm font-medium transition-colors duration-300"
            style={{
              background: `${theme.accent}14`,
              borderColor: `${theme.accent}3a`,
              color: theme.accent,
            }}
          >
            {!isConnected ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>{t("connecting")}</span>
              </>
            ) : (
              <>
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    background: theme.accent,
                    boxShadow: `0 0 8px ${theme.accent}`,
                    animation: uiState === "listening" || uiState === "speaking" ? "pulse 1.4s ease-in-out infinite" : "none",
                  }}
                />
                <span>{meta.label}</span>
              </>
            )}
          </div>
          {error && <div className="text-xs text-red-400 max-w-sm text-center">{error}</div>}
        </div>

        {/* Transcript bubbles */}
        <div className="w-full max-w-xl min-h-[96px] flex flex-col gap-2 items-stretch">
          {transcript && (
            <div className="vc-transcript self-end max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-md bg-white/10 border border-white/10 backdrop-blur text-sm text-white/90 whitespace-pre-wrap break-words">
              {transcript}
            </div>
          )}
          {agentTranscript && (
            <div
              className="vc-transcript self-start max-w-[85%] px-4 py-2.5 rounded-2xl rounded-bl-md text-sm text-white whitespace-pre-wrap break-words border backdrop-blur"
              style={{
                background: `linear-gradient(135deg, ${theme.accent}22, ${theme.accent}0a)`,
                borderColor: `${theme.accent}33`,
              }}
            >
              {agentTranscript}
            </div>
          )}
        </div>
      </div>

      {/* Floating text input (above dock) */}
      {typingOpen && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 w-[min(560px,92vw)]">
          <div className="flex items-center gap-2 p-2 pl-4 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-xl shadow-2xl vc-transcript">
            <Keyboard size={16} className="text-white/50 shrink-0" />
            <input
              ref={typedInputRef}
              type="text"
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendTyped();
                }
              }}
              placeholder={t("typedInputPlaceholder")}
              className="flex-1 bg-transparent outline-none text-sm text-white placeholder-white/40 py-2"
              aria-label={t("typeMessageAriaLabel")}
            />
            <button
              type="button"
              onClick={handleSendTyped}
              disabled={!typedText.trim() || !isConnected}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-sky-500 hover:bg-sky-600 text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
              title={t("sendEnterTitle")}
              aria-label={t("send")}
            >
              <Send size={15} />
            </button>
          </div>
          {typedEcho && (
            <div className="mt-2 px-3 text-[11px] text-white/40 text-right">
              {t("sentPrefix")} <span className="text-white/60">{typedEcho.length > 60 ? typedEcho.slice(0, 60) + "…" : typedEcho}</span>
            </div>
          )}
        </div>
      )}

      {/* Bottom controls */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-2 p-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl shadow-2xl">
        <button
          type="button"
          onClick={handleToggleMute}
          disabled={!isConnected}
          className={`w-12 h-12 flex items-center justify-center rounded-full transition-all ${
            muted
              ? "bg-rose-500/30 text-rose-200 ring-1 ring-rose-400/50"
              : "bg-white/10 hover:bg-white/15 text-white/90"
          } disabled:opacity-40 disabled:cursor-not-allowed`}
          title={muted ? t("unmuteMicTitle") : t("muteMicTitle")}
          aria-label={muted ? t("unmuteAria") : t("muteAria")}
        >
          {muted ? <MicOff size={18} /> : <Mic size={18} />}
        </button>

        <button
          type="button"
          onClick={handleInterrupt}
          disabled={!isSpeaking}
          className="w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/15 text-white/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          title={t("interruptAgent")}
          aria-label={t("interruptAgent")}
        >
          <Square size={16} fill="currentColor" />
        </button>

        <button
          type="button"
          onClick={handleCopyTranscript}
          disabled={!transcript && !agentTranscript}
          className="w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/15 text-white/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          title={t("copyTranscript")}
          aria-label={t("copyTranscript")}
        >
          {copied ? <Check size={18} className="text-emerald-300" /> : <Copy size={17} />}
        </button>

        <button
          type="button"
          onClick={handleToggleTyping}
          disabled={!isConnected}
          className={`w-12 h-12 flex items-center justify-center rounded-full transition-all ${
            typingOpen
              ? "bg-sky-400/25 text-sky-200 ring-1 ring-sky-400/50"
              : "bg-white/10 hover:bg-white/15 text-white/90"
          } disabled:opacity-30 disabled:cursor-not-allowed`}
          title={t("typeToAgentTitle")}
          aria-label={t("typeToAgentAria")}
        >
          <Keyboard size={18} />
        </button>

        <button
          type="button"
          onClick={handleClearTranscripts}
          disabled={!agentTranscript}
          className="w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/15 text-white/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          title={t("clearTranscript")}
          aria-label={t("clearTranscript")}
        >
          <RotateCcw size={17} />
        </button>

        <div className="px-2 text-[11px] uppercase tracking-wider text-white/60 select-none min-w-[50px] text-center">
          {muted ? t("stateMuted") : isConnected ? t("liveStatus") : "—"}
        </div>

        <button
          type="button"
          onClick={handleClose}
          className="w-12 h-12 flex items-center justify-center rounded-full bg-red-500 hover:bg-red-600 text-white transition-all shadow-lg shadow-red-500/30"
          title={t("endConversation")}
          aria-label={t("endConversation")}
        >
          <PhoneOff size={18} />
        </button>
      </div>
    </div>
  );
}
