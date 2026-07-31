"use client";

import { useTranslations } from "use-intl";
import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Lock, Loader2, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { authApi } from "@/lib/authStorage";

function ResetPasswordInner() {
  const t = useTranslations("ResetPasswordPage");
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!token) {
      setError(t("noTokenError"));
      return;
    }
    if (password.length < 8) {
      setError(t("passwordMinLength"));
      return;
    }
    if (password !== confirm) {
      setError(t("passwordMismatch"));
      return;
    }
    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err.message || t("invalidOrExpiredLink"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md glass-card rounded-2xl p-8">
        {done ? (
          <div className="text-center">
            <CheckCircle2 size={48} className="mx-auto mb-4 text-green-400" />
            <h1 className="text-xl font-bold th-text mb-2">{t("successTitle")}</h1>
            <p className="th-text-secondary text-sm mb-6">
              {t("successDescription")}
            </p>
            <button
              onClick={() => router.push("/login")}
              className="w-full px-4 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white transition-colors"
            >
              {t("signIn")}
            </button>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold th-text mb-2">{t("title")}</h1>
            <p className="th-text-secondary text-sm mb-6">
              {t("description")}
            </p>
            {error && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-sm text-red-200">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 th-text-faint" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("passwordPlaceholder")}
                  className="w-full glass-input pl-10 pr-12 py-3 rounded-xl focus:ring-2 focus:ring-blue-500/50"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 th-text-faint hover:th-text-secondary"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 th-text-faint" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder={t("confirmPasswordPlaceholder")}
                  className="w-full glass-input pl-10 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500/50"
                  disabled={loading}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 size={18} className="animate-spin" />}
                {t("submit")}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}
