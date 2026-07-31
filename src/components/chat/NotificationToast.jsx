"use client";

import { useEffect, useState } from "react";
import { X, CheckCircle2, AlertCircle, Loader2, Info } from "lucide-react";
import EntityJumpButton from "@/components/EntityJumpButton";

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  loading: Loader2,
  info: Info,
};

const COLORS = {
  success: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  error: "border-red-500/30 bg-red-500/10 text-red-300",
  loading: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  info: "th-border-secondary th-bg-surface th-text-secondary",
};

function Toast({ notification, onDismiss }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    if (notification.autoDismiss !== false) {
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(() => onDismiss(notification.id), 300);
      }, notification.duration || 5000);
      return () => clearTimeout(timer);
    }
  }, [notification, onDismiss]);

  const type = notification.type || "info";
  const Icon = ICONS[type];

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border shadow-lg transition-all duration-300 ${COLORS[type]} ${
        visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
      }`}
    >
      <Icon size={16} className={`shrink-0 ${type === "loading" ? "animate-spin" : ""}`} />
      <div className="flex-1 min-w-0">
        {notification.title && (
          <p className="text-xs font-medium">{notification.title}</p>
        )}
        <p className="text-[11px] opacity-80 truncate">{notification.message}</p>
      </div>
      {notification.link && (
        <EntityJumpButton
          to={notification.link.to}
          params={notification.link.params}
          href={notification.link.href}
          title={notification.link.title || "Open"}
          size={12}
          className="!p-1"
        />
      )}
      <button
        onClick={() => {
          setVisible(false);
          setTimeout(() => onDismiss(notification.id), 300);
        }}
        className="p-0.5 hover:th-bg-surface-hover rounded transition-colors shrink-0"
      >
        <X size={12} />
      </button>
    </div>
  );
}

export default function NotificationToast({ notifications, onDismiss }) {
  if (!notifications || notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-80">
      {notifications.map((n) => (
        <Toast key={n.id} notification={n} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
