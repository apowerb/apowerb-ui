"use client";

import { useTranslations } from "use-intl";
import { AlertTriangle } from "lucide-react";
import SourcesPopover from "./SourcesPopover";

function Skeleton() {
  return (
    <div className="flex h-full min-h-12 flex-col justify-center gap-2" aria-hidden="true" data-testid="v2-skeleton">
      <div className="th-skeleton h-6 w-2/5 animate-pulse rounded motion-reduce:animate-none" />
      <div className="th-skeleton h-3 w-3/4 animate-pulse rounded motion-reduce:animate-none" />
    </div>
  );
}

/**
 * Card around a visual: title, subtitle, "Sources" button, and the three states
 * (loading skeleton, readable error, content). `compact` is for KPI tiles
 * where the title is a small caption.
 */
export default function VisualFrame({
  title,
  subtitle,
  meta,
  loading = false,
  error = null,
  compact = false,
  dense = false,
  children,
}) {
  const t = useTranslations("DashboardV2");
  return (
    <section
      aria-label={title || undefined}
      className={`bi-v2-fade-in group/frame relative flex h-full min-h-0 flex-col px-4 ${dense ? "py-1" : "py-3"} [container-type:inline-size]`}
    >
      {(title || subtitle || meta) && (
        <header
          className={
            title || subtitle
              ? "mb-2 flex shrink-0 items-start justify-between gap-2"
              : "absolute right-2 top-2 z-10"
          }
        >
          {(title || subtitle) && <div className="min-w-0 [word-break:normal] [overflow-wrap:break-word] [hyphens:auto]" lang="fr">
            {title && (
              <h3
                className={
                  compact
                    ? "text-[clamp(8.5px,5.2cqw,10px)] font-semibold uppercase leading-snug tracking-normal th-text-muted"
                    : "text-sm font-semibold leading-snug th-text"
                }
              >
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="bi-v2-num mt-0.5 text-[11px] leading-snug th-text-faint">
                {subtitle}
              </p>
            )}
          </div>}
          {meta && !loading && !error && (
            <div className="shrink-0 opacity-60 transition-opacity focus-within:opacity-100 group-hover/frame:opacity-100">
              <SourcesPopover meta={meta} title={title} />
            </div>
          )}
        </header>
      )}
      <div className="min-h-0 flex-1">
        {error ? (
          <div
            role="alert"
            className="flex h-full min-h-12 items-start gap-2 rounded-lg border p-3 text-xs"
            style={{
              color: "var(--v2-bad)",
              borderColor: "color-mix(in srgb, var(--v2-bad) 40%, transparent)",
              background: "color-mix(in srgb, var(--v2-bad) 8%, transparent)",
            }}
          >
            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <div className="font-semibold">{t("visualError")}</div>
              <div className="mt-0.5 break-words opacity-90">{String(error)}</div>
            </div>
          </div>
        ) : loading ? (
          <Skeleton />
        ) : (
          children
        )}
      </div>
    </section>
  );
}
