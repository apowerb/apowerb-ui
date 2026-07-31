"use client";

import { X, Copy, Check, Cable, Terminal } from "lucide-react";
import { useState, useEffect } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

const TABS = [
  { id: "python", label: "Python", icon: "py" },
  { id: "curl", label: "cURL", icon: null },
];

export default function ConnectSnippetModal({ show, agent, onClose }) {
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState("python");
  const modalRef = useFocusTrap(show && !!agent);

  useEffect(() => {
    function handleEscape(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  if (!show || !agent) return null;

  const agentId = agent.agent_id != null ? String(agent.agent_id) : agent.id;
  const agentName = agent.label || agent.id;

  const pythonSnippet = `import requests
import uuid

# API Configuration
api_url = "https://api-agent-dev.thaink2.fr/api/adk/run"

# JWT Token (obtain from /api/auth/login)
jwt_token = "<YOUR_JWT_TOKEN>"

# Prepare headers with Bearer token
headers = {
    "Authorization": f"Bearer {jwt_token}",
    "Content-Type": "application/json",
    "Accept": "application/json"
}

# Prepare payload
payload = {
    "agent_name": "${agentName}",
    "user_id": "<YOUR_EMAIL>",
    "session_id": str(uuid.uuid4()),
    "new_message": {
        "role": "user",
        "parts": [{"text": "Hello, what can you do?"}]
    }
}

# Send request
response = requests.post(api_url, headers=headers, json=payload)
print(response.status_code)
print(response.json())`;

  const curlSnippet = `curl -X POST "https://api-agent-dev.thaink2.fr/api/adk/run" \\
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json" \\
  -d '{
    "agent_name": "${agentName}",
    "user_id": "<YOUR_EMAIL>",
    "session_id": "sess_unique_id",
    "new_message": {
        "role": "user",
        "parts": [{"text": "Hello, what can you do?"}]
    }
}'`;

  const snippet = tab === "python" ? pythonSnippet : curlSnippet;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const gradient = "from-blue-400/80 to-blue-600/80";

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[40] perspective-1000"
      onClick={onClose}
    >
      <div className="absolute inset-0 th-bg-overlay backdrop-blur-md animate-fade-in" />

      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="connect-snippet-modal-title"
        className="relative w-full max-w-2xl mx-4 animate-scale-up-center max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`absolute -inset-1 bg-linear-to-r ${gradient} rounded-2xl blur-lg opacity-40 animate-breathe`}
        />

        <div className="relative flex flex-col glass-modal rounded-2xl shadow-2xl overflow-hidden h-full">
          {/* Header */}
          <div
            className={`shrink-0 h-24 bg-linear-to-br ${gradient} p-6 relative overflow-hidden`}
          >
            <div className="absolute inset-0 overflow-hidden rounded-t-2xl">
              <div className="absolute -right-20 -top-20 w-60 h-60 bg-white/5 rotate-45" />
            </div>

            <div className="relative flex justify-between items-start z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 backdrop-blur-md rounded-xl border border-white/20 shadow-lg">
                  <Cable size={24} className="text-white" />
                </div>
                <div>
                  <h2 id="connect-snippet-modal-title" className="text-2xl font-black text-white tracking-tight drop-shadow-md">
                    Connect to {agentName}
                  </h2>
                  <p className="text-white/70 text-sm font-medium">
                    API integration template
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="bg-white/20 hover:bg-black/40 text-white/80 hover:text-white p-2 rounded-full transition-all backdrop-blur-sm border border-white/20 ring-1 ring-transparent hover:ring-white/20"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Tabs + Copy */}
          <div className="shrink-0 flex items-center justify-between px-4 pt-3 pb-0">
            <div className="flex gap-1">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setTab(t.id); setCopied(false); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    tab === t.id
                      ? "th-bg-surface-hover th-text border th-border-hover"
                      : "th-text-faint hover:th-text-secondary hover:th-bg-surface border border-transparent"
                  }`}
                >
                  {t.id === "curl" && <Terminal size={12} className="inline mr-1.5 -mt-0.5" />}
                  {t.label}
                </button>
              ))}
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold th-bg-surface hover:th-bg-surface-hover th-text-secondary hover:th-text border th-border transition-all backdrop-blur-sm"
            >
              {copied ? (
                <>
                  <Check size={12} className="text-blue-400" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy size={12} />
                  Copy
                </>
              )}
            </button>
          </div>

          {/* Code snippet */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <pre className="p-5 text-xs th-text-secondary font-mono leading-relaxed overflow-x-auto whitespace-pre">
              {snippet}
            </pre>
          </div>

          {/* Footer */}
          <div className="shrink-0 p-4 th-bg-surface border-t th-border-secondary flex items-center justify-between">
            <p className="text-[10px] th-text-ghost">
              Agent ID: {agentId} &middot; Model: {agent.agent_model || "default"}
            </p>
            <button
              onClick={onClose}
              className="glass-btn px-4 py-2 border th-border th-text-secondary rounded-xl hover:th-bg-surface hover:th-text font-semibold transition-all text-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
