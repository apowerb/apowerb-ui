"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import BrandIcon from "@/components/brand/BrandIcon";
import {
  BookOpen, Database, ArrowRight, Sparkles, Zap,
  FileSearch, BarChart3, MessageSquare, ChevronRight, BrainCircuit,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

/* ═══════════════════════════════════════════════
   INTERSECTION OBSERVER
═══════════════════════════════════════════════ */
function useInView(options = {}) {
  const ref = useRef(null);
  const [isInView, setIsInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { setIsInView(true); observer.unobserve(el); }
      },
      { threshold: 0.1, ...options }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, isInView];
}

/* ═══════════════════════════════════════════════
   TYPEWRITER
═══════════════════════════════════════════════ */
const PROMPTS = [
  "What were our Q3 revenue figures by region?",
  "Summarize the key points from the uploaded contract",
  "Show me all orders above $10,000 from last month",
  "What does our refund policy say about digital goods?",
  "Compare sales performance between product lines",
];

function Typewriter() {
  const [promptIdx, setPromptIdx] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [phase, setPhase] = useState("typing");

  useEffect(() => {
    const full = PROMPTS[promptIdx];
    let t;
    if (phase === "typing") {
      if (displayed.length < full.length)
        t = setTimeout(() => setDisplayed(full.slice(0, displayed.length + 1)), 40);
      else t = setTimeout(() => setPhase("pause"), 1800);
    } else if (phase === "pause") {
      t = setTimeout(() => setPhase("erasing"), 400);
    } else {
      if (displayed.length > 0)
        t = setTimeout(() => setDisplayed(displayed.slice(0, -1)), 18);
      else { setPromptIdx((i) => (i + 1) % PROMPTS.length); setPhase("typing"); }
    }
    return () => clearTimeout(t);
  }, [displayed, phase, promptIdx]);

  return (
    <div
      className="mx-auto rounded-2xl overflow-hidden"
      style={{
        maxWidth: 560,
        background: "var(--glass-card-bg)",
        border: "1px solid var(--glass-card-border)",
        boxShadow: "0 8px 32px var(--glass-card-shadow)",
      }}
    >
      {/* Window chrome */}
      <div
        className="flex items-center gap-1.5 px-4 py-3"
        style={{ borderBottom: "1px solid var(--border-secondary)" }}
      >
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
          <div key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: c, opacity: 0.75 }} />
        ))}
        <span
          className="ml-auto text-[10px] tracking-widest uppercase"
          style={{ color: "var(--text-whisper)" }}
        >
          AI Chat
        </span>
      </div>

      <div className="p-5 space-y-3">
        {/* User bubble */}
        <div className="flex justify-end">
          <div
            className="px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm text-white"
            style={{
              background: "linear-gradient(135deg, var(--color-brand), #2255ff)",
              maxWidth: "85%",
            }}
          >
            {displayed}
            <span
              className="inline-block w-[2px] h-[13px] ml-[2px] align-middle rounded-full opacity-80"
              style={{ background: "#fff", animation: "blink 1s step-end infinite" }}
            />
          </div>
        </div>

        {/* AI bubble */}
        <div className="flex items-end gap-2.5">
          <div
            className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center"
            style={{ background: "rgba(1,61,255,0.1)", border: "1px solid rgba(1,61,255,0.22)" }}
          >
            <BrainCircuit size={13} className="text-brand" />
          </div>
          <div
            className="px-4 py-2.5 rounded-2xl rounded-bl-sm text-sm italic"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-secondary)",
              color: "var(--text-faint)",
            }}
          >
            Analyzing your data
            <span className="ml-1.5 inline-flex gap-1">
              {[0, 1, 2].map((i) => (
                <span key={i} className="inline-block w-1 h-1 rounded-full"
                  style={{ background: "var(--color-brand)", animation: `dotBounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
                />
              ))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   MODE CARD
═══════════════════════════════════════════════ */
function ModeCard({ icon: Icon, label, tag, tagColor, description, href, features, delay }) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);
  const cardRef = useRef(null);
  const [ref, isInView] = useInView();

  const onMouseMove = useCallback((e) => {
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
  }, []);

  return (
    <div
      ref={ref}
      style={{
        opacity: isInView ? 1 : 0,
        transform: isInView ? "translateY(0)" : "translateY(28px)",
        transition: `opacity 0.65s ease ${delay}, transform 0.65s ease ${delay}`,
      }}
    >
      <button
        ref={cardRef}
        onClick={() => router.push(href)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onMouseMove={onMouseMove}
        className="relative w-full text-left outline-none group"
        style={{ "--mx": "50%", "--my": "50%" }}
      >
        {/* Mouse spotlight */}
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none transition-opacity duration-500"
          style={{
            opacity: hovered ? 1 : 0,
            background: `radial-gradient(300px circle at var(--mx) var(--my), ${tagColor}12, transparent 70%)`,
          }}
        />

        <div
          className="relative rounded-2xl overflow-hidden transition-all duration-300"
          style={{
            background: hovered ? "var(--glass-card-hover-bg)" : "var(--glass-card-bg)",
            border: hovered ? `1px solid ${tagColor}45` : "1px solid var(--glass-card-border)",
            boxShadow: hovered ? "0 20px 60px var(--glass-card-hover-shadow)" : "0 4px 16px var(--glass-card-shadow)",
            transform: hovered ? "translateY(-5px)" : "translateY(0)",
          }}
        >
          {/* Top accent line */}
          <div className="h-px w-full" style={{
            background: `linear-gradient(90deg, transparent, ${tagColor}, transparent)`,
            opacity: hovered ? 0.7 : 0.2,
            transition: "opacity 0.3s ease",
          }} />

          <div className="p-7">
            {/* Icon + tag */}
            <div className="flex items-start justify-between mb-6">
              <div
                className="rounded-xl flex items-center justify-center transition-all duration-300"
                style={{
                  width: 50, height: 50,
                  background: hovered ? `${tagColor}15` : "var(--bg-surface)",
                  border: `1px solid ${hovered ? tagColor + "30" : "var(--border-primary)"}`,
                }}
              >
                <Icon size={21} style={{
                  color: hovered ? tagColor : "var(--text-muted)",
                  transition: "color 0.3s",
                }} />
              </div>
              <span
                className="text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded-full"
                style={{ background: `${tagColor}15`, color: tagColor, border: `1px solid ${tagColor}28` }}
              >
                {tag}
              </span>
            </div>

            <h3
              className="text-xl font-bold mb-2.5 tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              {label}
            </h3>

            <p
              className="text-sm leading-relaxed mb-6"
              style={{ color: "var(--text-faint)" }}
            >
              {description}
            </p>

            <div className="flex flex-wrap gap-2 mb-7">
              {features.map((f) => (
                <span
                  key={f}
                  className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg"
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-secondary)",
                    color: "var(--text-ghost)",
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: tagColor }} />
                  {f}
                </span>
              ))}
            </div>

            <div
              className="flex items-center justify-between pt-5"
              style={{ borderTop: "1px solid var(--border-secondary)" }}
            >
              <span
                className="text-sm font-semibold inline-flex items-center gap-1.5 transition-all duration-300"
                style={{
                  color: hovered ? tagColor : "var(--text-ghost)",
                  transform: hovered ? "translateX(4px)" : "translateX(0)",
                }}
              >
                Launch <ArrowRight size={13} />
              </span>
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300"
                style={{
                  background: hovered ? tagColor : "var(--bg-surface)",
                  boxShadow: hovered ? `0 0 18px ${tagColor}55` : "none",
                }}
              >
                <ChevronRight size={13} style={{
                  color: hovered ? "#fff" : "var(--text-ghost)",
                }} />
              </div>
            </div>
          </div>
        </div>
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   CAPABILITY STRIP
═══════════════════════════════════════════════ */
function CapabilityStrip() {
  const items = [
    { icon: FileSearch, label: "Source citations" },
    { icon: BarChart3, label: "Auto charts" },
    { icon: Zap, label: "Real-time streaming" },
    { icon: Sparkles, label: "Multi-model" },
    { icon: MessageSquare, label: "Multi-turn memory" },
  ];
  const [ref, isInView] = useInView();

  return (
    <div ref={ref} className="flex flex-wrap justify-center gap-2.5">
      {items.map(({ icon: Icon, label }, i) => (
        <div
          key={label}
          className="flex items-center gap-2 px-3.5 py-2 rounded-full text-xs"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-primary)",
            color: "var(--text-faint)",
            opacity: isInView ? 1 : 0,
            transform: isInView ? "translateY(0)" : "translateY(12px)",
            transition: `opacity 0.5s ease ${i * 60}ms, transform 0.5s ease ${i * 60}ms`,
          }}
        >
          <Icon size={12} className="text-brand" />
          {label}
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════ */
export default function ChatbotLandingPage() {
  return (
    <div
      className="h-full overflow-y-auto"
      style={{ background: "var(--background)" }}
    >
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes dotBounce { 0%,80%,100%{transform:translateY(0);opacity:.4} 40%{transform:translateY(-4px);opacity:1} }
        @keyframes heroFade { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
        @keyframes glowPulse { 0%,100%{opacity:.4} 50%{opacity:.75} }
        @keyframes ringPulse { 0%{transform:scale(1);opacity:.5} 70%{transform:scale(1.55);opacity:0} 100%{transform:scale(1.55);opacity:0} }
      `}</style>

      {/* Background decorations — dark only via opacity */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div style={{
          position: "absolute", top: "-20%", left: "50%", transform: "translateX(-50%)",
          width: 1100, height: 600,
          background: "radial-gradient(ellipse, var(--glow-pulse) 0%, transparent 70%)",
          animation: "glowPulse 8s ease-in-out infinite",
        }} />
      </div>

      {/* Theme toggle */}
      <div className="fixed top-0 right-0 z-20 px-5 py-3" style={{ animation: "heroFade 0.5s ease both" }}>
        <ThemeToggle collapsed />
      </div>

      {/* Content */}
      <div className="relative min-h-full flex flex-col items-center px-6 pt-16 pb-24" style={{ zIndex: 1 }}>

        {/* Logo */}
        <div className="flex flex-col items-center mb-10" style={{ animation: "heroFade 0.5s ease both" }}>
          <div className="relative flex items-center justify-center mb-5">
            <div
              className="absolute rounded-full"
              style={{ width: 88, height: 88, background: "var(--glow-pulse)", animation: "ringPulse 2.6s ease-out infinite" }}
            />
            <div
              className="relative rounded-full"
              style={{ width: 72, height: 72, background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-hover))", boxShadow: "0 0 36px var(--glow-pulse-intense)" }}
            >
              <BrandIcon alt="TH2" width={72} height={72} className="rounded-full" priority />
            </div>
          </div>
          <h2
            className="text-lg font-bold tracking-tight mb-1"
            style={{ background: "linear-gradient(90deg, var(--color-brand), #a882ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
          >
            TH2 Agent Studio
          </h2>
          <p
            className="text-xs tracking-widest uppercase"
            style={{ color: "var(--text-ghost)" }}
          >
            AI Chatbot Suite
          </p>
        </div>

        {/* Headline */}
        <h1
          className="text-center font-bold tracking-tight leading-none mb-4"
          style={{
            fontSize: "clamp(2.2rem, 5vw, 4.2rem)",
            maxWidth: 720,
            color: "var(--text-primary)",
            animation: "heroFade 0.6s ease both",
            animationDelay: "0.1s",
          }}
        >
          Ask anything.{" "}
          <span style={{ background: "linear-gradient(100deg, var(--color-brand), #a882ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Get real answers.
          </span>
        </h1>

        {/* Subtitle */}
        <p
          className="text-center max-w-md mb-12 leading-relaxed"
          style={{
            fontSize: "1rem",
            color: "var(--text-muted)",
            animation: "heroFade 0.6s ease both",
            animationDelay: "0.18s",
          }}
        >
          Two intelligent interfaces — query your documents or explore your
          databases — all in plain natural language.
        </p>

        {/* Chat preview */}
        <div className="w-full mb-14" style={{ animation: "heroFade 0.7s ease both", animationDelay: "0.26s" }}>
          <Typewriter />
        </div>

        {/* Mode cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full mb-14" style={{ maxWidth: 840 }}>
          <ModeCard
            icon={BookOpen} label="Knowledge Chat" tag="RAG" tagColor="var(--color-brand)"
            description="Upload documents, PDFs, and knowledge bases. Ask questions in plain English and get precise, source-grounded answers."
            href="/chatbot/rag"
            features={["Source citations", "Multi-doc search", "PDF & text", "Contextual memory"]}
            delay="0.32s"
          />
          <ModeCard
            icon={Database} label="Data Explorer" tag="Text-to-SQL" tagColor="#00c2a8"
            description="Connect your databases and query them conversationally. Describe what you need — get instant tables, charts, and exports."
            href="/chatbot/text-to-sql"
            features={["Auto SQL generation", "Visual charts", "Multi-table joins", "CSV export"]}
            delay="0.42s"
          />
        </div>

        <CapabilityStrip />

        <div
          className="my-12 h-px w-full"
          style={{ maxWidth: 840, background: "var(--border-primary)" }}
        />

        <div className="flex items-center gap-2" style={{ opacity: 0.4 }}>
          <BrandIcon alt="" width={16} height={16} className="rounded-full" />
          <p
            className="text-[11px] tracking-widest uppercase"
            style={{ color: "var(--text-muted)" }}
          >
            thaink² · select a mode to begin
          </p>
        </div>
      </div>
    </div>
  );
}