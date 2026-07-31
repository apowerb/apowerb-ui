"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "use-intl";
import { ChevronUp, ChevronDown, ChevronsUpDown, Search } from "lucide-react";
import {
  colorForCategory,
  formatChartValue,
  humanizeAxisLabel,
  humanizeColumnName,
} from "@/lib/chart-tokens";
import AttachmentMenu from "./AttachmentMenu";

// Matches ISO-ish dates with optional time component: "2026-05-11",
// "2026-05-11T13:36:25", "2026-05-11T13:36:25.123Z", …
const ISO_DATE_RX = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?Z?)?$/;

// Status pill rendering is GATED on the column name, not on the cell
// value shape. Otherwise "CF100832" / "TILCO" / "SOCOMEC" (legitimate
// PO numbers and supplier names that happen to be in SCREAMING_CASE)
// were turned into pills along with the actual statuses, which broke
// text selection and confused the operator. The whitelist below maps
// to an order-tracking schema; extend it as new enum-style columns
// appear in other dashboards.
const STATUS_COLUMNS = new Set([
  "statutglobal",
  "statut",
  "status",
  "typeecart",
  "decision",
  "etat",
  "state",
]);

function isStatusColumn(columnName) {
  if (!columnName) return false;
  return STATUS_COLUMNS.has(String(columnName).toLowerCase());
}

// Render a single cell, picking the right formatter based on the value
// shape. Cheap detection — no schema, no column-type metadata, just
// pattern matching that's safe to apply to every cell.
function CellValue({ value, columnName }) {
  if (value == null || value === "") {
    return <span className="th-text-faint">—</span>;
  }
  const s = String(value);

  // ISO date → "lun. 12 mai" (or with hours when the column name suggests
  // a datetime — Backlog table has DateReceptionAR with HH:MM:SS that the
  // operator wants to keep visible).
  if (ISO_DATE_RX.test(s)) {
    const hasTime = /[T ]\d{2}:\d{2}/.test(s);
    // Ajouter Z si pas d'offset pour parser comme UTC (backend Python datetime naïf)
    const normalized = /Z$|[+-]\d{2}:\d{2}$/.test(s) ? s : s + "Z";
    const d = new Date(normalized);
    if (!Number.isNaN(d.getTime())) {
      const opts = hasTime
        ? {
            weekday: "short",
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Europe/Paris",
          }
        : { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Paris" };
      return new Intl.DateTimeFormat("fr-FR", opts).format(d);
    }
  }

  // Status code → coloured pill. Gated on the *column* being a known
  // status / enum column (StatutGlobal, TypeEcart, Decision, …) so that
  // arbitrary SCREAMING_CASE values in other columns (PO numbers,
  // supplier names) stay as plain selectable text. The colour comes
  // from STATUS_COLORS (semantic) when the value is documented,
  // otherwise from the categorical fallback so unknown enum values
  // still get a distinct hue.
  if (isStatusColumn(columnName)) {
    const color = colorForCategory(s, 0);
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap select-text"
        style={{
          background: `${color}1f`, // 12% opacity hex suffix
          color,
          border: `1px solid ${color}40`,
        }}
        title={s}
      >
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full flex-shrink-0"
          style={{ background: color }}
        />
        {humanizeAxisLabel(s)}
      </span>
    );
  }

  // Numbers → French formatting with thousands grouping. We only apply
  // this when the column name doesn't look like an identifier (e.g.
  // ``numerocommande`` should stay "CF100898" unformatted).
  if (typeof value === "number" && !columnLooksLikeIdentifier(columnName)) {
    return formatChartValue(value);
  }

  return s;
}

// Avoid formatting "12345" as "12 345" when the column is a code (PO
// number, supplier ID, …). Hand-pick the columns we know are codes.
const IDENTIFIER_COLUMN_HINTS = [
  "numero", "id", "code", "reference", "ref",
];

function columnLooksLikeIdentifier(name) {
  if (!name) return false;
  const lower = String(name).toLowerCase();
  return IDENTIFIER_COLUMN_HINTS.some((hint) => lower.includes(hint));
}

