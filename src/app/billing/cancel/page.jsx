"use client";

import { XCircle, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function BillingCancelPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen th-bg-body flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative glass-card rounded-3xl p-8 md:p-12 max-w-md w-full text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-purple-500/20 flex items-center justify-center">
          <XCircle size={40} className="text-purple-400" />
        </div>

        <h1 className="text-2xl font-bold th-text mb-3">
          Payment Cancelled
        </h1>
        <p className="th-text-secondary mb-8">
          Your payment has been cancelled. No amount has been charged.
        </p>

        <button
          onClick={() => router.push("/")}
          className="flex items-center justify-center gap-2 mx-auto px-6 py-3 th-bg-surface hover:th-bg-surface-hover border th-border th-text font-semibold rounded-xl transition-all"
        >
          <ArrowLeft size={18} />
          Back to Application
        </button>
      </div>
    </div>
  );
}
