"use client";

import { useTranslations } from "use-intl";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import BrandIcon from "@/components/brand/BrandIcon";
import LoginModal from "./LoginModal";
import RegisterModal from "./RegisterModal";
import ForgotPasswordModal from "./ForgotPasswordModal";
import { useAuth } from "@/contexts/AuthContext";
import Slot from "@/extensions/Slot";

// Set NEXT_PUBLIC_AUTH_DISABLE_BASIC=true to hide email/password Sign In + Create Account
// on the login screen. The matching backend flag (AUTH_BASIC_ENABLED=false) must also be set
// for full security — disabling here is a UX hint only.
const _AUTH_BASIC_DISABLED = (process.env.NEXT_PUBLIC_AUTH_DISABLE_BASIC || "").toLowerCase() === "true";

// Set NEXT_PUBLIC_AUTH_DISABLE_SIGNUP=true to keep the email/password Sign In
// button but hide self-registration. Pair with AUTH_REGISTER_ENABLED=false on
// the backend (returns 404 on POST /users/) so the protection is real, not
// just a UX hint. Closed-signup deployment: internal users can sign in,
// nobody can
// open an account from the login screen.
const _AUTH_SIGNUP_DISABLED = (process.env.NEXT_PUBLIC_AUTH_DISABLE_SIGNUP || "").toLowerCase() === "true";

export default function AuthScreen({ redirectTo }) {
  const t = useTranslations("AuthScreen");
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const { isLoading, pendingChallenge, clearChallenge } = useAuth();

  const handleSwitchToRegister = () => {
    setShowLogin(false);
    setShowRegister(true);
  };

  const handleSwitchToLogin = () => {
   setShowRegister(false);
   setShowForgotPassword(false);
   setShowLogin(true);
  };

  const handleForgotPassword = () => {
    setShowLogin(false);
    setShowForgotPassword(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen th-bg-body flex items-center justify-center">
        <Loader2 size={48} className="text-brand animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen th-bg-body flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="auth-decoration absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      {/* Main card */}
      <div className="relative glass-card rounded-3xl p-8 md:p-12 max-w-md w-full text-center">
        {/* Logo */}
        <div className="mb-8">
          <div className="w-24 h-24 mx-auto mb-4 relative">
            <BrandIcon
              alt="apowerb Logo"
              fill
              className="object-contain drop-shadow-lg"
              priority
            />
          </div>
          <h1 className="brand-title text-3xl font-bold">
            apowerb
          </h1>
          <p className="th-text-muted mt-2">
          thaink² {t("tagline")}
          </p>
        </div>

        {/* Buttons */}
        <div className="space-y-3">
          {!_AUTH_BASIC_DISABLED && (
            <button
            onClick={() => setShowLogin(true)}
            className="btn-brand w-full py-3 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/20"
          >
            {t("signIn")}
          </button>
          )}

          {!_AUTH_BASIC_DISABLED && !_AUTH_SIGNUP_DISABLED && (
            <button
            onClick={() => setShowRegister(true)}
            className="w-full py-3 th-bg-surface hover:th-bg-surface-hover border th-border hover:th-border-hover th-text font-semibold rounded-xl transition-all"
          >
            {t("createAccount")}
          </button>
          )}

          <Slot name="auth.providers" redirectTo={redirectTo} />
        </div>

        {/* Legal notice */}
        <p className="th-text-faint text-xs mt-6 leading-relaxed">
          {t("legalPrefix")}{" "}
          <a
            href="https://agent-dev.thaink2.fr/legal#privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-brand transition-colors"
          >
            {t("privacyPolicy")}
          </a>{" "}
          {t("legalAnd")}{" "}
          <a
            href="https://agent-dev.thaink2.fr/legal#terms"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-brand transition-colors"
          >
            {t("termsOfUse")}
          </a>
          .
        </p>

      </div>

      {/* Modals */}
      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onSwitchToRegister={handleSwitchToRegister}
          onForgotPassword={handleForgotPassword}
          redirectTo={redirectTo}
        />
      )}

      {showRegister && (
        <RegisterModal
          onClose={() => setShowRegister(false)}
          onSwitchToLogin={handleSwitchToLogin}
          redirectTo={redirectTo}
        />
      )}

      {showForgotPassword && (
        <ForgotPasswordModal
          onClose={() => setShowForgotPassword(false)}
          onBackToLogin={handleSwitchToLogin}
        />
      )}

      {pendingChallenge && (
        <Slot
          name="auth.challenge"
          onClose={() => {
            clearChallenge();
            setShowLogin(false);
          }}
          onResolved={() => setShowLogin(false)}
        />
      )}
    </div>
  );
}
