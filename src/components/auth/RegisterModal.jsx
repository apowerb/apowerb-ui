"use client";

import { useTranslations } from "use-intl";
import { useState, useEffect } from "react";
import { X, Mail, Lock, User, Loader2, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { authApi } from "@/lib/authStorage";
import { useFocusTrap } from "@/hooks/useFocusTrap";

export default function RegisterModal({ onClose, onSwitchToLogin }) {
  const t = useTranslations("RegisterModal");
  const [formData, setFormData] = useState({
    email: "",
    username: "",
    firstName: "",
    lastName: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState("");
  const [verificationEmail, setVerificationEmail] = useState(null);

  const { register, isLoading, error } = useAuth();
  const modalRef = useFocusTrap(true);

  useEffect(() => {
    function handleEscape(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError("");

    // Validation
    if (!formData.email.trim()) {
      setLocalError(t("emailRequired"));
      return;
    }
    if (!formData.username.trim()) {
      setLocalError(t("usernameRequired"));
      return;
    }
    if (!formData.password) {
      setLocalError(t("passwordRequired"));
      return;
    }
    if (formData.password.length < 6) {
      setLocalError(t("passwordMinLength"));
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setLocalError(t("passwordMismatch"));
      return;
    }

    try {
      const result = await register({
        email: formData.email,
        username: formData.username,
        firstName: formData.firstName,
        lastName: formData.lastName,
        password: formData.password,
      });
      if (result?.needsVerification) {
        setVerificationEmail(result.email);
        return;
      }
      onClose();
    } catch (err) {
      // Error is handled by context
    }
  };

  const displayError = localError || error;

  if (verificationEmail) {
    return (
      <div className="fixed inset-0 z-[40] flex items-center justify-center">
        <div className="absolute inset-0 th-bg-overlay backdrop-blur-sm" onClick={onClose} />
        <div ref={modalRef} role="dialog" aria-modal="true" className="relative w-full max-w-md mx-4 glass-card rounded-2xl p-6 animate-scale-in text-center">
          <div className="flex justify-center mb-4">
            <Mail size={40} className="text-blue-400" />
          </div>
          <h2 className="text-xl font-bold th-text mb-2">{t("checkInboxTitle")}</h2>
          <p className="th-text-secondary text-sm mb-6">
            {t("verificationSentPrefix")} <strong>{verificationEmail}</strong>. {t("verificationSentSuffix")}
          </p>
          <button
            type="button"
            onClick={() => authApi.resendVerification(verificationEmail)}
            className="text-sm text-blue-400 hover:underline mb-4 block w-full"
          >
            {t("resendEmail")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white transition-colors"
          >
            {t("close")}
          </button>
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
      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="register-modal-title" className="relative w-full max-w-md mx-4 glass-card rounded-2xl p-6 animate-scale-in max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="auth-modal-header flex items-center justify-between mb-6">
          <h2 id="register-modal-title" className="text-xl font-bold th-text">{t("title")}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:th-bg-surface-hover rounded-lg transition-colors"
          >
            <X size={20} className="th-text-faint" />
          </button>
        </div>

        {/* Error message */}
        {displayError && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-sm text-red-200">
            {displayError}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium th-text-secondary mb-2">
              {t("emailLabel")} <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Mail
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 th-text-faint"
              />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder={t("emailPlaceholder")}
                className="w-full glass-input pl-10 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500/50"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-medium th-text-secondary mb-2">
              {t("usernameLabel")} <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <User
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 th-text-faint"
              />
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder={t("usernamePlaceholder")}
                className="w-full glass-input pl-10 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500/50"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* First name & Last name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium th-text-secondary mb-2">
                {t("firstNameLabel")}
              </label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder={t("firstNamePlaceholder")}
                className="w-full glass-input px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500/50"
                disabled={isLoading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium th-text-secondary mb-2">
                {t("lastNameLabel")}
              </label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                placeholder={t("lastNamePlaceholder")}
                className="w-full glass-input px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500/50"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium th-text-secondary mb-2">
              {t("passwordLabel")} <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Lock
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 th-text-faint"
              />
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
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
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium th-text-secondary mb-2">
              {t("confirmPasswordLabel")} <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Lock
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 th-text-faint"
              />
              <input
                type={showPassword ? "text" : "password"}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder={t("confirmPasswordPlaceholder")}
                className="w-full glass-input pl-10 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500/50"
                disabled={isLoading}
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
                {t("creating")}
              </>
            ) : (
              t("submit")
            )}
          </button>
        </form>

        {/* Switch to login */}
        <div className="mt-6 text-center">
          <p className="text-sm th-text-muted">
            {t("alreadyHaveAccount")}{" "}
            <button
              onClick={onSwitchToLogin}
              className="text-brand hover:text-blue-300 font-medium"
            >
              {t("signIn")}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
