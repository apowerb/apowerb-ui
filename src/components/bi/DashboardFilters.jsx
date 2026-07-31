"use client";

import { useState } from "react";
import { useTranslations } from "use-intl";
import { Filter, ChevronDown, ChevronUp } from "lucide-react";

export default function DashboardFilters({ labels = [], onFilterChange, onClear }) {
  const t = useTranslations("DashboardFilters");
  const OPERATORS = [
    { label: t("opEquals"), value: "eq" },
    { label: t("opNotEquals"), value: "neq" },
    { label: t("opGreaterThan"), value: "gt" },
    { label: t("opLessThan"), value: "lt" },
    { label: t("opContains"), value: "contains" },
  ];
  const [expanded, setExpanded] = useState(false);
  const [filterField, setFilterField] = useState("");
  const [filterOp, setFilterOp] = useState("eq");
  const [filterValue, setFilterValue] = useState("");

  const handleApply = () => {
    if (!filterField || !filterValue.trim()) return;
    onFilterChange?.({
      filter_field: filterField,
      filter_op: filterOp,
      filter_value: filterValue.trim(),
    });
  };

  const handleClear = () => {
    setFilterField("");
    setFilterOp("eq");
    setFilterValue("");
    onClear?.();
  };

  return (
    <div className="glass-card rounded-xl border th-border">
      {/* Toggle button */}
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-3 hover:th-bg-surface transition-colors rounded-xl"
      >
        <div className="flex items-center gap-2 th-text-secondary text-sm font-medium">
          <Filter size={16} />
          <span>{t("filters")}</span>
        </div>
        {expanded ? (
          <ChevronUp size={16} className="th-text-secondary" />
        ) : (
          <ChevronDown size={16} className="th-text-secondary" />
        )}
      </button>

      {/* Filter controls */}
      {expanded && (
        <div className="px-4 pb-4 pt-1">
          <div className="flex flex-wrap items-end gap-3">
            {/* Field */}
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs font-medium th-text-secondary mb-1">{t("field")}</label>
              <select
                value={filterField}
                onChange={(e) => setFilterField(e.target.value)}
                className="glass-input w-full px-3 py-2 rounded-lg text-sm"
              >
                <option value="">{t("selectField")}</option>
                {labels.map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Operator */}
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs font-medium th-text-secondary mb-1">{t("operator")}</label>
              <select
                value={filterOp}
                onChange={(e) => setFilterOp(e.target.value)}
                className="glass-input w-full px-3 py-2 rounded-lg text-sm"
              >
                {OPERATORS.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Value */}
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs font-medium th-text-secondary mb-1">{t("value")}</label>
              <input
                type="text"
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                placeholder={t("valuePlaceholder")}
                className="glass-input w-full px-3 py-2 rounded-lg text-sm"
              />
            </div>

            {/* Apply */}
            <button
              onClick={handleApply}
              disabled={!filterField || !filterValue.trim()}
              className="btn-brand px-4 py-2 text-white text-sm rounded-lg font-bold"
            >
              {t("apply")}
            </button>

            {/* Clear */}
            <button
              onClick={handleClear}
              className="px-4 py-2 th-bg-surface border th-border hover:th-bg-surface-hover th-text-secondary text-sm rounded-lg font-medium transition-colors"
            >
              {t("clear")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
