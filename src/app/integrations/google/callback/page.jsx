"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "use-intl";

const SERVICE_LABELS = {
  google_drive: "Google Drive",
  google_gmail: "Gmail",
  google_calendar: "Google Calendar",
  google_sheets: "Google Sheets",
  google_docs: "Google Docs",
};

export default function GoogleIntegrationCallbackPage() {
  const t = useTranslations("GoogleIntegrationCallbackPage");
  const hasFired = useRef(false);

  const [status, setStatus] = useState(() => {
    if (typeof window === 'undefined') return "loading";
    const params = new URLSearchParams(window.location.search);
    return params.get("code") ? "loading" : "error";
  });
  const [errorMessage, setErrorMessage] = useState(() => {
    if (typeof window === 'undefined') return "";
    const params = new URLSearchParams(window.location.search);
    return params.get("code") ? "" : t("missingCodeParam");
  });
  const [username, setUsername] = useState("");
  const [serviceLabel, setServiceLabel] = useState(() => {
    if (typeof window === 'undefined') return "Google";
    const service = localStorage.getItem("google_oauth_service") || "google_drive";
    return SERVICE_LABELS[service] || "Google";
  });

  useEffect(() => {
    // Guard against React StrictMode double-invocation and any other
    // re-renders — the OAuth code is single-use and must only be exchanged once.
    if (hasFired.current) return;
    hasFired.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");

    const service = localStorage.getItem("google_oauth_service") || "google_drive";
    localStorage.removeItem("google_oauth_service");

    if (!code) return;

    const token = localStorage.getItem("th2_auth_token");

    fetch("/api/integrations/google/callback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        code,
        state: state || "",
        service,
        redirect_uri: window.location.origin + "/integrations/google/callback",
      }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || `Error ${res.status}`);
        return data;
      })
      .then((data) => {
        setUsername(data.email || data.username || "");
        setStatus("success");
        if (window.opener) {
          window.opener.postMessage(
            { type: "integration_connected", provider: service, success: true },
            window.location.origin
          );
          window.close();
          return;
        }
        setTimeout(() => { window.location.href = "/integrations"; }, 2000);
      })
      .catch((err) => {
        setStatus("error");
        setErrorMessage(err.message || t("genericError"));
        if (window.opener) {
          window.opener.postMessage(
            { type: "integration_connected", provider: service, success: false, error: err.message },
            window.location.origin
          );
          window.close();
          return;
        }
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center th-bg-body">
      <div className="max-w-md w-full mx-4 p-8 th-bg-surface backdrop-blur-xl border th-border rounded-2xl shadow-2xl text-center">

        {status === "loading" && (
          <>
            <div className="mx-auto w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-4" />
            <h1 className="text-xl font-bold th-text mb-2">{t("connecting", { service: serviceLabel })}</h1>
            <p className="text-sm th-text-muted">{t("finalising", { service: serviceLabel })}</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="mx-auto w-14 h-14 flex items-center justify-center rounded-full bg-blue-500/20 border border-blue-500/30 mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <h1 className="text-xl font-bold th-text mb-2">{t("connected", { service: serviceLabel })}</h1>
            {username && (
              <p className="text-sm th-text-secondary mb-2">
                {t("signedInAs")} <span className="th-text font-medium">{username}</span>
              </p>
            )}
            <p className="text-sm th-text-faint">{t("redirecting")}</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="mx-auto w-14 h-14 flex items-center justify-center rounded-full bg-red-500/20 border border-red-500/30 mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </div>
            <h1 className="text-xl font-bold th-text mb-2">{t("connectionFailed")}</h1>
            <p className="text-sm text-red-400/80 mb-4">{errorMessage}</p>
            <button
              onClick={() => window.location.href = "/integrations"}
              className="px-6 py-2 th-bg-elevated hover:opacity-80 th-text-secondary rounded-lg text-sm font-medium transition-colors border th-border"
            >
              {t("backToIntegrations")}
            </button>
          </>
        )}

      </div>
    </div>
  );
}