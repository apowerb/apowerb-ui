"use client";

import { useTranslations } from "use-intl";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Camera,
  User,
  Mail,
  Save,
  Loader2,
  Check,
  Trash2,
  Shield,
  ShieldCheck,
  ShieldOff,
  KeyRound,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { authApi } from "@/lib/authStorage";
import Slot from "@/extensions/Slot";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { formatDate as formatDateParis } from "@/lib/datetime";

export default function UserProfileModal({ onClose }) {
  const t = useTranslations("UserProfileModal");
  const { user, token, updateProfile, uploadAvatar, refreshProfile, isLoading } = useAuth();
  const fileInputRef = useRef(null);
  const modalRef = useFocusTrap(true);

  useEffect(() => {
    function handleEscape(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const [formData, setFormData] = useState({
    username: user?.username || "",
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    email: user?.email || "",
  });
  const [localError, setLocalError] = useState("");
  const [success, setSuccess] = useState(false);
  const [uploading, setUploading] = useState(false);

  // MFA states
  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const [showDisableMfa, setShowDisableMfa] = useState(false);
  const [disableCode, setDisableCode] = useState("");
  const [disabling, setDisabling] = useState(false);
  const [mfaError, setMfaError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setSuccess(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError("");
    setSuccess(false);

    if (!formData.username.trim()) {
      setLocalError(t("usernameRequired"));
      return;
    }

    try {
      await updateProfile({
        username: formData.username,
        firstName: formData.firstName,
        lastName: formData.lastName,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setLocalError(err.message);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setLocalError(t("selectImage"));
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setLocalError(t("imageMaxSize"));
      return;
    }

    setUploading(true);
    setLocalError("");

    try {
      await uploadAvatar(file);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      await updateProfile({ avatar: null });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setLocalError(err.message);
    }
  };

  // Get initials for avatar placeholder
  const getInitials = () => {
    const first = user?.firstName?.[0] || user?.username?.[0] || "";
    const last = user?.lastName?.[0] || "";
    return (first + last).toUpperCase() || "?";
  };

  // Handle MFA disable
  const handleDisableMfa = async (e) => {
    e?.preventDefault();
    if (!disableCode.trim()) {
      setMfaError(t("mfaCodeRequired"));
      return;
    }
    setDisabling(true);
    setMfaError("");
    try {
      await authApi.mfaDisable(disableCode.trim(), token);
      await refreshProfile();
      setShowDisableMfa(false);
      setDisableCode("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setMfaError(err.message || t("invalidCode"));
    } finally {
      setDisabling(false);
    }
  };

  // Handle MFA setup complete
  const handleMfaSetupComplete = () => {
    setShowMfaSetup(false);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  return (
    <>
    <div className="fixed inset-0 z-[40] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 th-bg-overlay backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="user-profile-modal-title" className="relative w-full max-w-lg mx-4 glass-card rounded-2xl p-6 animate-scale-in max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="auth-modal-header flex items-center justify-between mb-6">
          <h2 id="user-profile-modal-title" className="text-xl font-bold th-text">{t("title")}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:th-bg-surface-hover rounded-lg transition-colors"
          >
            <X size={20} className="th-text-muted" />
          </button>
        </div>

        {/* Avatar section */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative group">
            {/* Avatar */}
            <div
              onClick={handleAvatarClick}
              className="w-24 h-24 rounded-full overflow-hidden cursor-pointer border-4 th-border hover:border-blue-500/50 transition-all"
            >
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={t("avatarAlt")}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold text-white">
                  {getInitials()}
                </div>
              )}

              {/* Overlay on hover */}
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {uploading ? (
                  <Loader2 size={24} className="text-white animate-spin" />
                ) : (
                  <Camera size={24} className="text-white" />
                )}
              </div>
            </div>

            {/* Remove avatar button */}
            {user?.avatar && (
              <button
                onClick={handleRemoveAvatar}
                className="absolute -bottom-1 -right-1 p-1.5 bg-red-500 hover:bg-red-400 rounded-full shadow-lg transition-colors"
                title={t("removeAvatarTooltip")}
              >
                <Trash2 size={14} className="text-white" />
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          <p className="mt-3 text-sm th-text-muted">
            {t("clickToChangeAvatar")}
          </p>
        </div>

        {/* Messages */}
        {localError && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-sm text-red-200">
            {localError}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-blue-500/20 border border-blue-500/30 rounded-xl text-sm text-blue-200 flex items-center gap-2">
            <Check size={16} />
            {t("updateSuccess")}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email (read-only) */}
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
                value={formData.email}
                disabled
                className="w-full glass-input pl-10 pr-4 py-3 rounded-xl opacity-60 cursor-not-allowed"
              />
            </div>
            <p className="mt-1 text-xs th-text-faint">
              {t("emailReadonlyNote")}
            </p>
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-medium th-text-secondary mb-2">
              {t("usernameLabel")}
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

          {/* Two-Factor Authentication */}
          <div className="pt-4 border-t th-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${user?.mfaEnabled ? "bg-blue-500/20" : "th-bg-surface"}`}>
                  {user?.mfaEnabled ? (
                    <ShieldCheck size={18} className="text-blue-400" />
                  ) : (
                    <Shield size={18} className="th-text-faint" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-medium th-text-secondary">
                    {t("mfaTitle")}
                  </h3>
                  <p className="text-xs th-text-faint mt-0.5">
                    {user?.mfaEnabled
                      ? t("mfaEnabledDesc")
                      : t("mfaDisabledDesc")}
                  </p>
                </div>
              </div>
              {user?.mfaEnabled ? (
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-lg font-medium">
                    {t("enabledBadge")}
                  </span>
                  {!showDisableMfa && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowDisableMfa(true);
                        setMfaError("");
                      }}
                      className="px-3 py-1.5 text-xs text-red-300 hover:text-red-200 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      {t("disableButton")}
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowMfaSetup(true)}
                  className="btn-brand px-4 py-2 text-sm text-white font-medium rounded-xl"
                >
                  {t("enable2fa")}
                </button>
              )}
            </div>

            {/* Disable MFA inline form */}
            {showDisableMfa && (
              <div className="mt-3 space-y-2">
                {mfaError && (
                  <p className="text-xs text-red-300">{mfaError}</p>
                )}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <KeyRound
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 th-text-faint"
                    />
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={disableCode}
                      onChange={(e) => {
                        setDisableCode(e.target.value.replace(/\D/g, ""));
                        setMfaError("");
                      }}
                      placeholder={t("mfaCodePlaceholder")}
                      disabled={disabling}
                      className="w-full glass-input pl-9 pr-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-red-500/50 font-mono"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleDisableMfa}
                    disabled={disabling || disableCode.length < 6}
                    className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 text-sm rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {disabling ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <ShieldOff size={14} />
                    )}
                    {t("confirmButton")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDisableMfa(false);
                      setDisableCode("");
                      setMfaError("");
                    }}
                    className="px-2 py-2 th-text-faint hover:th-text-muted text-sm"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Account info */}
          <div className="pt-4 border-t th-border">
            <p className="text-xs th-text-faint">
              {t("accountCreatedOn")}{" "}
              {user?.createdAt
                ? formatDateParis(user.createdAt)
                : t("notAvailable")}
            </p>
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
                {t("saving")}
              </>
            ) : (
              <>
                <Save size={18} />
                {t("save")}
              </>
            )}
          </button>
        </form>
      </div>

    </div>

      {/* Emplacement securite — la brique commerciale y monte la configuration
          du second facteur. Rendu via portail pour echapper au contexte
          d'empilement du parent. Sans brique, rien ne s'affiche. */}
      {showMfaSetup && createPortal(
        <Slot
          name="profile.security"
          onClose={() => setShowMfaSetup(false)}
          onComplete={handleMfaSetupComplete}
        />,
        document.body
      )}
    </>
  );
}
