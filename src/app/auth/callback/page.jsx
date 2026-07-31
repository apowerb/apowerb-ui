"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AuthProvider } from "@/contexts/AuthContext";
import Slot from "@/extensions/Slot";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { oauthLogin, pendingChallenge, clearChallenge } = useAuth();
  const [error, setError] = useState(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get("error");
    if (errorParam) return `Authentication denied: ${errorParam}`;
    const code = params.get("code");
    const state = params.get("state");
    if (!code || !state) return "Missing callback parameters";
    return null;
  });

  useEffect(() => {
    if (error) return;

    const code = searchParams.get("code");
    const state = searchParams.get("state"); // provider name

    if (!code || !state) return;

    const redirectUri = `${window.location.origin}/auth/callback`;

    oauthLogin(state, code, redirectUri)
      .then((result) => {
        // Un defi reste a relever : ne pas rediriger, la brique le rend.
        if (result?.mfaRequired) return;
        router.push("/agents");
      })
      .catch((err) => {
        setError(err.message || "OAuth login error");
      });
  }, [searchParams, oauthLogin, router, error]);

  // Un defi d'authentification reste a relever : la brique le rend.
  if (pendingChallenge) {
    return (
      <div className="min-h-screen th-bg-body flex items-center justify-center p-4">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        </div>
        <Slot
          name="auth.challenge"
          onClose={() => {
            clearChallenge();
            router.push("/agents");
          }}
          onResolved={() => router.push("/agents")}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen th-bg-body flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative glass-card rounded-3xl p-8 md:p-12 max-w-md w-full text-center">
        {error ? (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
              <AlertCircle size={32} className="text-red-400" />
            </div>
            <h2 className="text-xl font-bold th-text mb-2">
              Login Error
            </h2>
            <p className="th-text-secondary mb-6">{error}</p>
            <button
              onClick={() => router.push("/")}
              className="flex items-center justify-center gap-2 mx-auto px-6 py-3 th-bg-surface hover:th-bg-surface-hover border th-border rounded-xl th-text transition-all"
            >
              <ArrowLeft size={18} />
              Back to Sign In
            </button>
          </>
        ) : (
          <>
            <Loader2 size={48} className="text-brand animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-bold th-text mb-2">
              Signing in...
            </h2>
            <p className="th-text-secondary">
              Please wait while we verify your identity.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <AuthProvider>
      <Suspense
        fallback={
          <div className="min-h-screen th-bg-body flex items-center justify-center">
            <Loader2 size={48} className="text-brand animate-spin" />
          </div>
        }
      >
        <CallbackContent />
      </Suspense>
    </AuthProvider>
  );
}
