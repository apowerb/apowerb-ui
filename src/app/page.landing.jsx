"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "use-intl";
import BrandIcon from "@/components/brand/BrandIcon";
import { authStorage } from "@/lib/authStorage";
import {
  ArrowRight,
  Blocks,
  MessageSquare,
  Wrench,
  Store,
  Database,
  Shield,
  ChevronDown,
  Zap,
  Sparkles,
  GitBranch,
  Bot,
  BrainCircuit,
  Workflow,
  Menu,
  X,
  PlugZap,
  LayoutDashboard,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   INTEGRATION ICONS — inline SVG for landing page
   ═══════════════════════════════════════════════════════════ */
function GithubIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
      <path d="M94,7399 C99.523,7399 104,7403.59 104,7409.253 C104,7413.782 101.138,7417.624 97.167,7418.981 C96.66,7419.082 96.48,7418.762 96.48,7418.489 C96.48,7418.151 96.492,7417.047 96.492,7415.675 C96.492,7414.719 96.172,7414.095 95.813,7413.777 C98.04,7413.523 100.38,7412.656 100.38,7408.718 C100.38,7407.598 99.992,7406.684 99.35,7405.966 C99.454,7405.707 99.797,7404.664 99.252,7403.252 C99.252,7403.252 98.414,7402.977 96.505,7404.303 C95.706,7404.076 94.85,7403.962 94,7403.958 C93.15,7403.962 92.295,7404.076 91.497,7404.303 C89.586,7402.977 88.746,7403.252 88.746,7403.252 C88.203,7404.664 88.546,7405.707 88.649,7405.966 C88.01,7406.684 87.619,7407.598 87.619,7408.718 C87.619,7412.646 89.954,7413.526 92.175,7413.785 C91.889,7414.041 91.63,7414.493 91.54,7415.156 C90.97,7415.418 89.522,7415.871 88.63,7414.304 C88.63,7414.304 88.101,7413.319 87.097,7413.247 C87.097,7413.247 86.122,7413.234 87.029,7413.87 C87.029,7413.87 87.684,7414.185 88.139,7415.37 C88.139,7415.37 88.726,7417.2 91.508,7416.58 C91.513,7417.437 91.522,7418.245 91.522,7418.489 C91.522,7418.76 91.338,7419.077 90.839,7418.982 C86.865,7417.627 84,7413.783 84,7409.253 C84,7403.59 88.478,7399 94,7399" fill="#ffffff" transform="translate(-84, -7399)" />
    </svg>
  );
}

function GmailIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="52 42 88 66" xmlns="http://www.w3.org/2000/svg">
      <path fill="#4285f4" d="M58 108h14V74L52 59v43c0 3.32 2.69 6 6 6"/>
      <path fill="#34a853" d="M120 108h14c3.32 0 6-2.69 6-6V59l-20 15"/>
      <path fill="#fbbc04" d="M120 48v26l20-15v-8c0-7.42-8.47-11.65-14.4-7.2"/>
      <path fill="#ea4335" d="M72 74V48l24 18 24-18v26L96 92"/>
      <path fill="#c5221f" d="M52 51v8l20 15V48l-5.6-4.2c-5.94-4.45-14.4-.22-14.4 7.2"/>
    </svg>
  );
}

function GoogleDriveIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
      <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5l5.4 9.35z" fill="#0066DA"/>
      <path d="M43.65 25L29.9 1.2C28.55 2 27.4 3.1 26.6 4.5L3.45 44.7c-.8 1.4-1.2 2.95-1.2 4.5h27.5L43.65 25z" fill="#00AC47"/>
      <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75L84.3 60.2c.8-1.4 1.2-2.95 1.2-4.5H58.05l6.85 12.5 8.65 8.6z" fill="#EA4335"/>
      <path d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.45-4.5 1.2L43.65 25z" fill="#00832D"/>
      <path d="M58.05 49.2h-30.6l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h49.1c1.6 0 3.15-.45 4.5-1.2L58.05 49.2z" fill="#2684FC"/>
      <path d="M73.4 26.5L60.65 4.5c-.8-1.4-1.95-2.5-3.3-3.3L43.6 25l14.5 24.2h27.45c0-1.55-.4-3.1-1.2-4.5L73.4 26.5z" fill="#FFBA00"/>
    </svg>
  );
}

function GoogleDocsIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 88" xmlns="http://www.w3.org/2000/svg">
      <path d="M58 88H6a6 6 0 0 1-6-6V6a6 6 0 0 1 6-6h36l22 22v60a6 6 0 0 1-6 6z" fill="#4285F4"/>
      <path d="M42 0l22 22H48a6 6 0 0 1-6-6V0z" fill="#3367D6"/>
      <rect x="16" y="40" width="32" height="3" rx="1.5" fill="#fff"/>
      <rect x="16" y="48" width="32" height="3" rx="1.5" fill="#fff"/>
      <rect x="16" y="56" width="24" height="3" rx="1.5" fill="#fff"/>
      <rect x="16" y="64" width="28" height="3" rx="1.5" fill="#fff"/>
    </svg>
  );
}

function GoogleSheetsIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 88" xmlns="http://www.w3.org/2000/svg">
      <path d="M58 88H6a6 6 0 0 1-6-6V6a6 6 0 0 1 6-6h36l22 22v60a6 6 0 0 1-6 6z" fill="#23A566"/>
      <path d="M42 0l22 22H48a6 6 0 0 1-6-6V0z" fill="#1C8F5A"/>
      <rect x="12" y="36" width="40" height="36" rx="2" fill="#fff"/>
      <path d="M12 50h40M12 62h40M30 36v36" stroke="#23A566" strokeWidth="2" fill="none"/>
    </svg>
  );
}

function GoogleCalendarIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <path d="M152.637 200H47.363C21.207 200 0 178.793 0 152.637V47.363C0 21.207 21.207 0 47.363 0h105.274C178.793 0 200 21.207 200 47.363v105.274C200 178.793 178.793 200 152.637 200" fill="#fff"/>
      <path d="M152.637 200H47.363C21.207 200 0 178.793 0 152.637V47.363C0 21.207 21.207 0 47.363 0h105.274C178.793 0 200 21.207 200 47.363v105.274C200 178.793 178.793 200 152.637 200" fill="#4285F4" opacity=".4"/>
      <path d="M152.637 0H47.363C21.207 0 0 21.207 0 47.363V152.637C0 178.793 21.207 200 47.363 200h105.274C178.793 200 200 178.793 200 152.637V47.363C200 21.207 178.793 0 152.637 0M157.5 157.5h-115V42.5h115z" fill="#4285F4"/>
      <rect x="62.5" y="90" width="18" height="18" rx="2" fill="#EA4335"/>
      <rect x="91" y="90" width="18" height="18" rx="2" fill="#EA4335"/>
      <rect x="119.5" y="90" width="18" height="18" rx="2" fill="#EA4335"/>
      <rect x="62.5" y="118.5" width="18" height="18" rx="2" fill="#EA4335"/>
      <rect x="91" y="118.5" width="18" height="18" rx="2" fill="#EA4335"/>
      <rect x="119.5" y="118.5" width="18" height="18" rx="2" fill="#34A853"/>
      <path d="M152.637 0H47.363C21.207 0 0 21.207 0 47.363v10.305h200V47.363C200 21.207 178.793 0 152.637 0" fill="#1967D2"/>
    </svg>
  );
}

function OutlookIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="4" fill="#0078D4"/>
      <path d="M20 8h7.5c.83 0 1.5.67 1.5 1.5v13c0 .83-.67 1.5-1.5 1.5H20V8z" fill="#0364B8"/>
      <path d="M20 12l9-4v16l-9-4V12z" fill="#28A8EA"/>
      <rect x="2" y="6" width="16" height="20" rx="1.5" fill="#0078D4"/>
      <ellipse cx="10" cy="16" rx="4.5" ry="5.5" fill="none" stroke="white" strokeWidth="1.8"/>
    </svg>
  );
}

function SlackIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
      <path d="M26.9 80.4a13.4 13.4 0 1 1-13.4-13.4h13.4v13.4z" fill="#E01E5A"/>
      <path d="M33.6 80.4a13.4 13.4 0 0 1 26.8 0v33.6a13.4 13.4 0 1 1-26.8 0V80.4z" fill="#E01E5A"/>
      <path d="M47 26.9a13.4 13.4 0 1 1 13.4-13.4V27H47z" fill="#36C5F0"/>
      <path d="M47 33.6a13.4 13.4 0 0 1 0 26.8H13.4a13.4 13.4 0 1 1 0-26.8H47z" fill="#36C5F0"/>
      <path d="M101 47a13.4 13.4 0 1 1 13.4 13.4H101V47z" fill="#2EB67D"/>
      <path d="M94.4 47a13.4 13.4 0 0 1-26.8 0V13.4a13.4 13.4 0 1 1 26.8 0V47z" fill="#2EB67D"/>
      <path d="M80.9 101a13.4 13.4 0 1 1-13.4 13.4V101h13.4z" fill="#ECB22E"/>
      <path d="M80.9 94.4a13.4 13.4 0 0 1 0-26.8h33.6a13.4 13.4 0 1 1 0 26.8H80.9z" fill="#ECB22E"/>
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════
   INTERSECTION OBSERVER HOOK — scroll-triggered animations
   ═══════════════════════════════════════════════════════════ */
function useInView() {
  const ref = useRef(null);
  return [ref, true];
}

/* ═══════════════════════════════════════════════════════════
   HERO AGENT FLOW DIAGRAM — living, breathing SVG
   ═══════════════════════════════════════════════════════════ */
