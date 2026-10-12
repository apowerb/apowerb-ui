"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "use-intl";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useOptionalDashboardData } from "../DashboardDataContext";
import { formatFull, isIsoDate, resolveColor, shortDate } from "../format";
import { EmptyState, useFormats } from "./shared";

const TOTAL_LABEL = /^(toutes?|tous|all|total)$/i;

export function isTotalRow(row, xKey) {
  return row?._total === true || (xKey != null && TOTAL_LABEL.test(String(row?.[xKey] ?? "")));
}

function cellText(value, kind) {
  if (value == null || value === "") return "—";
  if (typeof value === "number") return formatFull(value, kind);
  if (isIsoDate(value)) return shortDate(value);
  return String(value);
}

function compareValues(a, b) {
  const na = typeof a === "number" ? a : Number.NaN;
  const nb = typeof b === "number" ? b : Number.NaN;
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  if (a == null) return 1;
  if (b == null) return -1;
  return String(a).localeCompare(String(b), "fr", { numeric: true });
}

/**
 * Sortable table. Cells coloured by `_status_<col>`, the `_highlight` row set
 * apart, the "all" row pinned in the foot. A click on a row applies the
 * visual's `click_filters` (the same click again clears them).
 */
export default function TableVisual({ visual, result }) {
  const t = useTranslations("DashboardV2");
  const ctx = useOptionalDashboardData();
  const formats = useFormats(visual);
  const rows = useMemo(() => result?.rows || [], [result]);
  const [sort, setSort] = useState({ key: null, dir: "desc" });

  const columns = useMemo(() => {
    if (visual.columns?.length) {
      return visual.columns.map((c) => ({ ...c, label: c.label || c.key }));
    }
    const first = rows[0] || {};
    return Object.keys(first)
      .filter((k) => !k.startsWith("_"))
      .map((k) => ({ key: k, label: k }));
  }, [visual.columns, rows]);

  const clickEntries = Object.entries(visual.click_filters || {});
  const clickable = Boolean(ctx) && clickEntries.length > 0;
  const xKey = visual.x || columns[0]?.key;

  const { body, foot } = useMemo(() => {
    const total = rows.filter((r) => isTotalRow(r, xKey));
    const data = rows.filter((r) => !isTotalRow(r, xKey));
    if (sort.key) {
      data.sort((a, b) => {
        const c = compareValues(a[sort.key], b[sort.key]);
        return sort.dir === "asc" ? c : -c;
      });
    }
    return { body: data, foot: total };
  }, [rows, sort, xKey]);

  if (rows.length === 0) return <EmptyState>—</EmptyState>;

  const activeValue = (filterId) => {
    const v = ctx?.values?.[filterId];
    return Array.isArray(v) ? (v.length === 1 ? String(v[0]) : null) : v == null ? null : String(v);
  };

  const onRow = (row, total) => {
    if (!clickable) return;
    for (const [filterId, field] of clickEntries) {
      if (total) ctx.setFilter(filterId, null);
      else ctx.crossFilter(filterId, row[field] ?? row[xKey]);
    }
  };

  const toggleSort = (key) =>
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" },
    );

  const renderRow = (row, i, total = false) => {
    const selected =
      clickable &&
      !total &&
      clickEntries.some(([fid, field]) => activeValue(fid) === String(row[field] ?? row[xKey]));
    const highlighted = row._highlight === true || selected;
    return (
      <tr
        key={`${total ? "t" : "r"}-${i}`}
        data-highlight={highlighted ? "true" : undefined}
        data-total={total ? "true" : undefined}
        tabIndex={clickable ? 0 : undefined}
        data-selected={selected ? "true" : undefined}
        title={clickable ? `${t("filterBy")} ${String(row[xKey] ?? "")}` : undefined}
        onClick={clickable ? () => onRow(row, total) : undefined}
        onKeyDown={
          clickable
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onRow(row, total);
                }
              }
            : undefined
        }
        className={[
          "border-b th-border-secondary transition-colors",
          clickable
            ? "cursor-pointer hover:bg-[var(--bg-surface-hover)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--border-focus)]"
            : "",
          highlighted ? "bg-[color-mix(in_srgb,var(--v2-accent)_14%,transparent)] font-semibold" : "",
          total ? "font-semibold th-text bg-[var(--bg-surface)]" : "",
        ].join(" ")}
      >
        {columns.map((c, ci) => {
          const status = row[`_status_${c.key}`];
          const numeric = typeof row[c.key] === "number";
          return (
            <td
              key={c.key}
              className={`px-3 py-2.5 ${numeric ? "bi-v2-num text-right" : "text-left"} ${
                ci === 0 ? "th-text" : "th-text-secondary"
              }`}
              style={status ? { color: resolveColor(status) } : undefined}
            >
              {cellText(row[c.key], c.format || formats.kind(c.key))}
            </td>
          );
        })}
      </tr>
    );
  };

  return (
    <div className="max-h-full min-h-0 overflow-auto rounded-md" data-testid="v2-table">
      <table className="w-full border-collapse text-xs">
        <thead className="sticky top-0 z-10 bg-[var(--bg-dropdown)]">
          <tr className="border-b th-border">
            {columns.map((c, ci) => {
              const sorted = sort.key === c.key;
              const numericCol = typeof rows.find((r) => r[c.key] != null)?.[c.key] === "number";
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={sorted ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                  className={`px-3 py-2 font-semibold th-text-muted ${
                    ci > 0 && numericCol ? "text-right" : "text-left"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(c.key)}
                    className="inline-flex items-center gap-1 rounded hover:th-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
                    title={t("sortBy", { column: c.label })}
                  >
                    {c.label}
                    {sorted &&
                      (sort.dir === "asc" ? (
                        <ArrowUp size={11} aria-hidden="true" />
                      ) : (
                        <ArrowDown size={11} aria-hidden="true" />
                      ))}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>{body.map((r, i) => renderRow(r, i))}</tbody>
        {foot.length > 0 && (
          <tfoot className="sticky bottom-0 bg-[var(--bg-dropdown)]">
            {foot.map((r, i) => renderRow(r, i, true))}
          </tfoot>
        )}
      </table>
    </div>
  );
}
