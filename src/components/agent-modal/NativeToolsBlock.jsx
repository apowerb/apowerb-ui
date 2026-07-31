"use client";

import { Mail, Lock, Loader2, CheckCircle } from "lucide-react";

const EMAIL_CATEGORIES = ["outlook_mail", "emailing"];

export function splitNativeTools(templateNativeTools) {
  const emailTools = templateNativeTools.filter((tp) =>
    EMAIL_CATEGORIES.some((cat) => tp.startsWith(cat + "."))
  );
  const otherTools = templateNativeTools.filter(
    (tp) => !EMAIL_CATEGORIES.some((cat) => tp.startsWith(cat + "."))
  );
  return { emailTools, otherTools };
}

export function EmailConnectionsBlock({
  outlookConnected,
  outlookLoading,
  onConnectOutlook,
}) {
  return (
    <div>
      <div className="text-xs font-semibold text-blue-400 mb-1.5 pl-1 flex items-center gap-1.5">
        <Mail size={12} /> Email Connections
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={outlookLoading}
          onClick={onConnectOutlook}
          className={`flex-1 flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all text-sm font-semibold ${
            outlookConnected
              ? "border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/15"
              : "border-white/10 bg-white/5 hover:bg-blue-600/20 hover:border-blue-500/30 text-white disabled:opacity-50"
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" className="shrink-0">
            <rect x="0" y="3.2" width="9.6" height="9.6" rx="0.8" fill="#0078D4"/>
            <path d="M4.8 5.6L4.8 10.4L2.4 10.4L2.4 7.2L4.8 5.6Z" fill="#0078D4"/>
            <rect x="5.6" y="0" width="4.8" height="7.2" rx="0.4" fill="#0364B8"/>
            <rect x="8.8" y="4" width="4.8" height="7.2" rx="0.4" fill="#0078D4"/>
            <rect x="5.6" y="8.8" width="4.8" height="7.2" rx="0.4" fill="#28A8EA"/>
            <text x="3.6" y="9.2" fontSize="5" fontWeight="bold" fill="white" textAnchor="middle">O</text>
          </svg>
          {outlookLoading ? (
            <Loader2 size={13} className="animate-spin" />
          ) : outlookConnected ? (
            <><CheckCircle size={13} /> Connected — Add another</>
          ) : (
            "Outlook"
          )}
        </button>
        <button
          type="button"
          disabled
          className="flex-1 flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white/30 text-sm font-semibold cursor-not-allowed"
        >
          <svg width="16" height="12" viewBox="0 0 16 12" className="shrink-0">
            <path d="M1.6 0h12.8C15.28 0 16 .72 16 1.6v8.8c0 .88-.72 1.6-1.6 1.6H1.6C.72 12 0 11.28 0 10.4V1.6C0 .72.72 0 1.6 0z" fill="#4285F4" opacity=".5"/>
            <path d="M16 1.6L8 7.2 0 1.6" stroke="#fff" strokeWidth="1.2" fill="none" opacity=".7"/>
          </svg>
          Gmail — Coming soon
        </button>
      </div>
    </div>
  );
}

export function NativeToolsList({ otherTools }) {
  return (
    <div>
      <div className="text-xs font-semibold text-blue-400 mb-1.5 pl-1 flex items-center gap-1.5">
        <Lock size={12} /> Native Tools
        <span className="th-text-ghost font-normal ml-1">(managed by template)</span>
      </div>
      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-1">
        <div className="space-y-1 p-2">
          {otherTools.map((toolPath) => {
            const toolShortName = toolPath.split(".").pop() || toolPath;
            const displayName = toolShortName.replace(/^tool_/, "").replace(/_/g, " ");
            return (
              <div key={toolPath} className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <Lock size={14} className="text-blue-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold th-text truncate capitalize" title={displayName}>
                      {displayName}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-semibold uppercase tracking-wider">
                      native
                    </span>
                  </div>
                  <div className="text-xs th-text-faint mt-0.5 truncate" title={toolPath}>
                    {toolPath}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
