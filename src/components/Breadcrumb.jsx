"use client";

import { Link } from "@/lib/navigation";
import { useTranslations } from "use-intl";
import { ChevronRight, Home } from "lucide-react";

/**
 * Generic breadcrumb trail.
 *
 * @param {Object} props
 * @param {Array<{label: string, href?: string, icon?: React.ComponentType}>} props.items
 *   Ordered list of crumbs. The last item is rendered as the current page
 *   (no link). Items with ``href`` render as links; items without are
 *   rendered as plain text (useful for non-routable intermediates).
 * @param {string} [props.className]
 */
export default function Breadcrumb({ items = [], className = "" }) {
  const t = useTranslations("Breadcrumb");
  if (!Array.isArray(items) || items.length === 0) return null;

  return (
    <nav
      aria-label={t("breadcrumbAria")}
      className={`flex items-center gap-1.5 text-xs font-medium ${className}`}
    >
      <ol className="flex items-center gap-1.5 flex-wrap">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          const Icon = item.icon;
          const content = (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg th-bg-surface border th-border">
              {Icon && <Icon size={12} className="th-text-muted" />}
              <span className={isLast ? "th-text font-semibold" : "th-text-muted"}>
                {item.label}
              </span>
            </span>
          );

          return (
            <li key={idx} className="flex items-center gap-1.5">
              {idx === 0 && !Icon && (
                <Home size={12} className="th-text-muted mr-0.5" aria-hidden />
              )}
              {!isLast && item.href ? (
                <Link
                  href={item.href}
                  className="hover:th-text transition-colors"
                >
                  {content}
                </Link>
              ) : (
                <span aria-current={isLast ? "page" : undefined}>
                  {content}
                </span>
              )}
              {!isLast && (
                <ChevronRight
                  size={12}
                  className="th-text-faint shrink-0"
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
