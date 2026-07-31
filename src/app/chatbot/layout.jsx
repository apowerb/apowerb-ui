"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ToastProvider } from "@/components/Toast";
import { Loader2 } from "lucide-react";

const REDIRECT_KEY = "th2_auth_redirect";

function ChatbotAuthGate({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      sessionStorage.setItem(REDIRECT_KEY, window.location.pathname);
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--background)" }}
      >
        <Loader2 size={48} className="text-brand animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="h-screen overflow-hidden"
      style={{ background: "var(--background)" }}
    >
      {children}
    </div>
  );
}

export default function ChatbotLayout({ children }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <ChatbotAuthGate>{children}</ChatbotAuthGate>
      </ToastProvider>
    </AuthProvider>
  );
}