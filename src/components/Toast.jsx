"use client";

import { createContext, useContext, useState, useCallback, useRef, useMemo } from "react";
import { useTranslations } from "use-intl";
import { X, AlertCircle, CheckCircle, Info, AlertTriangle, Copy, Check } from "lucide-react";

const ToastContext = createContext(null);

const TOAST_TYPES = {
  error: {
    icon: AlertCircle,
    bg: "from-red-500/20 to-red-600/20",
    border: "border-red-500/40",
    iconColor: "text-red-500",
  },
  success: {
    icon: CheckCircle,
    bg: "from-green-500/20 to-green-600/20",
    border: "border-green-500/40",
    iconColor: "text-green-500",
  },
  warning: {
    icon: AlertTriangle,
    bg: "from-amber-400/20 to-amber-500/20",
    border: "border-amber-500/40",
    iconColor: "text-amber-500",
  },
  info: {
    icon: Info,
    bg: "from-blue-500/20 to-brand/20",
    border: "border-brand/40",
    iconColor: "text-brand",
  },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback(
    (message, type = "info", duration = 4000, action = null) => {
      const id = Date.now();
      setToasts((prev) => [...prev, { id, message, type, action }]);

      if (duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
      }

      return id;
    },
    [],
  );

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useMemo(() => ({
    show: (message, type, duration, action) =>
      addToast(message, type, duration, action),
    error: (message, duration, action) =>
      addToast(message, "error", duration, action),
    success: (message, duration, action) =>
      addToast(message, "success", duration, action),
    warning: (message, duration, action) =>
      addToast(message, "warning", duration, action),
    info: (message, duration, action) =>
      addToast(message, "info", duration, action),
  }), [addToast]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

function ToastContainer({ toasts, onRemove }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[50] flex flex-col gap-2 max-w-md">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onRemove }) {
  const t = useTranslations("Toast");
  const config = TOAST_TYPES[toast.type] || TOAST_TYPES.info;
  const Icon = config.icon;
  const [copied, setCopied] = useState(false);
  const copyTimeout = useRef(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(toast.message);
      setCopied(true);
      clearTimeout(copyTimeout.current);
      copyTimeout.current = setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`
        flex flex-col gap-2 p-4 rounded-xl
        bg-linear-to-r ${config.bg}
        border ${config.border}
        backdrop-blur-xl shadow-lg
        animate-slide-up
      `}
    >
      <div className="flex items-start gap-3">
        <Icon size={20} className={`shrink-0 mt-0.5 ${config.iconColor}`} />
        <p className="text-sm th-text-secondary min-w-0 break-words flex-1">{toast.message}</p>
        <button
          onClick={() => onRemove(toast.id)}
          className="p-1 hover:th-bg-surface-hover rounded-lg transition-colors shrink-0"
        >
          <X size={14} className="th-text-muted" />
        </button>
      </div>
      {(toast.type === "error" || toast.action) && (
        <div className="flex items-center gap-2 ml-8">
          {toast.type === "error" && (
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg hover:th-bg-surface-hover transition-colors text-red-300 hover:text-red-200"
              title={t("copyError")}
            >
              {copied ? (
                <>
                  <Check size={14} className="text-blue-400" />
                  <span className="text-blue-400">{t("copied")}</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>{t("copy")}</span>
                </>
              )}
            </button>
          )}
          {toast.action && (
            <button
              onClick={() => {
                toast.action.onClick();
                onRemove(toast.id);
              }}
              className="text-xs font-semibold px-3 py-1 th-bg-surface hover:th-bg-surface-hover rounded-md transition-colors"
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
