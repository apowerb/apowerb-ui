"use client";

import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ToastProvider } from "@/components/Toast";
import AuthScreen from "@/components/auth/AuthScreen";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

// Read a `?redirect=` target, accepting ONLY internal paths (must start with
// a single "/") to avoid open-redirects to external sites. Defaults to "/".
function safeInternalRedirect() {
  if (typeof window === "undefined") return "/";
  const r = new URLSearchParams(window.location.search).get("redirect");
  if (r && r.startsWith("/") && !r.startsWith("//")) return r;
  return "/";
}

function LoginContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const redirectTo = safeInternalRedirect();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(redirectTo);
    }
  }, [isAuthenticated, isLoading, router, redirectTo]);

  if (isLoading || isAuthenticated) {
    return (
      <div className="min-h-screen th-bg-body flex items-center justify-center">
        <Loader2 size={48} className="text-brand animate-spin" />
      </div>
    );
  }

  return <AuthScreen redirectTo={redirectTo} />;
}

export default function LoginPage() {
  return (
    <AuthProvider>
      <ToastProvider>
        <LoginContent />
      </ToastProvider>
    </AuthProvider>
  );
}
