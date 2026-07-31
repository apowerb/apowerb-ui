"use client";

import { useState, useMemo, useCallback } from "react";
import { useTranslations } from "use-intl";
import { ChevronDown, ChevronRight, ChevronUp, Table2, Braces, Search, X, ArrowUpDown } from "lucide-react";

// --- JSON Tree Viewer ---
function JsonValue({ value, depth = 0 }) {
  const [collapsed, setCollapsed] = useState(depth > 2);

  if (value === null) return <span className="text-purple-400">null</span>;
  if (typeof value === "boolean")
    return <span className="text-purple-400">{String(value)}</span>;
  if (typeof value === "number")
    return <span className="text-blue-400">{value}</span>;
  if (typeof value === "string")
    return <span className="text-blue-300">&quot;{value}&quot;</span>;

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="th-text-faint">[]</span>;
    return (
      <span>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="inline th-text-faint hover:th-text-muted"
        >
          {collapsed ? <ChevronRight size={12} className="inline" /> : <ChevronDown size={12} className="inline" />}
          <span className="th-text-ghost text-[10px] ml-0.5">[{value.length}]</span>
        </button>
        {!collapsed && (
          <div className="ml-4 border-l th-border-secondary pl-2">
            {value.map((item, i) => (
              <div key={i}>
                <span className="th-text-ghost text-[10px] mr-1">{i}:</span>
                <JsonValue value={item} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </span>
    );
  }

  if (typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.length === 0) return <span className="th-text-faint">{"{}"}</span>;
    return (
      <span>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="inline th-text-faint hover:th-text-muted"
        >
          {collapsed ? <ChevronRight size={12} className="inline" /> : <ChevronDown size={12} className="inline" />}
          <span className="th-text-ghost text-[10px] ml-0.5">{"{"}...{"}"}</span>
        </button>
        {!collapsed && (
          <div className="ml-4 border-l th-border-secondary pl-2">
            {keys.map((key) => (
              <div key={key}>
                <span className="text-blue-300">{key}</span>
                <span className="th-text-ghost">: </span>
                <JsonValue value={value[key]} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </span>
    );
  }

  return <span className="th-text-muted">{String(value)}</span>;
}

// --- Cell that shows full value on click ---
function CellValue({ value }) {
  const t = useTranslations("StructuredOutput");
  const [expanded, setExpanded] = useState(false);
  const str =
    value === undefined || value === null
      ? ""
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);

  const isLong = str.length > 60;

  if (!isLong) return <span>{str}</span>;

  return (
    <span
      className="cursor-pointer group"
      onClick={(e) => {
        e.stopPropagation();
        setExpanded(!expanded);
      }}
      title={expanded ? t("clickToCollapse") : t("clickToExpand")}
    >
      {expanded ? (
        <span className="whitespace-pre-wrap break-all text-blue-200">{str}</span>
      ) : (
        <span className="th-text-secondary group-hover:text-blue-300 transition-colors">
          {str.slice(0, 60)}
          <span className="th-text-ghost">...</span>
        </span>
      )}
    </span>
  );
}

// --- Helper: stringify cell for search/sort ---
function cellToString(value) {
  if (value === undefined || value === null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

// --- DataTable for arrays of objects ---
function DataTable({ data }) {
  const t = useTranslations("StructuredOutput");
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("asc"); // "asc" | "desc"

  const isEmpty = !Array.isArray(data) || data.length === 0;

  // Extract columns from first few objects
  const columns = useMemo(() => {
    if (isEmpty) return [];
    const colSet = new Set();
    for (let i = 0; i < Math.min(data.length, 10); i++) {
      if (data[i] && typeof data[i] === "object" && !Array.isArray(data[i])) {
        Object.keys(data[i]).forEach((k) => colSet.add(k));
      }
    }
    return Array.from(colSet);
  }, [data, isEmpty]);

  // Filter rows by search
  const filtered = useMemo(() => {
    if (isEmpty) return [];
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter((row) =>
      columns.some((col) => cellToString(row[col]).toLowerCase().includes(q))
    );
  }, [data, columns, search, isEmpty]);

  // Sort filtered rows
  const sorted = useMemo(() => {
    if (isEmpty) return [];
    if (!sortCol) return filtered;
    return [...filtered].sort((a, b) => {
      const va = a[sortCol];
      const vb = b[sortCol];
      // null/undefined last
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      // numeric comparison
      if (typeof va === "number" && typeof vb === "number") {
        return sortDir === "asc" ? va - vb : vb - va;
      }
      // string comparison
      const sa = cellToString(va).toLowerCase();
      const sb = cellToString(vb).toLowerCase();
      const cmp = sa < sb ? -1 : sa > sb ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortCol, sortDir, isEmpty]);

  const handleSort = useCallback(
    (col) => {
      if (sortCol === col) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortCol(col);
        setSortDir("asc");
      }
    },
    [sortCol]
  );

  if (isEmpty || columns.length === 0) return null;

  const needsScroll = sorted.length > 10;

  return (
    <div className="my-2 rounded-lg border th-border overflow-hidden">
      {/* Toolbar: search + row count */}
      <div className="flex items-center gap-2 px-2 py-1.5 th-bg-surface border-b th-border">
        <div className="flex items-center gap-1.5 flex-1 min-w-0 th-bg-surface rounded px-2 py-1">
          <Search size={11} className="th-text-ghost shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("search")}
            className="bg-transparent text-[11px] th-text-secondary placeholder-white/30 outline-none flex-1 min-w-0"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="th-text-ghost hover:th-text-muted shrink-0"
            >
              <X size={11} />
            </button>
          )}
        </div>
        <span className="text-[10px] th-text-ghost shrink-0">
          {search
            ? t("rowsFiltered", { filtered: sorted.length, total: data.length })
            : t("rowsTotal", { count: data.length })}
        </span>
      </div>

      {/* Scrollable table area */}
      <div
        className={`overflow-auto custom-scrollbar ${needsScroll ? "max-h-[360px]" : ""}`}
      >
        <table className="min-w-full text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="th-bg-surface border-b th-border">
              {columns.map((col) => (
                <th
                  key={col}
                  onClick={() => handleSort(col)}
                  className="px-3 py-1.5 text-left font-medium th-text-muted whitespace-nowrap cursor-pointer hover:th-text hover:th-bg-surface transition-colors select-none"
                >
                  <span className="inline-flex items-center gap-1">
                    {col}
                    {sortCol === col ? (
                      sortDir === "asc" ? (
                        <ChevronUp size={11} className="text-blue-400" />
                      ) : (
                        <ChevronDown size={11} className="text-blue-400" />
                      )
                    ) : (
                      <ArrowUpDown size={10} className="th-text-ghost" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-4 text-center th-text-ghost text-[11px]"
                >
                  {t("noResultsFor", { search })}
                </td>
              </tr>
            ) : (
              sorted.map((row, i) => (
                <tr key={i} className="border-b th-border-secondary hover:th-bg-surface">
                  {columns.map((col) => (
                    <td key={col} className="px-3 py-1 th-text-secondary whitespace-nowrap">
                      <CellValue value={row[col]} />
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Main: detect and render structured content ---
export { DataTable };

export function JsonBlock({ content }) {
  const t = useTranslations("StructuredOutput");
  const [viewMode, setViewMode] = useState("tree"); // tree | table | raw

  const parsed = useMemo(() => {
    try {
      return JSON.parse(content);
    } catch {
      return null;
    }
  }, [content]);

  if (!parsed) return null;

  const isTableData =
    Array.isArray(parsed) &&
    parsed.length > 0 &&
    typeof parsed[0] === "object" &&
    !Array.isArray(parsed[0]);

  return (
    <div className="my-2 th-bg-surface rounded-lg border th-border overflow-hidden">
      {/* Header with view toggle */}
      <div className="flex items-center gap-2 px-3 py-1.5 th-bg-surface border-b th-border-secondary">
        <Braces size={12} className="th-text-faint" />
        <span className="text-[11px] th-text-faint flex-1">
          {Array.isArray(parsed)
            ? `${t("array")} [${parsed.length}]`
            : `${t("object")} {${Object.keys(parsed).length}}`}
        </span>
        <div className="flex gap-0.5">
          <button
            onClick={() => setViewMode("tree")}
            className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${
              viewMode === "tree" ? "th-bg-surface-hover th-text-secondary" : "th-text-ghost hover:th-text-muted"
            }`}
          >
            {t("tree")}
          </button>
          {isTableData && (
            <button
              onClick={() => setViewMode("table")}
              className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                viewMode === "table" ? "th-bg-surface-hover th-text-secondary" : "th-text-ghost hover:th-text-muted"
              }`}
            >
              {t("table")}
            </button>
          )}
          <button
            onClick={() => setViewMode("raw")}
            className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${
              viewMode === "raw" ? "th-bg-surface-hover th-text-secondary" : "th-text-ghost hover:th-text-muted"
            }`}
          >
            {t("raw")}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 max-h-[300px] overflow-auto custom-scrollbar text-xs font-mono">
        {viewMode === "tree" && <JsonValue value={parsed} />}
        {viewMode === "table" && isTableData && <DataTable data={parsed} />}
        {viewMode === "raw" && (
          <pre className="th-text-muted whitespace-pre-wrap">{JSON.stringify(parsed, null, 2)}</pre>
        )}
      </div>
    </div>
  );
}