export default function DataTable({ data = [], columns = [], pageSize = 25, title, actionColumn }) {
  const t = useTranslations("DataTable");
  // When actionColumn is present, hide the raw source column from display
  const visibleColumns = actionColumn?.source_column
    ? columns.filter((c) => c !== actionColumn.source_column)
    : columns;

  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState(null); // "asc" | "desc" | null
  const [page, setPage] = useState(0);

  const filteredData = useMemo(() => {
    if (!search.trim()) return data;
    const term = search.toLowerCase();
    return data.filter((row) =>
      columns.some((col) => {
        const val = row[col];
        return val != null && String(val).toLowerCase().includes(term);
      })
    );
  }, [data, columns, search]);

  const sortedData = useMemo(() => {
    if (!sortCol || !sortDir) return filteredData;
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortCol];
      const bVal = b[sortCol];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filteredData, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pagedData = sortedData.slice(safePage * pageSize, (safePage + 1) * pageSize);
  const startRow = sortedData.length === 0 ? 0 : safePage * pageSize + 1;
  const endRow = Math.min((safePage + 1) * pageSize, sortedData.length);

  const handleSort = (col) => {
    if (sortCol !== col) {
      setSortCol(col);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortCol(null);
      setSortDir(null);
    }
    setPage(0);
  };

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setPage(0);
  };

  if (!columns.length) {
    return (
      <div className="glass-card rounded-xl p-8 flex items-center justify-center">
        <p className="text-sm th-text-faint">{t("noData")}</p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl flex flex-col h-full overflow-hidden">
      {/* Header: title + search */}
      <div className="flex items-center justify-between gap-4 px-4 py-3 border-b th-border">
        {title && <h3 className="text-sm font-semibold th-text truncate">{title}</h3>}
        <div className="relative flex-shrink-0 w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 th-text-faint" />
          <input
            type="text"
            value={search}
            onChange={handleSearchChange}
            placeholder={t("searchPlaceholder")}
            className="glass-input w-full pl-9 pr-3 py-2 text-sm rounded-lg"
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-x-auto overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 th-bg-surface backdrop-blur-sm">
            <tr>
              {visibleColumns.map((col) => (
                <th
                  key={col}
                  onClick={() => handleSort(col)}
                  className="text-left text-xs font-semibold th-text-secondary tracking-wide px-4 py-3 border-b th-border cursor-pointer select-none hover:th-bg-surface transition-colors"
                  title={col}
                >
                  <span className="inline-flex items-center gap-1">
                    {humanizeColumnName(col)}
                    {sortCol === col && sortDir === "asc" && <ChevronUp size={14} />}
                    {sortCol === col && sortDir === "desc" && <ChevronDown size={14} />}
                    {sortCol !== col && <ChevronsUpDown size={12} className="opacity-30" />}
                  </span>
                </th>
              ))}
              {actionColumn?.type === "webhook_attachment" && (
                <th className="text-left text-xs font-semibold th-text-secondary tracking-wide px-4 py-3 border-b th-border">
                  {t("actions")}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {pagedData.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length + (actionColumn ? 1 : 0)} className="px-4 py-12 text-center th-text-faint text-sm">
                  {t("noRows")}
                </td>
              </tr>
            ) : (
              pagedData.map((row, i) => (
                <tr
                  key={i}
                  className={i % 2 === 0 ? "bg-white/[0.02]" : "bg-white/[0.04]"}
                >
                  {visibleColumns.map((col) => (
                    <td
                      key={col}
                      className="px-4 py-2.5 th-text whitespace-nowrap select-text"
                    >
                      <CellValue value={row[col]} columnName={col} />
                    </td>
                  ))}
                  {actionColumn?.type === "webhook_attachment" && (
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {/* Key is unique per (position, log): React must never recycle a
                          row's AttachmentMenu for a different log. The index keeps it
                          unique even when two rows share a webhookLogId (one email can
                          cover several orders). AttachmentMenu's reset useEffect is the
                          matching safety net. */}
                      <AttachmentMenu
                        key={`r${i}-${row[actionColumn.source_column] ?? "none"}`}
                        webhookLogId={row[actionColumn.source_column] ?? null}
                      />
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 border-t th-border text-xs th-text-secondary">
        <span>
          {t("pagination", { start: startRow, end: endRow, total: sortedData.length })}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
            className="px-3 py-1.5 rounded-lg th-bg-surface hover:th-bg-surface-hover transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {t("previous")}
          </button>
          <span>
            {safePage + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={safePage >= totalPages - 1}
            className="px-3 py-1.5 rounded-lg th-bg-surface hover:th-bg-surface-hover transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {t("next")}
          </button>
        </div>
      </div>
    </div>
  );
}
