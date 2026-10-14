"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "use-intl";
import { Database, X } from "lucide-react";
import { useDashboardLocale } from "./DashboardDataContext";
import { intlLocale } from "./format";
import { ProvenanceBadge } from "./visuals/NoteBlock";

/**
 * "Sources" button + popover: where a visual's numbers come from (source,
 * measures with their formula and provenance, filters applied / ignored, rows).
 */
export default function SourcesPopover({ meta, title }) {
  const t = useTranslations("DashboardV2");
  const locale = useDashboardLocale();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);
  const panelRef = useRef(null);

  const place = useCallback(() => {
    const el = buttonRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = Math.min(360, window.innerWidth - 16);
    const left = Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8));
    setPos({ top: r.bottom + 6, left, width });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onDown = (e) => {
      if (panelRef.current?.contains(e.target) || buttonRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  const applied = Object.entries(meta?.filters_applied || {});
  const ignored = meta?.ignored_filters || [];
  const measures = meta?.measures || [];

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t("sources")}
        title={t("sources")}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="inline-flex h-6 w-6 items-center justify-center rounded-md th-text-faint transition-colors hover:th-text hover:bg-[var(--bg-surface-hover)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--border-focus)]"
      >
        <Database size={13} aria-hidden="true" />
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label={`${t("sources")} — ${title || ""}`}
            className="bi-v2-fade-in fixed z-[1000] max-h-[70vh] overflow-auto rounded-xl border p-4 text-xs shadow-2xl"
            style={{
              top: pos.top,
              left: pos.left,
              width: pos.width,
              background: "var(--bg-dropdown)",
              borderColor: "var(--border-hover)",
              color: "var(--text-secondary)",
            }}
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider th-text-faint">
                  {t("sources")}
                </div>
                {title && <div className="mt-0.5 text-sm font-semibold th-text">{title}</div>}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("close")}
                className="rounded p-1 th-text-faint hover:th-text"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>

            <dl className="space-y-3">
              <div>
                <dt className="font-semibold th-text-muted">{t("source")}</dt>
                <dd className="mt-0.5 font-mono th-text">{meta?.source || "—"}</dd>
              </div>

              {measures.length > 0 && (
                <div>
                  <dt className="font-semibold th-text-muted">{t("measures")}</dt>
                  <dd className="mt-1 space-y-2">
                    {measures.map((m) => (
                      <div key={m.name} className="rounded-lg border th-border p-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold th-text">{m.label || m.name}</span>
                          {(m.provenance || []).map((p) => (
                            <ProvenanceBadge key={p} kind={p} />
                          ))}
                        </div>
                        <code className="mt-1 block break-words font-mono text-[11px] th-text-muted">
                          {m.expr}
                        </code>
                      </div>
                    ))}
                  </dd>
                </div>
              )}

              <div>
                <dt className="font-semibold th-text-muted">{t("filtersApplied")}</dt>
                <dd className="mt-0.5">
                  {applied.length === 0 ? (
                    <span className="th-text-faint">{t("none")}</span>
                  ) : (
                    <ul className="space-y-0.5">
                      {applied.map(([k, v]) => (
                        <li key={k}>
                          <span className="font-mono th-text-muted">{k}</span>
                          {" = "}
                          <span className="th-text">
                            {v && typeof v === "object" ? JSON.stringify(v) : String(v)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </dd>
              </div>

              {ignored.length > 0 && (
                <div>
                  <dt className="font-semibold th-text-muted">{t("filtersIgnored")}</dt>
                  <dd className="mt-0.5 font-mono th-text">{ignored.join(", ")}</dd>
                </div>
              )}

              {(meta?.warnings || []).length > 0 && (
                <div>
                  <dt className="font-semibold" style={{ color: "var(--v2-warn)" }}>
                    {t("warnings")}
                  </dt>
                  <dd className="mt-0.5 space-y-0.5">
                    {meta.warnings.map((w, i) => (
                      <p key={i} className="th-text-secondary">
                        {w}
                      </p>
                    ))}
                  </dd>
                </div>
              )}

              <div className="flex items-center justify-between border-t th-border pt-2">
                <dt className="font-semibold th-text-muted">{t("rows")}</dt>
                <dd className="bi-v2-num th-text">
                  {new Intl.NumberFormat(intlLocale(locale)).format(meta?.row_count ?? 0)}
                </dd>
              </div>
            </dl>
          </div>,
          document.body,
        )}
    </>
  );
}
