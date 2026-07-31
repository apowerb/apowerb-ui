"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "use-intl";
import BrandIcon from "@/components/brand/BrandIcon";
import {
  MessageSquare, Loader2, AlertCircle,
  User, BrainCircuit, Copy, Check, ExternalLink,
} from "lucide-react";
import { formatDate as formatDateParis, formatDateTime } from "@/lib/datetime";

/* ─────────────────────────────────────────
   Single message bubble (read-only)
───────────────────────────────────────── */
function SharedMessage({ message, agentName }) {
  const t = useTranslations("SharedConversationView");
  const isUser = message.role === "user";
  const content = typeof message.content === "string" ? message.content : "";
  const time = message.timestamp ? formatDateTime(message.timestamp) : "";

  return (
    <div className={`flex gap-3 mb-5 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div
        className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5"
        style={{
          background: isUser ? "rgba(1,61,255,0.2)" : "rgba(168,130,255,0.15)",
          border: isUser ? "1px solid rgba(1,61,255,0.35)" : "1px solid rgba(168,130,255,0.25)",
        }}
      >
        {isUser
          ? <User size={14} className="text-brand" />
          : <BrainCircuit size={14} style={{ color: "#a882ff" }} />
        }
      </div>

      {/* Bubble */}
      <div className={`flex flex-col max-w-[75%] ${isUser ? "items-end" : "items-start"}`}>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs font-medium th-text-muted">
            {isUser ? t("userRole") : agentName || t("assistantFallback")}
          </span>
          {time && (
            <span className="text-[10px] th-text-ghost">{time}</span>
          )}
        </div>
        <div
          className="px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
          style={isUser ? {
            background: "rgba(1,61,255,0.18)",
            border: "1px solid rgba(1,61,255,0.28)",
            color: "var(--foreground)",
            borderTopRightRadius: 4,
          } : {
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
            borderTopLeftRadius: 4,
          }}
        >
          {content || <span style={{ opacity: 0.4, fontStyle: "italic" }}>[no content]</span>}
        </div>

        {/* Tool calls badge */}
        {message.toolCalls?.length > 0 && (
          <span
            className="mt-1.5 text-[11px] px-2.5 py-1 rounded-full"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              color: "var(--text-muted)",
            }}
          >
            {t("toolCallCount", { count: message.toolCalls.length })}
          </span>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Main view
───────────────────────────────────────── */
export default function SharedConversationView({ shareId }) {
  const t = useTranslations("SharedConversationView");
  const [status, setStatus]           = useState("loading"); // loading | success | error
  const [data, setData]               = useState(null);
  const [errorMsg, setErrorMsg]       = useState("");
  const [linkCopied, setLinkCopied]   = useState(false);

  useEffect(() => {
    if (!shareId) return;
    fetch(`/api/conversations/share/${shareId}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || `Not found (${res.status})`);
        }
        return res.json();
      })
      .then((json) => { setData(json); setStatus("success"); })
      .catch((err) => { setErrorMsg(err.message); setStatus("error"); });
  }, [shareId]);

  const copyCurrentUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    } catch {}
  };

  return (
    <div
      className="min-h-screen th-text selection:bg-brand/30 selection:text-white th-bg-body"
    >
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div style={{
          position: "absolute", top: "-15%", left: "50%",
          transform: "translateX(-50%)",
          width: 900, height: 500,
          background: "radial-gradient(ellipse, rgba(1,61,255,0.08) 0%, transparent 70%)",
        }} />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-12">

        {/* ── Brand header ── */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-hover))",
                boxShadow: "0 0 16px rgba(1,61,255,0.4)",
              }}
            >
              <BrandIcon alt="TH2" width={32} height={32} className="rounded-full" />
            </div>
            <span
              className="text-sm font-semibold transition-colors th-text-muted"
            >
              TH2 Agent Studio
            </span>
          </Link>

          <Link
            href="/chatbot"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all bg-brand text-white"
            style={{
              boxShadow: "0 0 24px rgba(1,61,255,0.35)",
            }}
          >
            {t("tryItYourself")} <ExternalLink size={13} />
          </Link>
        </div>

        {/* ── Loading ── */}
        {status === "loading" && (
          <div className="flex flex-col items-center gap-4 py-24">
            <Loader2 size={32} className="animate-spin text-brand" />
            <p className="th-text-faint">{t("loadingConversation")}</p>
          </div>
        )}

        {/* ── Error ── */}
        {status === "error" && (
          <div
            className="flex flex-col items-center gap-4 py-16 px-6 rounded-2xl text-center"
            style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}
          >
            <AlertCircle size={36} className="text-red-400" />
            <div>
              <p className="font-semibold text-red-300 mb-1">{t("conversationNotFound")}</p>
              <p className="text-sm text-red-400/60">{errorMsg}</p>
            </div>
            <Link
              href="/chatbot"
              className="mt-2 text-sm font-semibold text-brand"
            >
              {t("startYourOwnChat")}
            </Link>
          </div>
        )}

        {/* ── Success ── */}
        {status === "success" && data && (
          <>
            {/* Conversation card header */}
            <div
              className="rounded-2xl overflow-hidden mb-2"
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                boxShadow: "0 4px 32px rgba(0,0,0,0.4)",
              }}
            >
              <div className="h-px w-full" style={{ background: "linear-gradient(90deg, transparent, var(--color-brand), transparent)" }} />

              <div
                className="flex items-center justify-between px-5 py-4"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: "rgba(1,61,255,0.15)", border: "1px solid rgba(1,61,255,0.3)" }}
                  >
                    <MessageSquare size={16} className="text-brand" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold th-text leading-tight">{data.title}</p>
                    <p className="text-xs mt-0.5 th-text-faint">
                      {data.agentName} · {t("messagesCount", { count: data.messages?.length ?? 0 })}
                      {data.createdAt ? ` · ${formatDateParis(data.createdAt)}` : ""}
                    </p>
                  </div>
                </div>

                {/* Copy link */}
                <button
                  onClick={copyCurrentUrl}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all"
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border)",
                    color: linkCopied ? "#4ade80" : "var(--text-muted)",
                  }}
                >
                  {linkCopied ? <><Check size={12} /> {t("copied")}</> : <><Copy size={12} /> {t("copyLink")}</>}
                </button>
              </div>

              {/* Messages */}
              <div className="p-5">
                {data.messages?.length === 0 ? (
                  <p className="text-center text-sm py-8 th-text-ghost">
                    {t("noMessages")}
                  </p>
                ) : (
                  data.messages.map((msg, i) => (
                    <SharedMessage key={i} message={msg} agentName={data.agentName} />
                  ))
                )}
              </div>
            </div>

            {/* Snapshot notice */}
            <p className="text-center text-xs mb-8 th-text-ghost">
              {t("snapshotNotice")}
            </p>

            {/* CTA */}
            <div className="flex justify-center">
              <Link
                href="/chatbot"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all bg-brand text-white"
                style={{
                  boxShadow: "0 0 32px rgba(1,61,255,0.35)",
                }}
              >
                {t("startYourOwnConversation")} <ExternalLink size={14} />
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}