function AgentFlowDiagram() {
  const t = useTranslations("LandingPage");
  const nodes = [
    { id: "router", label: t("diagramNodeRouter"), x: 220, y: 40, color: "#a882ff", icon: "R" },
    { id: "rag", label: t("diagramNodeRag"), x: 60, y: 170, color: "#3b82f6", icon: "K" },
    { id: "analyst", label: t("diagramNodeAnalyst"), x: 220, y: 170, color: "#8b5cf6", icon: "D" },
    { id: "email", label: t("diagramNodeEmail"), x: 380, y: 170, color: "#3b82f6", icon: "E" },
    { id: "output", label: t("diagramNodeOutput"), x: 220, y: 300, color: "#013DFF", icon: "O" },
  ];

  const edges = [
    { from: "router", to: "rag" },
    { from: "router", to: "analyst" },
    { from: "router", to: "email" },
    { from: "rag", to: "output" },
    { from: "analyst", to: "output" },
    { from: "email", to: "output" },
  ];

  const getNode = (id) => nodes.find((n) => n.id === id);

  return (
    <div className="relative w-full max-w-[500px] aspect-[5/4] mx-auto">
      <svg
        viewBox="0 0 500 370"
        className="w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Animated gradient for edges */}
          <linearGradient id="edgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#013DFF" stopOpacity="0.6" />
            <stop offset="50%" stopColor="#a882ff" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#013DFF" stopOpacity="0.6" />
          </linearGradient>
          {/* Glow filter */}
          <filter id="nodeGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Pulse particle */}
          <circle id="particle" r="3" fill="#a882ff">
            <animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite" />
          </circle>
        </defs>

        {/* Edges with animated particles */}
        {edges.map((edge, i) => {
          const from = getNode(edge.from);
          const to = getNode(edge.to);
          return (
            <g key={i}>
              <line
                x1={from.x + 40}
                y1={from.y + 30}
                x2={to.x + 40}
                y2={to.y + 10}
                stroke="url(#edgeGrad)"
                strokeWidth="1.5"
                strokeDasharray="6 4"
                opacity="0.5"
              >
                <animate
                  attributeName="stroke-dashoffset"
                  from="0"
                  to="-20"
                  dur={`${1.5 + i * 0.2}s`}
                  repeatCount="indefinite"
                />
              </line>
              {/* Traveling particle */}
              <circle r="2.5" fill="#a882ff" opacity="0.9">
                <animateMotion
                  dur={`${2 + i * 0.3}s`}
                  repeatCount="indefinite"
                  begin={`${i * 0.4}s`}
                >
                  <mpath>
                    <line
                      x1={from.x + 40}
                      y1={from.y + 30}
                      x2={to.x + 40}
                      y2={to.y + 10}
                    />
                  </mpath>
                </animateMotion>
              </circle>
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map((node, i) => (
          <g key={node.id} filter="url(#nodeGlow)">
            {/* Node background glow */}
            <rect
              x={node.x}
              y={node.y}
              width="80"
              height="40"
              rx="12"
              fill={node.color}
              opacity="0.15"
            >
              <animate
                attributeName="opacity"
                values="0.1;0.25;0.1"
                dur={`${3 + i * 0.5}s`}
                repeatCount="indefinite"
              />
            </rect>
            {/* Node border */}
            <rect
              x={node.x}
              y={node.y}
              width="80"
              height="40"
              rx="12"
              fill="rgba(10,10,26,0.8)"
              stroke={node.color}
              strokeWidth="1.5"
              opacity="0.9"
            />
            {/* Node text */}
            <text
              x={node.x + 40}
              y={node.y + 24}
              textAnchor="middle"
              fill="white"
              fontSize="10"
              fontFamily="var(--font-geist-sans), system-ui"
              fontWeight="500"
              letterSpacing="0.02em"
            >
              {node.label}
            </text>
          </g>
        ))}
      </svg>

      {/* Ambient orb behind diagram */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full opacity-20 blur-[100px] pointer-events-none"
        style={{ background: "radial-gradient(circle, #013DFF 0%, transparent 70%)" }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   NAVBAR
   ═══════════════════════════════════════════════════════════ */
function Navbar() {
  const t = useTranslations("LandingPage");
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const storedUser = authStorage.getUser();
    const storedToken = authStorage.getToken();
    if (storedUser && storedToken) setUser(storedUser);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinks = [
    { label: t("navFeatures"), href: "#features" },
    { label: t("navHowItWorks"), href: "#how-it-works" },
    { label: t("navIntegrations"), href: "#integrations" },
    { label: t("navFaq"), href: "#faq" },
    { label: t("navLegal"), href: "/legal" },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[#0a0a1a]/85 backdrop-blur-2xl border-b border-white/[0.06] shadow-xl shadow-black/30"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/home" className="flex items-center gap-2.5 group">
          {/* Thème sombre : wordmark blanc */}
          <Image
            src="/thaink2_logo_wordmark_white.png"
            alt="thaink2"
            width={114}
            height={27}
            className="brand-dark-only object-contain transition-transform duration-300 group-hover:scale-105"
          />
          {/* Thème clair : icône bleue d'origine */}
          <div className="brand-light-only relative w-7 h-7 transition-transform duration-300 group-hover:scale-110">
            <Image src="/thaink2_logo_circle.png" alt="" aria-hidden="true" fill sizes="28px" className="object-contain" />
          </div>
          <span className="text-[15px] font-semibold tracking-tight text-white">
            TH2 Agent Studio
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-7">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-white/65 hover:text-white transition-colors duration-200"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-2">
          {user ? (
            <Link
              href="/agents"
              className="text-sm font-semibold text-white bg-[#013DFF] hover:bg-[#0147ff] px-4 py-2 rounded-lg transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/45 flex items-center gap-1.5"
            >
              {t("dashboard")}
              <ArrowRight size={14} />
            </Link>
          ) : (
            <>
              <Link
                href="/agents"
                className="text-sm font-medium text-white/70 hover:text-white px-3 py-2 transition-colors duration-200"
              >
                {t("signIn")}
              </Link>
              <Link
                href="/agents"
                className="text-sm font-semibold text-white bg-[#013DFF] hover:bg-[#0147ff] px-4 py-2 rounded-lg transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/45"
              >
                {t("startFree")}
              </Link>
            </>
          )}
        </div>

        {/* Mobile menu toggle */}
        <button
          className="md:hidden text-white/80 p-2"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? t("closeMenuAria") : t("openMenuAria")}
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="md:hidden bg-[#0a0a1a]/95 backdrop-blur-2xl border-t border-white/[0.06] px-6 py-4 space-y-2">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="block text-sm font-medium text-white/75 hover:text-white py-2"
            >
              {link.label}
            </a>
          ))}
          <Link
            href="/agents"
            className="block text-center text-sm font-semibold text-white bg-[#013DFF] px-5 py-2.5 rounded-lg mt-3"
          >
            {user ? t("dashboard") : t("startFree")}
          </Link>
        </div>
      )}
    </nav>
  );
}

/* ═══════════════════════════════════════════════════════════
   SECTION: HERO
   ═══════════════════════════════════════════════════════════ */
function HeroSection({ user }) {
  const t = useTranslations("LandingPage");
  return (
    <section className="relative flex items-center justify-center pt-32 pb-24 lg:pt-40 lg:pb-32 overflow-hidden">
      {/* Background orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-[10%] left-[15%] w-[600px] h-[600px] rounded-full opacity-[0.08] blur-[120px]"
          style={{ background: "radial-gradient(circle, #013DFF, transparent 70%)" }}
        />
        <div
          className="absolute bottom-[10%] right-[10%] w-[500px] h-[500px] rounded-full opacity-[0.06] blur-[120px]"
          style={{ background: "radial-gradient(circle, #a882ff, transparent 70%)" }}
        />
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 grid lg:grid-cols-[1.1fr_1fr] gap-14 lg:gap-20 items-center w-full">
        {/* Left — Copy */}
        <div className="space-y-7 text-center lg:text-left">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 text-[11px] font-medium tracking-[0.15em] uppercase text-white/60 bg-white/[0.04] border border-white/10 rounded-full px-3.5 py-1.5">
            <Sparkles size={12} className="text-[#a882ff]" />
            {t("heroBadge")}
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-[5.25rem] font-bold leading-[1.02] tracking-[-0.02em]">
            <span className="text-white">{t("heroTitleLine1")}</span>
            <br />
            <span className="bg-linear-to-r from-[#5f82ff] via-[#8a9bff] to-[#c4a8ff] bg-clip-text text-transparent">
              {t("heroTitleLine2")}
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-white/65 max-w-xl mx-auto lg:mx-0 leading-relaxed">
            {t("heroSubtitle")}
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start pt-1">
            <Link
              href="/agents"
              className="group inline-flex items-center justify-center gap-2 text-base font-semibold text-white bg-[#013DFF] hover:bg-[#0050ff] px-7 py-3.5 rounded-xl transition-all duration-300 shadow-[0_0_40px_rgba(1,61,255,0.35)] hover:shadow-[0_0_60px_rgba(1,61,255,0.5)]"
            >
              {user ? t("goToDashboard") : t("startBuildingFree")}
              <ArrowRight size={17} className="transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center justify-center gap-2 text-base font-medium text-white/75 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 px-7 py-3.5 rounded-xl transition-all duration-300"
            >
              {t("seeHowItWorks")}
            </a>
          </div>

          {/* Trust line */}
          <p className="text-xs text-white/40 pt-2">
            {t("heroTrustLine")}
          </p>
        </div>

        {/* Right — Agent Flow Diagram */}
        <div className="hidden lg:block">
          <div className="relative">
            <div className="glass rounded-3xl p-7 border border-white/10">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                <span className="ml-3 text-xs text-white/40 font-mono">{t("heroMockWindowTitle")}</span>
              </div>
              <AgentFlowDiagram />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   SECTION: BUILT ON — honest tech stack
   ═══════════════════════════════════════════════════════════ */
function BuiltOnSection() {
  const t = useTranslations("LandingPage");
  const techs = [
    "Google ADK",
    "Vertex AI",
    "OpenAI",
    "Anthropic Claude",
    "Mistral",
    "LiteLLM",
    "Next.js",
    "FastAPI",
  ];

  return (
    <section className="relative py-16 border-y border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-6">
        <p className="text-center text-[11px] uppercase tracking-[0.25em] text-white/40 mb-8">
          {t("builtOnHeading")}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {techs.map((name) => (
            <span
              key={name}
              className="text-base font-medium text-white/35 hover:text-white/60 transition-colors duration-300 cursor-default select-none"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   SECTION: FEATURES GRID
   ═══════════════════════════════════════════════════════════ */
function FeaturesSection() {
  const t = useTranslations("LandingPage");

  const FEATURES = [
    {
      icon: Blocks,
      title: t("featureAgentFactoryTitle"),
      desc: t("featureAgentFactoryDesc"),
      gradient: "from-blue-500 to-blue-400",
      glow: "rgba(59,130,246,0.15)",
    },
    {
      icon: MessageSquare,
      title: t("featureAiInActionTitle"),
      desc: t("featureAiInActionDesc"),
      gradient: "from-violet-500 to-purple-500",
      glow: "rgba(139,92,246,0.15)",
    },
    {
      icon: Database,
      title: t("featureKnowledgeRagTitle"),
      desc: t("featureKnowledgeRagDesc"),
      gradient: "from-blue-500 to-blue-400",
      glow: "rgba(59,130,246,0.15)",
    },
    {
      icon: Wrench,
      title: t("featureToolBoxTitle"),
      desc: t("featureToolBoxDesc"),
      gradient: "from-purple-500 to-purple-400",
      glow: "rgba(168,130,255,0.15)",
    },
    {
      icon: Workflow,
      title: t("featureOrchestratorTitle"),
      desc: t("featureOrchestratorDesc"),
      gradient: "from-blue-500 to-blue-400",
      glow: "rgba(59,130,246,0.15)",
    },
    {
      icon: Store,
      title: t("featureMarketplaceTitle"),
      desc: t("featureMarketplaceDesc"),
      gradient: "from-purple-500 to-purple-400",
      glow: "rgba(168,130,255,0.15)",
    },
    {
      icon: PlugZap,
      title: t("featureIntegrationsTitle"),
      desc: t("featureIntegrationsDesc"),
      gradient: "from-purple-500 to-purple-400",
      glow: "rgba(168,130,255,0.15)",
    },
    {
      icon: Shield,
      title: t("featureSecurityAuthTitle"),
      desc: t("featureSecurityAuthDesc"),
      gradient: "from-purple-500 to-purple-400",
      glow: "rgba(168,130,255,0.15)",
    },
    {
      icon: LayoutDashboard,
      title: t("featureBiReportingTitle"),
      desc: t("featureBiReportingDesc"),
      gradient: "from-purple-500 to-purple-400",
      glow: "rgba(168,130,255,0.15)",
    },
  ];

  return (
    <section id="features" className="relative py-28">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section header */}
        <div className="max-w-2xl mx-auto text-center mb-16">
          <p className="text-[11px] uppercase tracking-[0.25em] text-[#a882ff] mb-4 font-medium">{t("featuresEyebrow")}</p>
          <h2 className="text-4xl sm:text-5xl font-bold text-white tracking-[-0.02em] leading-[1.05]">
            {t("featuresTitleLine1")}
            <br />
            <span className="text-white/45">{t("featuresTitleLine2")}</span>
          </h2>
          <p className="text-base text-white/55 mt-5 leading-relaxed">
            {t("featuresSubtitle")}
          </p>
        </div>

        {/* Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="group relative rounded-2xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] p-7 transition-all duration-300 hover:border-white/15"
              >
                <div
                  className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{
                    background: `radial-gradient(400px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), ${f.glow}, transparent 60%)`,
                  }}
                />
                <div className="relative">
                  <div
                    className={`inline-flex p-2.5 rounded-xl bg-linear-to-br ${f.gradient} mb-5 shadow-lg`}
                  >
                    <Icon size={20} className="text-white" strokeWidth={2} />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2 tracking-tight">{f.title}</h3>
                  <p className="text-sm text-white/55 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   SECTION: PRODUCT SHOWCASE — alternating split
   ═══════════════════════════════════════════════════════════ */
function ShowcaseMockup({ type }) {
  const t = useTranslations("LandingPage");
  if (type === "builder") {
    return (
      <div className="glass rounded-2xl p-6 border border-white/8">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2.5 h-2.5 rounded-full bg-purple-500/50" />
          <div className="w-2.5 h-2.5 rounded-full bg-purple-300/50" />
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500/50" />
          <span className="ml-2 text-[10px] text-white/20 font-mono">{t("mockupAgentFactoryTitle")}</span>
        </div>
        <div className="space-y-3">
          {/* Agent cards */}
          {[
            { name: t("mockupAgentRouter"), color: "border-purple-500/40 bg-purple-500/5", type: "router" },
            { name: t("mockupAgentRagSearch"), color: "border-blue-500/40 bg-blue-500/5", type: "sequential" },
            { name: t("mockupAgentFormatter"), color: "border-purple-500/40 bg-purple-500/5", type: "base" },
          ].map((agent) => (
            <div
              key={agent.name}
              className={`flex items-center gap-3 p-3 rounded-xl border ${agent.color} transition-all duration-300 hover:scale-[1.02]`}
            >
              <Bot size={16} className="text-white/40" />
              <div>
                <div className="text-sm font-medium text-white/80">{agent.name}</div>
                <div className="text-[10px] text-white/25">{agent.type}</div>
              </div>
              <div className="ml-auto w-2 h-2 rounded-full bg-blue-400/60 animate-pulse" />
            </div>
          ))}
          {/* Connection lines */}
          <div className="flex justify-center py-1">
            <GitBranch size={18} className="text-white/10 rotate-180" />
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl border border-[#013DFF]/30 bg-[#013DFF]/5">
            <Zap size={16} className="text-[#013DFF]" />
            <div>
              <div className="text-sm font-medium text-white/80">{t("mockupOutputLabel")}</div>
              <div className="text-[10px] text-white/25">{t("mockupAggregatedResponse")}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (type === "rag") {
    return (
      <div className="glass rounded-2xl p-6 border border-white/8">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2.5 h-2.5 rounded-full bg-purple-500/50" />
          <div className="w-2.5 h-2.5 rounded-full bg-purple-300/50" />
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500/50" />
          <span className="ml-2 text-[10px] text-white/20 font-mono">{t("mockupKnowledgeBaseTitle")}</span>
        </div>
        <div className="space-y-3">
          {/* Files */}
          {["Q3-report.pdf", "product-specs.csv", "meeting-notes.md"].map((file, i) => (
            <div
              key={file}
              className="flex items-center gap-3 p-3 rounded-xl border border-white/6 bg-white/2"
            >
              <Database size={14} className="text-blue-400/60" />
              <span className="text-sm text-white/50 flex-1">{file}</span>
              <span className="text-[10px] text-blue-400/60 font-mono">{t("mockupIndexed")}</span>
            </div>
          ))}
          {/* Search bar mockup */}
          <div className="mt-2 p-3 rounded-xl border border-[#a882ff]/20 bg-[#a882ff]/5">
            <div className="text-[10px] text-[#a882ff]/60 mb-2 font-mono">{t("mockupSemanticSearch")}</div>
            <div className="text-sm text-white/60">{t("mockupSearchExample")}</div>
            <div className="mt-2 text-xs text-white/30 border-t border-white/6 pt-2">
              {t("mockupSearchResult")}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (type === "integrations") {
    return (
      <div className="glass rounded-2xl p-6 border border-white/8">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2.5 h-2.5 rounded-full bg-purple-500/50" />
          <div className="w-2.5 h-2.5 rounded-full bg-purple-300/50" />
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500/50" />
          <span className="ml-2 text-[10px] text-white/20 font-mono">{t("mockupOrchestratorTitle")}</span>
        </div>
        <div className="space-y-3">
          {[
            { name: "Gmail", status: t("mockupConnected"), color: "text-blue-400/70", icon: <GmailIcon size={16} /> },
            { name: "Google Drive", status: t("mockupConnected"), color: "text-blue-400/70", icon: <GoogleDriveIcon size={16} /> },
            { name: "GitHub", status: t("mockupConnected"), color: "text-blue-400/70", icon: <GithubIcon size={16} /> },
            { name: "Microsoft Outlook", status: t("mockupConnected"), color: "text-blue-400/70", icon: <OutlookIcon size={16} /> },
          ].map((svc) => (
            <div
              key={svc.name}
              className="flex items-center gap-3 p-3 rounded-xl border border-white/6 bg-white/2"
            >
              {svc.icon}
              <span className="text-sm text-white/50 flex-1">{svc.name}</span>
              <span className={`text-[10px] ${svc.color} font-mono`}>{svc.status}</span>
            </div>
          ))}
          <div className="mt-2 p-3 rounded-xl border border-blue-500/20 bg-blue-500/5">
            <div className="text-[10px] text-blue-400/60 mb-2 font-mono">{t("mockupScheduledRun")}</div>
            <div className="flex items-center justify-between">
              <div className="text-sm text-white/60">{t("mockupScheduledRunName")}</div>
              <div className="w-2 h-2 rounded-full bg-blue-400/60 animate-pulse" />
            </div>
            <div className="mt-2 text-xs text-white/30 border-t border-white/6 pt-2">
              {t("mockupNextRun")}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // supervision
  return (
    <div className="glass rounded-2xl p-6 border border-white/8">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2.5 h-2.5 rounded-full bg-purple-500/50" />
        <div className="w-2.5 h-2.5 rounded-full bg-purple-300/50" />
        <div className="w-2.5 h-2.5 rounded-full bg-blue-500/50" />
        <span className="ml-2 text-[10px] text-white/20 font-mono">{t("mockupTraceTimelineTitle")}</span>
      </div>
      <div className="space-y-2">
        {[
          { time: "0.0s", event: t("mockupTraceStep1"), color: "text-white/40" },
          { time: "0.1s", event: t("mockupTraceStep2"), color: "text-purple-400/70" },
          { time: "0.3s", event: "tool_search_knowledge()", color: "text-blue-400/70" },
          { time: "1.2s", event: t("mockupTraceStep4"), color: "text-blue-400/70" },
          { time: "1.4s", event: t("mockupTraceStep5"), color: "text-purple-400/70" },
          { time: "2.8s", event: t("mockupTraceStep6"), color: "text-[#013DFF]" },
        ].map((step, i) => (
          <div
            key={i}
            className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/2 transition-colors"
          >
            <span className="text-[10px] text-white/20 font-mono w-8 shrink-0 mt-0.5">{step.time}</span>
            <div className="w-1.5 h-1.5 rounded-full bg-current mt-1.5 shrink-0" style={{ color: step.color.includes("text-") ? undefined : step.color }} />
            <span className={`text-xs font-mono ${step.color}`}>{step.event}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductShowcase() {
  const t = useTranslations("LandingPage");

  const SHOWCASES = [
    {
      badge: t("showcaseBuilderBadge"),
      title: t("showcaseBuilderTitle"),
      desc: t("showcaseBuilderDesc"),
      features: [
        t("showcaseBuilderFeature1"),
        t("showcaseBuilderFeature2"),
        t("showcaseBuilderFeature3"),
        t("showcaseBuilderFeature4"),
      ],
      visual: "builder",
    },
    {
      badge: t("showcaseRagBadge"),
      title: t("showcaseRagTitle"),
      desc: t("showcaseRagDesc"),
      features: [
        t("showcaseRagFeature1"),
        t("showcaseRagFeature2"),
        t("showcaseRagFeature3"),
        t("showcaseRagFeature4"),
      ],
      visual: "rag",
    },
    {
      badge: t("showcaseIntegrationsBadge"),
      title: t("showcaseIntegrationsTitle"),
      desc: t("showcaseIntegrationsDesc"),
      features: [
        t("showcaseIntegrationsFeature1"),
        t("showcaseIntegrationsFeature2"),
        t("showcaseIntegrationsFeature3"),
        t("showcaseIntegrationsFeature4"),
      ],
      visual: "integrations",
    },
  ];

  return (
    <section className="py-24 space-y-24">
      {SHOWCASES.map((s, i) => {
        const isReversed = i % 2 === 1;
        return <ShowcaseRow key={s.badge} data={s} reversed={isReversed} />;
      })}
    </section>
  );
}

function ShowcaseRow({ data, reversed }) {
  return (
    <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-14 items-center">
      {/* Text */}
      <div className={`space-y-5 ${reversed ? "lg:order-2" : ""}`}>
        <span className="inline-block text-[11px] uppercase tracking-[0.25em] text-[#a882ff] font-medium">{data.badge}</span>
        <h3 className="text-3xl sm:text-4xl font-bold text-white tracking-[-0.02em] whitespace-pre-line leading-[1.1]">
          {data.title}
        </h3>
        <p className="text-base text-white/60 leading-relaxed max-w-md">{data.desc}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          {data.features.map((f) => (
            <span
              key={f}
              className="text-xs font-medium text-white/70 bg-white/[0.04] border border-white/10 px-3 py-1.5 rounded-lg"
            >
              {f}
            </span>
          ))}
        </div>
      </div>

      {/* Visual */}
      <div className={reversed ? "lg:order-1" : ""}>
        <ShowcaseMockup type={data.visual} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SECTION: HOW IT WORKS
   ═══════════════════════════════════════════════════════════ */

function IntegrationsSection() {
  const t = useTranslations("LandingPage");
  const items = [
    { name: "GitHub", desc: t("integrationGithubDesc"), available: true, icon: <GithubIcon size={18} /> },
    { name: "Gmail", desc: t("integrationGmailDesc"), available: true, icon: <GmailIcon size={18} /> },
    { name: "Google Drive", desc: t("integrationGoogleDriveDesc"), available: true, icon: <GoogleDriveIcon size={18} /> },
    { name: "Google Docs", desc: t("integrationGoogleDocsDesc"), available: true, icon: <GoogleDocsIcon size={18} /> },
    { name: "Google Sheets", desc: t("integrationGoogleSheetsDesc"), available: true, icon: <GoogleSheetsIcon size={18} /> },
    { name: "Google Calendar", desc: t("integrationGoogleCalendarDesc"), available: true, icon: <GoogleCalendarIcon size={18} /> },
    { name: "Outlook", desc: t("integrationOutlookDesc"), available: true, icon: <OutlookIcon size={18} /> },
    { name: "Slack", desc: t("integrationSlackDesc"), available: false, icon: <SlackIcon size={18} /> },
  ];
  return (
    <section id="integrations" className="py-28">
      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <p className="text-[11px] uppercase tracking-[0.25em] text-[#a882ff] mb-4 font-medium">{t("integrationsEyebrow")}</p>
          <h2 className="text-4xl sm:text-5xl font-bold text-white tracking-[-0.02em] leading-[1.05]">
            {t("integrationsTitleLine1")}<br /><span className="text-white/45">{t("integrationsTitleLine2")}</span>
          </h2>
          <p className="text-base text-white/60 mt-5 leading-relaxed">
            {t("integrationsSubtitle")}
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-w-5xl mx-auto">
          {items.map((item) => (
            <div
              key={item.name}
              className="relative flex flex-col gap-3 p-5 rounded-2xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/15 transition-all duration-300"
            >
              {!item.available && (
                <span className="absolute top-3 right-3 text-[9px] font-bold uppercase tracking-wider text-white/50 bg-white/[0.06] border border-white/10 px-2 py-0.5 rounded-full">
                  {t("integrationSoonBadge")}
                </span>
              )}
              <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center">
                {item.icon}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{item.name}</p>
                <p className="text-xs text-white/55 mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="text-center mt-10">
          <Link
            href="/integrations"
            className="inline-flex items-center gap-2 text-sm font-medium text-white/70 hover:text-white border border-white/10 hover:border-white/25 bg-white/[0.03] hover:bg-white/[0.07] px-5 py-2.5 rounded-xl transition-all duration-300"
          >
            <PlugZap size={15} /> {t("manageYourIntegrations")} <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const t = useTranslations("LandingPage");
  const steps = [
    {
      num: "01",
      title: t("stepDesignTitle"),
      desc: t("stepDesignDesc"),
      icon: BrainCircuit,
    },
    {
      num: "02",
      title: t("stepEquipTitle"),
      desc: t("stepEquipDesc"),
      icon: Wrench,
    },
    {
      num: "03",
      title: t("stepDeployTitle"),
      desc: t("stepDeployDesc"),
      icon: Zap,
    },
  ];

  return (
    <section id="how-it-works" className="py-28 relative">
      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-2xl mx-auto text-center mb-16">
          <p className="text-[11px] uppercase tracking-[0.25em] text-[#a882ff] mb-4 font-medium">{t("howItWorksEyebrow")}</p>
          <h2 className="text-4xl sm:text-5xl font-bold text-white tracking-[-0.02em] leading-[1.05]">
            {t("howItWorksTitleLine1")}
            <br />
            <span className="text-white/45">{t("howItWorksTitleLine2")}</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8 relative max-w-5xl mx-auto">
          {/* Connecting line */}
          <div className="hidden md:block absolute top-8 left-[16.6%] right-[16.6%] h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />

          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.num} className="relative text-center">
                <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#0a0a1a] border border-white/12 mb-5 shadow-[0_0_20px_rgba(1,61,255,0.15)]">
                  <Icon size={24} className="text-[#5f82ff]" strokeWidth={1.5} />
                  <span className="absolute -top-2 -right-2 text-[10px] font-bold text-white/60 bg-[#0a0a1a] border border-white/15 rounded-md px-1.5 py-0.5 font-mono">
                    {step.num}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2.5 tracking-tight">{step.title}</h3>
                <p className="text-sm text-white/60 leading-relaxed max-w-xs mx-auto">{step.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   SECTION: FAQ
   ═══════════════════════════════════════════════════════════ */
function FAQSection() {
  const t = useTranslations("LandingPage");
  const [openIndex, setOpenIndex] = useState(0);

  const FAQS = [
    { q: t("faq1Question"), a: t("faq1Answer") },
    { q: t("faq2Question"), a: t("faq2Answer") },
    { q: t("faq3Question"), a: t("faq3Answer") },
    { q: t("faq4Question"), a: t("faq4Answer") },
  ];

  return (
    <section id="faq" className="py-28">
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-14">
          <p className="text-[11px] uppercase tracking-[0.25em] text-[#a882ff] mb-4 font-medium">{t("faqEyebrow")}</p>
          <h2 className="text-4xl sm:text-5xl font-bold text-white tracking-[-0.02em]">
            {t("faqTitle")}
          </h2>
        </div>

        <div className="space-y-2.5">
          {FAQS.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <div
                key={i}
                className={`rounded-xl border transition-colors duration-300 ${
                  isOpen
                    ? "border-white/15 bg-white/[0.04]"
                    : "border-white/[0.08] bg-white/[0.015] hover:bg-white/[0.03]"
                }`}
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? -1 : i)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between p-5 text-left cursor-pointer"
                >
                  <span className="text-[15px] font-medium text-white pr-4">{faq.q}</span>
                  <ChevronDown
                    size={18}
                    className={`shrink-0 text-white/50 transition-transform duration-300 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <div
                  className={`overflow-hidden transition-all duration-400 ${
                    isOpen ? "max-h-80 pb-5" : "max-h-0"
                  }`}
                >
                  <p className="px-5 text-sm text-white/65 leading-relaxed">{faq.a}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   SECTION: FINAL CTA
   ═══════════════════════════════════════════════════════════ */
function FinalCTASection({ user }) {
  const t = useTranslations("LandingPage");
  return (
    <section className="py-28 relative">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full opacity-[0.10] blur-[120px]"
          style={{ background: "radial-gradient(circle, #013DFF, transparent 60%)" }}
        />
      </div>

      <div className="relative max-w-3xl mx-auto px-6 text-center">
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-[-0.02em] mb-5 leading-[1.05]">
          {t("finalCtaTitleLine1")}
          <br />
          <span className="bg-linear-to-r from-[#5f82ff] to-[#c4a8ff] bg-clip-text text-transparent">
            {t("finalCtaTitleLine2")}
          </span>
        </h2>
        <p className="text-lg text-white/65 mb-9 max-w-lg mx-auto">
          {t("finalCtaSubtitle")}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/agents"
            className="group inline-flex items-center justify-center gap-2 text-base font-semibold text-white bg-[#013DFF] hover:bg-[#0050ff] px-8 py-3.5 rounded-xl transition-all duration-300 shadow-[0_0_40px_rgba(1,61,255,0.35)] hover:shadow-[0_0_60px_rgba(1,61,255,0.5)]"
          >
            {user ? t("goToDashboard") : t("getStartedFree")}
            <ArrowRight size={17} className="transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </div>
        {!user && <p className="text-xs text-white/45 mt-5">{t("finalCtaTrustLine")}</p>}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   FOOTER
   ═══════════════════════════════════════════════════════════ */
function Footer() {
  const t = useTranslations("LandingPage");
  const columns = [
    {
      title: t("footerColProductTitle"),
      links: [
        { label: t("footerLinkAgentFactory"), href: "#features" },
        { label: t("footerLinkOrchestrator"), href: "#features" },
        { label: t("footerLinkMarketplace"), href: "#features" },
        { label: t("footerLinkIntegrations"), href: "#integrations" },
      ],
    },
    {
      title: t("footerColResourcesTitle"),
      links: [
        { label: t("footerLinkDocumentation"), href: "#" },
        { label: t("footerLinkApiReference"), href: "#" },
        { label: t("footerLinkChangelog"), href: "#" },
        { label: t("footerLinkStatus"), href: "#" },
      ],
    },
    {
      title: t("footerColCompanyTitle"),
      links: [
        { label: t("footerLinkAboutThaink2"), href: "#" },
        { label: t("footerLinkBlog"), href: "#" },
        { label: t("footerLinkCareers"), href: "#" },
        { label: t("footerLinkContact"), href: "#" },
      ],
    },
    {
      title: t("footerColLegalTitle"),
      links: [
        { label: t("footerLinkPrivacyPolicy"), href: "/legal#privacy" },
        { label: t("footerLinkTermsOfService"), href: "/legal#terms" },
        { label: t("footerLinkGdpr"), href: "/legal#privacy" },
      ],
    },
  ];

  return (
    <footer className="border-t border-white/[0.06] pt-14 pb-8">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-12">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/home" className="flex items-center gap-2 mb-4 group">
              <div className="relative w-7 h-7">
                <BrandIcon alt="thaink2" fill sizes="28px" className="object-contain" />
              </div>
              <span className="text-sm font-semibold text-white/85 group-hover:text-white transition-colors">TH2 Agent Studio</span>
            </Link>
            <p className="text-xs text-white/50 leading-relaxed max-w-[220px]">
              {t("footerTagline")}
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="text-[11px] uppercase tracking-[0.2em] text-white/55 mb-4 font-semibold">{col.title}</h4>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-white/55 hover:text-white transition-colors duration-200"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/[0.06] pt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <span className="text-xs text-white/40">{t("footerCopyright")}</span>
          <div className="flex gap-6">
            {["Twitter", "LinkedIn", "GitHub"].map((social) => (
              <a
                key={social}
                href="#"
                className="text-xs text-white/45 hover:text-white transition-colors duration-200"
              >
                {social}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════ */
export default function LandingPage() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const storedUser = authStorage.getUser();
    const storedToken = authStorage.getToken();
    if (storedUser && storedToken) setUser(storedUser);
  }, []);

  // Smooth scroll behavior for anchor links
  useEffect(() => {
    const handleClick = (e) => {
      const target = e.target.closest('a[href^="#"]');
      if (!target) return;
      e.preventDefault();
      const id = target.getAttribute("href").slice(1);
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  // Track mouse for card hover effects
  useEffect(() => {
    const handleMouse = (e) => {
      const cards = document.querySelectorAll("[style*='--mouse-x'],.group");
      cards.forEach((card) => {
        const rect = card.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        card.style.setProperty("--mouse-x", `${x}%`);
        card.style.setProperty("--mouse-y", `${y}%`);
      });
    };
    window.addEventListener("mousemove", handleMouse);
    return () => window.removeEventListener("mousemove", handleMouse);
  }, []);

  return (
    <div className="landing-page min-h-screen bg-[#0a0a1a] text-white/90 selection:bg-[#013DFF]/30 selection:text-white overflow-x-hidden">
      <Navbar />
      <HeroSection user={user} />
      <BuiltOnSection />
      <FeaturesSection />
      <HowItWorksSection />
      <ProductShowcase />
      <IntegrationsSection />
      <FAQSection />
      <FinalCTASection user={user} />
      <Footer />
    </div>
  );
}
