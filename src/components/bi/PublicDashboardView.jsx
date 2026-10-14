"use client";

import { useState, useEffect, useCallback, useSyncExternalStore } from "react";
import { useTranslations } from "use-intl";
import { useRouter } from "@/lib/navigation";
import { BarChart3, Globe, Building2, Lock } from "lucide-react";
import { getPublicDashboard } from "@/lib/api";
import ChartRenderer from "./ChartRenderer";
import StatCard from "./StatCard";
import { DashboardDataProvider } from "./v2/DashboardDataContext";
import FilterBar from "./v2/FilterBar";
import VisualRenderer from "./v2/VisualRenderer";
import { isV2Dashboard, NARROW_PX } from "./v2/isV2";
import { fitTextBlocks } from "./v2/layout";

function subscribeNarrow(cb) {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
}
const getNarrow = () => window.innerWidth < NARROW_PX;
const getNarrowServer = () => false;

// v2 dashboards share one filter state and one data call (public endpoint).
function DataScope({ enabled, dashboard, slug, onContentHeight, children }) {
  if (!enabled) return children;
  return (
    <DashboardDataProvider dashboard={dashboard} publicSlug={slug} onContentHeight={onContentHeight}>
      {children}
    </DashboardDataProvider>
  );
}

// The 12-column desktop layout does not fit a narrow screen: a 3/12 KPI
// tile shrinks to ~140px and its value overflows. Fall back to 2 columns,
// then 1, and let the tiles flow in reading order.
function columnsForWidth(width) {
  if (width < 640) return 1;
  if (width < 1024) return 2;
  return 12;
}

function useGridColumns() {
  const [columns, setColumns] = useState(12);
  useEffect(() => {
    const update = () => setColumns(columnsForWidth(window.innerWidth));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return columns;
}

function gridPlacement(position, columns) {
  const width = position?.width || 6;
  const height = position?.height || 4;
  if (columns === 12) {
    return {
      gridColumn: `${(position?.col || 0) + 1} / span ${width}`,
      gridRow: `${(position?.row || 0) + 1} / span ${height}`,
    };
  }
  const span = width <= 6 ? 1 : columns;
  return { gridColumn: `span ${span}`, gridRow: `span ${height}` };
}

function readingOrder(a, b) {
  const rowDiff = (a.position?.row || 0) - (b.position?.row || 0);
  return rowDiff || (a.position?.col || 0) - (b.position?.col || 0);
}

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
  const columns = useGridColumns();
  const [textPx, setTextPx] = useState({});
  const onContentHeight = useCallback(
    (id, px) => setTextPx((prev) => (prev[id] === px ? prev : { ...prev, [id]: px })),
    [],
  );
  const narrow = useSyncExternalStore(subscribeNarrow, getNarrow, getNarrowServer);

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

  const isV2 = isV2Dashboard(dashboard);
  const legacyComponents =
    columns === 12
      ? dashboard.components || []
      : [...(dashboard.components || [])].sort(readingOrder);
  const components = isV2
    ? fitTextBlocks(dashboard.components || [], textPx)
    : legacyComponents;
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
      <DataScope enabled={isV2} dashboard={dashboard} slug={slug} onContentHeight={onContentHeight}>
      <div className="p-6">
        <div className="w-full">
          {isV2 && (
            <div className="mb-4">
              <FilterBar />
            </div>
          )}
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
                gridTemplateColumns: isV2
                  ? narrow ? "repeat(2, 1fr)" : "repeat(12, 1fr)"
                  : `repeat(${columns}, 1fr)`,
                gap: "16px",
                gridAutoRows: isV2 ? "60px" : "84px",
              }}
            >
              {components.map((comp) => {
                if (comp.component_type === "visual") {
                  const span = narrow ? (comp.visual?.type === "kpi" ? 1 : 2) : comp.position?.width || 6;
                  const baseRows = comp.position?.height || 4;
                  const rows =
                    narrow && comp.visual?.type !== "kpi" && comp.visual?.type !== "text"
                      ? Math.max(baseRows * 2, 5)
                      : baseRows;
                  return (
                    <div
                      key={comp.id}
                      data-testid={`v2-block-${comp.id}`}
                      style={
                        narrow
                          ? { gridColumn: `span ${span}`, gridRow: `span ${rows}` }
                          : {
                              gridColumn: `${(comp.position?.col || 0) + 1} / span ${span}`,
                              gridRow: `${(comp.position?.row || 0) + 1} / span ${rows}`,
                            }
                      }
                      className={`glass-card bi-v2-card ${comp.visual?.type === "text" ? "bi-v2-card--bare" : ""} rounded-xl overflow-hidden`}
                    >
                      <VisualRenderer component={comp} />
                    </div>
                  );
                }
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
                    style={gridPlacement(comp.position, columns)}
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
      </DataScope>

      {/* Footer */}
      <footer className="p-4 text-center border-t th-border">
        <p className="text-xs th-text-faint">Powered by th2ai BI & Reporting</p>
      </footer>
    </div>
  );
}
