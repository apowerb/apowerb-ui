"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "use-intl";
import { useRouter } from "@/lib/navigation";
import { BarChart3, Globe, Building2 } from "lucide-react";
import { getPublicDashboard } from "@/lib/api";
import ChartRenderer from "./ChartRenderer";
import StatCard from "./StatCard";

export default function PublicDashboardView({ slug }) {
  const t = useTranslations("PublicDashboardView");
  const VIS_BADGES = {
    public: {
      icon: Globe,
      label: t("visibilityPublic"),
      className: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    },
    organization: {
      icon: Building2,
      label: t("visibilityOrganization"),
      className: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    },
    private: {
      icon: Lock,
      label: t("visibilityPrivate"),
      className: "th-bg-surface th-text-muted th-border-hover",
    },
  };
  const router = useRouter();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chartMeta, setChartMeta] = useState({});

  useEffect(() => {
    getPublicDashboard(slug)
      .then((data) => {
        setDashboard(data);
        setError(null);
      })
      .catch((err) => setError(err.message || t("notFoundFallback")))
      .finally(() => setLoading(false));
  }, [slug, t]);

  const isAuthError = error && (error.includes("Authentication") || error.includes("401"));
  const isForbidden = error && (error.includes("organization") || error.includes("403") || error.includes("private"));

  // Visitor not logged in (401): send them straight to the login page with a
  // return path, so they land back on this dashboard once authenticated.
  useEffect(() => {
    if (isAuthError) {
      router.replace(
        `/login?redirect=${encodeURIComponent(`/view/dashboard/${slug}`)}`
      );
    }
  }, [isAuthError, slug, router]);

  if (loading) {
    return (
      <div className="min-h-screen th-bg-body flex items-center justify-center">
        <div className="glass-card p-8 rounded-2xl text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[var(--border-primary)] border-t-purple-500 mx-auto mb-4" />
          <p className="th-text-secondary">{t("loading")}</p>
        </div>
      </div>
    );
  }

  if (error || !dashboard) {
    // Not logged in → the redirect above is in flight; show a transient
    // loader instead of a dead-end card.
    if (isAuthError) {
      return (
        <div className="min-h-screen th-bg-body flex items-center justify-center">
          <div className="glass-card p-8 rounded-2xl text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-[var(--border-primary)] border-t-purple-500 mx-auto mb-4" />
            <p className="th-text-secondary">{t("redirecting")}</p>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen th-bg-body flex items-center justify-center">
        <div className="glass-card p-8 rounded-2xl text-center max-w-md">
          {isForbidden ? (
            <Building2 size={48} className="text-blue-400/50 mx-auto mb-4" />
          ) : (
            <BarChart3 size={48} className="th-text-ghost mx-auto mb-4" />
          )}
          <h2 className="text-xl font-bold th-text mb-2">
            {isForbidden ? t("accessRestricted") : t("dashboardNotFound")}
          </h2>
          <p className="th-text-secondary text-sm">
            {isForbidden
              ? t("accessRestrictedDescription")
              : error || t("dashboardNotFoundDescription")}
          </p>
        </div>
      </div>
    );
  }

  const components = dashboard.components || [];
  const visBadge = VIS_BADGES[dashboard.visibility] || VIS_BADGES.public;
  const BadgeIcon = visBadge.icon;

  return (
    <div className="min-h-screen th-bg-body">
      {/* Header */}
      <header className="p-6 bg-linear-to-r from-purple-500/10 to-purple-500/10 border-b th-border backdrop-blur-xl">
        <div className="max-w-[1800px] mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-black th-text tracking-tight">
              {dashboard.title}
            </h1>
            <span
              className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${visBadge.className}`}
            >
              <BadgeIcon size={12} />
              {visBadge.label}
            </span>
          </div>
          {dashboard.description && (
            <p className="th-text-secondary text-sm">{dashboard.description}</p>
          )}
          {dashboard.created_by && (
            <p className="text-xs th-text-faint mt-1">{t("by", { name: dashboard.created_by })}</p>
          )}
        </div>
      </header>

      {/* Content -- CSS grid (read-only, no drag) */}
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          {components.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <div className="glass-card p-12 rounded-2xl text-center">
                <BarChart3
                  size={48}
                  className="text-purple-400/50 mx-auto mb-4"
                />
                <h3 className="text-xl font-bold th-text mb-2">
                  {t("noChartsYet")}
                </h3>
                <p className="th-text-secondary">
                  {t("noChartsDescription")}
                </p>
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(12, 1fr)",
                gap: "16px",
                gridAutoRows: "84px",
              }}
            >
              {components.map((comp) => {
                const resolvedTitle =
                  comp.chart?.chart_id && chartMeta[comp.chart.chart_id]?.title;
                const compTitle =
                  comp.component_type === "key_value"
                    ? comp.key_value?.label || t("kpiFallback")
                    : comp.component_type === "table"
                      ? comp.table?.title || t("tableFallback")
                      : comp.chart?.title_override || resolvedTitle || t("chartFallback");
                const compDesc =
                  comp.chart?.chart_id && chartMeta[comp.chart.chart_id]?.description;
                return (
                  <div
                    key={comp.id}
                    style={{
                      gridColumn: `${(comp.position?.col || 0) + 1} / span ${comp.position?.width || 6}`,
                      gridRow: `${(comp.position?.row || 0) + 1} / span ${comp.position?.height || 4}`,
                    }}
                    className="glass-card rounded-xl overflow-hidden flex flex-col"
                  >
                    <div className="px-4 py-2.5 border-b th-border">
                      <h3 className="text-sm font-semibold th-text truncate">
                        {compTitle}
                      </h3>
                      {compDesc && (
                        <p className="text-[11px] th-text-faint truncate mt-0.5" title={compDesc}>{compDesc}</p>
                      )}
                    </div>
                    <div className="flex-1 p-3 min-h-0">
                      {comp.component_type === "key_value" && comp.key_value ? (
                        <StatCard
                          value={comp.key_value.value}
                          label={comp.key_value.label}
                          unit={comp.key_value.unit}
                          icon={comp.key_value.icon}
                          description={comp.key_value.description}
                          trend={comp.key_value.trend}
                        />
                      ) : (
                        <ChartRenderer
                          chartId={comp.chart?.chart_id}
                          publicMode={true}
                          onLoaded={(meta) => {
                            const id = comp.chart?.chart_id;
                            if (!id) return;
                            setChartMeta((prev) => {
                              const existing = prev[id];
                              if (
                                existing &&
                                existing.title === meta.title &&
                                existing.description === meta.description &&
                                existing.chart_type === meta.chart_type &&
                                existing.row_count === meta.row_count
                              ) {
                                return prev;
                              }
                              return { ...prev, [id]: meta };
                            });
                          }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="p-4 text-center border-t th-border">
        <p className="text-xs th-text-faint">Powered by th2ai BI & Reporting</p>
      </footer>
    </div>
  );
}
