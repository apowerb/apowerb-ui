"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX, Download } from "lucide-react";

export default function AudioPlayer({ result }) {
  const audioRef = useRef(null);
  const objectUrlRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [objectUrl, setObjectUrl] = useState(null);

  const base64Src = result.base64_data
    ? `data:${result.content_type || "audio/mpeg"};base64,${result.base64_data}`
    : null;

  useEffect(() => {
    if (base64Src || !result.download_path) return;
    let cancelled = false;
    (async () => {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const token = typeof window !== "undefined" ? localStorage.getItem("th2_auth_token") : null;
        const res = await fetch(`${apiBase}${result.download_path}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        if (!cancelled) {
          const url = URL.createObjectURL(blob);
          objectUrlRef.current = url;
          setObjectUrl(url);
        }
      } catch (err) {
        console.error("[AudioPlayer] fetch error:", err);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, [result.download_path]);

  const src = base64Src || objectUrl;

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); }
    else { audioRef.current.play(); }
    setPlaying(!playing);
  }, [playing]);

  const toggleMute = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.muted = !muted;
    setMuted(!muted);
  }, [muted]);

  const handleTimeUpdate = () => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) setDuration(audioRef.current.duration);
  };

  const handleSeek = (e) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = pct * duration;
  };

  const handleEnded = () => setPlaying(false);

  const fmt = (s) => {
    if (!s || !isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  if (!src) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="px-3 pb-2">
      <div className="th-bg-elevated rounded-xl p-3 border th-border max-w-sm">
        <audio
          ref={audioRef}
          src={src}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
          preload="metadata"
        />

        {/* Controls row */}
        <div className="flex items-center gap-2.5">
          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            className="p-2 rounded-full bg-blue-500 hover:bg-blue-400 text-white transition-colors shrink-0"
          >
            {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
          </button>

          {/* Seek bar + time */}
          <div className="flex-1 min-w-0">
            <div
              className="h-1.5 rounded-full bg-gray-700 cursor-pointer relative group"
              onClick={handleSeek}
            >
              <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{ width: `${progress}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ left: `${progress}%`, marginLeft: "-6px" }}
              />
            </div>
            <div className="flex justify-between mt-1 text-[10px] th-text-ghost">
              <span>{fmt(currentTime)}</span>
              <span>{fmt(duration)}</span>
            </div>
          </div>

          {/* Volume */}
          <button onClick={toggleMute} className="th-text-ghost hover:th-text-muted shrink-0">
            {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
        </div>

        {/* Metadata */}
        <div className="mt-1.5 flex items-center gap-2 text-[10px] th-text-ghost flex-wrap">
          {result.audio_format && <span>{result.audio_format.toUpperCase()}</span>}
          {result.size_kb && <span>{result.size_kb} KB</span>}
          {result.provider_used && <span>via {result.provider_used}</span>}
          {result.voice && <span>Voice: {result.voice}</span>}
        </div>
      </div>
    </div>
  );
}
