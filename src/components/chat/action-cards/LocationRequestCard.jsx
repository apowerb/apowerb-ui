"use client";

import { useEffect, useId, useState } from "react";
import { MapPin, Check, X, AlertCircle } from "lucide-react";
import { STATUS_STYLES } from "./statusStyles";
import useActionCardSubmit from "./useActionCardSubmit";

const LOCAL_STATUS_STYLES = {
  ...STATUS_STYLES,
  pending: "border-indigo-500/30 bg-indigo-500/5",
};

export default function LocationRequestCard({ card, onRespond, agentName }) {
  // Lazy initializer avoids calling impure APIs during render on the client
  // and keeps SSR safe (we default to "available" until the effect runs).
  const [geoAvailable, setGeoAvailable] = useState(() => {
    if (typeof navigator === "undefined") return false;
    if (!navigator.geolocation) return false;
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      return false;
    }
    return true;
  });
  const [errorMsg, setErrorMsg] = useState(() =>
    // Same logic as geoAvailable — mirror the unavailable path so the user
    // sees an explanation immediately.
    typeof navigator === "undefined" ||
    !navigator.geolocation ||
    (typeof window !== "undefined" && window.isSecureContext === false)
      ? "Geolocation not available in this context"
      : "",
  );
  const { submitting, handleSubmit } = useActionCardSubmit(card);
  const describedById = useId();

  // Keep an effect to re-check if navigator.geolocation appears/disappears
  // (edge case for prerendered HTML hydrating client-side).
  useEffect(() => {
    if (
      typeof navigator !== "undefined" &&
      navigator.geolocation &&
      (typeof window === "undefined" || window.isSecureContext !== false)
    ) {
      setGeoAvailable(true);
      setErrorMsg("");
    }
  }, []);

  if (!card) return null;
  const { data = {}, status } = card;
  const border = LOCAL_STATUS_STYLES[status] || LOCAL_STATUS_STYLES.pending;

  const handleShare = () => {
    if (!geoAvailable) return;
    setErrorMsg("");
    handleSubmit(() =>
      new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            onRespond?.({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
            });
            resolve();
          },
          (err) => {
            const isPermissionDenied =
              err && err.code === (err.PERMISSION_DENIED ?? 1);
            const response = isPermissionDenied
              ? "denied_permission"
              : "unavailable";
            setErrorMsg(
              isPermissionDenied
                ? "Permission denied for geolocation."
                : err?.message || "Location unavailable.",
            );
            onRespond?.(response, {
              sendFollowup: true,
              status: "error",
            });
            resolve();
          },
          { enableHighAccuracy: data.precision === "fine" },
        );
      }),
    );
  };

  const handleCancel = () => {
    handleSubmit(() => onRespond?.("denied", { sendFollowup: false }));
  };

  const promptLine = agentName
    ? `${agentName} requests your location`
    : "This agent requests your location";

  return (
    <div
      role="group"
      aria-label={card.ariaLabel || `Location request from ${agentName || "agent"}`}
      className={`my-3 rounded-xl border overflow-hidden ${border}`}
    >
      <div className="flex items-start gap-3 px-3 py-2.5">
        <span className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30">
          <MapPin size={16} className="text-indigo-300" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold th-text">{promptLine}</p>
          <p id={describedById} className="text-[11px] th-text-muted mt-0.5">
            {data.reason}
          </p>

          {status === "pending" && (
            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={handleShare}
                disabled={!geoAvailable || submitting}
                aria-describedby={describedById}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-300 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <MapPin size={12} />
                Share location
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={submitting}
                aria-describedby={describedById}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg th-bg-surface hover:th-bg-surface-hover border th-border text-xs font-medium th-text-muted transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <X size={12} />
                Cancel
              </button>
            </div>
          )}

          {status === "done" && (
            <p className="text-[11px] text-emerald-400 mt-2 flex items-center gap-1">
              <Check size={12} /> Location shared
            </p>
          )}

          {status === "cancelled" && (
            <p className="text-[11px] th-text-faint mt-2 flex items-center gap-1">
              <X size={12} /> Denied
            </p>
          )}

          {(errorMsg || status === "error") && (
            <p className="flex items-center gap-1 text-[11px] text-red-400 mt-1">
              <AlertCircle size={12} />
              {errorMsg || card.errorMessage || "Location failed"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
