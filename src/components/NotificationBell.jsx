"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "@/lib/navigation";
import { useTranslations } from "use-intl";
import {
  Bell,
  Webhook,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  Loader2,
} from "lucide-react";
import {
  getUnreadNotificationCount,
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/api";
import { formatDate as formatDateParis } from "@/lib/datetime";

const POLL_INTERVAL = 30_000; // 30s fallback if SSE fails

/** Map notification type to icon + color (semantic palette) */
function typeIcon(type) {
  switch (type) {
    case "webhook":
      return { Icon: Webhook, color: "text-purple-400" };
    case "error":
      return { Icon: AlertTriangle, color: "text-red-400" };
    case "warning":
      return { Icon: AlertTriangle, color: "text-amber-400" };
    case "success":
      return { Icon: CheckCircle2, color: "text-green-400" };
    default:
      return { Icon: Info, color: "text-blue-400" };
  }
}

/** Human-readable relative time. `t` must be a NotificationBell translator. */
function relativeTime(isoOrTs, t) {
  if (!isoOrTs) return "";
  const date = typeof isoOrTs === "number" ? new Date(isoOrTs) : new Date(isoOrTs);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return t("justNow");
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return t("minAgo", { count: diffMin });
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return t("hAgo", { count: diffH });
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return t("dAgo", { count: diffD });
  return formatDateParis(isoOrTs);
}

export default function NotificationBell({ collapsed = false }) {
  const t = useTranslations("NotificationBell");
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [panelPos, setPanelPos] = useState(null);
  const panelRef = useRef(null);
  const bellRef = useRef(null);

  // Poll unread count (initial + fallback)
  const fetchUnreadCount = useCallback(async () => {
    try {
      const data = await getUnreadNotificationCount();
      setUnreadCount(data.count ?? 0);
    } catch {
      // Silently fail — backend may not be ready yet
    }
  }, []);

  // SSE real-time stream with polling fallback
  useEffect(() => {
    fetchUnreadCount();

    let eventSource = null;
    let pollTimer = null;
    let reconnectTimer = null;

    function connectSSE() {
      const token = typeof window !== "undefined"
        ? JSON.parse(localStorage.getItem("th2_auth") || "{}")?.token
        : null;
      if (!token) {
        // No token — fall back to polling
        pollTimer = setInterval(fetchUnreadCount, POLL_INTERVAL);
        return;
      }

      // Use fetch-based EventSource since native doesn't support auth headers
      // We use the proxy which forwards the auth header from cookie/header
      // But native EventSource can't send headers, so use fetch streaming
      const controller = new AbortController();

      (async () => {
        try {
          const res = await fetch("/api/notifications/stream", {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          });
          if (!res.ok || !res.body) throw new Error("SSE failed");

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            // Parse SSE events from buffer
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const payload = JSON.parse(line.slice(6));
                  // New notification arrived — update state
                  setUnreadCount((c) => c + 1);
                  setNotifications((prev) => [payload, ...prev]);
                } catch {
                  // ignore parse errors
                }
              }
            }
          }
        } catch (err) {
          if (err.name === "AbortError") return;
          // SSE disconnected — fall back to polling, retry SSE later
          pollTimer = setInterval(fetchUnreadCount, POLL_INTERVAL);
          reconnectTimer = setTimeout(() => {
            clearInterval(pollTimer);
            connectSSE();
          }, 15_000);
        }
      })();

      eventSource = controller;
    }

    connectSSE();

    return () => {
      eventSource?.abort();
      clearInterval(pollTimer);
      clearTimeout(reconnectTimer);
    };
  }, [fetchUnreadCount]);

  // Load full list when opening the dropdown
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listNotifications({ limit: 30 });
      setNotifications(data.notifications ?? []);
      setHasLoaded(true);
    } catch {
      // keep whatever we had
    } finally {
      setLoading(false);
    }
  }, []);

  const handleToggle = useCallback(() => {
    const willOpen = !isOpen;
    setIsOpen(willOpen);
    if (willOpen) {
      fetchNotifications();
      // Calculate panel position from the bell button
      if (bellRef.current) {
        const rect = bellRef.current.getBoundingClientRect();
        setPanelPos({
          left: rect.right + 8,
          bottom: window.innerHeight - rect.bottom,
        });
      }
    }
  }, [isOpen, fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target) &&
        bellRef.current &&
        !bellRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen]);

  // Click on a notification
  const handleNotificationClick = useCallback(
    async (notif) => {
      // Mark as read optimistically
      if (!notif.is_read) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
        try {
          await markNotificationRead(notif.id);
        } catch {
          // revert on error
          setNotifications((prev) =>
            prev.map((n) => (n.id === notif.id ? { ...n, is_read: false } : n))
          );
          setUnreadCount((c) => c + 1);
        }
      }

      setIsOpen(false);

      // Navigate to the link
      if (notif.link) {
        router.push(notif.link);
      }
    },
    [router]
  );

  // Mark all read
  const handleMarkAllRead = useCallback(async () => {
    const previousNotifications = notifications;
    const previousCount = unreadCount;

    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);

    try {
      await markAllNotificationsRead();
    } catch {
      // Revert
      setNotifications(previousNotifications);
      setUnreadCount(previousCount);
    }
  }, [notifications, unreadCount]);

  const hasUnread = unreadCount > 0;

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={bellRef}
        onClick={handleToggle}
        title={t("notificationsTitle")}
        className={`
          relative p-2 rounded-xl transition-all duration-200
          hover:th-bg-surface-hover
          ${isOpen ? "th-bg-surface" : ""}
        `}
      >
        <Bell
          size={22}
          className={`transition-colors ${hasUnread ? "text-blue-400" : "th-text-faint"}`}
        />
        {/* Unread badge */}
        {hasUnread && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-purple-500 rounded-full shadow-sm shadow-purple-500/30 animate-fade-in">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel — fixed position, to the right of the bell */}
      {isOpen && panelPos && (
        <div
          ref={panelRef}
          className="fixed w-80 max-h-[28rem] flex flex-col border th-border rounded-2xl shadow-2xl z-50 animate-fade-in notification-panel"
          style={{ left: panelPos.left, bottom: panelPos.bottom, transform: "none" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b th-border-secondary">
            <h3 className="text-sm font-semibold th-text">{t("notificationsTitle")}</h3>
            <div className="flex items-center gap-2">
              {hasUnread && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {t("markAllRead")}
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg hover:th-bg-surface-hover transition-colors"
              >
                <X size={14} className="th-text-faint" />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {loading && !hasLoaded ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="animate-spin text-blue-400" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <Bell size={28} className="th-text-ghost mb-2" />
                <p className="text-sm th-text-faint">{t("noNotifications")}</p>
              </div>
            ) : (
              <ul>
                {notifications.map((notif) => {
                  const { Icon, color } = typeIcon(notif.type);
                  return (
                    <li key={notif.id}>
                      <button
                        onClick={() => handleNotificationClick(notif)}
                        className={`
                          w-full flex items-start gap-3 px-4 py-3 text-left
                          transition-colors hover:th-bg-surface-hover
                          ${!notif.is_read ? "border-l-2 border-blue-500" : "border-l-2 border-transparent"}
                        `}
                      >
                        <div className={`shrink-0 mt-0.5 ${color}`}>
                          <Icon size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm truncate ${
                              notif.is_read ? "th-text-secondary" : "th-text font-medium"
                            }`}
                          >
                            {notif.title}
                          </p>
                          <p className="text-xs th-text-faint line-clamp-2 mt-0.5">
                            {notif.message}
                          </p>
                          <p className="text-[11px] th-text-ghost mt-1">
                            {relativeTime(notif.created_at, t)}
                          </p>
                        </div>
                        {!notif.is_read && (
                          <span className="shrink-0 mt-1.5 w-2 h-2 rounded-full bg-blue-500" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
