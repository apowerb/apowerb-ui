"use client";

import { useCallback, useRef, useEffect } from "react";

const PROVIDER_FAMILY = {
  google_drive:        { family: "google",    service: "google_drive",    connectPath: "/google/connect",                callbackPath: "/integrations/google/callback" },
  google_gmail:        { family: "google",    service: "google_gmail",    connectPath: "/google/connect",                callbackPath: "/integrations/google/callback" },
  google_calendar:     { family: "google",    service: "google_calendar", connectPath: "/google/connect",                callbackPath: "/integrations/google/callback" },
  google_sheets:       { family: "google",    service: "google_sheets",   connectPath: "/google/connect",                callbackPath: "/integrations/google/callback" },
  google_docs:         { family: "google",    service: "google_docs",     connectPath: "/google/connect",                callbackPath: "/integrations/google/callback" },
  microsoft_outlook:   { family: "microsoft", service: "outlook",         connectPath: "/microsoft/outlook/connect",     callbackPath: "/integrations/microsoft/callback" },
  microsoft_teams:     { family: "microsoft", service: "teams",           connectPath: "/microsoft/teams/connect",       callbackPath: "/integrations/microsoft/callback" },
  microsoft_onedrive:  { family: "microsoft", service: "onedrive",        connectPath: "/microsoft/onedrive/connect",    callbackPath: "/integrations/microsoft/callback" },
  microsoft_sharepoint:{ family: "microsoft", service: "sharepoint",      connectPath: "/microsoft/sharepoint/connect",  callbackPath: "/integrations/microsoft/callback" },
  github:              { family: "github",    service: "github",          connectPath: "/github/connect",                callbackPath: "/integrations/github/callback" },
  odoo:                { family: "odoo",      service: "odoo",            connectPath: null,                             callbackPath: null },
};

export function useOAuthPopup({ onSuccess, onFailure, onCancel }) {
  const popupRef = useRef(null);
  const pollRef = useRef(null);

  const cleanup = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "integration_connected") return;

      cleanup();
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
      popupRef.current = null;

      if (event.data.success) {
        onSuccess?.(event.data.provider);
      } else {
        onFailure?.(event.data.error || "unknown_error");
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
      cleanup();
    };
  }, [onSuccess, onFailure, cleanup]);

  const openOAuth = useCallback(
    async (provider) => {
      const config = PROVIDER_FAMILY[provider];

      if (!config || config.connectPath === null) {
        onFailure?.("odoo_not_supported");
        return;
      }

      const left = Math.max(0, (window.screen.width - 500) / 2);
      const top = Math.max(0, (window.screen.height - 700) / 2);
      const popup = window.open(
        "about:blank",
        "oauth_popup",
        `width=500,height=700,left=${left},top=${top}`
      );

      if (!popup || popup.closed) {
        onFailure?.("popup_blocked");
        return;
      }

      popupRef.current = popup;

      try {
        const token = localStorage.getItem("th2_auth_token");
        const callbackUrl = `${window.location.origin}${config.callbackPath}`;
        const separator = config.connectPath.includes("?") ? "&" : "?";
        const fetchUrl = `/api/integrations${config.connectPath}${separator}service=${config.service}&redirect_uri=${encodeURIComponent(callbackUrl)}`;

        const res = await fetch(fetchUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "OAuth initiation failed");

        if (config.family === "google") {
          localStorage.setItem("google_oauth_service", config.service);
        }

        if (config.family === "microsoft") {
          // Use localStorage (not sessionStorage) so the popup window can read it
          localStorage.setItem(
            "microsoft_oauth_pending",
            JSON.stringify({ state: data.state, service: config.service })
          );
        }

        popup.location.href = data.url;
      } catch (err) {
        if (popup && !popup.closed) popup.close();
        popupRef.current = null;
        onFailure?.(err.message || "oauth_error");
        return;
      }

      pollRef.current = setInterval(() => {
        if (popupRef.current && popupRef.current.closed) {
          cleanup();
          popupRef.current = null;
          onCancel?.(provider);
        }
      }, 500);
    },
    [onFailure, onCancel, cleanup]
  );

  return { openOAuth };
}
