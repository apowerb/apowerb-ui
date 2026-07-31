"use client";

import { useTranslations } from "use-intl";
import { useState, useEffect } from "react";
import { X, Mail, Lock, Loader2, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { authApi } from "@/lib/authStorage";
import { useFocusTrap } from "@/hooks/useFocusTrap";

// Pair with AUTH_REGISTER_ENABLED=false on the backend. When this flag is
// on, the "Don't have an account?" link below is hidden so the modal can
// only be used to log in.
const _AUTH_SIGNUP_DISABLED = (process.env.NEXT_PUBLIC_AUTH_DISABLE_SIGNUP || "").toLowerCase() === "true";

export default function LoginModal({ onClose, onSwitchToRegister, onForgotPassword }) {
  const t = useTranslations("LoginModal");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState("");
  const [unverifiedEmail, setUnverifiedEmail] = useState(null);
  const [resendNote, setResendNote] = useState("");

  const { login, isLoading, error } = useAuth();
  const modalRef = useFocusTrap(true);

  useEffect(() => {
    function handleEscape(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError("");
    setUnverifiedEmail(null);
    setResendNote("");

    if (!email.trim()) {
      setLocalError(t("emailRequired"));
      return;
    }
    if (!password) {
      setLocalError(t("passwordRequired"));
      return;
    }

    try {
      const result = await login(email, password);
      // Un defi reste a relever : ne pas fermer, la brique le rend.
      if (result?.mfaRequired) return;
      onClose();
    } catch (err) {
      if (err.code === "email_not_verified") {
        setUnverifiedEmail(email);
      }
      // Error is handled by context
    }
  };

  const displayError = localError || error;

  return (
    <div className="fixed inset-0 z-[40] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 th-bg-overlay backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="login-modal-title" className="relative w-full max-w-md mx-4 glass-card rounded-2xl p-6 animate-scale-in">
        {/* Header */}
        <div className="auth-modal-header flex items-center justify-between mb-6">
          <h2 id="login-modal-title" className="text-xl font-bold th-text">{t("title")}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:th-bg-surface-hover rounded-lg transition-colors"
          >
            <X size={20} className="th-text-faint" />
          </button>
        </div>

        {/* Error message */}
        {displayError && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-sm text-red-200 dark:text-red-200">
            {displayError}
          </div>
        )}
        {unverifiedEmail && (
          <div className="mb-4 text-sm th-text-secondary">
            <button
              type="button"
              onClick={async () => {
                await authApi.resendVerification(unverifiedEmail);
                setResendNote(t("resendConfirmationSent"));
              }}
              className="text-blue-400 hover:underline"
            >
              {t("resendConfirmationEmail")}
            </button>
            {resendNote && <span className="block mt-1 text-green-400">{resendNote}</span>}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium th-text-secondary mb-2">
              {t("emailLabel")}
            </label>
            <div className="relative">
              <Mail
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 th-text-faint"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("emailPlaceholder")}
                className="w-full glass-input pl-10 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500/50"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium th-text-secondary mb-2">
              {t("passwordLabel")}
            </label>
            <div className="relative">
              <Lock
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 th-text-faint"
              />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("passwordPlaceholder")}
                className="w-full glass-input pl-10 pr-12 py-3 rounded-xl focus:ring-2 focus:ring-blue-500/50"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 th-text-faint hover:th-text-secondary"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {/* Forgot password link */}
            <div className="text-right mt-1">
              <button
                type="button"
                onClick={onForgotPassword}
                className="text-xs text-brand hover:text-blue-300"
              >
                {t("forgotPassword")}
              </button>
            </div>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={isLoading}
            className="btn-brand w-full py-3 text-white font-semibold rounded-xl flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                {t("signingIn")}
              </>
            ) : (
              t("submit")
            )}
          </button>
        </form>

        {/* Switch to register — hidden when NEXT_PUBLIC_AUTH_DISABLE_SIGNUP=true */}
        {!_AUTH_SIGNUP_DISABLED && (
          <div className="mt-6 text-center">
            <p className="text-sm th-text-muted">
              {t("noAccount")}{" "}
              <button
                onClick={onSwitchToRegister}
                className="text-brand hover:text-blue-300 font-medium"
              >
                {t("createAccount")}
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
