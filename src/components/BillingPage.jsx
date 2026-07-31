"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "use-intl";
import {
  CreditCard,
  Package,
  History,
  ExternalLink,
  Loader2,
  Coins,
  Star,
  Zap,
  Crown,
  RefreshCw,
} from "lucide-react";
import {
  getBillingPackages,
  createBillingCheckout,
  getBillingBalance,
  getBillingTransactions,
  getBillingPortal,
} from "@/lib/api";
import { formatDate as formatDateParis } from "@/lib/datetime";

const PACKAGE_ICONS = [Coins, Star, Zap, Crown];
const PACKAGE_COLORS = [
  "from-blue-500 to-blue-400",
  "from-purple-500 to-purple-400",
  "from-purple-500 to-purple-400",
  "from-blue-500 to-blue-400",
];

export default function BillingPage() {
  const t = useTranslations("BillingPage");
  const [packages, setPackages] = useState([]);
  const [balance, setBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [pkgs, bal, txns] = await Promise.all([
        getBillingPackages().catch(() => []),
        getBillingBalance().catch(() => ({ credits: 0 })),
        getBillingTransactions(20).catch(() => []),
      ]);
      setPackages(Array.isArray(pkgs) ? pkgs : pkgs.packages || []);
      setBalance(bal);
      setTransactions(Array.isArray(txns) ? txns : txns.transactions || []);
    } catch (err) {
      console.error("[Billing] Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCheckout = async (pkg) => {
    setCheckoutLoading(pkg.id || pkg.package_id);
    try {
      const result = await createBillingCheckout(
        pkg.id || pkg.package_id,
        `${window.location.origin}/billing/success`,
        `${window.location.origin}/billing/cancel`,
      );
      if (result.checkout_url) {
        window.location.href = result.checkout_url;
      }
    } catch (err) {
      console.error("[Billing] Checkout error:", err);
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const result = await getBillingPortal(window.location.href);
      if (result.portal_url) {
        window.location.href = result.portal_url;
      }
    } catch (err) {
      console.error("[Billing] Portal error:", err);
    } finally {
      setPortalLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 size={48} className="text-brand animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col th-bg-body overflow-hidden">
      {/* Header */}
      <header className="shrink-0 p-6 bg-linear-to-r from-brand/20 to-brand-secondary/20 border-b th-border backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-linear-to-br from-brand to-brand-secondary rounded-2xl shadow-lg">
              <CreditCard size={32} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black th-text tracking-tight">{t("billingTitle")}</h1>
              <p className="th-text-secondary text-sm font-medium mt-1">{t("billingSubtitle")}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchData}
              className="flex items-center gap-2 px-4 py-2 th-bg-surface hover:th-bg-surface-hover th-text-secondary hover:th-text rounded-xl th-border border text-sm font-semibold transition-all"
              title={t("refreshLabel")}
            >
              <RefreshCw size={16} />
              {t("refreshLabel")}
            </button>

            <div className="glass-card rounded-2xl px-6 py-3 flex items-center gap-3">
              <Coins size={24} className="text-purple-400" />
              <div>
                <p className="th-text-muted text-xs">{t("currentBalanceLabel")}</p>
                <p className="text-xl font-bold th-text">
                  {balance?.credits ?? 0}
                  <span className="text-sm font-normal th-text-muted ml-1">
                    {t("creditsSuffix")}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Packages */}
          <div>
            <h2 className="text-lg font-semibold th-text mb-4 flex items-center gap-2">
              <Package size={20} className="text-purple-400" />
              {t("creditPackagesHeading")}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {packages.map((pkg, index) => {
                const Icon = PACKAGE_ICONS[index % PACKAGE_ICONS.length];
                const color = PACKAGE_COLORS[index % PACKAGE_COLORS.length];
                const isPopular = pkg.popular || index === 1;
                const pkgId = pkg.id || pkg.package_id;
                const isLoading = checkoutLoading === pkgId;

                return (
                  <div
                    key={pkgId}
                    className={`relative glass-card rounded-2xl p-6 border transition-all hover:scale-105 ${
                      isPopular
                        ? "border-purple-500/50 shadow-lg shadow-purple-500/20"
                        : "th-border"
                    }`}
                  >
                    {isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-linear-to-r from-purple-500 to-purple-400 rounded-full text-xs font-bold text-white">
                        {t("popularBadge")}
                      </div>
                    )}

                    <div
                      className={`w-12 h-12 rounded-xl bg-linear-to-r ${color} flex items-center justify-center mb-4`}
                    >
                      <Icon size={24} className="text-white" />
                    </div>

                    <h3 className="text-lg font-bold th-text">
                      {pkg.name}
                    </h3>

                    <div className="mt-2 mb-4">
                      <span className="text-3xl font-bold th-text">
                        ${((pkg.price || 0) / 100).toFixed(2)}
                      </span>
                      <span className="th-text-muted ml-1">USD</span>
                    </div>

                    <div className="space-y-2 mb-6">
                      <p className="th-text-secondary text-sm">
                        {t("packageCreditsCount", { count: pkg.credits ?? pkg.credit_amount ?? 0 })}
                      </p>
                      {(pkg.bonus || pkg.bonus_credits) && (
                        <p className="text-blue-400 text-sm font-medium">
                          {t("bonusCredits", { count: pkg.bonus || pkg.bonus_credits })}
                        </p>
                      )}
                      {pkg.description && (
                        <p className="th-text-muted text-xs">
                          {pkg.description}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => handleCheckout(pkg)}
                      disabled={isLoading}
                      className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-all ${
                        isPopular
                          ? "bg-linear-to-r from-purple-500 to-purple-400 hover:from-purple-400 hover:to-purple-300 text-white shadow-lg shadow-purple-500/20"
                          : "th-bg-surface hover:th-bg-surface-hover border th-border th-text"
                      } disabled:opacity-50`}
                    >
                      {isLoading ? (
                        <Loader2 size={18} className="animate-spin mx-auto" />
                      ) : (
                        t("buyButton")
                      )}
                    </button>
                  </div>
                );
              })}

              {packages.length === 0 && (
                <div className="col-span-full text-center py-12 th-text-ghost">
                  {t("noPackagesText")}
                </div>
              )}
            </div>
          </div>

          {/* Transactions */}
          <div>
            <h2 className="text-lg font-semibold th-text mb-4 flex items-center gap-2">
              <History size={20} className="text-blue-400" />
              {t("transactionHistoryHeading")}
            </h2>

            <div className="glass-card rounded-2xl overflow-hidden">
              {transactions.length > 0 ? (
                <table className="w-full">
                  <thead>
                    <tr className="border-b th-border">
                      <th className="text-left py-3 px-4 th-text-muted text-sm font-medium">
                        {t("dateHeader")}
                      </th>
                      <th className="text-left py-3 px-4 th-text-muted text-sm font-medium">
                        {t("typeHeader")}
                      </th>
                      <th className="text-right py-3 px-4 th-text-muted text-sm font-medium">
                        {t("amountHeader")}
                      </th>
                      <th className="text-left py-3 px-4 th-text-muted text-sm font-medium">
                        {t("descriptionHeader")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx, i) => (
                      <tr
                        key={tx.id || i}
                        className="border-b border-transparent hover:th-bg-surface transition-colors"
                      >
                        <td className="py-3 px-4 th-text-secondary text-sm">
                          {tx.created_at || tx.date
                            ? formatDateParis(tx.created_at || tx.date)
                            : "\u2014"}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium ${
                              (tx.type || "").includes("credit") ||
                              (tx.type || "").includes("purchase")
                                ? "bg-blue-500/20 text-blue-400"
                                : (tx.type || "").includes("debit") ||
                                    (tx.type || "").includes("usage")
                                  ? "bg-purple-500/20 text-purple-400"
                                  : "bg-blue-500/20 text-blue-400"
                            }`}
                          >
                            {tx.type || "\u2014"}
                          </span>
                        </td>
                        <td
                          className={`py-3 px-4 text-right text-sm font-medium ${
                            (tx.amount || tx.credits || 0) >= 0
                              ? "text-blue-400"
                              : "text-purple-400"
                          }`}
                        >
                          {(tx.amount || tx.credits || 0) >= 0 ? "+" : ""}
                          {tx.amount || tx.credits || 0}
                        </td>
                        <td className="py-3 px-4 th-text-muted text-sm">
                          {tx.description || "\u2014"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-12 th-text-ghost">
                  {t("noTransactionsText")}
                </div>
              )}
            </div>
          </div>

          {/* Stripe Portal */}
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold th-text">
                  {t("paymentManagementHeading")}
                </h3>
                <p className="th-text-muted text-sm mt-1">
                  {t("paymentManagementDescription")}
                </p>
              </div>
              <button
                onClick={handlePortal}
                disabled={portalLoading}
                className="flex items-center gap-2 px-5 py-2.5 bg-linear-to-r from-blue-500 to-blue-400 hover:from-blue-400 hover:to-blue-300 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
              >
                {portalLoading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>
                    <ExternalLink size={18} />
                    {t("managePaymentsButton")}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
