"use client";

import { useTranslations } from "use-intl";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { authApi } from "@/lib/authStorage";

function VerifyEmailInner() {
  const t = useTranslations("VerifyEmailPage");
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token");
  const [status, setStatus] = useState(token ? "loading" : "error"); // loading | success | error

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    authApi
      .verifyEmail(token)
      .then(() => {
        if (!cancelled) setStatus("success");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md glass-card rounded-2xl p-8 text-center">
        {status === "loading" && (
          <>
            <Loader2 size={40} className="mx-auto mb-4 animate-spin text-blue-400" />
            <p className="th-text-secondary">{t("verifying")}</p>
          </>
        )}
        {status === "success" && (
          <>
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
          </>
        )}
        {status === "error" && (
          <>
            <XCircle size={48} className="mx-auto mb-4 text-red-400" />
            <h1 className="text-xl font-bold th-text mb-2">{t("errorTitle")}</h1>
            <p className="th-text-secondary text-sm mb-6">
              {t("errorDescription")}
            </p>
            <button
              onClick={() => router.push("/login")}
              className="w-full px-4 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white transition-colors"
            >
              {t("goToSignIn")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailInner />
    </Suspense>
  );
}
