"use client";

import { useState } from "react";
import { useRouter } from "@/lib/navigation";
import { useTranslations } from "use-intl";
import { Image } from "@/lib/navigation";
import { ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import NotificationBell from "@/components/NotificationBell";
import UserMenu from "@/components/auth/UserMenu";
import UserProfileModal from "@/components/auth/UserProfileModal";

export default function ChatPageShell({ icon: Icon, label, tag, tagColor, description, children }) {
  const t = useTranslations("ChatPageShell");
  const router = useRouter();
  const [showProfile, setShowProfile] = useState(false);

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/chatbot");
    }
  };

  return (
    <div className="h-full flex flex-col" style={{ background: "var(--background)" }}>

      {/* Top accent line */}
      <div
        className="h-px w-full flex-shrink-0"
        style={{ background: `linear-gradient(90deg, transparent, ${tagColor}, transparent)` }}
      />

      {/* Header */}
      <header
        className="flex-shrink-0 flex items-center gap-3 sm:gap-4 px-3 sm:px-5 py-3"
        style={{
          background: "var(--glass-bg)",
          borderBottom: "1px solid var(--border-primary)",
          backdropFilter: "blur(12px)",
        }}
      >
        {/* Back button */}
        <button
          onClick={handleBack}
          aria-label={t("goBack")}
          className="flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 flex-shrink-0"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-primary)",
            color: "var(--text-muted)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = `${tagColor}15`;
            e.currentTarget.style.borderColor = `${tagColor}45`;
            e.currentTarget.style.color = tagColor;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--bg-surface)";
            e.currentTarget.style.borderColor = "var(--border-primary)";
            e.currentTarget.style.color = "var(--text-muted)";
          }}
        >
          <ArrowLeft size={15} />
        </button>

        {/* Logo */}
        <div
          className="flex items-center justify-center rounded-full flex-shrink-0 bg-linear-to-br from-brand to-brand-hover"
          style={{
            width: 32, height: 32,
            boxShadow: "0 0 14px rgba(1,61,255,0.35)",
          }}
        >
          <Image src="/thaink2_logo_circle.png" alt="TH2" width={32} height={32} className="rounded-full" />
        </div>

        {/* Divider */}
        <div className="w-px h-6 flex-shrink-0 hidden sm:block" style={{ background: "var(--border-primary)" }} />

        {/* Mode icon */}
        <div
          className="flex items-center justify-center rounded-lg flex-shrink-0"
          style={{
            width: 30, height: 30,
            background: `${tagColor}15`,
            border: `1px solid ${tagColor}28`,
          }}
        >
          <Icon size={15} style={{ color: tagColor }} />
        </div>

        {/* Title + tag */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <span
            className="text-sm font-semibold truncate"
            style={{ color: "var(--text-primary)" }}
          >
            {label}
          </span>
          <span
            className="text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full flex-shrink-0"
            style={{ background: `${tagColor}15`, color: tagColor, border: `1px solid ${tagColor}28` }}
          >
            {tag}
          </span>
          {description && (
            <span className="hidden md:block text-xs truncate" style={{ color: "var(--text-whisper)" }}>
              — {description}
            </span>
          )}
        </div>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <ThemeToggle collapsed />

          <NotificationBell collapsed />

          <UserMenu
            collapsed
            onOpenProfile={() => setShowProfile(true)}
          />

          <div
            className="w-2 h-2 rounded-full hidden sm:block"
            style={{
              background: tagColor,
              boxShadow: `0 0 6px ${tagColor}`,
              animation: "headerGlow 2.5s ease-in-out infinite",
            }}
            aria-hidden="true"
          />
        </div>
      </header>

      <style>{`
        @keyframes headerGlow {
          0%, 100% { opacity: 0.6; }
          50%       { opacity: 1; }
        }
      `}</style>

      <div className="flex-1 min-h-0">
        {children}
      </div>

      {showProfile && <UserProfileModal onClose={() => setShowProfile(false)} />}
    </div>
  );
}
