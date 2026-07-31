"use client";

import { useTranslations } from "use-intl";

/**
 * Animated octopus SVG for the AI thinking/reasoning state.
 * Props:
 *   size  – bounding box in px (default 32)
 *   className – extra classes forwarded to the wrapper <svg>
 */
export default function ThinkingOctopus({ size = 32, className = "" }) {
  const t = useTranslations("ThinkingOctopus");
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={className}
      aria-label={t("aiThinking")}
    >
      <style>{`
        /* Head bob */
        @keyframes octoBob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        /* Tentacle wave – each arm gets a staggered delay */
        @keyframes tentWave1 {
          0%, 100% { d: path("M38 72 Q28 90 20 100"); }
          50% { d: path("M38 72 Q22 85 16 100"); }
        }
        @keyframes tentWave2 {
          0%, 100% { d: path("M48 76 Q42 92 36 108"); }
          50% { d: path("M48 76 Q38 88 30 106"); }
        }
        @keyframes tentWave3 {
          0%, 100% { d: path("M60 78 Q60 95 58 110"); }
          50% { d: path("M60 78 Q62 95 64 110"); }
        }
        @keyframes tentWave4 {
          0%, 100% { d: path("M72 76 Q78 92 84 108"); }
          50% { d: path("M72 76 Q82 88 90 106"); }
        }
        @keyframes tentWave5 {
          0%, 100% { d: path("M82 72 Q92 90 100 100"); }
          50% { d: path("M82 72 Q98 85 104 100"); }
        }
        /* Eye blink */
        @keyframes octoBlink {
          0%, 92%, 100% { transform: scaleY(1); }
          95% { transform: scaleY(0.1); }
        }
        .octo-head { animation: octoBob 2s ease-in-out infinite; }
        .t1 { animation: tentWave1 1.6s ease-in-out infinite; }
        .t2 { animation: tentWave2 1.8s ease-in-out infinite 0.15s; }
        .t3 { animation: tentWave3 2.0s ease-in-out infinite 0.3s; }
        .t4 { animation: tentWave4 1.8s ease-in-out infinite 0.45s; }
        .t5 { animation: tentWave5 1.6s ease-in-out infinite 0.6s; }
        .octo-eye { animation: octoBlink 4s ease-in-out infinite; transform-origin: center; }
        .octo-eye-r { animation: octoBlink 4s ease-in-out infinite 0.1s; transform-origin: center; }
      `}</style>

      <g className="octo-head">
        {/* Body / head */}
        <ellipse cx="60" cy="52" rx="30" ry="28" fill="url(#octoGrad)" />
        {/* Forehead highlight */}
        <ellipse cx="60" cy="42" rx="18" ry="12" fill="rgba(255,255,255,0.12)" />

        {/* Eyes */}
        <g className="octo-eye">
          <ellipse cx="48" cy="52" rx="5" ry="5.5" fill="white" />
          <circle cx="49" cy="52" r="2.8" fill="#1a1a2e" />
          <circle cx="50" cy="51" r="1" fill="white" />
        </g>
        <g className="octo-eye-r">
          <ellipse cx="72" cy="52" rx="5" ry="5.5" fill="white" />
          <circle cx="73" cy="52" r="2.8" fill="#1a1a2e" />
          <circle cx="74" cy="51" r="1" fill="white" />
        </g>

        {/* Smile */}
        <path d="M54 60 Q60 65 66 60" fill="none" stroke="#1a1a2e" strokeWidth="1.5" strokeLinecap="round" />
      </g>

      {/* Tentacles */}
      <path className="t1" d="M38 72 Q28 90 20 100" fill="none" stroke="url(#octoGrad)" strokeWidth="5" strokeLinecap="round" />
      <path className="t2" d="M48 76 Q42 92 36 108" fill="none" stroke="url(#octoGrad)" strokeWidth="5" strokeLinecap="round" />
      <path className="t3" d="M60 78 Q60 95 58 110" fill="none" stroke="url(#octoGrad)" strokeWidth="5" strokeLinecap="round" />
      <path className="t4" d="M72 76 Q78 92 84 108" fill="none" stroke="url(#octoGrad)" strokeWidth="5" strokeLinecap="round" />
      <path className="t5" d="M82 72 Q92 90 100 100" fill="none" stroke="url(#octoGrad)" strokeWidth="5" strokeLinecap="round" />

      <defs>
        <linearGradient id="octoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
    </svg>
  );
}
