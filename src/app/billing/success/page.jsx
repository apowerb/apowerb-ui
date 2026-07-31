"use client";

import { CheckCircle, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function BillingSuccessPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen th-bg-body flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative glass-card rounded-3xl p-8 md:p-12 max-w-md w-full text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-blue-500/20 flex items-center justify-center">
          <CheckCircle size={40} className="text-blue-400" />
        </div>

        <h1 className="text-2xl font-bold th-text mb-3">
          Payment Successful!
        </h1>
        <p className="th-text-secondary mb-8">
          Your credits have been added to your account. Thank you for your purchase!
        </p>

        <button
          onClick={() => router.push("/")}
          className="flex items-center justify-center gap-2 mx-auto px-6 py-3 bg-linear-to-r from-blue-500 to-brand hover:from-blue-400 hover:to-brand-hover text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-500/20"
        >
          <ArrowLeft size={18} />
          Back to Application
        </button>
      </div>
    </div>
  );
}
