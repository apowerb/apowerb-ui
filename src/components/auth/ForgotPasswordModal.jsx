"use client";

import { useTranslations } from "use-intl";
import { useState, useEffect } from "react";
import { X, Mail, Loader2, CheckCircle, ArrowLeft } from "lucide-react";
import { authApi } from "@/lib/authStorage";
import { useFocusTrap } from "@/hooks/useFocusTrap";

export default function ForgotPasswordModal({ onClose, onBackToLogin }) {
  const t = useTranslations("ForgotPasswordModal");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
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
    setError("");

    if (!email.trim()) {
      setError(t("emailRequired"));
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(t("invalidEmailFormat"));
      return;
    }

    setIsLoading(true);

    try {
      await authApi.requestPasswordReset(email);
      setIsSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Success state
  if (isSuccess) {
    return (
      <div className="fixed inset-0 z-[40] flex items-center justify-center">
        <div
          className="absolute inset-0 th-bg-overlay backdrop-blur-sm"
          onClick={onClose}
        />

        <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="forgot-password-success-title" className="relative w-full max-w-md mx-4 glass-card rounded-2xl p-6 animate-scale-in">
          <div className="text-center py-4">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-500/20 flex items-center justify-center">
              <CheckCircle size={32} className="text-blue-400" />
            </div>
            <h2 id="forgot-password-success-title" className="text-xl font-bold th-text mb-2">{t("emailSentTitle")}</h2>
            <p className="th-text-faint text-sm mb-6">
              {t("accountExistsPrefix")} <span className="text-brand">{email}</span>{t("accountExistsSuffix")}
            </p>
            <button
              onClick={onBackToLogin}
              className="btn-brand w-full py-3 text-white font-semibold rounded-xl"
            >
              {t("backToSignIn")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[40] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 th-bg-overlay backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="forgot-password-modal-title" className="relative w-full max-w-md mx-4 glass-card rounded-2xl p-6 animate-scale-in">
        {/* Header */}
        <div className="auth-modal-header flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToLogin}
              className="p-2 hover:th-bg-surface-hover rounded-lg transition-colors"
            >
              <ArrowLeft size={20} className="th-text-faint" />
            </button>
            <h2 id="forgot-password-modal-title" className="text-xl font-bold th-text">{t("title")}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:th-bg-surface-hover rounded-lg transition-colors"
          >
            <X size={20} className="th-text-faint" />
          </button>
        </div>

        {/* Description */}
        <p className="th-text-faint text-sm mb-6">
          {t("description")}
        </p>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-sm text-red-200">
            {error}
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
                autoFocus
              />
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
                {t("sending")}
              </>
            ) : (
              t("submit")
            )}
          </button>
        </form>

        {/* Back to login */}
        <div className="mt-6 text-center">
          <button
            onClick={onBackToLogin}
            className="text-sm th-text-muted hover:th-text-secondary"
          >
            {t("backToSignIn")}
          </button>
        </div>
      </div>
    </div>
  );
}
