"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "use-intl";
import { ChevronDown, RotateCcw, X } from "lucide-react";
import { useDashboardData } from "./DashboardDataContext";
import { AGGREGATIONS, PERIOD_RE, PERIOD_UNITS, TIME_GRAINS } from "./filterValues";

const DEFAULT_PRESETS = ["13w", "26w", "52w", "all"];

const controlClass =
  "rounded-lg border px-2.5 py-1.5 text-xs th-text transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--border-focus)]";
const controlStyle = {
  background: "var(--glass-input-bg)",
  borderColor: "var(--glass-input-border)",
};

function SelectFilter({ spec, value, options, onChange, allLabel }) {
  return (
    <select
      aria-label={spec.label}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
      className={`${controlClass} min-w-32 max-w-56 cursor-pointer`}
      style={controlStyle}
    >
      <option value="">{allLabel}</option>
      {options.map((o) => (
        <option key={String(o)} value={String(o)}>
          {String(o)}
        </option>
      ))}
    </select>
  );
}

function MultiFilter({ spec, value, options, onChange, allLabel, countLabel }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = Array.isArray(value) ? value.map(String) : [];

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = (o) => {
    const key = String(o);
    const next = selected.includes(key) ? selected.filter((v) => v !== key) : [...selected, key];
    onChange(next.length ? next : null);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={spec.label}
        onClick={() => setOpen((v) => !v)}
        className={`${controlClass} inline-flex min-w-32 items-center justify-between gap-2`}
        style={controlStyle}
      >
        <span className="truncate">{selected.length ? countLabel(selected.length) : allLabel}</span>
        <ChevronDown size={12} aria-hidden="true" />
      </button>
      {open && (
        <div
          role="listbox"
          aria-multiselectable="true"
          aria-label={spec.label}
          className="absolute left-0 top-full z-50 mt-1 max-h-64 min-w-44 overflow-auto rounded-lg border p-1 shadow-xl"
          style={{ background: "var(--bg-dropdown)", borderColor: "var(--border-hover)" }}
        >
          {options.map((o) => (
            <label
              key={String(o)}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs th-text hover:bg-[var(--bg-surface-hover)]"
            >
              <input
                type="checkbox"
                checked={selected.includes(String(o))}
                onChange={() => toggle(o)}
              />
              {String(o)}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function ChoiceFilter({ spec, value, onChange, t }) {
  const grain = spec.type === "time_grain";
  const allowed = grain ? TIME_GRAINS : AGGREGATIONS;
  const choices = spec.presets?.length ? allowed.filter((c) => spec.presets.includes(c)) : allowed;
  return (
    <select
      aria-label={spec.label}
      value={value ?? (grain ? "" : "sum")}
      onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
      className={`${controlClass} min-w-32 cursor-pointer`}
      style={controlStyle}
    >
      {grain && <option value="">{t("grainNone")}</option>}
      {choices.map((c) => (
        <option key={c} value={c}>
          {t(grain ? `grain.${c}` : `aggregation.${c}`)}
        </option>
      ))}
    </select>
  );
}

function CustomPeriod({ value, onChange, t }) {
  const m = PERIOD_RE.exec(value || "");
  const [n, setN] = useState(m ? m[1] : "");
  const [unit, setUnit] = useState(m ? m[2] : "m");
  const commit = (nextN, nextUnit) => {
    if (PERIOD_RE.test(`${nextN}${nextUnit}`)) onChange(`${nextN}${nextUnit}`);
  };
  return (
    <div className="inline-flex items-center gap-1.5">
      <input
        type="number"
        min={1}
        max={999}
        aria-label={t.customN}
        value={n}
        onChange={(e) => {
          setN(e.target.value);
          commit(e.target.value, unit);
        }}
        className={`${controlClass} w-16`}
        style={controlStyle}
      />
      <select
        aria-label={t.unit}
        value={unit}
        onChange={(e) => {
          setUnit(e.target.value);
          commit(n, e.target.value);
        }}
        className={`${controlClass} cursor-pointer`}
        style={controlStyle}
      >
        {PERIOD_UNITS.map((u) => (
          <option key={u} value={u}>
            {t.unitLabel(u)}
          </option>
        ))}
      </select>
    </div>
  );
}

function PeriodFilter({ spec, value, onChange, t }) {
  const presets = spec.presets?.length ? spec.presets : DEFAULT_PRESETS;
  const current = value ?? "all";
  const radios = useRef([]);
  const isCustom = !presets.includes(current);
  const [customOpen, setCustomOpen] = useState(false);
  const showCustom = isCustom || customOpen;

  const onKeyDown = (e, idx) => {
    let next = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (idx + 1) % presets.length;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (idx - 1 + presets.length) % presets.length;
    if (next == null) return;
    e.preventDefault();
    onChange(presets[next]);
    radios.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={spec.label}
      className="inline-flex overflow-hidden rounded-lg border"
      style={controlStyle}
    >
      {presets.map((p, i) => {
        const checked = p === current;
        return (
          <button
            key={p}
            ref={(el) => {
              radios.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={t.periodLong(p)}
            title={t.periodLong(p)}
            tabIndex={checked ? 0 : -1}
            onClick={() => {
              setCustomOpen(false);
              onChange(p);
            }}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--border-focus)] ${
              checked
                ? "bg-[color-mix(in_srgb,var(--v2-accent)_22%,transparent)] th-text"
                : "th-text-muted hover:bg-[var(--bg-surface-hover)]"
            }`}
          >
            {t.periodShort(p)}
          </button>
        );
      })}
      <button
        type="button"
        role="radio"
        aria-checked={isCustom}
        aria-label={t.custom}
        title={t.custom}
        tabIndex={isCustom ? 0 : -1}
        onClick={() => setCustomOpen(true)}
        className={`px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--border-focus)] ${
          showCustom
            ? "bg-[color-mix(in_srgb,var(--v2-accent)_22%,transparent)] th-text"
            : "th-text-muted hover:bg-[var(--bg-surface-hover)]"
        }`}
      >
        {t.customShort}
      </button>
      {showCustom && (
        <span className="border-l px-1.5 py-0.5" style={{ borderColor: "var(--glass-input-border)" }}>
          <CustomPeriod value={isCustom ? current : null} onChange={onChange} t={t} />
        </span>
      )}
    </div>
  );
}

function DateRangeFilter({ spec, value, onChange }) {
  const from = value?.from ?? "";
  const to = value?.to ?? "";
  const set = (patch) => {
    const next = { from: from || null, to: to || null, ...patch };
    onChange(next.from || next.to ? next : null);
  };
  return (
    <div className="inline-flex items-center gap-1.5" role="group" aria-label={spec.label}>
      <input
        type="date"
        aria-label={`${spec.label} (début)`}
        value={from}
        onChange={(e) => set({ from: e.target.value || null })}
        className={controlClass}
        style={controlStyle}
      />
      <span className="th-text-faint" aria-hidden="true">–</span>
      <input
        type="date"
        aria-label={`${spec.label} (fin)`}
        value={to}
        onChange={(e) => set({ to: e.target.value || null })}
        className={controlClass}
        style={controlStyle}
      />
    </div>
  );
}

/**
 * One control per dashboard filter, the chips of the filters set by a click in a
 * visual, and the reset button.
 */
export default function FilterBar() {
  const t = useTranslations("DashboardV2");
  const { specFilters, values, crossed, data, error, setFilter, resetFilters, refresh } =
    useDashboardData();
  if (!specFilters.length && !error) return null;

  const UNIT_KEYS = { d: "Days", w: "Weeks", m: "Months", y: "Years" };
  const periodText = (p, size) => {
    if (p === "all") return t(size === "Short" ? "periodAll" : "periodAllLong");
    if (p === "ytd") return t(`periodYtd${size}`);
    if (p === "mtd") return t(`periodMtd${size}`);
    const m = PERIOD_RE.exec(p);
    if (!m) return p;
    return t(`period${UNIT_KEYS[m[2]]}${size}`, { n: Number(m[1]) });
  };
  const labels = {
    periodShort: (p) => periodText(p, "Short"),
    periodLong: (p) => periodText(p, "Long"),
    custom: t("periodCustom"),
    customShort: t("periodCustomShort"),
    customN: t("periodCustomN"),
    unit: t("periodUnit"),
    unitLabel: (u) => t(`periodUnits.${u}`),
  };

  const chips = specFilters.filter((f) => crossed.has(f.id) && values[f.id] != null);
  const dirty = specFilters.some(
    (f) => JSON.stringify(values[f.id] ?? null) !== JSON.stringify(f.default ?? null),
  );
  const valueText = (f) => {
    const resolved = data?.filters?.[f.id]?.label;
    if (resolved) return resolved;
    const v = values[f.id];
    return Array.isArray(v) ? v.join(", ") : String(v);
  };

  return (
    <div className="flex flex-col gap-2" role="region" aria-label={t("filters")} data-testid="v2-filterbar">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        {specFilters.map((f) => {
          const options = data?.filter_options?.[f.id] || [];
          const id = `v2-filter-${f.id}`;
          return (
            <div key={f.id} className="flex flex-col gap-1">
              <span id={id} className="text-[10px] font-semibold uppercase tracking-wider th-text-faint">
                {f.label}
              </span>
              {f.type === "relative_period" ? (
                <PeriodFilter spec={f} value={values[f.id]} onChange={(v) => setFilter(f.id, v)} t={labels} />
              ) : f.type === "time_grain" || f.type === "aggregation" ? (
                <ChoiceFilter spec={f} value={values[f.id]} onChange={(v) => setFilter(f.id, v)} t={t} />
              ) : f.type === "date_range" ? (
                <DateRangeFilter spec={f} value={values[f.id]} onChange={(v) => setFilter(f.id, v)} />
              ) : f.type === "multi" ? (
                <MultiFilter
                  spec={f}
                  value={values[f.id]}
                  options={options}
                  onChange={(v) => setFilter(f.id, v)}
                  allLabel={t("allOptions")}
                  countLabel={(n) => t("selectedCount", { n })}
                />
              ) : (
                <SelectFilter
                  spec={f}
                  value={values[f.id]}
                  options={options}
                  onChange={(v) => setFilter(f.id, v)}
                  allLabel={t("allOptions")}
                />
              )}
            </div>
          );
        })}
        <button
          type="button"
          onClick={resetFilters}
          disabled={!dirty}
          className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium th-text-muted transition-colors enabled:hover:th-text enabled:hover:bg-[var(--bg-surface-hover)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--border-focus)]"
          style={controlStyle}
        >
          <RotateCcw size={12} aria-hidden="true" />
          {t("reset")}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-lg border px-3 py-2 text-xs"
          style={{
            color: "var(--v2-bad)",
            borderColor: "color-mix(in srgb, var(--v2-bad) 40%, transparent)",
            background: "color-mix(in srgb, var(--v2-bad) 8%, transparent)",
          }}
        >
          <span className="min-w-0 flex-1 break-words">
            {t("loadFailed", { message: error.message || String(error) })}
          </span>
          <button type="button" onClick={refresh} className="shrink-0 font-semibold underline">
            {t("retry")}
          </button>
        </div>
      )}

      {chips.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={t("activeFilters")}>
          {chips.map((f) => (
            <li key={f.id}>
              <span
                data-testid="v2-filter-chip"
                className="inline-flex items-center gap-1 rounded-full border py-0.5 pl-2.5 pr-1 text-xs th-text"
                style={{
                  borderColor: "color-mix(in srgb, var(--v2-accent) 50%, transparent)",
                  background: "color-mix(in srgb, var(--v2-accent) 14%, transparent)",
                }}
              >
                <span className="th-text-muted">{f.label} :</span>
                <strong className="font-semibold">{valueText(f)}</strong>
                <button
                  type="button"
                  onClick={() => setFilter(f.id, f.default ?? null)}
                  aria-label={t("removeFilter", { label: f.label })}
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-[var(--bg-surface-hover)] focus-visible:outline-2 focus-visible:outline-[var(--border-focus)]"
                >
                  <X size={10} aria-hidden="true" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
