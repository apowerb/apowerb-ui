"use client";

import { useEffect, useState } from "react";

export default function OutlookCallbackPage() {
  const [status, setStatus] = useState(() => {
    if (typeof window === 'undefined') return "loading";
    const params = new URLSearchParams(window.location.search);
    return params.get("code") ? "loading" : "error";
  });
  const [errorMessage, setErrorMessage] = useState(() => {
    if (typeof window === 'undefined') return "";
    const params = new URLSearchParams(window.location.search);
    return params.get("code") ? "" : "Missing 'code' parameter in callback URL.";
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");

    if (!code) return;

    const token = localStorage.getItem("th2_auth_token");

    fetch("/api/emailing/microsoft/callback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ code, state: state || "" }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.detail || `Error ${res.status}`);
        }
        return data;
      })
      .then((data) => {
        setStatus("success");
        // Notify the parent window (AgentModal) that Outlook is connected
        if (window.opener) {
          window.opener.postMessage(
            {
              type: "outlook-connected",
              success: true,
              tool_config_id: data.tool_config_id || null,
            },
            "*",
          );
        }
        // Auto-close after a short delay
        setTimeout(() => {
          window.close();
        }, 1500);
      })
      .catch((err) => {
        setStatus("error");
        setErrorMessage(err.message || "An error occurred.");
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center th-bg-body">
      <div className="max-w-md w-full mx-4 p-8 th-bg-surface backdrop-blur-xl border th-border rounded-2xl shadow-2xl text-center">
        {status === "loading" && (
          <>
            <div className="mx-auto w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-4" />
            <h1 className="text-xl font-bold th-text mb-2">
              Connecting...
            </h1>
            <p className="text-sm th-text-muted">
              Finalizing connection with Microsoft Outlook.
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="mx-auto w-14 h-14 flex items-center justify-center rounded-full bg-blue-500/20 border border-blue-500/30 mb-4">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-blue-400"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <h1 className="text-xl font-bold th-text mb-2">
              Outlook connected!
            </h1>
            <p className="text-sm th-text-muted">
              This window will close automatically.
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="mx-auto w-14 h-14 flex items-center justify-center rounded-full bg-red-500/20 border border-red-500/30 mb-4">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-red-400"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </div>
            <h1 className="text-xl font-bold th-text mb-2">
              Connection error
            </h1>
            <p className="text-sm text-red-400/80 mb-4">{errorMessage}</p>
            <button
              onClick={() => window.close()}
              className="px-6 py-2 th-bg-surface hover:th-bg-surface-hover th-text-secondary rounded-lg text-sm font-medium transition-colors border th-border"
            >
              Close
            </button>
          </>
        )}
      </div>
    </div>
  );
}
